import { router } from 'expo-router';

import { GoalRow } from '@/components/GoalRow';
import { Button, Card, Muted, Screen, Title } from '@/components/ui';
import { formatEuro } from '@/lib/format';
import { useSavingsGoals } from '@/lib/useSavingsGoals';

export default function SavingsGoals() {
  const { goals, loading } = useSavingsGoals();
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);
  const perMonth = active.reduce((s, g) => s + (g.perMonthCents ?? 0), 0);

  return (
    <Screen>
      {active.length > 0 && (
        <Card>
          <Muted>Nötige Sparrate für alle Ziele</Muted>
          <Title>{formatEuro(perMonth)} pro Monat</Title>
        </Card>
      )}
      <Button label="Sparziel hinzufügen" onPress={() => router.push('/sparziel-form')} />
      <Card style={{ gap: 18 }}>
        {!loading && active.length === 0 && (
          <Muted>Noch keine Sparziele. Lege z. B. „Urlaub 2027“ mit Zielbetrag und Datum an.</Muted>
        )}
        {active.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </Card>
      {archived.length > 0 && (
        <Card style={{ gap: 18 }}>
          <Title>Abgeschlossen</Title>
          {archived.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </Card>
      )}
      <Muted>
        Einzahlungen trägst du als Ausgabe ein (z. B. Kategorie „Sparen & Anlage“) und wählst unten im Formular das
        Sparziel aus. Eine Einnahme mit Sparziel zählt als Entnahme.
      </Muted>
    </Screen>
  );
}
