import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Field, Muted, Screen, Segmented } from '@/components/ui';
import { parseGermanDate } from '@/lib/dates';
import { centsToInput, formatDate, parseAmount } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { SavingsGoal } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';

const COLORS = ['#3FA37A', '#2E9CB8', '#4F7CAC', '#9B6BB5', '#E0A030', '#D2694B', '#D25B7A'];

export default function SavingsGoalForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { household, members } = useHousehold();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState(COLORS[0]);
  const [target, setTarget] = useState('');
  const [start, setStart] = useState('');
  const [date, setDate] = useState('');
  const [personId, setPersonId] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('savings_goals')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const g = data as SavingsGoal | null;
        if (!g) return;
        setName(g.name);
        setIcon(g.icon);
        setColor(g.color);
        setTarget(centsToInput(g.target_cents));
        setStart(g.start_cents ? centsToInput(g.start_cents) : '');
        setDate(g.target_date ? formatDate(g.target_date) : '');
        setPersonId(g.person_id);
        setArchived(g.archived);
      });
  }, [id]);

  const save = async () => {
    const targetCents = parseAmount(target);
    const startCents = start.trim() ? parseAmount(start) : 0;
    const targetDate = date.trim() ? parseGermanDate(date) : null;
    if (!name.trim()) return setError('Bitte einen Namen eingeben, z. B. Urlaub 2027.');
    if (!targetCents) return setError('Bitte einen gültigen Zielbetrag eingeben.');
    if (startCents == null) return setError('Bitte einen gültigen Betrag für „schon gespart“ eingeben.');
    if (date.trim() && !targetDate) return setError('Bitte ein gültiges Zieldatum eingeben (TT.MM.JJJJ).');
    setBusy(true);
    setError(null);
    const row = {
      household_id: household!.id,
      name: name.trim(),
      icon: icon.trim() || '🎯',
      color,
      target_cents: targetCents,
      start_cents: startCents,
      target_date: targetDate,
      person_id: personId,
      archived,
    };
    const { error } = id
      ? await supabase.from('savings_goals').update(row).eq('id', id)
      : await supabase.from('savings_goals').insert(row);
    setBusy(false);
    if (error) setError(error.message);
    else router.back();
  };

  const remove = () => {
    const doDelete = async () => {
      await supabase.from('savings_goals').delete().eq('id', id!);
      router.back();
    };
    const text = 'Die Buchungen bleiben erhalten, sind dann aber keinem Ziel mehr zugeordnet.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Sparziel löschen? ${text}`)) doDelete();
    } else {
      Alert.alert('Sparziel löschen?', text, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Sparziel bearbeiten' : 'Neues Sparziel' }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 70 }}>
          <Field label="Symbol" value={icon} onChangeText={setIcon} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Urlaub 2027" />
        </View>
      </View>
      <View style={styles.colors}>
        {COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? t.text : 'transparent' }]}
          />
        ))}
      </View>
      <Field label="Zielbetrag (€)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0,00" />
      <Field label="Zieldatum (optional)" value={date} onChangeText={setDate} placeholder="TT.MM.JJJJ" />
      <Field
        label="Schon gespart (optional)"
        value={start}
        onChangeText={setStart}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      <Muted>Für wen</Muted>
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
          <Body>Abgeschlossen</Body>
          <Switch value={archived} onValueChange={setArchived} />
        </View>
      )}
      {error && <Body style={{ color: t.expense }}>{error}</Body>}
      <Button label="Speichern" onPress={save} loading={busy} />
      {id && <Button label="Löschen" variant="danger" onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
});
