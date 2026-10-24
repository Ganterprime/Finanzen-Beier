-- Die Edge Function arbeitet mit der Rolle service_role. Auch diese braucht in neueren
-- Supabase-Projekten ausdrückliche Rechte auf die Tabellen.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
