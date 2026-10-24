import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { FREQUENCY_LABEL, formatEuro, formatPercent, monthlyCents } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { FixedCost } from '@/lib/types';
import { useFixedCosts } from '@/lib/useFixedCosts';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function FixedCosts() {
  const t = useTheme();
  const { items, loading } = useFixedCosts();
  const active = items.filter((f) => f.active);
  const monthly = (type: 'ausgabe' | 'einnahme') =>
    active.filter((f) => f.type === type).reduce((s, f) => s + monthlyCents(f.amount_cents, f.frequency), 0);
  const out = monthly('ausgabe');
  const income = monthly('einnahme');

  const expenses = items.filter((f) => f.type === 'ausgabe');
  const incomes = items.filter((f) => f.type === 'einnahme');

  return (
    <Screen>
      <Card>
        <Muted>Fixkosten pro Monat</Muted>
        <Text style={[styles.big, { color: t.expense }]}>{formatEuro(out)}</Text>
        <View style={styles.split}>
          <View style={{ flex: 1 }}>
            <Muted>Feste Einnahmen</Muted>
            <Text style={[styles.mid, { color: t.income }]}>{formatEuro(income)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Muted>Fixkostenquote</Muted>
            <Text style={[styles.mid, { color: t.text }]}>{income ? formatPercent(out / income) : '–'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Muted>Frei verfügbar</Muted>
            <Text style={[styles.mid, { color: t.text }]}>{income ? formatEuro(income - out) : '–'}</Text>
          </View>
        </View>
      </Card>

      <Button label="Fixkosten hinzufügen" onPress={() => router.push('/fixkosten-form')} />

      <Section title="Ausgaben" items={expenses} loading={loading} />
      <Section title="Feste Einnahmen" items={incomes} loading={loading} />
      <Muted>
        Fixkosten werden am Fälligkeitstag automatisch als Buchung eingetragen. Weicht ein Betrag einmal ab, passe
        einfach diese eine Buchung an.
      </Muted>
    </Screen>
  );
}

function Section({ title, items, loading }: { title: string; items: FixedCost[]; loading: boolean }) {
  const t = useTheme();
  const { category, memberName } = useHousehold();
  return (
    <Card>
      <Title>{title}</Title>
      {!loading && items.length === 0 && <Muted>Noch keine Einträge.</Muted>}
      {items.map((f) => {
        const c = category(f.category_id);
        return (
          <Pressable
            key={f.id}
            onPress={() => router.push({ pathname: '/fixkosten-form', params: { id: f.id } })}
            style={[styles.row, { opacity: f.active ? 1 : 0.45 }]}
          >
            <Text style={{ fontSize: 20 }}>{c?.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 15, fontWeight: '500' }}>{f.name}</Text>
              <Muted>
                {FREQUENCY_LABEL[f.frequency]} am {f.due_day}. · {memberName(f.person_id)}
                {f.active ? '' : ' · pausiert'}
              </Muted>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{formatEuro(f.amount_cents)}</Text>
              {f.frequency !== 'monatlich' && (
                <Muted>{formatEuro(monthlyCents(f.amount_cents, f.frequency))}/Monat</Muted>
              )}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  mid: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
