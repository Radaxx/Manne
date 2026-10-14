import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { NewsItem } from '../supabase/functions/news/rss';
import { supabase } from './supabase';

// « L'Église aujourd'hui » : les titres de Vatican News, de l'Église catholique en France et de cath.ch,
// réunis par la fonction Supabase `news`. Le téléphone ne contacte qu'elle ; l'article s'ouvre chez
// l'éditeur quand on le choisit. Sans projet Supabase configuré, il n'y a pas d'actualités.

export type { NewsItem };

const KEY = 'manne/news';
const FRESH = 30 * 60 * 1000;

type Cached = { at: number; items: NewsItem[] };

const isItem = (v: unknown): v is NewsItem =>
  !!v &&
  typeof v === 'object' &&
  ['id', 'source', 'sourceName', 'title', 'summary', 'link', 'published'].every(
    (k) => typeof (v as Record<string, unknown>)[k] === 'string',
  ) &&
  /^https:\/\//.test((v as NewsItem).link);

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const cached = raw ? (JSON.parse(raw) as Cached) : null;
    return cached && Array.isArray(cached.items) ? { at: cached.at, items: cached.items.filter(isItem) } : null;
  } catch {
    return null;
  }
}

let inflight: Promise<NewsItem[]> | null = null;

/** Les actualités : celles du cache si elles ont moins de 30 minutes, sinon celles de la fonction. */
export function loadNews(): Promise<NewsItem[]> {
  const client = supabase;
  if (!client) return Promise.resolve([]);
  inflight ??= (async () => {
    const cached = await readCache();
    if (cached && Date.now() - cached.at < FRESH) return cached.items;
    try {
      const { data, error } = await client.functions.invoke<{ items: unknown[] }>('news', { method: 'GET' });
      if (error || !data || !Array.isArray(data.items)) throw error ?? new Error('Réponse vide');
      const items = data.items.filter(isItem);
      AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), items })).catch(() => {});
      return items;
    } catch (e) {
      // Hors connexion : les derniers titres connus valent mieux que rien.
      if (cached) return cached.items;
      throw e;
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export type NewsState = { items: NewsItem[]; loading: boolean; error: boolean; available: boolean };

export function useNews(): NewsState {
  const [state, setState] = useState<NewsState>({ items: [], loading: !!supabase, error: false, available: !!supabase });
  useEffect(() => {
    let alive = true;
    loadNews()
      .then((items) => alive && setState({ items, loading: false, error: false, available: !!supabase }))
      .catch(() => alive && setState({ items: [], loading: false, error: true, available: !!supabase }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/**
 * Les titres du jour pour le fil Découvrir : ceux des dernières 48 heures, une source après l'autre,
 * cinq au plus. Le fil reste un lieu de prière, pas un flux d'information.
 */
export function headlines(items: NewsItem[], now = Date.now(), count = 5): NewsItem[] {
  const since = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const recent = items.filter((i) => i.published >= since);
  const bySource = new Map<string, NewsItem[]>();
  for (const item of recent) bySource.set(item.source, [...(bySource.get(item.source) ?? []), item]);
  const queues = [...bySource.values()];
  const out: NewsItem[] = [];
  for (let round = 0; out.length < count && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && out.length < count) out.push(q[round]);
  }
  return out;
}

/** « il y a 3 h », « hier », « le 12 octobre » */
export function publishedAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return minutes <= 1 ? 'à l’instant' : `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}
