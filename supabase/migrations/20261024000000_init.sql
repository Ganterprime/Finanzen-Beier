-- Finanzen Beier: Grundschema
-- Haushalte, Mitglieder, Kategorien, Buchungen, Fixkosten, Einladungen, Push-Tokens.
-- Zugriff wird per Row Level Security auf Haushaltsmitglieder beschränkt.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create type public.entry_type as enum ('ausgabe', 'einnahme');

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  currency    text not null default 'EUR',
  created_by  uuid not null default auth.uid() references auth.users on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  display_name  text not null,
  color         text not null default '#4F7CAC',
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index on public.household_members (user_id);

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  email         text not null,
  invited_by    uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index on public.invitations (lower(email));

create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  type           public.entry_type not null,
  icon           text not null default '•',
  color          text not null default '#8A8A8A',
  is_fixed_cost  boolean not null default false,
  sort_order     int not null default 0,
  archived       boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (household_id, type, name)
);

create table public.fixed_costs (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  type            public.entry_type not null default 'ausgabe',
  category_id     uuid not null references public.categories on delete restrict,
  amount_cents    bigint not null check (amount_cents > 0),
  frequency       text not null default 'monatlich'
                  check (frequency in ('monatlich', 'quartalsweise', 'halbjaehrlich', 'jaehrlich')),
  due_day         int not null default 1 check (due_day between 1 and 31),
  start_date      date not null default current_date,
  end_date        date,
  person_id       uuid references auth.users on delete set null, -- null = gemeinsam
  active          boolean not null default true,
  note            text,
  last_booked_on  date,
  created_by      uuid default auth.uid() references auth.users on delete set null,
  created_at      timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.fixed_costs (household_id);

create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  type           public.entry_type not null,
  amount_cents   bigint not null check (amount_cents > 0),
  category_id    uuid not null references public.categories on delete restrict,
  booked_on      date not null default current_date,
  person_id      uuid default auth.uid() references auth.users on delete set null, -- null = gemeinsam
  note           text,
  source         text not null default 'manuell' check (source in ('manuell', 'fixkosten')),
  fixed_cost_id  uuid references public.fixed_costs on delete set null,
  created_by     uuid default auth.uid() references auth.users on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.transactions (household_id, booked_on desc);
create unique index transactions_fixed_cost_once
  on public.transactions (fixed_cost_id, booked_on) where fixed_cost_id is not null;

create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für die Zugriffsregeln
-- ---------------------------------------------------------------------------

create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members where household_id = hh and user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members
    where household_id = hh and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_household(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members a
    join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations       enable row level security;
alter table public.categories        enable row level security;
alter table public.fixed_costs       enable row level security;
alter table public.transactions      enable row level security;
alter table public.push_tokens       enable row level security;

-- Haushalte: anlegen nur über create_household()
create policy "Mitglieder lesen Haushalt" on public.households
  for select using (public.is_member(id));
create policy "Owner ändert Haushalt" on public.households
  for update using (public.is_owner(id));

-- Mitglieder: hinzufügen nur über create_household() / accept_invitation()
create policy "Mitglieder sehen Mitglieder" on public.household_members
  for select using (public.is_member(household_id));
create policy "Eigenen Eintrag ändern" on public.household_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner entfernt Mitglieder" on public.household_members
  for delete using (public.is_owner(household_id) or user_id = auth.uid());

-- Einladungen: nur Owner
create policy "Owner verwaltet Einladungen" on public.invitations
  for all using (public.is_owner(household_id)) with check (public.is_owner(household_id));

-- Kategorien, Fixkosten, Buchungen: alle Mitglieder des Haushalts
create policy "Mitglieder: Kategorien" on public.categories
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "Mitglieder: Fixkosten" on public.fixed_costs
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "Mitglieder: Buchungen" on public.transactions
  for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Push-Tokens: nur eigene
create policy "Eigene Push-Tokens" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Standardkategorien
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_categories(hh uuid)
returns void language sql security definer set search_path = public as $$
  insert into categories (household_id, name, type, icon, color, is_fixed_cost, sort_order)
  values
    (hh, 'Wohnen',               'ausgabe',  '🏠', '#4F7CAC', true,  10),
    (hh, 'Energie',              'ausgabe',  '⚡', '#E0A030', true,  20),
    (hh, 'Versicherungen',       'ausgabe',  '🛡️', '#6B8E9E', true,  30),
    (hh, 'Internet & Handy',     'ausgabe',  '📶', '#5A9BD5', true,  40),
    (hh, 'Abos & Streaming',     'ausgabe',  '📺', '#9B6BB5', true,  50),
    (hh, 'Kredite & Raten',      'ausgabe',  '🏦', '#7A7A7A', true,  60),
    (hh, 'Sparen & Anlage',      'ausgabe',  '🐷', '#3FA37A', true,  70),
    (hh, 'Lebensmittel',         'ausgabe',  '🛒', '#5BAA4A', false, 100),
    (hh, 'Drogerie & Haushalt',  'ausgabe',  '🧴', '#7FB8C9', false, 110),
    (hh, 'Mobilität',            'ausgabe',  '🚗', '#D2694B', false, 120),
    (hh, 'Gesundheit',           'ausgabe',  '💊', '#D25B7A', false, 130),
    (hh, 'Restaurant & Café',    'ausgabe',  '🍽️', '#E07B39', false, 140),
    (hh, 'Freizeit & Hobby',     'ausgabe',  '🎨', '#B5649E', false, 150),
    (hh, 'Kleidung',             'ausgabe',  '👕', '#8C6BC2', false, 160),
    (hh, 'Urlaub & Reisen',      'ausgabe',  '✈️', '#2E9CB8', false, 170),
    (hh, 'Geschenke',            'ausgabe',  '🎁', '#E05A5A', false, 180),
    (hh, 'Haustier',             'ausgabe',  '🐾', '#A0825A', false, 190),
    (hh, 'Sonstiges',            'ausgabe',  '📦', '#8A8A8A', false, 999),
    (hh, 'Gehalt',               'einnahme', '💼', '#3FA37A', true,  10),
    (hh, 'Nebeneinkommen',       'einnahme', '💡', '#5BAA4A', false, 20),
    (hh, 'Erstattungen',         'einnahme', '↩️', '#5A9BD5', false, 30),
    (hh, 'Zinsen & Dividenden',  'einnahme', '📈', '#2E9CB8', false, 40),
    (hh, 'Geschenke erhalten',   'einnahme', '🎁', '#E05A5A', false, 50),
    (hh, 'Sonstige Einnahmen',   'einnahme', '📦', '#8A8A8A', false, 999)
  on conflict do nothing;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Haushalt anlegen und Einladungen
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  hh uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  insert into households (name, created_by) values (p_name, auth.uid()) returning id into hh;
  insert into household_members (household_id, user_id, role, display_name, color)
    values (hh, auth.uid(), 'owner', p_display_name, '#4F7CAC');
  perform seed_default_categories(hh);
  return hh;
end;
$$;

-- Offene Einladungen für die E-Mail des angemeldeten Nutzers
create or replace function public.my_invitations()
returns table (id uuid, household_id uuid, household_name text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.household_id, h.name, i.expires_at
  from invitations i join households h on h.id = i.household_id
  where lower(i.email) = lower(auth.jwt() ->> 'email')
    and i.accepted_at is null
    and i.expires_at > now();
$$;

create or replace function public.accept_invitation(p_invitation uuid, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invitations;
begin
  select * into inv from invitations
  where id = p_invitation
    and lower(email) = lower(auth.jwt() ->> 'email')
    and accepted_at is null
    and expires_at > now();
  if not found then
    raise exception 'Einladung ungültig oder abgelaufen';
  end if;
  insert into household_members (household_id, user_id, role, display_name, color)
    values (inv.household_id, auth.uid(), 'member', p_display_name, '#C46A8A')
    on conflict do nothing;
  update invitations set accepted_at = now() where id = inv.id;
  return inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixkosten automatisch buchen
-- Erzeugt für jede aktive Fixkostenvorlage die fälligen Buchungen bis heute.
-- ---------------------------------------------------------------------------

create or replace function public.book_due_fixed_costs(p_fixed_cost uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  inserted int;
begin
  with fc as (
    select f.*,
      case f.frequency
        when 'monatlich' then 1
        when 'quartalsweise' then 3
        when 'halbjaehrlich' then 6
        else 12
      end as step
    from fixed_costs f
    where f.active and (p_fixed_cost is null or f.id = p_fixed_cost)
  ),
  months as (
    select fc.*, (date_trunc('month', fc.start_date) + make_interval(months => n * fc.step))::date as month_start
    from fc,
      generate_series(
        0,
        ((extract(year from current_date) - extract(year from fc.start_date)) * 12
          + extract(month from current_date) - extract(month from fc.start_date))::int / fc.step
      ) as n
  ),
  due as (
    select m.*,
      (m.month_start + (least(m.due_day,
        extract(day from (m.month_start + interval '1 month - 1 day'))::int) - 1))::date as due_on
    from months m
  )
  insert into transactions (household_id, type, amount_cents, category_id, booked_on,
                            person_id, note, source, fixed_cost_id, created_by)
  select d.household_id, d.type, d.amount_cents, d.category_id, d.due_on,
         d.person_id, d.name, 'fixkosten', d.id, d.created_by
  from due d
  where d.due_on >= d.start_date
    and d.due_on <= current_date
    and (d.end_date is null or d.due_on <= d.end_date)
    and (d.last_booked_on is null or d.due_on > d.last_booked_on)
  on conflict (fixed_cost_id, booked_on) where fixed_cost_id is not null do nothing;

  get diagnostics inserted = row_count;

  -- Auch pausierte Einträge fortschreiben, damit beim Reaktivieren nichts nachgebucht wird.
  update fixed_costs set last_booked_on = current_date
  where p_fixed_cost is null or id = p_fixed_cost;

  return inserted;
end;
$$;
revoke execute on function public.book_due_fixed_costs(uuid) from public, anon, authenticated;

create or replace function public.on_fixed_cost_saved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform book_due_fixed_costs(new.id);
  return new;
end;
$$;

create trigger fixed_cost_book_after_insert
  after insert on public.fixed_costs
  for each row execute function public.on_fixed_cost_saved();

-- Täglich um 03:00 UTC buchen (pg_cron muss im Supabase-Dashboard aktiviert sein).
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('fixkosten-buchen', '0 3 * * *', 'select public.book_due_fixed_costs()');
exception when others then
  raise notice 'pg_cron nicht verfügbar, Fixkosten-Job bitte manuell einrichten: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at pflegen
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Auswertung: Summen pro Monat, Kategorie und Person (RLS greift über security_invoker)
-- ---------------------------------------------------------------------------

create view public.monthly_category_totals with (security_invoker = true) as
select
  t.household_id,
  date_trunc('month', t.booked_on)::date as month,
  t.type,
  t.category_id,
  t.person_id,
  (t.source = 'fixkosten' or c.is_fixed_cost) as is_fixed_cost,
  sum(t.amount_cents)::bigint as total_cents,
  count(*)::int as entries
from public.transactions t
join public.categories c on c.id = t.category_id
group by 1, 2, 3, 4, 5, 6;

-- ---------------------------------------------------------------------------
-- Live-Sync
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.transactions, public.categories, public.fixed_costs;
