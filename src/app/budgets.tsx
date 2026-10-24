import { router } from 'expo-router';

import { BudgetRow } from '@/components/BudgetRow';
import { FilterBar } from '@/components/FilterBar';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { budgetUsage, useBudgets } from '@/lib/useBudgets';
import { useTransactions } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function Budgets() {
  const { period, scope, members } = useHousehold();
  const { budgets, loading } = useBudgets();
  const { items } = useTransactions(period);
  const usage = budgetUsage(
    budgets,
    items,
    members.map((m) => m.user_id),
    period,
  ).filter((b) => scope === 'alle' || b.person_id === scope || b.person_id == null);

  return (
    <Screen>
      <FilterBar />
      <Button label="Budget hinzufügen" onPress={() => router.push('/budget-form')} />
      <Card style={{ gap: 18 }}>
        {!loading && usage.length === 0 && (
          <Muted>Noch keine Budgets. Lege z. B. „Freizeit: 150 € pro Monat für jeden“ an.</Muted>
        )}
        {usage.map((b) => (
          <BudgetRow key={b.id} budget={b} />
        ))}
      </Card>
      <Muted>
        Budgets gelten pro Monat. In der Jahresansicht wird das Limit mal 12 gerechnet. Bei einem Budget für eine Person
        zählen ihre eigenen Ausgaben und gemeinsame Ausgaben zur Hälfte.
      </Muted>
    </Screen>
  );
}
