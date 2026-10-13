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

/** Union des deux téléphones. La position la plus avancée gagne, les listes s'ajoutent. */
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
  const positions = { ...there.positions };
  for (const [book, pos] of Object.entries(here.positions)) {
    const n = Number(book);
    positions[n] = positions[n] ? furtherPoint(positions[n], pos) : pos;
  }
  const plans = { ...there.plans };
  for (const [id, state] of Object.entries(here.plans)) {
    plans[id] = plans[id] ? furtherPlan(plans[id], state) : state;
  }
  const saved = [...here.saved];
  for (const passage of there.saved) if (!saved.some((s) => s.id === passage.id)) saved.push(passage);
  const prayers = new Map(there.customPrayers.map((prayer) => [prayer.id, prayer]));
  for (const prayer of here.customPrayers) {
    const prev = prayers.get(prayer.id);
    if (!prev || prayer.updatedAt >= prev.updatedAt) prayers.set(prayer.id, prayer);
  }
  const pinned = [...here.pinnedPrayers];
  for (const id of there.pinnedPrayers) if (!pinned.includes(id)) pinned.push(id);
  const intentions = [...here.adoration.intentions];
  for (const item of there.adoration.intentions) if (!intentions.some((i) => i.id === item.id)) intentions.push(item);
  const themeScores = { ...there.themeScores };
  for (const [theme, score] of Object.entries(here.themeScores)) {
    const key = theme as keyof typeof themeScores;
    themeScores[key] = Math.max(themeScores[key] ?? 0, score ?? 0);
  }
  const merged = prepareStored({
    ...there,
    ...here,
    liked: [...new Set([...here.liked, ...there.liked])],
    saved,
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
    pinnedPrayers: pinned,
    customPrayers: [...prayers.values()],
    confession: { items: here.confession.items, lastConfession: later(here.confession.lastConfession, there.confession.lastConfession) },
    confessionLock: here.confessionLock,
    rosary: {
      ...here.rosary,
      session: furtherStep(here.rosary.session, there.rosary.session),
      last: later(here.rosary.last, there.rosary.last),
      count: Math.max(here.rosary.count, there.rosary.count),
    },
    adoration: {
      ...here.adoration,
      session: furtherStep(here.adoration.session, there.adoration.session),
      last: later(here.adoration.last, there.adoration.last),
      count: Math.max(here.adoration.count, there.adoration.count),
      intentions,
    },
  });
  return { ...merged, streak: currentStreak(merged) };
}

let running = false;
let again = false;

/** Pousse la progression, en la fusionnant avec celle du cloud. Sans projet Supabase, ne fait rien. */
export async function syncProgress(getLocal: () => Progress, hydrate: (next: Progress) => void) {
  if (!supabase) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const next = await once(getLocal());
      if (next) hydrate(next);
    } while (again);
  } finally {
    running = false;
  }
}

async function once(local: Progress): Promise<Progress | null> {
  const client = supabase;
  if (!client) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await client.from('user_state').select('state').eq('user_id', userId).maybeSingle();
  if (error) return null;
  const remote = data?.state ? prepareStored(data.state) : null;
  const merged = remote ? mergeProgress(local, remote) : local;
  const payload = cloudState(merged);
  const { error: writeError } = await client.from('user_state').upsert({
    user_id: userId,
    state: payload,
    updated_at: new Date().toISOString(),
  });
  if (writeError || !remote) return null;
  return JSON.stringify(cloudState(local)) === JSON.stringify(payload) ? null : merged;
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
