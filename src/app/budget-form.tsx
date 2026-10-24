import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { CategoryGrid } from '@/components/CategoryGrid';
import { Body, Button, Field, Muted, Screen, Segmented } from '@/components/ui';
import { centsToInput, parseAmount } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { Budget } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';

/** 'jeden' legt beim Neuanlegen ein Budget pro Person an */
type Owner = 'jeden' | 'gemeinsam' | string;

export default function BudgetForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { household, members, categories } = useHousehold();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💶');
  const [amount, setAmount] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [owner, setOwner] = useState<Owner>(members.length > 1 ? 'jeden' : 'gemeinsam');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'ausgabe' && (!c.archived || categoryIds.includes(c.id))),
    [categories, categoryIds],
  );

  useEffect(() => {
    if (!id) return;
    supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const b = data as Budget | null;
        if (!b) return;
        setName(b.name);
        setIcon(b.icon);
        setAmount(centsToInput(b.amount_cents));
        setCategoryIds(b.category_ids);
        setOwner(b.person_id ?? 'gemeinsam');
      });
  }, [id]);

  const toggle = (cid: string) =>
    setCategoryIds((ids) => (ids.includes(cid) ? ids.filter((x) => x !== cid) : [...ids, cid]));

  const save = async () => {
    const cents = parseAmount(amount);
    if (!name.trim()) return setError('Bitte einen Namen eingeben, z. B. Freizeit.');
    if (!cents) return setError('Bitte einen gültigen Betrag pro Monat eingeben.');
    setBusy(true);
    setError(null);
    const base = {
      household_id: household!.id,
      name: name.trim(),
      icon: icon.trim() || '💶',
      amount_cents: cents,
      category_ids: categoryIds,
    };
    const personIds: (string | null)[] =
      owner === 'jeden' ? members.map((m) => m.user_id) : [owner === 'gemeinsam' ? null : owner];
    const { error } = id
      ? await supabase.from('budgets').update({ ...base, person_id: personIds[0] }).eq('id', id)
      : await supabase.from('budgets').insert(personIds.map((person_id) => ({ ...base, person_id })));
    setBusy(false);
    if (error) setError(error.message);
    else router.back();
  };

  const remove = () => {
    const doDelete = async () => {
      await supabase.from('budgets').delete().eq('id', id!);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Budget löschen? Deine Buchungen bleiben erhalten.')) doDelete();
    } else {
      Alert.alert('Budget löschen?', 'Deine Buchungen bleiben erhalten.', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const ownerOptions: { value: Owner; label: string }[] = [
    ...(!id && members.length > 1 ? [{ value: 'jeden', label: 'Jeder' }] : []),
    { value: 'gemeinsam', label: 'Gemeinsam' },
    ...members.map((m) => ({ value: m.user_id, label: m.display_name })),
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Budget bearbeiten' : 'Neues Budget' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Freizeit" />
      <Field label="Symbol" value={icon} onChangeText={setIcon} />
      <Field
        label="Betrag pro Monat (€)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      <Muted>Für wen</Muted>
      <Segmented options={ownerOptions} value={owner} onChange={setOwner} />
      {owner === 'jeden' && <Muted>Jeder bekommt ein eigenes Budget mit diesem Betrag.</Muted>}
      <Muted>
        Welche Kategorien zählen? {categoryIds.length === 0 ? 'Keine gewählt: alle Ausgaben zählen.' : `${categoryIds.length} gewählt.`}
      </Muted>
      <CategoryGrid categories={expenseCategories} selected={categoryIds} onSelect={toggle} />
      {error && <Body style={{ color: t.expense }}>{error}</Body>}
      <Button label="Speichern" onPress={save} loading={busy} />
      {id && <Button label="Löschen" variant="danger" onPress={remove} />}
    </Screen>
  );
}
