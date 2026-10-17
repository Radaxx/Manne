// Relève les reçus des notifications push (Expo conseille d'attendre 15 minutes ; il les garde 24 heures) et supprime les
// jetons que l'appareil ne reconnaît plus (« DeviceNotRegistered »). Appelée toutes les 15 minutes par pg_cron, avec le
// secret partagé PUSH_DISPATCH_SECRET dans l'en-tête x-push-secret (verify_jwt désactivé, voir supabase/config.toml).
// Variables : PUSH_DISPATCH_SECRET, EXPO_ACCESS_TOKEN (facultatif), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH = 1000;

type Receipt = { status: string; message?: string; details?: { error?: string } };

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (!secret || !safeEqual(req.headers.get('x-push-secret') ?? '', secret)) return json(401, { error: 'unauthorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(500, { error: 'config' });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;

  let checked = 0;
  let failed = 0;
  for (let round = 0; round < 5; round++) {
    const claimed = await supabase.rpc('claim_push_tickets', { p_limit: BATCH });
    if (claimed.error) {
      console.error('claim_push_tickets', claimed.error.message);
      return json(500, { error: 'claim' });
    }
    const tickets = (claimed.data ?? []) as { ticket_id: string; token: string }[];
    if (tickets.length === 0) break;

    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    let receipts: Record<string, Receipt> = {};
    try {
      const res = await fetch(EXPO_RECEIPTS, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: tickets.map((t) => t.ticket_id) }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        // Les tickets réclamés redeviennent disponibles au bout de 10 minutes.
        console.error('getReceipts', res.status);
        return json(502, { error: 'expo' });
      }
      receipts = ((await res.json()) as { data?: Record<string, Receipt> }).data ?? {};
    } catch (error) {
      console.error('getReceipts impossible', error instanceof Error ? error.message : error);
      return json(502, { error: 'network' });
    }

    const report = tickets.map((t) => {
      const receipt = receipts[t.ticket_id];
      if (!receipt) return { ticket: t.ticket_id, status: 'missing' };
      if (receipt.status === 'ok') return { ticket: t.ticket_id, status: 'ok' };
      failed++;
      return { ticket: t.ticket_id, status: 'error', error: receipt.details?.error ?? receipt.message ?? 'error' };
    });
    const reported = await supabase.rpc('push_report_receipts', { p_results: report });
    if (reported.error) console.error('push_report_receipts', reported.error.message);
    checked += tickets.length;
    if (tickets.length < BATCH) break;
  }
  return json(200, { checked, failed });
});
