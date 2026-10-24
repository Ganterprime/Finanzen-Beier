import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { BudgetRow } from '@/components/BudgetRow';
import { CategoryBars } from '@/components/CategoryBars';
import { FilterBar } from '@/components/FilterBar';
import { TransactionRow } from '@/components/TransactionRow';
import { GoalRow } from '@/components/GoalRow';
import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { budgetUsage, useBudgets } from '@/lib/useBudgets';
import { useSavingsGoals } from '@/lib/useSavingsGoals';
import { availablePerPerson, byScope, sumByCategory, totals, useTransactions } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function Overview() {
  const t = useTheme();
  const { period, scope, category, members, memberName } = useHousehold();
  const { items } = useTransactions(period);
  const { goals } = useSavingsGoals();
  const activeGoals = goals.filter((g) => !g.archived);
  const { budgets } = useBudgets();
  const usage = budgetUsage(
    budgets,
    items,
    members.map((m) => m.user_id),
    period,
  ).filter((b) => scope === 'alle' || b.person_id === scope || b.person_id == null);
  const available = availablePerPerson(
    items,
    members.map((m) => m.user_id),
  ).filter((p) => scope === 'alle' || p.userId === scope);
  const shown = byScope(items, scope);
  const sum = totals(shown, (id) => category(id)?.is_fixed_cost ?? false);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <FilterBar />

        <Card>
          <Muted>Saldo</Muted>
          <Text style={[styles.big, { color: sum.balance >= 0 ? t.income : t.expense }]}>
            {formatEuro(sum.balance)}
          </Text>
          <View style={styles.split}>
            <Stat label="Einnahmen" value={sum.income} color={t.income} />
            <Stat label="Ausgaben" value={sum.expense} color={t.expense} />
            <Stat label="davon Fixkosten" value={sum.fixed} color={t.muted} />
          </View>
        </Card>

        {members.length > 1 && (
          <Card>
            <Title>Verfügbar</Title>
            <Muted>Eigene Einnahmen minus eigene Ausgaben, Gemeinsames je zur Hälfte.</Muted>
            {available.map((p) => (
              <View key={p.userId} style={styles.personRow}>
                <Text style={{ color: t.text, flex: 1, fontSize: 15 }}>{memberName(p.userId)}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      color: p.available >= 0 ? t.income : t.expense,
                      fontSize: 18,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {formatEuro(p.available)}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {formatEuro(p.income)} rein · {formatEuro(p.expense)} raus
                  </Muted>
                </View>
              </View>
            ))}
          </Card>
        )}

        <Card style={{ gap: 16 }}>
          <Title>Budgets</Title>
          {usage.length === 0 && <Muted>Lege fest, wie viel jeder z. B. für Freizeit ausgeben darf.</Muted>}
          {usage.slice(0, 4).map((b) => (
            <BudgetRow key={b.id} budget={b} />
          ))}
          <Button
            label={usage.length ? 'Alle Budgets' : 'Budget anlegen'}
            variant="secondary"
            onPress={() => router.push(usage.length ? '/budgets' : '/budget-form')}
          />
        </Card>

        <Card style={{ gap: 16 }}>
          <Title>Sparziele</Title>
          {activeGoals.length === 0 && <Muted>Noch kein Sparziel angelegt.</Muted>}
          {activeGoals.slice(0, 3).map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
          <Button
            label={activeGoals.length ? 'Alle Sparziele' : 'Sparziel anlegen'}
            variant="secondary"
            onPress={() => router.push(activeGoals.length ? '/sparziele' : '/sparziel-form')}
          />
        </Card>

        <Card>
          <Title>Top-Kategorien</Title>
          <CategoryBars rows={sumByCategory(shown, 'ausgabe')} limit={5} />
        </Card>

        <Card>
          <Title>Letzte Buchungen</Title>
          {shown.length === 0 && <Muted>Noch nichts eingetragen. Tippe auf +.</Muted>}
          {shown.slice(0, 8).map((item) => (
            <TransactionRow key={item.id} item={item} />
          ))}
        </Card>
        <View style={{ height: 70 }} />
      </Screen>
      <AddButton />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Muted>{label}</Muted>
      <Text style={{ color, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {formatEuro(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', gap: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
