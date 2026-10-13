import { type Progress, prepareStored, today } from './storage';
import { currentUserId, supabase } from './supabase';
import { currentStreak, type DayLog, EMPTY_DAY } from './today';

/** Ce qui part dans le cloud : la date de confession oui, la liste et le verrou non. */
export function cloudState(p: Progress): Progress {
  return {
    ...p,
    confession: { items: [], lastConfession: p.confession.lastConfession },
    confessionLock: true,
  };
}

/** Les stamps sont gardés six mois : au-delà, un appareil resté éteint aussi longtemps repart de zéro. */
const STAMP_TTL = 180 * 24 * 60 * 60 * 1000;

const stampAt = (p: Progress, key: string) => p.stamps[key] ?? 0;

/**
 * Fusionne une liste d'éléments identifiés. Un élément présent des deux côtés reste. Présent d'un seul
 * côté, il reste sauf si l'autre côté l'a retiré après : c'est le stamp le plus récent qui décide.
 */
function mergeItems<T>(
  here: Progress,
  there: Progress,
  items: (p: Progress) => T[],
  id: (item: T) => string,
  stampKey: (id: string) => string,
  newer: (mine: T, theirs: T) => T = (mine) => mine,
): T[] {
  const mine = items(here);
  const theirs = items(there);
  const theirById = new Map(theirs.map((item) => [id(item), item]));
  const mineIds = new Set(mine.map(id));
  const out: T[] = [];
  for (const item of mine) {
    const other = theirById.get(id(item));
    const key = stampKey(id(item));
    if (other) out.push(newer(item, other));
    else if (stampAt(here, key) >= stampAt(there, key)) out.push(item);
  }
  for (const item of theirs) {
    if (mineIds.has(id(item))) continue;
    const key = stampKey(id(item));
    if (stampAt(there, key) >= stampAt(here, key)) out.push(item);
  }
  return out;
}

/** Un geste explicite plus récent d'un côté l'emporte en bloc ; à égalité, on garde le plus avancé. */
function byStamp<T>(here: Progress, there: Progress, key: string, mine: T, theirs: T, tie: (a: T, b: T) => T): T {
  const a = stampAt(here, key);
  const b = stampAt(there, key);
  if (a === b) return tie(mine, theirs);
  return a > b ? mine : theirs;
}

/** Union des deux téléphones. Le geste le plus récent gagne, sinon la position la plus avancée ; les listes s'ajoutent. */
export function mergeProgress(local: Progress, remote: Progress): Progress {
  const here = prepareStored(local);
  const there = prepareStored(remote);
  const d = today();
  const readToday = [...new Set([here, there].filter((p) => p.day === d).flatMap((p) => p.readToday))];
  const chaptersToday = [...new Set([here, there].filter((p) => p.day === d).flatMap((p) => p.chaptersToday))];
  const days: Record<string, DayLog> = {};
  for (const date of new Set([...Object.keys(here.days), ...Object.keys(there.days)])) {
    days[date] = mergeDay(here.days[date], there.days[date]);
  }
  const positions: Progress['positions'] = {};
  for (const book of new Set([...Object.keys(here.positions), ...Object.keys(there.positions)])) {
    const n = Number(book);
    const a = here.positions[n];
    const b = there.positions[n];
    const pos = a && b ? byStamp(here, there, `pos:${n}`, a, b, furtherPoint) : (a ?? b);
    if (pos) positions[n] = pos;
  }
  const plans: Progress['plans'] = {};
  for (const id of new Set([...Object.keys(here.plans), ...Object.keys(there.plans)])) {
    const a = here.plans[id];
    const b = there.plans[id];
    const key = `plan:${id}`;
    // Arrêter un plan est un geste : le plan absent d'un côté et plus récent que l'autre disparaît.
    const sa = stampAt(here, key);
    const sb = stampAt(there, key);
    const plan = sa === sb ? (a && b ? furtherPlan(a, b) : (a ?? b)) : sa > sb ? a : b;
    if (plan) plans[id] = plan;
  }
  const themeScores = byStamp(here, there, 'scores', here.themeScores, there.themeScores, (mine, theirs) => {
    const best = { ...theirs };
    for (const [theme, score] of Object.entries(mine)) {
      const key = theme as keyof typeof best;
      best[key] = Math.max(best[key] ?? 0, score ?? 0);
    }
    return best;
  });
  const cutoff = Date.now() - STAMP_TTL;
  const stamps: Progress['stamps'] = {};
  for (const [key, at] of [...Object.entries(there.stamps), ...Object.entries(here.stamps)]) {
    if (at >= cutoff) stamps[key] = Math.max(stamps[key] ?? 0, at);
  }
  const merged = prepareStored({
    ...there,
    ...here,
    liked: mergeItems(
      here,
      there,
      (p) => p.liked,
      (id) => id,
      (id) => `liked:${id}`,
    ),
    saved: mergeItems(
      here,
      there,
      (p) => p.saved,
      (item) => item.id,
      (id) => `saved:${id}`,
    ),
    themeScores,
    day: d,
    readToday,
    chaptersToday,
    days,
    seenMilestones: [...new Set([...here.seenMilestones, ...there.seenMilestones])],
    displayName: here.displayName.trim() || there.displayName.trim(),
    lastOffice: later(here.lastOffice, there.lastOffice),
    lastActiveDay: later(here.lastActiveDay, there.lastActiveDay),
    currentBook: here.currentBook,
    positions,
    chaptersRead: [...new Set([...here.chaptersRead, ...there.chaptersRead])],
    plans,
    reminder: here.reminder,
    pinnedPrayers: mergeItems(
      here,
      there,
      (p) => p.pinnedPrayers,
      (id) => id,
      (id) => `pin:${id}`,
    ),
    customPrayers: mergeItems(
      here,
      there,
      (p) => p.customPrayers,
      (prayer) => prayer.id,
      (id) => `prayer:${id}`,
      (mine, theirs) => (mine.updatedAt >= theirs.updatedAt ? mine : theirs),
    ),
    confession: { items: here.confession.items, lastConfession: later(here.confession.lastConfession, there.confession.lastConfession) },
    confessionLock: here.confessionLock,
    rosary: {
      ...here.rosary,
      session: byStamp(here, there, 'rosary', here.rosary.session, there.rosary.session, furtherStep),
      last: later(here.rosary.last, there.rosary.last),
      count: Math.max(here.rosary.count, there.rosary.count),
    },
    adoration: {
      ...here.adoration,
      session: byStamp(here, there, 'adoration', here.adoration.session, there.adoration.session, furtherStep),
      last: later(here.adoration.last, there.adoration.last),
      count: Math.max(here.adoration.count, there.adoration.count),
      intentions: mergeItems(
        here,
        there,
        (p) => p.adoration.intentions,
        (item) => item.id,
        (id) => `intent:${id}`,
      ),
    },
    stamps,
  });
  return { ...merged, streak: currentStreak(merged) };
}

