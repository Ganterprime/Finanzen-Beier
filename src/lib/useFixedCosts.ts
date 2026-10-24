import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { FixedCost } from './types';
import { useHousehold } from '@/providers/HouseholdProvider';

export function useFixedCosts() {
  const { household } = useHousehold();
  const [items, setItems] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from('fixed_costs')
      .select('*')
      .eq('household_id', household.id)
      .order('active', { ascending: false })
      .order('amount_cents', { ascending: false });
    setItems((data as FixedCost[]) ?? []);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    load();
    if (!household) return;
    const channel = supabase
      .channel(`fixed-costs-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fixed_costs', filter: `household_id=eq.${household.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, load]);

  return { items, loading, reload: load };
}
