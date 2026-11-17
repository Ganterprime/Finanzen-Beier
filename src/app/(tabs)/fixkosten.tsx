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
  const { members } = useHousehold();
  const { items, loading } = useFixedCosts();
  const active = items.filter((f) => f.active);
  const monthly = (list: FixedCost[]) => list.reduce((s, f) => s + monthlyCents(f.amount_cents, f.frequency), 0);
  const out = monthly(active.filter((f) => f.type === 'ausgabe' && !f.savings_goal_id));
  const saving = monthly(active.filter((f) => f.type === 'ausgabe' && f.savings_goal_id));
  const income = monthly(active.filter((f) => f.type === 'einnahme'));

  // Sparraten (zahlen auf ein Sparziel ein) getrennt von den Kosten zeigen
  const expenses = items.filter((f) => f.type === 'ausgabe' && !f.savings_goal_id);
  const savings = items.filter((f) => f.type === 'ausgabe' && f.savings_goal_id);
  const incomes = items.filter((f) => f.type === 'einnahme');
  const shared = expenses.filter((f) => !f.person_id || !members.some((m) => m.user_id === f.person_id));

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
            <Text style={[styles.mid, { color: t.text }]}>{income ? formatEuro(income - out - saving) : '–'}</Text>
          </View>
        </View>
        {saving > 0 && <Muted>Sparraten: {formatEuro(saving)} pro Monat (bei „Frei verfügbar“ schon abgezogen).</Muted>}
      </Card>

      <Button label="Fixkosten hinzufügen" onPress={() => router.push('/fixkosten-form')} />

      {members.length > 1 ? (
        <>
          <Section title="Gemeinsame Kosten" items={shared} loading={loading} />
          {members.map((m) => (
            <Section
              key={m.user_id}
              title={`${m.display_name}: eigene Kosten`}
              items={expenses.filter((f) => f.person_id === m.user_id)}
              loading={loading}
            />
          ))}
        </>
      ) : (
        <Section title="Ausgaben" items={expenses} loading={loading} />
      )}
      {savings.length > 0 && <Section title="Sparen" items={savings} loading={loading} />}
      <Section title="Feste Einnahmen" items={incomes} loading={loading} />
      <Muted>
        Fixkosten werden am Fälligkeitstag automatisch als Buchung eingetragen. Sparraten zahlen dabei direkt in ihren
        Spartopf ein. Weicht ein Betrag einmal ab, passe
        einfach diese eine Buchung an.
      </Muted>
    </Screen>
  );
}

function Section({ title, items, loading }: { title: string; items: FixedCost[]; loading: boolean }) {
  const t = useTheme();
  const { category, memberName } = useHousehold();
  const perMonth = items.filter((f) => f.active).reduce((s, f) => s + monthlyCents(f.amount_cents, f.frequency), 0);
  return (
    <Card>
      <View style={styles.head}>
        <Title>{title}</Title>
        {items.length > 0 && <Muted>{formatEuro(perMonth)}/Monat</Muted>}
      </View>
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
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
