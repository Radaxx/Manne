import { useFocusEffect } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import type { Result } from './profile';
import {
  fetchMyShowcase,
  hidePassage,
  hidePrayer,
  passageKey,
  type Showcase,
  type ShowcasePassage,
  type ShowcasePrayer,
  setIntentionOnProfile,
  showPassage,
  showPrayer,
} from './showcase';
import { supabase } from './supabase';

// ——— Ce que J'affiche : un petit store partagé, pour que les interrupteurs soient justes partout ———

type Mine = { owner: string | null; showcase: Showcase | null };

let mine: Mine = { owner: null, showcase: null };
const listeners = new Set<() => void>();

function setMine(next: Mine) {
  mine = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getMine = () => mine;

async function linkedUserId(): Promise<string | null> {
  const client = supabase;
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    return user && user.is_anonymous === false ? user.id : null;
  } catch {
    return null;
  }
}

let inflight: Promise<Showcase | null> | null = null;

/** Relit la vitrine du compte courant. Renvoie null sans compte relié, sans profil ou hors ligne. */
export function refreshMyShowcase(): Promise<Showcase | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    const owner = await linkedUserId();
    if (!owner) {
      if (mine.owner !== null) setMine({ owner: null, showcase: null });
      return null;
    }
    const result = await fetchMyShowcase();
    if (!result.ok) return mine.owner === owner ? mine.showcase : null;
    setMine({ owner, showcase: result.showcase });
    return result.showcase;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

type Current = { kind: 'none' } | { kind: 'offline' } | { kind: 'ok'; showcase: Showcase };

/** La vitrine connue pour le compte courant, relue si elle manque ou appartient à un autre compte. */
async function currentShowcase(): Promise<Current> {
  const owner = await linkedUserId();
  if (!owner) return { kind: 'none' };
  const known = mine.owner === owner ? mine.showcase : null;
  if (known) return { kind: 'ok', showcase: known };
  const fresh = await refreshMyShowcase();
  return fresh ? { kind: 'ok', showcase: fresh } : { kind: 'offline' };
}

function patch(owner: string, change: (s: Showcase) => Showcase) {
  if (mine.owner !== owner || !mine.showcase) return;
  setMine({ owner, showcase: change(mine.showcase) });
}

export async function setPassageShown(passage: ShowcasePassage, on: boolean): Promise<Result> {
  const result = await (on ? showPassage(passage) : hidePassage(passage));
  if (!result.ok) return result;
  const owner = await linkedUserId();
  if (!owner) return result;
  const key = passageKey(passage);
  patch(owner, (s) => {
    const rest = s.passages.filter((p) => passageKey(p) !== key);
    return { ...s, passages: on ? [passage, ...rest] : rest };
  });
  return result;
}

export async function setPrayerShown(prayer: ShowcasePrayer, on: boolean): Promise<Result> {
  const result = await (on ? showPrayer(prayer.id, prayer.title, prayer.text) : hidePrayer(prayer.id));
  if (!result.ok) return result;
  const owner = await linkedUserId();
  if (!owner) return result;
  patch(owner, (s) => {
    const rest = s.prayers.filter((p) => p.id !== prayer.id);
    return { ...s, prayers: on ? [prayer, ...rest] : rest };
  });
  return result;
}

/** Afficher ou retirer une intention de mon profil, puis relire ma vitrine. */
export async function setIntentionShown(id: string, on: boolean): Promise<Result> {
  const result = await setIntentionOnProfile(id, on);
  if (result.ok) void refreshMyShowcase();
  return result;
}

const OFFLINE: Result = { ok: false, message: 'Pas de réseau pour le moment.' };

/**
 * Une prière affichée vient d'être modifiée sur le téléphone : sa copie suit.
 * Null si elle n'est pas affichée (ou sans compte relié) ; un échec dit que la copie n'est pas à jour.
 */
export async function updatePrayerCopy(prayer: ShowcasePrayer): Promise<Result | null> {
  const current = await currentShowcase();
  if (current.kind === 'none') return null;
  if (current.kind === 'offline') return OFFLINE;
  if (!current.showcase.prayers.some((p) => p.id === prayer.id)) return null;
  return setPrayerShown(prayer, true);
}

/** Une prière affichée vient d'être supprimée du téléphone : sa copie disparaît. Null si elle n'était pas affichée. */
export async function dropPrayerCopy(id: string): Promise<Result | null> {
  const current = await currentShowcase();
  if (current.kind === 'none') return null;
  if (current.kind === 'offline') return OFFLINE;
  if (!current.showcase.prayers.some((p) => p.id === id)) return null;
  return setPrayerShown({ id, title: '', text: '' }, false);
}

/** Des passages ne sont plus gardés : on retire la copie de ceux qui étaient affichés. */
export async function dropPassageCopies(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const current = await currentShowcase();
  if (current.kind !== 'ok') return;
  for (const passage of current.showcase.passages) {
    if (keys.includes(passageKey(passage))) await setPassageShown(passage, false);
  }
}

/** Ce que j'affiche, relu au focus de l'écran. `canShow` : compte relié avec un profil, les seuls à pouvoir afficher. */
export function useMyShowcase() {
  const { status, userId, profile } = useAuth();
  const canShow = status === 'signedIn' && !!profile;
  const snapshot = useSyncExternalStore(subscribe, getMine, getMine);
  useFocusEffect(
    useCallback(() => {
      if (canShow) void refreshMyShowcase();
    }, [canShow]),
  );
  const showcase = canShow && snapshot.owner === userId ? snapshot.showcase : null;
  return {
    /** Vrai quand les interrupteurs peuvent s'afficher et sont justes. */
    canShow,
    ready: showcase !== null,
    showcase,
    isPassageShown: (p: ShowcasePassage) => !!showcase?.passages.some((s) => passageKey(s) === passageKey(p)),
    isPrayerShown: (id: string) => !!showcase?.prayers.some((s) => s.id === id),
    isIntentionShown: (id: string) => !!showcase?.intentions.some((s) => s.id === id),
    refresh: refreshMyShowcase,
  };
}
