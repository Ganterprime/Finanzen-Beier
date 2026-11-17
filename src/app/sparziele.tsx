import { router } from 'expo-router';

import { GoalRow } from '@/components/GoalRow';
import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import type { GoalProgress } from '@/lib/useSavingsGoals';
import { useSavingsGoals } from '@/lib/useSavingsGoals';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function SavingsGoals() {
  const { members } = useHousehold();
  const { goals, loading } = useSavingsGoals();
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);
  const total = active.reduce((s, g) => s + g.savedCents, 0);
  const perMonth = active.reduce((s, g) => s + (g.perMonthCents ?? 0), 0);
  const shared = active.filter((g) => !g.person_id || !members.some((m) => m.user_id === g.person_id));

  return (
    <Screen>
      {active.length > 0 && (
        <Card>
          <Muted>In allen Spartöpfen</Muted>
          <Title>{formatEuro(total)}</Title>
          {perMonth > 0 && <Muted>Nötig für die Ziele mit Datum: {formatEuro(perMonth)} pro Monat</Muted>}
        </Card>
      )}
      <Button label="Spartopf hinzufügen" onPress={() => router.push('/sparziel-form')} />
      {!loading && active.length === 0 && (
        <Card>
          <Muted>Noch keine Spartöpfe. Lege z. B. „Notgroschen“ mit Zielbetrag an.</Muted>
        </Card>
      )}
      <Group title="Gemeinsam" goals={shared} />
      {members.map((m) => (
        <Group key={m.user_id} title={m.display_name} goals={active.filter((g) => g.person_id === m.user_id)} />
      ))}
      <Group title="Abgeschlossen" goals={archived} />
      <Muted>
        Feste Sparraten legst du unter Fixkosten an und wählst dort den Spartopf aus, dann wird jeden Monat automatisch
        eingezahlt. Einzelne Einzahlungen trägst du als Ausgabe ein und wählst unten im Formular den Spartopf. Eine
        Einnahme mit Spartopf zählt als Entnahme. Ein Topf mit Zielbetrag zeigt zusätzlich den Fortschritt.
      </Muted>
    </Screen>
  );
}

function Group({ title, goals }: { title: string; goals: GoalProgress[] }) {
  if (!goals.length) return null;
  return (
    <Card style={{ gap: 18 }}>
      <Title>{title}</Title>
      {goals.map((g) => (
        <GoalRow key={g.id} goal={g} />
      ))}
    </Card>
  );
}
