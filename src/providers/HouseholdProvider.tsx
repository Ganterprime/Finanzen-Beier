import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Category, Household, Member, Period, Scope } from '@/lib/types';
import { useSession } from './SessionProvider';

interface HouseholdState {
  loading: boolean;
  household: Household | null;
  members: Member[];
  categories: Category[];
  scope: Scope;
  setScope: (s: Scope) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  reload: () => Promise<void>;
  memberName: (userId: string | null) => string;
  category: (id: string) => Category | undefined;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

const now = new Date();

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scope, setScope] = useState<Scope>('alle');
  const [period, setPeriod] = useState<Period>({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const loadCategories = useCallback(async (householdId: string) => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', householdId)
      .order('sort_order')
      .order('name');
    setCategories((data as Category[]) ?? []);
  }, []);

  const reload = useCallback(async () => {
    if (!userId) {
      setHousehold(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Vorerst ein Haushalt pro Nutzer; später Umschalter zwischen mehreren.
    const { data: own } = await supabase
      .from('household_members')
      .select('household_id, households(id, name, currency)')
      .eq('user_id', userId)
      .order('joined_at')
      .limit(1)
      .maybeSingle();
    const hh = (own?.households as unknown as Household | null) ?? null;
    setHousehold(hh);
    if (hh) {
      const { data: m } = await supabase
        .from('household_members')
        .select('household_id, user_id, role, display_name, color')
        .eq('household_id', hh.id)
        .order('joined_at');
      setMembers((m as Member[]) ?? []);
      await loadCategories(hh.id);
    } else {
      setMembers([]);
      setCategories([]);
    }
    setLoading(false);
  }, [userId, loadCategories]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel(`categories-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${household.id}` },
        () => loadCategories(household.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, loadCategories]);

  const value = useMemo<HouseholdState>(
    () => ({
      loading,
      household,
      members,
      categories,
      scope,
      setScope,
      period,
      setPeriod,
      reload,
      memberName: (id) =>
        id == null ? 'Gemeinsam' : members.find((m) => m.user_id === id)?.display_name ?? 'Unbekannt',
      category: (id) => categories.find((c) => c.id === id),
    }),
    [loading, household, members, categories, scope, period, reload],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold außerhalb von HouseholdProvider');
  return ctx;
}
