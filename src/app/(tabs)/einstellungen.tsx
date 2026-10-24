import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Button, Card, Field, Muted, Screen, Title } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { enableWebPush, sendTestPush, webPushStatus, type WebPushStatus } from '@/lib/webPush';
import { useHousehold } from '@/providers/HouseholdProvider';
import { useSession } from '@/providers/SessionProvider';

interface Invitation {
  id: string;
  email: string;
  expires_at: string;
  accepted_at: string | null;
}

export default function Settings() {
  const t = useTheme();
  const { session } = useSession();
  const { household, members, reload } = useHousehold();
  const me = members.find((m) => m.user_id === session?.user.id);
  const isOwner = me?.role === 'owner';

  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [email, setEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [push, setPush] = useState<WebPushStatus>(webPushStatus());
  const [pushBusy, setPushBusy] = useState(false);

  const loadInvitations = useCallback(async () => {
    if (!isOwner || !household) return;
    const { data } = await supabase
      .from('invitations')
      .select('id, email, expires_at, accepted_at')
      .eq('household_id', household.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    setInvitations((data as Invitation[]) ?? []);
  }, [isOwner, household]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const saveName = async () => {
    if (!me || !displayName.trim()) return;
    await supabase
      .from('household_members')
      .update({ display_name: displayName.trim() })
      .eq('household_id', me.household_id)
      .eq('user_id', me.user_id);
    await reload();
    setMessage('Name gespeichert.');
  };

  const invite = async () => {
    const { error } = await supabase.from('invitations').insert({ household_id: household!.id, email: email.trim() });
    if (error) return setMessage(error.message);
    setEmail('');
    setMessage('Einladung angelegt. Die Person registriert sich mit genau dieser E-Mail und kann dann beitreten.');
    loadInvitations();
  };

  return (
    <Screen>
      <Card>
        <Title>{household?.name}</Title>
        {members.map((m) => (
          <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
            <Body style={{ flex: 1 }}>{m.display_name}</Body>
            <Muted>{m.role === 'owner' ? 'Verwalter' : 'Mitglied'}</Muted>
          </View>
        ))}
      </Card>

      <Card>
        <Title>Dein Name</Title>
        <Field label="Anzeigename" value={displayName} onChangeText={setDisplayName} />
        <Button label="Speichern" variant="secondary" onPress={saveName} />
      </Card>

      {isOwner && (
        <Card>
          <Title>Mitglied einladen</Title>
          <Field
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="talea@…"
          />
          <Button label="Einladen" onPress={invite} disabled={!email.includes('@')} />
          {invitations.map((i) => (
            <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Body style={{ flex: 1 }}>{i.email}</Body>
              <Muted>offen bis {formatDate(i.expires_at.slice(0, 10))}</Muted>
              <Pressable
                onPress={async () => {
                  await supabase.from('invitations').delete().eq('id', i.id);
                  loadInvitations();
                }}
              >
                <Text style={{ color: t.expense }}>Zurückziehen</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {push !== 'unsupported' && (
        <Card>
          <Title>Benachrichtigungen</Title>
          {push === 'needs-homescreen' && (
            <Body>
              Auf dem iPhone gehen Benachrichtigungen nur, wenn die App auf dem Startbildschirm liegt: In Safari auf
              Teilen (Quadrat mit Pfeil) tippen, „Zum Home-Bildschirm“ wählen und die App dann von dort öffnen.
            </Body>
          )}
          {push === 'denied' && (
            <Body>Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen.</Body>
          )}
          {(push === 'default' || push === 'granted') && (
            <Muted>
              {push === 'granted'
                ? 'Auf diesem Gerät aktiv. Du bekommst eine Nachricht, wenn jemand anderes etwas einträgt.'
                : 'Lass dich benachrichtigen, wenn jemand anderes etwas einträgt.'}
            </Muted>
          )}
          {(push === 'default' || push === 'granted') && (
            <Button
              label={push === 'granted' ? 'Auf diesem Gerät erneut aktivieren' : 'Benachrichtigungen aktivieren'}
              variant={push === 'granted' ? 'secondary' : 'primary'}
              loading={pushBusy}
              onPress={async () => {
                setPushBusy(true);
                try {
                  setPush(await enableWebPush());
                } catch (e) {
                  setMessage(`Benachrichtigungen: ${(e as Error).message}`);
                }
                setPushBusy(false);
              }}
            />
          )}
          {push === 'granted' && (
            <Button
              label="Testnachricht senden"
              variant="secondary"
              onPress={() =>
                sendTestPush()
                  .then(() => setMessage('Testnachricht verschickt.'))
                  .catch((e) => setMessage(`Test fehlgeschlagen: ${(e as Error).message}`))
              }
            />
          )}
        </Card>
      )}

      {message && <Muted>{message}</Muted>}

      <Button label="Kategorien verwalten" variant="secondary" onPress={() => router.push('/kategorien')} />
      <Button label="Abmelden" variant="secondary" onPress={() => supabase.auth.signOut()} />
      <Muted>Angemeldet als {session?.user.email}</Muted>
    </Screen>
  );
}
