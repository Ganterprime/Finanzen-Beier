import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { FilterBar } from '@/components/FilterBar';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, Field, Muted, Screen, Segmented } from '@/components/ui';
import { formatDate, formatEuro } from '@/lib/format';
import type { EntryType } from '@/lib/types';
import { byScope, useTransactions } from '@/lib/useTransactions';
import { useHousehold } from '@/providers/HouseholdProvider';

export default function Transactions() {
  const { period, scope, category } = useHousehold();
  const { items, loading } = useTransactions(period);
  const [type, setType] = useState<EntryType | 'alle'>('alle');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = byScope(items, scope).filter(
      (t) =>
        (type === 'alle' || t.type === type) &&
        (!q || (t.note ?? '').toLowerCase().includes(q) || (category(t.category_id)?.name ?? '').toLowerCase().includes(q)),
    );
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) map.set(t.booked_on, [...(map.get(t.booked_on) ?? []), t]);
    return [...map.entries()];
  }, [items, scope, type, query, category]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <FilterBar />
        <Segmented
          options={[
            { value: 'alle', label: 'Alle' },
            { value: 'ausgabe', label: 'Ausgaben' },
            { value: 'einnahme', label: 'Einnahmen' },
          ]}
          value={type}
          onChange={setType}
        />
        <Field label="Suchen" value={query} onChangeText={setQuery} placeholder="Notiz oder Kategorie" />
        {!loading && groups.length === 0 && <Muted>Keine Buchungen gefunden.</Muted>}
        {groups.map(([day, list]) => {
          const net = list.reduce((s, t) => s + (t.type === 'einnahme' ? t.amount_cents : -t.amount_cents), 0);
          return (
            <Card key={day} style={{ gap: 0 }}>
              <Muted>
                {formatDate(day)} · {formatEuro(net)}
              </Muted>
              {list.map((item) => (
                <TransactionRow key={item.id} item={item} />
              ))}
            </Card>
          );
        })}
        <View style={{ height: 70 }} />
      </Screen>
      <AddButton />
    </View>
  );
}
