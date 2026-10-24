-- Sparziele: Zielbetrag bis Zieldatum. Einzahlungen sind Buchungen, die einem Ziel
-- zugeordnet werden (Ausgabe = Einzahlung, Einnahme = Entnahme).
-- Darf gefahrlos mehrfach ausgeführt werden.

create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  icon          text not null default '🎯',
  color         text not null default '#3FA37A',
  target_cents  bigint not null check (target_cents > 0),
  start_cents   bigint not null default 0 check (start_cents >= 0),
  target_date   date,
  person_id     uuid references auth.users on delete set null, -- null = gemeinsam
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists savings_goals_household on public.savings_goals (household_id);

alter table public.transactions
  add column if not exists savings_goal_id uuid references public.savings_goals on delete set null;
create index if not exists transactions_savings_goal on public.transactions (savings_goal_id)
  where savings_goal_id is not null;

alter table public.savings_goals enable row level security;
drop policy if exists "Mitglieder: Sparziele" on public.savings_goals;
create policy "Mitglieder: Sparziele" on public.savings_goals
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

grant select, insert, update, delete on public.savings_goals to authenticated;
grant all on public.savings_goals to service_role;

do $$
begin
  alter publication supabase_realtime add table public.savings_goals;
exception when duplicate_object then null;
end;
$$;
