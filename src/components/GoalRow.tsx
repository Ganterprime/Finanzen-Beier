import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEuro, formatPercent } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { GoalProgress } from '@/lib/useSavingsGoals';

export function GoalRow({ goal }: { goal: GoalProgress }) {
  const t = useTheme();
  const done = goal.remainingCents === 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/sparziel-form', params: { id: goal.id } })}
      style={({ pressed }) => [{ gap: 6, opacity: pressed ? 0.6 : goal.archived ? 0.45 : 1 }]}
    >
      <View style={styles.line}>
        <Text style={{ fontSize: 18 }}>{goal.icon}</Text>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {goal.name}
        </Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>{formatPercent(goal.progress)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.chip }]}>
        <View style={[styles.bar, { width: `${Math.max(2, goal.progress * 100)}%`, backgroundColor: goal.color }]} />
      </View>
      <Text style={{ color: t.muted, fontSize: 12 }}>
        {formatEuro(goal.savedCents)} von {formatEuro(goal.target_cents)}
        {goal.target_date ? ` · bis ${formatDate(goal.target_date)}` : ''}
      </Text>
      {done ? (
        <Text style={{ color: t.income, fontSize: 13, fontWeight: '600' }}>Ziel erreicht 🎉</Text>
      ) : (
        goal.perMonthCents != null && (
          <Text style={{ color: t.text, fontSize: 13 }}>
            Noch {formatEuro(goal.remainingCents)}: {formatEuro(goal.perMonthCents)} pro Monat
            {goal.monthsLeft === 1 ? ' (letzter Monat)' : ` für ${goal.monthsLeft} Monate`}
          </Text>
        )
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
});
