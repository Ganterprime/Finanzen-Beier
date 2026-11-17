import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Muted } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import { useSavingsGoals } from '@/lib/useSavingsGoals';

/** Auswahl eines Sparziels als Chips; zeigt nichts, solange es keine Sparziele gibt. */
export function GoalPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTheme();
  const { goals } = useSavingsGoals();
  const visible = goals.filter((g) => !g.archived || g.id === value);
  if (!visible.length) return null;
  return (
    <>
      <Muted>{label}</Muted>
      <View style={styles.chips}>
        {[{ id: null as string | null, icon: '', name: 'Keins' }, ...visible].map((g) => {
          const active = g.id === value;
          return (
            <Pressable
              key={g.id ?? 'none'}
              onPress={() => onChange(g.id)}
              style={[styles.chip, { backgroundColor: active ? t.primary : t.chip }]}
            >
              <Text style={{ color: active ? '#fff' : t.text }}>
                {g.icon ? `${g.icon} ` : ''}
                {g.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
