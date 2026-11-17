-- 1. Sparziele ohne festen Zielbetrag erlauben (z. B. „Urlaub“ oder „Auto-Rücklage“ als Topf).
-- 2. Fixkosten können auf ein Sparziel einzahlen (z. B. Bausparer monatlich aufs Hauskonto).
-- Darf gefahrlos mehrfach ausgeführt werden.

alter table public.savings_goals alter column target_cents drop not null;

alter table public.fixed_costs
  add column if not exists savings_goal_id uuid references public.savings_goals on delete set null;

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
                            person_id, note, source, fixed_cost_id, savings_goal_id, created_by)
  select d.household_id, d.type, d.amount_cents, d.category_id, d.due_on,
         d.person_id, d.name, 'fixkosten', d.id, d.savings_goal_id, d.created_by
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
