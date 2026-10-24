export type EntryType = 'ausgabe' | 'einnahme';

export type Frequency = 'monatlich' | 'quartalsweise' | 'halbjaehrlich' | 'jaehrlich';

export interface Household {
  id: string;
  name: string;
  currency: string;
}

export interface Member {
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  display_name: string;
  color: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  type: EntryType;
  icon: string;
  color: string;
  is_fixed_cost: boolean;
  sort_order: number;
  archived: boolean;
}

export interface Transaction {
  id: string;
  household_id: string;
  type: EntryType;
  amount_cents: number;
  category_id: string;
  booked_on: string;
  person_id: string | null;
  note: string | null;
  source: 'manuell' | 'fixkosten';
  fixed_cost_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FixedCost {
  id: string;
  household_id: string;
  name: string;
  type: EntryType;
  category_id: string;
  amount_cents: number;
  frequency: Frequency;
  due_day: number;
  start_date: string;
  end_date: string | null;
  person_id: string | null;
  active: boolean;
  note: string | null;
}

/** 'alle' = gemeinsame Ansicht, sonst die user_id einer Person */
export type Scope = 'alle' | string;

/** month: 1–12, null = ganzes Jahr */
export interface Period {
  year: number;
  month: number | null;
}
