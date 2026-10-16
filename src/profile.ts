import { supabase } from './supabase';

// Profils et abonnements. Pas d'image : l'avatar vient des initiales du pseudo.

export type MyProfile = {
  handle: string;
  bio: string | null;
  parish: string | null;
  followers: number;
  following: number;
};
/** La carte minimale d'une personne : tout ce que montre une recherche ou une liste. */
export type ProfileCard = { handle: string };
export type FoundProfile = ProfileCard & { following: boolean };
/** Le profil d'un autre. Bio, paroisse et compteurs sont nuls tant que la personne ne te suit pas. */
export type OtherProfile = ProfileCard & {
  bio: string | null;
  parish: string | null;
  followers: number | null;
  following: number | null;
  iFollow: boolean;
  followsMe: boolean;
  visible: boolean;
};

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const BIO_MAX = 160;
export const PARISH_MAX = 80;
const RESERVED = ['admin', 'manne', 'support', 'moderation', 'equipe'];

/** Ce que le serveur enregistre : sans espaces, sans @, en minuscules. */
export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

/** Pourquoi ce pseudo est refusé, en français, ou null s'il convient. */
export function handleProblem(value: string): string | null {
  const handle = normalizeHandle(value);
  if (handle.length < HANDLE_MIN) return `Le pseudo fait au moins ${HANDLE_MIN} caractères.`;
  if (handle.length > HANDLE_MAX) return `Le pseudo fait ${HANDLE_MAX} caractères au plus.`;
  if (!/^[a-z0-9_.]+$/.test(handle)) return 'Le pseudo ne prend que des lettres minuscules, des chiffres, le point et le tiret bas.';
  if (handle.startsWith('.') || handle.endsWith('.')) return 'Le pseudo ne peut pas commencer ni finir par un point.';
  if (RESERVED.includes(handle)) return 'Ce pseudo est réservé.';
  return null;
}

/** Première et dernière lettre ou chiffre du pseudo, en majuscules : `jean.marie` donne JE, `paul_7` donne P7. */
export function initials(handle: string): string {
  const chars = normalizeHandle(handle).replace(/[^a-z0-9]/g, '');
  if (chars.length === 0) return '';
  if (chars.length === 1) return chars.toUpperCase();
  return (chars[0] + chars[chars.length - 1]).toUpperCase();
}

