import { useEffect, useState } from 'react';

import { Body, Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { signOut } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useHousehold } from '@/providers/HouseholdProvider';

interface Invitation {
  id: string;
  household_name: string;
}

export default function Onboarding() {
  const t = useTheme();
  const { reload, error: loadError } = useHousehold();
  const [name, setName] = useState('');
  const [householdName, setHouseholdName] = useState('Beier / Beier-Kiray');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('my_invitations').then(({ data }) => setInvitations((data as Invitation[]) ?? []));
  }, []);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    else await reload();
  };

  return (
    <Screen>
      <Field label="Dein Name in der App" value={name} onChangeText={setName} placeholder="z. B. Joschka" />

      {invitations.map((inv) => (
        <Card key={inv.id}>
          <Title>Einladung: {inv.household_name}</Title>
          <Body>Du wurdest in diesen Haushalt eingeladen.</Body>
          <Button
            label="Beitreten"
            disabled={!name.trim()}
            loading={busy}
            onPress={() =>
              run(() => supabase.rpc('accept_invitation', { p_invitation: inv.id, p_display_name: name.trim() }))
            }
          />
        </Card>
      ))}

      <Card>
        <Title>Neuen Haushalt anlegen</Title>
        <Muted>Die Standardkategorien werden automatisch angelegt. Danach kannst du Talea einladen.</Muted>
        <Field label="Name des Haushalts" value={householdName} onChangeText={setHouseholdName} />
        <Button
          label="Haushalt anlegen"
          variant={invitations.length ? 'secondary' : 'primary'}
          disabled={!name.trim() || !householdName.trim()}
          loading={busy}
          onPress={() =>
            run(() =>
              supabase.rpc('create_household', { p_name: householdName.trim(), p_display_name: name.trim() }),
            )
          }
        />
      </Card>

      {(error || loadError) && <Body style={{ color: t.expense }}>{error ?? `Laden fehlgeschlagen: ${loadError}`}</Body>}
      <Button label="Abmelden" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
