import { useCallback, useEffect, useId, useState } from 'react';

import { supabase } from './supabase';
import type { SavingsGoal } from './types';
import { useHousehold } from '@/providers/HouseholdProvider';

export interface GoalProgress extends SavingsGoal {
  savedCents: number;
  /** 0–1 */
  progress: number;
  remainingCents: number;
  /** Nötige Sparrate pro Monat bis zum Zieldatum, null ohne Datum */
  perMonthCents: number | null;
  monthsLeft: number | null;
}

function monthsUntil(date: string): number {
  const now = new Date();
  const [y, m] = date.split('-').map(Number);
  // Der laufende Monat zählt mit, damit am Ende nicht alles im letzten Monat fällig wird.
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1)) + 1);
}

/** Sparziele mit Fortschritt, live aktualisiert. */
export function useSavingsGoals() {
  const { household } = useHousehold();
  const instance = useId();
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: g }, { data: tx }] = await Promise.all([
      supabase.from('savings_goals').select('*').eq('household_id', household.id).order('created_at'),
      supabase
        .from('transactions')
        .select('savings_goal_id, type, amount_cents')
        .eq('household_id', household.id)
        .not('savings_goal_id', 'is', null),
    ]);
    const saved = new Map<string, number>();
    for (const t of (tx as { savings_goal_id: string; type: string; amount_cents: number }[]) ?? []) {
      const sign = t.type === 'ausgabe' ? 1 : -1; // Ausgabe = Einzahlung, Einnahme = Entnahme
      saved.set(t.savings_goal_id, (saved.get(t.savings_goal_id) ?? 0) + sign * t.amount_cents);
    }
    setGoals(
      ((g as SavingsGoal[]) ?? []).map((goal) => {
        const savedCents = goal.start_cents + (saved.get(goal.id) ?? 0);
        const remainingCents = Math.max(0, goal.target_cents - savedCents);
        const monthsLeft = goal.target_date ? monthsUntil(goal.target_date) : null;
        return {
          ...goal,
          savedCents,
          remainingCents,
          progress: Math.min(1, Math.max(0, savedCents / goal.target_cents)),
          monthsLeft,
          perMonthCents: monthsLeft ? Math.ceil(remainingCents / monthsLeft) : null,
        };
      }),
    );
    setLoading(false);
  }, [household]);

  useEffect(() => {
    load();
    if (!household) return;
    const channel = supabase
      .channel(`savings-${household.id}-${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals', filter: `household_id=eq.${household.id}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${household.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, instance, load]);

  return { goals, loading, reload: load };
}
