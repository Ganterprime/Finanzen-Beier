import { StyleSheet, Text, View } from 'react-native';

import { formatEuro, formatPercent } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useHousehold } from '@/providers/HouseholdProvider';

/** Horizontale Balken: Betrag und Anteil je Kategorie. */
export function CategoryBars({
  rows,
  limit,
  compare,
}: {
  rows: { categoryId: string; cents: number }[];
  limit?: number;
  /** Vergleichswerte (z. B. Vormonat) je Kategorie */
  compare?: Map<string, number>;
}) {
  const t = useTheme();
  const { category } = useHousehold();
  const total = rows.reduce((s, r) => s + r.cents, 0);
  const max = rows[0]?.cents ?? 0;
  const shown = limit ? rows.slice(0, limit) : rows;

  if (!rows.length) return <Text style={{ color: t.muted }}>Noch keine Buchungen in diesem Zeitraum.</Text>;

  return (
    <View style={{ gap: 12 }}>
      {shown.map((r) => {
        const c = category(r.categoryId);
        const prev = compare?.get(r.categoryId);
        const delta = prev ? (r.cents - prev) / prev : null;
        return (
          <View key={r.categoryId} style={{ gap: 4 }}>
            <View style={styles.line}>
              <Text style={{ color: t.text, flex: 1 }} numberOfLines={1}>
                {c?.icon} {c?.name ?? '–'}
              </Text>
              <Text style={[styles.value, { color: t.text }]}>{formatEuro(r.cents)}</Text>
              <Text style={[styles.share, { color: t.muted }]}>{formatPercent(r.cents / total)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: t.chip }]}>
              <View
                style={[styles.bar, { width: `${Math.max(2, (r.cents / max) * 100)}%`, backgroundColor: c?.color ?? t.primary }]}
              />
            </View>
            {delta != null && (
              <Text style={{ color: delta > 0 ? t.expense : t.income, fontSize: 12 }}>
                {delta > 0 ? '▲' : '▼'} {formatPercent(Math.abs(delta))} zum Vorzeitraum
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  share: { width: 54, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 13 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
});
