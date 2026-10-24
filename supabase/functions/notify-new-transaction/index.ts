// Supabase Edge Function: Push-Nachricht an die anderen Haushaltsmitglieder, sobald eine
// neue Buchung angelegt wird. Wird vom Datenbank-Trigger `transactions_notify` mit
// { transaction_id } aufgerufen; die Buchung wird hier selbst geladen, daher braucht der
// Aufruf kein Geheimnis. Mit { test: true } und Login-Token schickt sie eine Testnachricht
// an die eigenen Geräte.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY
// stellt Supabase automatisch bereit). "Verify JWT" muss ausgeschaltet sein.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

webpush.setVapidDetails(
  'mailto:finanzen-beier@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Message {
  title: string;
  body: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendToUsers(userIds: string[], msg: Message) {
  if (!userIds.length) return { web: 0, expo: 0 };

  // Web-Push (Browser / Startbildschirm-App)
  const { data: subs } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, subscription')
    .in('user_id', userIds);
  let web = 0;
  await Promise.all(
    (subs ?? []).map(async ({ endpoint, subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify({ ...msg, url: '/' }));
        web++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('web_push_subscriptions').delete().eq('endpoint', endpoint);
        } else {
          console.error('Web-Push fehlgeschlagen', status, e);
        }
      }
    }),
  );

  // Expo-Push (spätere native App)
  const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', userIds);
  if (tokens?.length) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(tokens.map(({ token }) => ({ to: token, ...msg, channelId: 'buchungen', sound: 'default' }))),
    });
  }
  return { web, expo: tokens?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  const payload = await req.json().catch(() => ({}));

  if (payload.test) {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data } = await supabase.auth.getUser(token);
    if (!data.user) return json({ error: 'Nicht angemeldet' }, 401);
    const result = await sendToUsers([data.user.id], {
      title: 'Finanzen Beier',
      body: 'Benachrichtigungen funktionieren 🎉',
    });
    return json(result);
  }

  if (!payload.transaction_id) return json({ error: 'transaction_id fehlt' }, 400);

  const { data: tx } = await supabase
    .from('transactions')
    .select('household_id, type, amount_cents, category_id, note, source, created_by, created_at')
    .eq('id', payload.transaction_id)
    .single();
  // Nur frische, von Hand eingetragene Buchungen melden (schützt vor wiederholten Aufrufen).
  if (!tx || tx.source !== 'manuell' || Date.now() - Date.parse(tx.created_at) > 5 * 60_000) {
    return json({ skipped: true });
  }

  const [{ data: members }, { data: category }] = await Promise.all([
    supabase.from('household_members').select('user_id, display_name').eq('household_id', tx.household_id),
    supabase.from('categories').select('name, icon').eq('id', tx.category_id).single(),
  ]);

  const author = members?.find((m) => m.user_id === tx.created_by)?.display_name ?? 'Jemand';
  const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== tx.created_by);
  const verb = tx.type === 'ausgabe' ? 'hat ausgegeben' : 'hat eingenommen';
  const body = [category ? `${category.icon} ${category.name}` : null, tx.note].filter(Boolean).join(' · ');

  const result = await sendToUsers(recipients, {
    title: `${author} ${verb}: ${euro.format(tx.amount_cents / 100)}`,
    body,
  });
  return json(result);
});
