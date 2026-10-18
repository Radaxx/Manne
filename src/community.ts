import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { currentUserId } from './auth/session';
import { REFUSED_TEXT, type ReportReason, SUSPENDED_TEXT } from './moderation';
import { supabase } from './supabase';

const QUEUE_KEY = 'manne/community/likes';

export type Echo = { id: string; body: string; created_at: string; mine: boolean; hidden: boolean };
export type SharedIntention = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  carries: number;
  carrying: boolean;
};

type Stat = { likes: number; echoes: number; liked: boolean };
type LikeOp = { target: string; liked: boolean };
type EchoRequest = { target: string; reference: string };

type Snapshot = {
  stats: Record<string, Stat>;
  overrides: Record<string, boolean>;
  echo: EchoRequest | null;
  revision: number;
};

/** Clé communautaire d'un passage : livre, chapitre, premier et dernier verset. */
export function communityKey(p: { book: number; chapter: number; from: number; to: number }) {
  return `${p.book}:${p.chapter}:${p.from}-${p.to}`;
}

let stats: Record<string, Stat> = {};
let overrides: Record<string, boolean> = {};
let echo: EchoRequest | null = null;
let snapshot: Snapshot = { stats, overrides, echo, revision: 0 };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { stats, overrides, echo, revision: snapshot.revision + 1 };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function shownLikes(snap: Snapshot, target: string): number | undefined {
  const stat = snap.stats[target];
  if (!stat) return undefined;
  const override = snap.overrides[target];
  if (override === undefined || override === stat.liked) return stat.likes;
  return Math.max(0, stat.likes + (override ? 1 : -1));
}

export function openEchoes(target: string, reference: string) {
  echo = { target, reference };
  emit();
}

export function closeEchoes() {
  echo = null;
  emit();
}

const queuedTargets = new Set<string>();
const failedTargets = new Set<string>();
let watchTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWatch() {
  if (watchTimer || queuedTargets.size === 0) return;
  watchTimer = setTimeout(() => {
    watchTimer = null;
    const batch = [...queuedTargets].slice(0, 30);
    for (const target of batch) queuedTargets.delete(target);
    void refreshTargets(batch).then((ok) => {
      if (!ok) for (const target of batch) if (!stats[target]) failedTargets.add(target);
      scheduleWatch();
    });
  }, 80);
}

/** Demande le compteur d'une carte devenue visible. Les demandes proches partent ensemble. */
export function watchTarget(target: string) {
  if (stats[target] || queuedTargets.has(target)) return;
  failedTargets.delete(target);
  queuedTargets.add(target);
  scheduleWatch();
}

/** Relance les compteurs restés sans réponse, au retour de l'app. */
export function retryFailed() {
  for (const target of failedTargets) queuedTargets.add(target);
  failedTargets.clear();
  scheduleWatch();
}

function asRecord(row: unknown): Record<string, unknown> | null {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
}

function readStat(row: unknown): { target: string; stat: Stat } | null {
  const record = asRecord(row);
  if (!record || typeof record.target !== 'string') return null;
  const likes = Number(record.likes);
  const echoes = Number(record.echoes);
  if (!Number.isFinite(likes) || !Number.isFinite(echoes) || typeof record.liked !== 'boolean') return null;
  return { target: record.target, stat: { likes, echoes, liked: record.liked } };
}

/** Utilisateur auquel appartiennent les compteurs en mémoire (leur « liked » est personnel). */
let statsUser: string | null = null;

async function refreshTargets(targets: string[]): Promise<boolean> {
  const client = supabase;
  if (!client || targets.length === 0) return false;
  const userId = await currentUserId();
  if (!userId) return false;
  const { data, error } = await client.rpc('community_stats', { targets });
  if (error || !Array.isArray(data)) return false;
  if (statsUser !== userId) {
    statsUser = userId;
    stats = {};
  }
  let changed = false;
  for (const row of data) {
    const parsed = readStat(row);
    if (!parsed) continue;
    stats = { ...stats, [parsed.target]: parsed.stat };
    if (overrides[parsed.target] === parsed.stat.liked) {
      overrides = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== parsed.target));
    }
    changed = true;
  }
  if (changed) emit();
  return true;
}

export function refreshTarget(target: string) {
  return refreshTargets([target]);
}

let queue: LikeOp[] | null = null;
let flushing: Promise<void> | null = null;
let flushAgain = false;

async function readQueue(): Promise<LikeOp[]> {
  if (queue) return queue;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LikeOp[]) : [];
    queue = Array.isArray(parsed) ? parsed : [];
  } catch {
    queue = [];
  }
  return queue;
}

async function persistQueue() {
  if (!queue) return;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Refus définitif de la base (donnée invalide, contrainte, droits) : rejouer l'opération échouerait
 * toujours et bloquerait les suivantes. Le réseau ou un serveur indisponible, eux, valent un nouvel essai.
 */
function rejected(error: { code?: string } | null): boolean {
  return !!error?.code && /^(22|23|42)/.test(error.code);
}

async function drainLikes(): Promise<boolean> {
  const client = supabase;
  const q = await readQueue();
  if (!client || q.length === 0) return true;
  const userId = await currentUserId();
  if (!userId) return false;
  while (queue && queue.length > 0) {
    const op = queue[0];
    const { error } = op.liked
      ? await client.from('likes').insert({ user_id: userId, target: op.target })
      : await client.from('likes').delete().eq('user_id', userId).eq('target', op.target);
    const duplicate = error?.code === '23505';
    const dropped = !duplicate && rejected(error);
    if (error && !duplicate && !dropped) return false;
    if (queue[0]?.target === op.target && queue[0]?.liked === op.liked) queue.shift();
    await persistQueue();
    if (dropped) {
      // Le compteur affiché revient à ce que dit le serveur.
      overrides = Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== op.target));
      emit();
    }
    void refreshTarget(op.target);
  }
  return true;
}

