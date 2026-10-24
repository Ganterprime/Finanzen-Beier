import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { CategoryGrid } from '@/components/CategoryGrid';
import { Body, Button, Field, Muted, Screen, Segmented } from '@/components/ui';
import { parseGermanDate } from '@/lib/dates';
import { centsToInput, formatDate, parseAmount, toISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { EntryType, FixedCost, Frequency } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function FixedCostForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { household, members, categories } = useHousehold();

  const [type, setType] = useState<EntryType>('ausgabe');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('monatlich');
  const [dueDay, setDueDay] = useState('1');
  const [start, setStart] = useState(formatDate(toISODate(new Date())));
  const [end, setEnd] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('fixed_costs')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const f = data as FixedCost | null;
        if (!f) return;
        setType(f.type);
        setName(f.name);
        setAmount(centsToInput(f.amount_cents));
        setCategoryId(f.category_id);
        setFrequency(f.frequency);
        setDueDay(String(f.due_day));
        setStart(formatDate(f.start_date));
        setEnd(f.end_date ? formatDate(f.end_date) : '');
        setPersonId(f.person_id);
        setActive(f.active);
      });
  }, [id]);

  // Fixkosten-Kategorien zuerst
  const visible = useMemo(
    () =>
      categories
        .filter((c) => c.type === type && (!c.archived || c.id === categoryId))
        .sort((a, b) => Number(b.is_fixed_cost) - Number(a.is_fixed_cost) || a.sort_order - b.sort_order),
    [categories, type, categoryId],
  );

  const save = async () => {
    const cents = parseAmount(amount);
    const day = Number(dueDay);
    const startDate = parseGermanDate(start);
    const endDate = end.trim() ? parseGermanDate(end) : null;
    if (!name.trim()) return setError('Bitte einen Namen eingeben, z. B. Miete.');
    if (!cents) return setError('Bitte einen gültigen Betrag eingeben.');
    if (!categoryId) return setError('Bitte eine Kategorie wählen.');
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError('Fälligkeitstag muss zwischen 1 und 31 liegen.');
    if (!startDate) return setError('Bitte ein gültiges Startdatum eingeben.');
    if (end.trim() && !endDate) return setError('Bitte ein gültiges Enddatum eingeben oder das Feld leeren.');
    setBusy(true);
    setError(null);
    const row = {
      household_id: household!.id,
      type,
      name: name.trim(),
      amount_cents: cents,
      category_id: categoryId,
      frequency,
      due_day: day,
      start_date: startDate,
      end_date: endDate,
      person_id: personId,
      active,
    };
    const { error } = id
      ? await supabase.from('fixed_costs').update(row).eq('id', id)
      : await supabase.from('fixed_costs').insert(row);
    setBusy(false);
    if (error) setError(error.message);
    else router.back();
  };

  const remove = () => {
    const doDelete = async () => {
      await supabase.from('fixed_costs').delete().eq('id', id!);
      router.back();
    };
    const text = 'Bereits gebuchte Beträge bleiben in den Buchungen erhalten.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Fixkosten löschen? ${text}`)) doDelete();
    } else {
      Alert.alert('Fixkosten löschen?', text, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Fixkosten bearbeiten' : 'Neue Fixkosten' }} />
      <Segmented
        options={[
          { value: 'ausgabe', label: 'Ausgabe' },
          { value: 'einnahme', label: 'Einnahme' },
        ]}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(null);
        }}
      />
      <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Miete, Netflix, Gehalt" />
      <Field label="Betrag (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0,00" />
      <Muted>Intervall</Muted>
      <Segmented
        options={[
          { value: 'monatlich', label: 'Monat' },
          { value: 'quartalsweise', label: 'Quartal' },
          { value: 'halbjaehrlich', label: 'Halbjahr' },
          { value: 'jaehrlich', label: 'Jahr' },
        ]}
        value={frequency}
        onChange={setFrequency}
      />
      <Field label="Fällig am Tag" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
      <Field label="Ab (erste Fälligkeit im Monat dieses Datums)" value={start} onChangeText={setStart} />
      <Field label="Bis (optional)" value={end} onChangeText={setEnd} placeholder="TT.MM.JJJJ" />
      <Muted>Kategorie</Muted>
      <CategoryGrid categories={visible} selected={categoryId} onSelect={setCategoryId} />
      <Muted>Wer zahlt</Muted>
      <Segmented
        options={[
          { value: null as string | null, label: 'Gemeinsam' },
          ...members.map((m) => ({ value: m.user_id as string | null, label: m.display_name })),
        ]}
        value={personId}
        onChange={setPersonId}
      />
      {id && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body>Aktiv</Body>
          <Switch value={active} onValueChange={setActive} />
        </View>
      )}
      {error && <Body style={{ color: t.expense }}>{error}</Body>}
      <Button label="Speichern" onPress={save} loading={busy} />
      {id && <Button label="Löschen" variant="danger" onPress={remove} />}
    </Screen>
  );
}
