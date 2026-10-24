import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';

import { useTheme } from '@/lib/theme';

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>
);

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Übersicht', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="buchungen" options={{ title: 'Buchungen', tabBarIcon: icon('📋') }} />
      <Tabs.Screen name="fixkosten" options={{ title: 'Fixkosten', tabBarIcon: icon('📌') }} />
      <Tabs.Screen name="auswertung" options={{ title: 'Auswertung', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="einstellungen" options={{ title: 'Einstellungen', tabBarIcon: icon('⚙️') }} />
    </Tabs>
  );
}
