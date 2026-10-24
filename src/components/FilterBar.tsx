import { Pressable, StyleSheet, Text, View } from 'react-native';

import { periodLabel } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import { useHousehold } from '@/providers/HouseholdProvider';
import { Segmented } from './ui';

/** Umschalter Gemeinsam / Person und Zeitraum (Monat oder ganzes Jahr). */
export function FilterBar({ showScope = true }: { showScope?: boolean }) {
  const t = useTheme();
  const { members, scope, setScope, period, setPeriod } = useHousehold();

  const step = (dir: -1 | 1) => {
    if (period.month == null) return setPeriod({ year: period.year + dir, month: null });
    let m = period.month + dir;
    let y = period.year;
    if (m < 1) [m, y] = [12, y - 1];
    if (m > 12) [m, y] = [1, y + 1];
    setPeriod({ year: y, month: m });
  };

  return (
    <View style={{ gap: 10 }}>
      {showScope && members.length > 1 && (
        <Segmented
          options={[
            { value: 'alle', label: 'Gemeinsam' },
            ...members.map((m) => ({ value: m.user_id, label: m.display_name })),
          ]}
          value={scope}
          onChange={setScope}
        />
      )}
      <View style={styles.row}>
        <Pressable onPress={() => step(-1)} hitSlop={10} style={styles.arrow}>
          <Text style={[styles.arrowText, { color: t.primary }]}>‹</Text>
        </Pressable>
        <Text style={[styles.label, { color: t.text }]}>{periodLabel(period)}</Text>
        <Pressable onPress={() => step(1)} hitSlop={10} style={styles.arrow}>
          <Text style={[styles.arrowText, { color: t.primary }]}>›</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Segmented
          options={[
            { value: 'monat', label: 'Monat' },
            { value: 'jahr', label: 'Jahr' },
          ]}
          value={period.month == null ? 'jahr' : 'monat'}
          onChange={(v) =>
            setPeriod(
              v === 'jahr'
                ? { year: period.year, month: null }
                : { year: period.year, month: period.year === new Date().getFullYear() ? new Date().getMonth() + 1 : 1 },
            )
          }
        />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { paddingHorizontal: 6 },
  arrowText: { fontSize: 26, fontWeight: '500' },
  label: { fontSize: 17, fontWeight: '700', minWidth: 120, textAlign: 'center' },
});
