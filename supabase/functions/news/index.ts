// « L'Église aujourd'hui » : les titres récents de Vatican News, de l'Église catholique en France et de
// cath.ch, réunis en une liste. La fonction lit les flux au plus toutes les 30 minutes (cache en mémoire) :
// l'app n'interroge qu'elle, et les sites d'actualité ne voient pas les téléphones.
// Déploiement : supabase functions deploy news --no-verify-jwt

import { mergeFeeds, type NewsItem, parseFeed, SOURCES } from './rss.ts';

const TTL = 30 * 60 * 1000;
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=900',
};

let cache: { at: number; items: NewsItem[] } | null = null;

async function read(source: (typeof SOURCES)[number]): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Manne (application catholique ; lecture des titres RSS)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${source.id} ${res.status}`);
  return parseFeed(await res.text(), source);
}

async function refresh(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(SOURCES.map(read));
  const feeds = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  for (const r of results) if (r.status === 'rejected') console.warn('Flux indisponible :', r.reason);
  // Si tous les flux échouent, on garde la dernière liste plutôt que de n'avoir rien.
  if (feeds.length === 0 && cache) return cache.items;
  return mergeFeeds(feeds);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), items: await refresh() };
  return new Response(JSON.stringify({ updated: new Date(cache.at).toISOString(), items: cache.items }), { headers: HEADERS });
});
