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

/** Name der Kategorie für Überweisungen aufs Gemeinschaftskonto */
export const TRANSFER_CATEGORY = 'Gemeinschaftskonto';

/**
 * Buchungen einer Person oder alle. Mit isTransfer werden in der gemeinsamen Ansicht die
 * Überweisungen aufs Gemeinschaftskonto weggelassen: Das Geld bleibt im Haushalt, und die
 * Kosten, die davon bezahlt werden, sind schon als gemeinsame Ausgaben gebucht.
 */
export function byScope(items: Transaction[], scope: Scope, isTransfer?: (categoryId: string) => boolean): Transaction[] {
  if (scope !== 'alle') return items.filter((t) => t.person_id === scope);
  return isTransfer ? items.filter((t) => !isTransfer(t.category_id)) : items;
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

/**
 * Verfügbarer Betrag pro Person: eigene Einnahmen minus eigene Ausgaben. Dazu gehören
 * die Überweisung aufs Gemeinschaftskonto, eigene Kosten und Sparraten. Gemeinsame
 * Kosten zählen hier nicht, sie werden vom Gemeinschaftskonto bezahlt.
 */
export function availablePerPerson(items: Transaction[], memberIds: string[]) {
  const result = new Map(memberIds.map((id) => [id, { income: 0, expense: 0 }]));
  for (const t of items) {
    const r = t.person_id ? result.get(t.person_id) : undefined;
    if (!r) continue;
    if (t.type === 'einnahme') r.income += t.amount_cents;
    else r.expense += t.amount_cents;
  }
  return memberIds.map((id) => {
    const r = result.get(id)!;
    return { userId: id, income: r.income, expense: r.expense, available: r.income - r.expense };
  });
}

/** Gemeinschaftskonto im Zeitraum: Überweisungen rein, gemeinsame Ausgaben raus. */
export function sharedAccount(items: Transaction[], isTransfer: (categoryId: string) => boolean) {
  let transfers = 0;
  let costs = 0;
  for (const t of items) {
    if (t.type !== 'ausgabe') continue;
    if (isTransfer(t.category_id)) transfers += t.amount_cents;
    else if (!t.person_id) costs += t.amount_cents;
  }
  return { transfers, costs, buffer: transfers - costs };
}
