import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Body, Card, Loading, Screen, Title } from '@/components/ui';
import { registerForPush } from '@/lib/push';
import { isConfigured } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { setupWebApp } from '@/lib/webPush';
import { HouseholdProvider, useHousehold } from '@/providers/HouseholdProvider';
import { SessionProvider, useSession } from '@/providers/SessionProvider';

// Im Browser die aufgerufene Seite merken, damit ein Neuladen nicht immer auf der Übersicht landet.
const initialWebPath =
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname + window.location.search : null;

export default function RootLayout() {
  useEffect(() => {
    setupWebApp();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {isConfigured ? (
        <SessionProvider>
          <HouseholdProvider>
            <RootStack />
          </HouseholdProvider>
        </SessionProvider>
      ) : (
        <NotConfigured />
      )}
    </SafeAreaProvider>
  );
}

function RootStack() {
  const t = useTheme();
  const { session, loading: sessionLoading } = useSession();
  const { household, loading: householdLoading } = useHousehold();
  const ready = !!session && !!household;

  const restored = useRef(false);

  useEffect(() => {
    if (!ready) return;
    registerForPush().catch(() => {});
    if (!restored.current && initialWebPath && !['/', '/login', '/onboarding'].includes(initialWebPath)) {
      restored.current = true;
      router.replace(initialWebPath as Href);
    }
  }, [ready]);

  if (sessionLoading || (session && householdLoading && !household)) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !household}>
        <Stack.Screen name="onboarding" options={{ title: 'Willkommen' }} />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="buchung" options={{ presentation: 'modal', title: 'Buchung' }} />
        <Stack.Screen name="fixkosten-form" options={{ presentation: 'modal', title: 'Fixkosten' }} />
        <Stack.Screen name="kategorien" options={{ title: 'Kategorien' }} />
      </Stack.Protected>
    </Stack>
  );
}

function NotConfigured() {
  return (
    <Screen>
      <Card>
        <Title>Supabase ist noch nicht eingerichtet</Title>
        <Body>
          Lege eine Datei .env mit EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY an (Vorlage:
          .env.example) und starte die App neu.
        </Body>
      </Card>
    </Screen>
  );
}
