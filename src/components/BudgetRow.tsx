import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { BudgetUsage } from '@/lib/useBudgets';
import { useHousehold } from '@/providers/HouseholdProvider';

export function BudgetRow({ budget }: { budget: BudgetUsage }) {
  const t = useTheme();
  const { memberName } = useHousehold();
  const over = budget.leftCents < 0;
  const color = over ? t.expense : budget.ratio >= 0.8 ? '#E0A030' : t.income;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/budget-form', params: { id: budget.id } })}
      style={({ pressed }) => [{ gap: 6, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.line}>
        <Text style={{ fontSize: 18 }}>{budget.icon}</Text>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
          {budget.name}
        </Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          {budget.person_id ? memberName(budget.person_id) : 'Gemeinsam'}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.chip }]}>
        <View style={[styles.bar, { width: `${Math.min(100, Math.max(2, budget.ratio * 100))}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.line}>
        <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>
          {formatEuro(budget.spentCents)} von {formatEuro(budget.limitCents)}
        </Text>
        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
          {over ? `${formatEuro(-budget.leftCents)} drüber` : `noch ${formatEuro(budget.leftCents)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
});
