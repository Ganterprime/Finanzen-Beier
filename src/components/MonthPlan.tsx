import { StyleSheet, Text, View } from 'react-native';

import { Card, Muted, Title } from '@/components/ui';
import { formatEuro, monthlyCents } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Budget, FixedCost } from '@/lib/types';
import { TRANSFER_CATEGORY } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

/**
 * Monatsrechnung wie in der Excel: pro Person Gehalt minus Überweisung aufs
 * Gemeinschaftskonto, eigene Fixkosten, Sparen und variable Budgets (z. B. Tanken).
 * Budgets ohne Kategorie (z. B. Spielgeld) kommen aus dem frei Verfügbaren und
 * werden deshalb nicht abgezogen.
 */
export function MonthPlan({ fixedCosts, budgets }: { fixedCosts: FixedCost[]; budgets: Budget[] }) {
  const t = useTheme();
  const { members, category } = useHousehold();
  const active = fixedCosts.filter((f) => f.active);
  const isTransfer = (f: FixedCost) => category(f.category_id)?.name === TRANSFER_CATEGORY;
  const sum = (list: FixedCost[]) => list.reduce((s, f) => s + monthlyCents(f.amount_cents, f.frequency), 0);
  const variable = budgets.filter((b) => b.category_ids.length > 0);
  const isMember = (id: string | null) => !!id && members.some((m) => m.user_id === id);

  const people = members.map((m) => {
    const own = active.filter((f) => f.person_id === m.user_id);
    const income = sum(own.filter((f) => f.type === 'einnahme'));
    const transfer = sum(own.filter((f) => f.type === 'ausgabe' && isTransfer(f)));
    const costs = sum(own.filter((f) => f.type === 'ausgabe' && !isTransfer(f) && !f.savings_goal_id));
    const saving = sum(own.filter((f) => f.type === 'ausgabe' && f.savings_goal_id));
    const budget = variable.filter((b) => b.person_id === m.user_id).reduce((s, b) => s + b.amount_cents, 0);
    return { id: m.user_id, name: m.display_name, income, transfer, costs, saving, budget };
  });
  const rows: { label: string; key: 'income' | 'transfer' | 'costs' | 'saving' | 'budget'; minus: boolean }[] = [
    { label: 'Gehalt / feste Einnahmen', key: 'income', minus: false },
    { label: 'Überweisung Gemeinschaftskonto', key: 'transfer', minus: true },
    { label: 'Eigene Fixkosten', key: 'costs', minus: true },
    { label: 'Sparen', key: 'saving', minus: true },
    { label: 'Variable Budgets', key: 'budget', minus: true },
  ];
  const visibleRows = rows.filter((r) => people.some((p) => p[r.key] > 0));

  // Gemeinschaftskonto: Überweisungen rein, gemeinsame Fixkosten und Budgets raus
  const transfers = people.reduce((s, p) => s + p.transfer, 0);
  const sharedCosts = sum(active.filter((f) => f.type === 'ausgabe' && !isMember(f.person_id)));
  const sharedBudgets = variable.filter((b) => !isMember(b.person_id)).reduce((s, b) => s + b.amount_cents, 0);

  const personBudgets = (id: string) =>
    variable.filter((b) => b.person_id === id).map((b) => `${b.name} ${formatEuro(b.amount_cents)}`);

  return (
    <Card style={{ gap: 6 }}>
      <Title>Unser Monat</Title>
      <View style={styles.row}>
        <Text style={styles.label} />
        {people.map((p) => (
          <Text key={p.id} style={[styles.value, { color: t.muted, fontWeight: '600' }]}>
            {p.name}
          </Text>
        ))}
      </View>
      {visibleRows.map((r) => (
        <View key={r.key} style={styles.row}>
          <Text style={[styles.label, { color: t.text }]}>
            {r.minus ? '− ' : ''}
            {r.label}
          </Text>
          {people.map((p) => (
            <Text key={p.id} style={[styles.value, { color: r.minus ? t.text : t.income }]}>
              {formatEuro(p[r.key])}
            </Text>
          ))}
        </View>
      ))}
      <View style={[styles.row, styles.total, { borderColor: t.border }]}>
        <Text style={[styles.label, { color: t.text, fontWeight: '700' }]}>Frei verfügbar</Text>
        {people.map((p) => {
          const free = p.income - p.transfer - p.costs - p.saving - p.budget;
          return (
            <Text key={p.id} style={[styles.value, { color: free >= 0 ? t.income : t.expense, fontWeight: '700' }]}>
              {formatEuro(free)}
            </Text>
          );
        })}
      </View>
      {people.some((p) => p.budget > 0) && (
        <Muted style={{ fontSize: 12 }}>
          Variable Budgets:{' '}
          {people
            .filter((p) => p.budget > 0)
            .map((p) => `${p.name}: ${personBudgets(p.id).join(', ')}`)
            .join(' · ')}
        </Muted>
      )}
      {transfers > 0 && (
        <>
          <Title>Gemeinschaftskonto</Title>
          <Line label="Überweisungen" value={transfers} />
          <Line label="− Gemeinsame Fixkosten" value={sharedCosts} />
          {sharedBudgets > 0 && (
            <Line
              label={`− ${variable
                .filter((b) => !isMember(b.person_id))
                .map((b) => b.name)
                .join(', ')}`}
              value={sharedBudgets}
            />
          )}
          <Line label="Puffer" value={transfers - sharedCosts - sharedBudgets} bold />
        </>
      )}
      <Muted style={{ fontSize: 12 }}>Jährliche Kosten sind auf den Monat umgerechnet.</Muted>
    </Card>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.row, bold && [styles.total, { borderColor: t.border }]]}>
      <Text style={[styles.label, { color: t.text, fontWeight: bold ? '700' : '400' }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          { color: bold ? (value >= 0 ? t.income : t.expense) : t.text, fontWeight: bold ? '700' : '400' },
        ]}
      >
        {formatEuro(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  label: { flex: 1.6, fontSize: 14 },
  value: { flex: 1, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  total: { borderTopWidth: 1, paddingTop: 6, marginTop: 2 },
});
