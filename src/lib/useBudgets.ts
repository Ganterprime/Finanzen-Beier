import { useCallback, useEffect, useId, useState } from 'react';

import { supabase } from './supabase';
import type { Budget, Period, Transaction } from './types';
import { useHousehold } from '@/providers/HouseholdProvider';

export interface BudgetUsage extends Budget {
  /** Limit für den gewählten Zeitraum (Monat oder ganzes Jahr) */
  limitCents: number;
  spentCents: number;
  /** negativ = überzogen */
  leftCents: number;
  /** 0–… (über 1 = überzogen) */
  ratio: number;
}

/** Budgets des Haushalts, live aktualisiert. */
export function useBudgets() {
  const { household } = useHousehold();
  const instance = useId();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at');
    setBudgets((data as Budget[]) ?? []);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    load();
    if (!household) return;
    const channel = supabase
      .channel(`budgets-${household.id}-${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets', filter: `household_id=eq.${household.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, instance, load]);

  return { budgets, loading, reload: load };
}

/**
 * Verbrauch je Budget im Zeitraum. Bei einem Personen-Budget zählen die eigenen
 * Ausgaben voll und gemeinsame Ausgaben anteilig (wie bei „Verfügbar“).
 * Einzahlungen auf Sparziele zählen nicht.
 */
export function budgetUsage(
  budgets: Budget[],
  items: Transaction[],
  memberIds: string[],
  period: Period,
): BudgetUsage[] {
  const months = period.month == null ? 12 : 1;
  const n = memberIds.length || 1;
  return budgets.map((b) => {
    let spent = 0;
    for (const t of items) {
      if (t.type !== 'ausgabe' || t.savings_goal_id) continue;
      if (b.category_ids.length && !b.category_ids.includes(t.category_id)) continue;
      if (b.person_id == null) spent += t.amount_cents;
      else if (t.person_id === b.person_id) spent += t.amount_cents;
      else if (t.person_id == null || !memberIds.includes(t.person_id)) spent += t.amount_cents / n;
    }
    const limitCents = b.amount_cents * months;
    const spentCents = Math.round(spent);
    return { ...b, limitCents, spentCents, leftCents: limitCents - spentCents, ratio: spentCents / limitCents };
  });
}
