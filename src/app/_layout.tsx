import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Card, Loading, Screen, Title } from '@/components/ui';
import { useOffline } from '@/lib/offline';
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
  const offline = useOffline();
  const insets = useSafeAreaInsets();

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
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {offline && (
        <View
          style={{
            backgroundColor: '#E0A030',
            paddingTop: insets.top + 4,
            paddingBottom: 4,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13, textAlign: 'center' }}>
            Offline: Du siehst den zuletzt geladenen Stand. Eintragen geht erst wieder mit Internet.
          </Text>
        </View>
      )}
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
          <Stack.Screen name="sparziele" options={{ title: 'Sparziele' }} />
          <Stack.Screen name="sparziel-form" options={{ presentation: 'modal', title: 'Sparziel' }} />
          <Stack.Screen name="budgets" options={{ title: 'Budgets' }} />
          <Stack.Screen name="budget-form" options={{ presentation: 'modal', title: 'Budget' }} />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

function NotConfigured() {
  return (
    <Screen>
      <Card>
        <Title>Supabase ist noch nicht eingerichtet</Title>
        <Body>
          Lege eine Datei .env mit EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_ANON_KEY an (Vorlage: .env.example)
          und starte die App neu.
        </Body>
      </Card>
    </Screen>
  );
}