function asRecord(row: unknown): Record<string, unknown> | null {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const count = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

export function readCard(row: unknown): ProfileCard | null {
  const record = asRecord(row);
  if (!record || typeof record.handle !== 'string' || !record.handle) return null;
  return { handle: record.handle };
}

export function readFound(row: unknown): FoundProfile | null {
  const card = readCard(row);
  const record = asRecord(row);
  if (!card || !record || typeof record.following !== 'boolean') return null;
  return { ...card, following: record.following };
}

export function readProfile(row: unknown): MyProfile | null {
  const card = readCard(row);
  const record = asRecord(row);
  if (!card || !record) return null;
  const followers = count(record.followers);
  const following = count(record.following_count);
  if (followers === null || following === null) return null;
  return { ...card, bio: text(record.bio), parish: text(record.parish), followers, following };
}

export function readOther(row: unknown): OtherProfile | null {
  const card = readCard(row);
  const record = asRecord(row);
  if (!card || !record) return null;
  if (typeof record.i_follow !== 'boolean' || typeof record.follows_me !== 'boolean' || typeof record.visible !== 'boolean') return null;
  // Un profil invisible ne porte jamais de détail, même si le serveur en envoyait par erreur.
  const visible = record.visible;
  return {
    ...card,
    bio: visible ? text(record.bio) : null,
    parish: visible ? text(record.parish) : null,
    followers: visible ? count(record.followers) : null,
    following: visible ? count(record.following_count) : null,
    iFollow: record.i_follow,
    followsMe: record.follows_me,
    visible,
  };
}

function failureMessage(message: string) {
  if (message.includes('déjà pris')) return 'Ce pseudo est déjà pris.';
  if (message.includes('Trop d')) return message;
  if (message.includes('pseudo')) return 'Ce pseudo ne convient pas. Choisis-en un autre.';
  if (message.includes('longueur')) return 'Un des champs est trop long.';
  if (message.includes('charte')) return 'Accepte la charte pour créer ton profil.';
  if (message.includes('profil')) return 'Crée d’abord ton profil.';
  if (message.includes('introuvable')) return 'Ce profil n’existe pas.';
  if (message.includes('propre')) return 'C’est ton propre profil.';
  return 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.';
}

type Result = { ok: true; data: unknown } | { ok: false; message: string };

/** Profil et abonnements demandent un compte relié : une session anonyme n'y a aucun accès. */
async function call(fn: string, args?: Record<string, unknown>): Promise<Result> {
  const client = supabase;
  if (!client) return { ok: false, message: 'Les profils ne sont pas reliés pour le moment.' };
  try {
    const { data: session } = await client.auth.getSession();
    const user = session.session?.user;
    if (user?.is_anonymous !== false) return { ok: false, message: 'Les profils demandent un compte relié.' };
    const { data, error } = await client.rpc(fn, args);
    if (error) return { ok: false, message: failureMessage(error.message) };
    return { ok: true, data };
  } catch {
    return { ok: false, message: 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.' };
  }
}

function readRows<T>(data: unknown, read: (row: unknown) => T | null): T[] {
  return Array.isArray(data) ? data.flatMap((row) => read(row) ?? []) : [];
}

/** `profile: null` : le compte est relié mais n'a pas encore de profil. */
export async function getMyProfile(): Promise<{ ok: true; profile: MyProfile | null } | { ok: false; message: string }> {
  const result = await call('get_my_profile');
  if (!result.ok) return result;
  return { ok: true, profile: readRows(result.data, readProfile)[0] ?? null };
}

export type ProfileInput = { handle: string; bio: string; parish: string };

/** Crée le profil (`acceptCharter` obligatoire) ou met à jour l'existant. */
export async function saveMyProfile(input: ProfileInput, acceptCharter: boolean) {
  return call('save_my_profile', {
    p_handle: normalizeHandle(input.handle),
    // Le serveur impose display_name = pseudo ; le paramètre reste pour la fonction de la migration 005.
    p_display_name: normalizeHandle(input.handle),
    p_bio: input.bio.trim() || null,
    p_parish: input.parish.trim() || null,
    p_accept_charter: acceptCharter,
  });
}

export async function isHandleAvailable(handle: string): Promise<{ ok: true; available: boolean } | { ok: false; message: string }> {
  const result = await call('handle_available', { p_handle: normalizeHandle(handle) });
  if (!result.ok) return result;
  return { ok: true, available: result.data === true };
}

/** Recherche par pseudo exact : `found: null` si personne ne porte ce pseudo. */
export async function findProfile(handle: string): Promise<{ ok: true; found: FoundProfile | null } | { ok: false; message: string }> {
  const result = await call('find_profile', { p_handle: normalizeHandle(handle) });
  if (!result.ok) return result;
  return { ok: true, found: readRows(result.data, readFound)[0] ?? null };
}

export async function getProfile(handle: string): Promise<{ ok: true; profile: OtherProfile | null } | { ok: false; message: string }> {
  const result = await call('get_profile', { p_handle: normalizeHandle(handle) });
  if (!result.ok) return result;
  return { ok: true, profile: readRows(result.data, readOther)[0] ?? null };
}

export async function follow(handle: string) {
  return call('follow', { p_handle: normalizeHandle(handle) });
}

export async function unfollow(handle: string) {
  return call('unfollow', { p_handle: normalizeHandle(handle) });
}

export async function listFollowing(): Promise<{ ok: true; people: ProfileCard[] } | { ok: false; message: string }> {
  const result = await call('list_following');
  if (!result.ok) return result;
  return { ok: true, people: readRows(result.data, readCard) };
}

export async function listFollowers(): Promise<{ ok: true; people: ProfileCard[] } | { ok: false; message: string }> {
  const result = await call('list_followers');
  if (!result.ok) return result;
  return { ok: true, people: readRows(result.data, readCard) };
}
