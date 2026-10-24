-- Budgets: Monatslimit für eine oder mehrere Kategorien, pro Person oder gemeinsam.
-- Keine Kategorie gewählt = alle Ausgaben zählen.
-- Darf gefahrlos mehrfach ausgeführt werden.

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  icon          text not null default '💶',
  category_ids  uuid[] not null default '{}',
  person_id     uuid references auth.users on delete cascade, -- null = gemeinsam
  amount_cents  bigint not null check (amount_cents > 0),       -- pro Monat
  created_at    timestamptz not null default now()
);
create index if not exists budgets_household on public.budgets (household_id);

alter table public.budgets enable row level security;
drop policy if exists "Mitglieder: Budgets" on public.budgets;
create policy "Mitglieder: Budgets" on public.budgets
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;

do $$
begin
  alter publication supabase_realtime add table public.budgets;
exception when duplicate_object then null;
end;
$$;
