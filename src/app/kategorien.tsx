import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Field, Muted, Screen, Segmented, Title } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import type { Category, EntryType } from '@/lib/types';
import { useHousehold } from '@/providers/HouseholdProvider';

const COLORS = ['#4F7CAC', '#5BAA4A', '#E0A030', '#D2694B', '#D25B7A', '#9B6BB5', '#2E9CB8', '#3FA37A', '#A0825A', '#8A8A8A'];

export default function Categories() {
  const t = useTheme();
  const { household, categories, reload } = useHousehold();
  const [type, setType] = useState<EntryType>('ausgabe');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState(COLORS[0]);
  const [fixed, setFixed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = categories.filter((c) => c.type === type);

  const add = async () => {
    setError(null);
    const { error } = await supabase.from('categories').insert({
      household_id: household!.id,
      type,
      name: name.trim(),
      icon: icon.trim() || '•',
      color,
      is_fixed_cost: fixed,
      sort_order: 500,
    });
    if (error) return setError(error.code === '23505' ? 'Diese Kategorie gibt es schon.' : error.message);
    setName('');
    reload();
  };

  const update = async (c: Category, patch: Partial<Category>) => {
    await supabase.from('categories').update(patch).eq('id', c.id);
    reload();
  };

  return (
    <Screen>
      <Segmented
        options={[
          { value: 'ausgabe', label: 'Ausgaben' },
          { value: 'einnahme', label: 'Einnahmen' },
        ]}
        value={type}
        onChange={setType}
      />

      <Card>
        <Title>Neue Kategorie</Title>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 70 }}>
            <Field label="Symbol" value={icon} onChangeText={setIcon} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Name" value={name} onChangeText={setName} placeholder="z. B. Kinder" />
          </View>
        </View>
        <View style={styles.colors}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? t.text : 'transparent' }]}
            />
          ))}
        </View>
        <View style={styles.row}>
          <Body style={{ flex: 1 }}>Zählt als Fixkosten</Body>
          <Switch value={fixed} onValueChange={setFixed} />
        </View>
        {error && <Body style={{ color: t.expense }}>{error}</Body>}
        <Button label="Hinzufügen" onPress={add} disabled={!name.trim()} />
      </Card>

      <Card>
        <Title>Vorhandene Kategorien</Title>
        <Muted>Ausgeblendete Kategorien bleiben in alten Buchungen erhalten.</Muted>
        {list.map((c) => (
          <View key={c.id} style={[styles.row, { opacity: c.archived ? 0.45 : 1 }]}>
            <Text style={{ fontSize: 20 }}>{c.icon}</Text>
            <NameInput value={c.name} onSave={(v) => update(c, { name: v })} />
            <Pressable onPress={() => update(c, { is_fixed_cost: !c.is_fixed_cost })}>
              <Text style={{ color: c.is_fixed_cost ? t.primary : t.muted, fontSize: 12 }}>
                {c.is_fixed_cost ? 'Fix' : 'Variabel'}
              </Text>
            </Pressable>
            <Pressable onPress={() => update(c, { archived: !c.archived })}>
              <Text style={{ color: t.primary, fontSize: 12 }}>{c.archived ? 'Einblenden' : 'Ausblenden'}</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function NameInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState(value);
  const commit = () => {
    const v = text.trim();
    if (v && v !== value) onSave(v);
    else setText(value);
  };
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      style={[styles.nameInput, { color: t.text, borderColor: t.border }]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  nameInput: { flex: 1, borderBottomWidth: 1, paddingVertical: 4, fontSize: 15 },
});
