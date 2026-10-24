import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme';
import type { Category } from '@/lib/types';

export function CategoryGrid({
  categories,
  selected,
  onSelect,
}: {
  categories: Category[];
  /** eine Kategorie oder mehrere (Mehrfachauswahl) */
  selected: string | null | string[];
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const active = Array.isArray(selected) ? selected.includes(c.id) : c.id === selected;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={[
              styles.tile,
              { backgroundColor: active ? c.color : t.card, borderColor: active ? c.color : t.border },
            ]}
          >
            <Text style={styles.icon}>{c.icon}</Text>
            <Text numberOfLines={2} style={[styles.name, { color: active ? '#fff' : t.text }]}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: 92,
    height: 78,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    gap: 4,
  },
  icon: { fontSize: 22 },
  name: { fontSize: 11, textAlign: 'center' },
});
