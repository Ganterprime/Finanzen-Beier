// Supabase Edge Function: schickt eine Push-Nachricht an die anderen Haushaltsmitglieder,
// sobald eine neue Buchung angelegt wird. Wird von einem Database Webhook
// (Tabelle transactions, Ereignis INSERT) aufgerufen.
import { createClient } from 'npm:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: {
    household_id: string;
    type: 'ausgabe' | 'einnahme';
    amount_cents: number;
    category_id: string;
    note: string | null;
    source: string;
    created_by: string | null;
  };
}

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  const { type, table, record } = (await req.json()) as WebhookPayload;
  // Automatisch gebuchte Fixkosten lösen keine Nachricht aus.
  if (type !== 'INSERT' || table !== 'transactions' || record.source !== 'manuell') {
    return new Response('ignored');
  }

  const [{ data: members }, { data: category }] = await Promise.all([
    supabase.from('household_members').select('user_id, display_name').eq('household_id', record.household_id),
    supabase.from('categories').select('name, icon').eq('id', record.category_id).single(),
  ]);

  const author = members?.find((m) => m.user_id === record.created_by)?.display_name ?? 'Jemand';
  const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== record.created_by);
  if (!recipients.length) return new Response('no recipients');

  const { data: tokens } = await supabase.from('push_tokens').select('token').in('user_id', recipients);
  if (!tokens?.length) return new Response('no tokens');

  const verb = record.type === 'ausgabe' ? 'hat ausgegeben' : 'hat eingenommen';
  const body = [category ? `${category.icon} ${category.name}` : null, record.note].filter(Boolean).join(' · ');
  const messages = tokens.map(({ token }) => ({
    to: token,
    title: `${author} ${verb}: ${euro.format(record.amount_cents / 100)}`,
    body,
    channelId: 'buchungen',
    sound: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  return new Response(await res.text(), { status: res.status });
});
