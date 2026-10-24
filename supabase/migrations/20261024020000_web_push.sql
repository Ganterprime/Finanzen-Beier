-- Push-Benachrichtigungen über die Web-App (Android und iPhone ab iOS 16.4)

create table public.web_push_subscriptions (
  endpoint      text primary key,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  subscription  jsonb not null,
  created_at    timestamptz not null default now()
);

alter table public.web_push_subscriptions enable row level security;
create policy "Eigene Web-Push-Abos" on public.web_push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, delete on public.web_push_subscriptions to authenticated;

-- Speichert das Abo des aktuellen Browsers. Meldet sich am selben Gerät jemand anderes an,
-- geht das Abo auf diese Person über.
create or replace function public.save_web_push_subscription(p_subscription jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  insert into web_push_subscriptions (endpoint, user_id, subscription)
  values (p_subscription ->> 'endpoint', auth.uid(), p_subscription)
  on conflict (endpoint) do update set user_id = excluded.user_id, subscription = excluded.subscription;
end;
$$;
grant execute on function public.save_web_push_subscription(jsonb) to authenticated;

-- Bei jeder neuen, von Hand eingetragenen Buchung die Edge Function aufrufen.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_new_transaction()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.source = 'manuell' then
    begin
      perform net.http_post(
        url := 'https://nptecxlfkngkzhdlwenx.supabase.co/functions/v1/notify-new-transaction',
        body := jsonb_build_object('transaction_id', new.id),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    exception when others then
      -- Eine fehlgeschlagene Benachrichtigung darf das Speichern nie verhindern.
      raise warning 'Push-Benachrichtigung fehlgeschlagen: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;

create trigger transactions_notify
  after insert on public.transactions
  for each row execute function public.notify_new_transaction();