type Apply = (update: (local: Progress) => Progress) => void;

let inflight: Promise<boolean> | null = null;
let again = false;
/** Dernier état que le cloud est connu pour contenir : inutile de le relire ni de le renvoyer s'il n'a pas bougé. */
let lastPushed: { userId: string; json: string } | null = null;

/** Tri des clés : jsonb ne garde pas l'ordre, et l'ordre ne doit pas compter pour comparer deux états. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * Pousse la progression, en la fusionnant avec celle du cloud. Sans projet Supabase, ne fait rien.
 * Le résultat est fusionné dans l'état courant au retour, pas collé par-dessus. Résout à vrai quand
 * le cloud contient bien l'état local.
 */
export function syncProgress(getLocal: () => Progress, apply: Apply): Promise<boolean> {
  if (!supabase) return Promise.resolve(false);
  if (inflight) {
    again = true;
    return inflight;
  }
  inflight = (async () => {
    let ok = false;
    try {
      do {
        again = false;
        const result = await once(getLocal());
        ok = result.ok;
        const merged = result.merged;
        if (merged) apply((local) => mergeProgress(local, merged));
      } while (again);
      return ok;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function once(local: Progress): Promise<{ ok: boolean; merged: Progress | null }> {
  const client = supabase;
  if (!client) return { ok: false, merged: null };
  const userId = await currentUserId();
  if (!userId) return { ok: false, merged: null };
  const localJson = canonical(cloudState(local));
  if (lastPushed?.userId === userId && lastPushed.json === localJson) return { ok: true, merged: null };
  const { data, error } = await client.from('user_state').select('state').eq('user_id', userId).maybeSingle();
  if (error) return { ok: false, merged: null };
  const remote = data?.state ? prepareStored(data.state) : null;
  const merged = remote ? mergeProgress(local, remote) : local;
  const json = canonical(cloudState(merged));
  let ok = true;
  if (!data?.state || canonical(data.state) !== json) {
    const { error: writeError } = await client.from('user_state').upsert({
      user_id: userId,
      state: cloudState(merged),
      updated_at: new Date().toISOString(),
    });
    ok = !writeError;
  }
  if (ok) lastPushed = { userId, json };
  return { ok, merged: remote && json !== localJson ? merged : null };
}

function mergeDay(a: DayLog | undefined, b: DayLog | undefined): DayLog {
  if (!a) return b ?? EMPTY_DAY;
  if (!b) return a;
  return {
    verses: Math.max(a.verses, b.verses),
    gospel: a.gospel || b.gospel,
    office: a.office || b.office,
    rosary: a.rosary || b.rosary,
    adoration: a.adoration || b.adoration,
    reading: a.reading || b.reading,
  };
}

function furtherPoint(a: { chapter: number; verse: number }, b: { chapter: number; verse: number }) {
  if (a.chapter !== b.chapter) return a.chapter > b.chapter ? a : b;
  return a.verse >= b.verse ? a : b;
}

function furtherPlan(a: Progress['plans'][string], b: Progress['plans'][string]) {
  const chosen = a.pos !== b.pos ? (a.pos > b.pos ? a : b) : a.verse >= b.verse ? a : b;
  return { start: a.start < b.start ? a.start : b.start, pos: chosen.pos, verse: chosen.verse };
}

function furtherStep<T extends { step: number }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return a.step >= b.step ? a : b;
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
