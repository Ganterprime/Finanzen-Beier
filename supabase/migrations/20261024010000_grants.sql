-- Neuere Supabase-Projekte geben neue Tabellen nicht mehr automatisch für die App frei.
-- Die Zugriffsregeln (Row Level Security) bleiben unverändert und schützen die Daten weiterhin.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.households,
  public.household_members,
  public.invitations,
  public.categories,
  public.fixed_costs,
  public.transactions,
  public.push_tokens
to authenticated;

grant select on public.monthly_category_totals to authenticated;

grant execute on function
  public.create_household(text, text),
  public.my_invitations(),
  public.accept_invitation(uuid, text),
  public.is_member(uuid),
  public.is_owner(uuid),
  public.shares_household(uuid)
to authenticated;

-- Doppelt angelegte Haushalte aufräumen: pro Person bleibt der zuerst angelegte.
delete from public.households h
where exists (
  select 1 from public.households h2
  where h2.created_by = h.created_by and h2.created_at < h.created_at
);
