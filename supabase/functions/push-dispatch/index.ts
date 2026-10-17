// Envoi des notifications push de la communauté. Appelée par la base (pg_net, voir 017_push_notifications.sql) avec le
// secret partagé PUSH_DISPATCH_SECRET dans l'en-tête x-push-secret ; verify_jwt est donc désactivé (supabase/config.toml).
// Déploiement : supabase functions deploy push-dispatch push-receipts --no-verify-jwt
// Variables : PUSH_DISPATCH_SECRET, EXPO_ACCESS_TOKEN (facultatif, « enhanced security » d'Expo), SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY (fournies par Supabase).
//
// Flux : claim_push_outbox (verrou « for update skip locked », idempotent) -> lots de 100 vers Expo -> tickets enregistrés
// (push_report_sent) ; « DeviceNotRegistered » supprime le jeton. Les reçus sont relevés par push-receipts.

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;
const ROUNDS = 5;

type Row = { id: number; user_id: string; kind: string; title: string; body: string; url: string; tokens: string[] };
type Outcome = { id: number; tickets: { ticket: string; token: string }[]; errors: string[]; retry: boolean };

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

async function sendBatch(messages: Record<string, unknown>[], accessToken: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return await fetch(EXPO_SEND, { method: 'POST', headers, body: JSON.stringify(messages), signal: AbortSignal.timeout(20_000) });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (!secret || !safeEqual(req.headers.get('x-push-secret') ?? '', secret)) return json(401, { error: 'unauthorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(500, { error: 'config' });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;

  let sent = 0;
  let dropped = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const claimed = await supabase.rpc('claim_push_outbox', { p_limit: BATCH });
    if (claimed.error) {
      console.error('claim_push_outbox', claimed.error.message);
      return json(500, { error: 'claim' });
    }
    const rows = (claimed.data ?? []) as Row[];
    if (rows.length === 0) break;

    // Un message par jeton ; `owners[i]` retrouve la ligne d'outbox du message i.
    const messages: Record<string, unknown>[] = [];
    const owners: { id: number; token: string }[] = [];
    const outcomes = new Map<number, Outcome>();
    for (const row of rows) {
      outcomes.set(row.id, { id: row.id, tickets: [], errors: [], retry: false });
      for (const token of row.tokens) {
        messages.push({
          to: token,
          title: row.title,
          body: row.body,
          data: { url: row.url },
          channelId: 'communaute',
          priority: 'default',
          ttl: 86_400,
        });
        owners.push({ id: row.id, token });
      }
    }

    for (let start = 0; start < messages.length; start += BATCH) {
      const chunk = messages.slice(start, start + BATCH);
      const who = owners.slice(start, start + BATCH);
      try {
        const res = await sendBatch(chunk, accessToken);
        if (!res.ok) {
          // 429 et 5xx : on réessaiera ; un 4xx demande de corriger le message, inutile de le renvoyer tel quel.
          const retry = res.status === 429 || res.status >= 500;
          for (const o of who) {
            const out = outcomes.get(o.id);
            if (!out) continue;
            out.errors.push(`http_${res.status}`);
            out.retry = out.retry || retry;
          }
          continue;
        }
        const body = (await res.json()) as { data?: { status: string; id?: string; message?: string; details?: { error?: string } }[] };
        const tickets = body.data ?? [];
        for (let i = 0; i < who.length; i++) {
          const out = outcomes.get(who[i].id);
          const ticket = tickets[i];
          if (!out) continue;
          if (ticket?.status === 'ok' && ticket.id) {
            out.tickets.push({ ticket: ticket.id, token: who[i].token });
            sent++;
            continue;
          }
          const code = ticket?.details?.error ?? 'no_ticket';
          out.errors.push(code);
          if (code === 'DeviceNotRegistered') {
            await supabase.rpc('push_drop_token', { p_token: who[i].token });
            dropped++;
          } else if (code === 'MessageRateExceeded') {
            out.retry = true;
          }
        }
      } catch (error) {
        console.error('Envoi à Expo impossible', error instanceof Error ? error.message : error);
        for (const o of who) {
          const out = outcomes.get(o.id);
          if (!out) continue;
          out.errors.push('network');
          out.retry = true;
        }
      }
    }

    const report = [...outcomes.values()].map((o) => ({
      id: o.id,
      tickets: o.tickets,
      error: o.errors.length ? [...new Set(o.errors)].join(',') : null,
      retry: o.retry,
    }));
    const reported = await supabase.rpc('push_report_sent', { p_results: report });
    if (reported.error) console.error('push_report_sent', reported.error.message);
    if (rows.length < BATCH) break;
  }
  return json(200, { sent, dropped });
});