/** Rejoue les j'aime qui n'ont pas atteint le serveur. Résout quand la file a été parcourue. */
export function flushLikes(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      let ok = true;
      do {
        flushAgain = false;
        ok = await drainLikes();
      } while (ok && flushAgain);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Après une déconnexion : les j'aime en attente et les compteurs appartenaient au compte quitté.
 * Sans cela, la file partirait sous la nouvelle session anonyme.
 */
export async function resetCommunity() {
  queue = [];
  stats = {};
  statsUser = null;
  overrides = {};
  echo = null;
  queuedTargets.clear();
  failedTargets.clear();
  emit();
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Mémorise le j'aime et l'envoie. En cas d'échec, il repart au prochain lancement. */
export async function queueLike(target: string, liked: boolean) {
  overrides = { ...overrides, [target]: liked };
  emit();
  const q = await readQueue();
  queue = [...q.filter((op) => op.target !== target), { target, liked }];
  await persistQueue();
  void flushLikes();
}

export function failureMessage(message: string) {
  if (message.includes('contenu_refuse')) return REFUSED_TEXT;
  if (message.includes('compte_suspendu')) return SUSPENDED_TEXT;
  if (message.includes('compte_requis')) return 'Relie un compte pour signaler.';
  if (message.includes('Trop d')) return message;
  if (message.includes('retiré')) return message;
  if (message.includes('Déjà signalé')) return 'Déjà signalé';
  if (message.includes('longueur')) return 'Le texte est trop long.';
  return 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.';
}

async function call(fn: string, args?: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const client = supabase;
  if (!client) return { ok: false, message: 'La communauté n’est pas reliée pour le moment.' };
  if (!(await currentUserId())) return { ok: false, message: 'Les échanges demandent une connexion.' };
  const { data, error } = await client.rpc(fn, args);
  if (error) return { ok: false, message: failureMessage(error.message) };
  return { ok: true, data };
}

function readEcho(row: unknown): Echo | null {
  const record = asRecord(row);
  if (!record || typeof record.id !== 'string' || typeof record.body !== 'string' || typeof record.created_at !== 'string') return null;
  if (typeof record.mine !== 'boolean' || typeof record.hidden !== 'boolean') return null;
  return { id: record.id, body: record.body, created_at: record.created_at, mine: record.mine, hidden: record.hidden };
}

function readIntention(row: unknown): SharedIntention | null {
  const record = asRecord(row);
  if (!record || typeof record.id !== 'string' || typeof record.body !== 'string' || typeof record.created_at !== 'string') return null;
  if (typeof record.mine !== 'boolean' || typeof record.carrying !== 'boolean') return null;
  const carries = Number(record.carries);
  if (!Number.isFinite(carries)) return null;
  return { id: record.id, body: record.body, created_at: record.created_at, mine: record.mine, carries, carrying: record.carrying };
}

export async function listEchoes(target: string): Promise<{ ok: true; echoes: Echo[] } | { ok: false; message: string }> {
  const result = await call('list_echoes', { p_target: target });
  if (!result.ok) return result;
  const echoes = Array.isArray(result.data)
    ? result.data.flatMap((row) => {
        const echo = readEcho(row);
        return echo ? [echo] : [];
      })
    : [];
  return { ok: true, echoes };
}

export async function postEcho(target: string, body: string) {
  const result = await call('post_echo', { p_target: target, p_body: body });
  if (result.ok) await refreshTarget(target);
  return result;
}

export async function deleteEcho(target: string, id: string) {
  const result = await call('delete_echo', { p_id: id });
  if (result.ok) await refreshTarget(target);
  return result;
}

export async function reportEcho(target: string, id: string, reason: ReportReason = 'autre') {
  const result = await call('report_echo', { p_id: id, p_reason: reason });
  if (result.ok) await refreshTarget(target);
  return result;
}

export async function listIntentions(): Promise<{ ok: true; intentions: SharedIntention[] } | { ok: false; message: string }> {
  const result = await call('list_intentions');
  if (!result.ok) return result;
  const intentions = Array.isArray(result.data)
    ? result.data.flatMap((row) => {
        const intention = readIntention(row);
        return intention ? [intention] : [];
      })
    : [];
  return { ok: true, intentions };
}

export async function postIntention(body: string) {
  return call('post_intention', { p_body: body });
}

export async function withdrawIntention(id: string) {
  return call('withdraw_intention', { p_id: id });
}

export async function setCarry(id: string, on: boolean) {
  return call('set_carry', { p_id: id, p_on: on });
}

export async function reportIntention(id: string, reason: ReportReason = 'autre') {
  return call('report_intention', { p_id: id, p_reason: reason });
}

export function useCommunity() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    revision: snap.revision,
    echo: snap.echo,
    snap,
    watch(passage: { book: number; chapter: number; from: number; to: number }) {
      watchTarget(communityKey(passage));
    },
    rail(passage: { book: number; chapter: number; from: number; to: number; reference: string }) {
      const target = communityKey(passage);
      const stat = snap.stats[target];
      return {
        likeCount: shownLikes(snap, target),
        echoCount: stat ? stat.echoes : undefined,
        onEchoes: () => openEchoes(target, passage.reference),
      };
    },
  };
}
