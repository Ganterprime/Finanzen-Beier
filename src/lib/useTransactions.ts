import { useCallback, useEffect, useId, useState } from 'react';

import { periodRange } from './format';
import { supabase } from './supabase';
import type { Period, Scope, Transaction } from './types';
import { useHousehold } from '@/providers/HouseholdProvider';

/** Buchungen eines Zeitraums, live aktualisiert. */
export function useTransactions(period: Period) {
  const { household } = useHousehold();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { from, to } = periodRange(period);
  const instance = useId();

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', household.id)
      .gte('booked_on', from)
      .lte('booked_on', to)
      .order('booked_on', { ascending: false })
      .order('created_at', { ascending: false });
    setItems((data as Transaction[]) ?? []);
    setLoading(false);
  }, [household, from, to]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel(`transactions-${household.id}-${from}-${to}-${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${household.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, from, to, instance, load]);

  return { items, loading, reload: load };
}

export function byScope(items: Transaction[], scope: Scope): Transaction[] {
  return scope === 'alle' ? items : items.filter((t) => t.person_id === scope);
}

export interface Totals {
  income: number;
  expense: number;
  fixed: number;
  balance: number;
}

export function totals(items: Transaction[], isFixedCategory: (id: string) => boolean): Totals {
  let income = 0;
  let expense = 0;
  let fixed = 0;
  for (const t of items) {
    if (t.type === 'einnahme') income += t.amount_cents;
    else {
      expense += t.amount_cents;
      if (t.source === 'fixkosten' || isFixedCategory(t.category_id)) fixed += t.amount_cents;
    }
  }
  return { income, expense, fixed, balance: income - expense };
}

/** Summe je Kategorie, absteigend sortiert */
export function sumByCategory(items: Transaction[], type: 'ausgabe' | 'einnahme') {
  const map = new Map<string, number>();
  for (const t of items) {
    if (t.type !== type) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount_cents);
  }
  return [...map.entries()]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => b.cents - a.cents);
}
