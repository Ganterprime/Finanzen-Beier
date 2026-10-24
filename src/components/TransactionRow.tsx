import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatEuro } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import type { Transaction } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';

export function TransactionRow({ item }: { item: Transaction }) {
  const t = useTheme();
  const { category, memberName } = useHousehold();
  const c = category(item.category_id);
  const income = item.type === 'einnahme';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/buchung', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: (c?.color ?? '#888') + '33' }]}>
        <Text style={{ fontSize: 18 }}>{c?.icon ?? '•'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
          {item.note || c?.name || 'Ohne Kategorie'}
        </Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>
          {formatDate(item.booked_on)} · {memberName(item.person_id)}
          {item.note && c ? ` · ${c.name}` : ''}
          {item.source === 'fixkosten' ? ' · Fixkosten' : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: income ? t.income : t.text }]}>
        {income ? '+' : '−'}
        {formatEuro(item.amount_cents)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '500' },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
