import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryGrid } from '@/components/CategoryGrid';
import { Body, Button, Field, Muted, Screen, Segmented } from '@/components/ui';
import { daysAgo, parseGermanDate } from '@/lib/dates';
import { centsToInput, formatDate, parseAmount } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useSavingsGoals } from '@/lib/useSavingsGoals';
import type { EntryType, Transaction } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useSession } from '@/providers/SessionProvider';

export default function BookingForm() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const { household, members, categories } = useHousehold();

  const [type, setType] = useState<EntryType>('ausgabe');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(formatDate(daysAgo(0)));
  const [personId, setPersonId] = useState<string | null>(session?.user.id ?? null);
  const [note, setNote] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const { goals } = useSavingsGoals();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const tx = data as Transaction | null;
        if (!tx) return;
        setType(tx.type);
        setAmount(centsToInput(tx.amount_cents));
        setCategoryId(tx.category_id);
        setDate(formatDate(tx.booked_on));
        setPersonId(tx.person_id);
        setNote(tx.note ?? '');
        setGoalId(tx.savings_goal_id);
      });
  }, [id]);

  const visible = useMemo(
    () => categories.filter((c) => c.type === type && (!c.archived || c.id === categoryId)),
    [categories, type, categoryId],
  );

  const save = async () => {
    const cents = parseAmount(amount);
    const bookedOn = parseGermanDate(date);
    if (!cents) return setError('Bitte einen gültigen Betrag eingeben, z. B. 12,50.');
    if (!categoryId) return setError('Bitte eine Kategorie wählen.');
    if (!bookedOn) return setError('Bitte ein gültiges Datum eingeben (TT.MM.JJJJ).');
    setBusy(true);
    setError(null);
    const row = {
      household_id: household!.id,
      type,
      amount_cents: cents,
      category_id: categoryId,
      booked_on: bookedOn,
      person_id: personId,
      note: note.trim() || null,
      savings_goal_id: goalId,
    };
    const { error } = id
      ? await supabase.from('transactions').update(row).eq('id', id)
      : await supabase.from('transactions').insert(row);
    setBusy(false);
    if (error) setError(error.message);
    else router.back();
  };

  const remove = () => {
    const doDelete = async () => {
      await supabase.from('transactions').delete().eq('id', id!);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Buchung löschen?')) doDelete();
    } else {
      Alert.alert('Buchung löschen?', undefined, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Buchung bearbeiten' : 'Neue Buchung' }} />
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

      <View style={[styles.amountBox, { borderColor: t.border, backgroundColor: t.card }]}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0,00"
          placeholderTextColor={t.muted}
          keyboardType="decimal-pad"
          autoFocus={!id}
          style={[styles.amount, { color: type === 'ausgabe' ? t.expense : t.income }]}
        />
        <Text style={[styles.currency, { color: t.muted }]}>€</Text>
      </View>

      <Muted>Kategorie</Muted>
      <CategoryGrid categories={visible} selected={categoryId} onSelect={setCategoryId} />

      <Field label="Datum" value={date} onChangeText={setDate} placeholder="TT.MM.JJJJ" />
      <View style={styles.chips}>
        {[
          ['Heute', 0],
          ['Gestern', 1],
        ].map(([label, n]) => (
          <Pressable
            key={label}
            onPress={() => setDate(formatDate(daysAgo(n as number)))}
            style={[styles.chip, { backgroundColor: t.chip }]}
          >
            <Text style={{ color: t.text }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Muted>Wer</Muted>
      <Segmented
        options={[
          ...members.map((m) => ({ value: m.user_id as string | null, label: m.display_name })),
          { value: null, label: 'Gemeinsam' },
        ]}
        value={personId}
        onChange={setPersonId}
      />

      <Field label="Notiz (optional)" value={note} onChangeText={setNote} placeholder="z. B. Wocheneinkauf" />

      {goals.some((g) => !g.archived || g.id === goalId) && (
        <>
          <Muted>{type === 'ausgabe' ? 'Einzahlung auf Sparziel (optional)' : 'Entnahme aus Sparziel (optional)'}</Muted>
          <View style={styles.chips}>
            {[{ id: null as string | null, icon: '', name: 'Keins' }, ...goals.filter((g) => !g.archived || g.id === goalId)].map(
              (g) => {
                const active = g.id === goalId;
                return (
                  <Pressable
                    key={g.id ?? 'none'}
                    onPress={() => setGoalId(g.id)}
                    style={[styles.chip, { backgroundColor: active ? t.primary : t.chip }]}
                  >
                    <Text style={{ color: active ? '#fff' : t.text }}>
                      {g.icon ? `${g.icon} ` : ''}
                      {g.name}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>
        </>
      )}

      {error && <Body style={{ color: t.expense }}>{error}</Body>}
      <Button label="Speichern" onPress={save} loading={busy} />
      {id && <Button label="Löschen" variant="danger" onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  amount: { flex: 1, minWidth: 0, outlineWidth: 0, fontSize: 36, fontWeight: '700', paddingVertical: 10 },
  currency: { fontSize: 28, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
