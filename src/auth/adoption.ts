import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { adoptionMessage, readParams } from './errors';
import { currentUserId } from './session';

/** Doit être identique à l'adresse enregistrée dans Supabase. */
export const REDIRECT = 'manne://auth/callback';

/** Ancienne clé (AsyncStorage, en clair) : lue une dernière fois pour la migration, puis supprimée. */
const LEGACY_NONCE_KEY = 'manne/auth/pending-nonce';
/** SecureStore n'accepte que lettres, chiffres, « . », « - » et « _ ». */
const NONCE_KEY = 'manne.auth.pending-nonce';

async function secureGet(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(NONCE_KEY);
  } catch {
    return null;
  }
}

async function readStoredNonce(): Promise<string | null> {
  const secure = await secureGet();
  if (secure) return secure;
  const legacy = await AsyncStorage.getItem(LEGACY_NONCE_KEY).catch(() => null);
  if (legacy) {
    // Migration : le nonce passe dans le trousseau et quitte le stockage en clair.
    if (await writeSecureNonce(legacy)) await AsyncStorage.removeItem(LEGACY_NONCE_KEY).catch(() => {});
  }
  return legacy;
}

async function writeSecureNonce(nonce: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await SecureStore.setItemAsync(NONCE_KEY, nonce);
    return true;
  } catch {
    return false;
  }
}

async function writeStoredNonce(nonce: string) {
  // Trousseau indisponible : mieux vaut garder le nonce en clair que de perdre la reprise.
  if (!(await writeSecureNonce(nonce))) await AsyncStorage.setItem(LEGACY_NONCE_KEY, nonce);
}

/**
 * Le nonce déposé vaut aussi longtemps que le lien du mail (une heure par défaut chez Supabase). Plus court,
 * le lien marcherait mais ce que l'anonyme avait fait ne pourrait plus être repris.
 */
const NONCE_TTL = 60 * 60 * 1000;
let pendingNonce: string | null = null;

/** Dépose le nonce qui autorisera le compte à reprendre ce que cet anonyme a fait. */
export async function depositNonce(): Promise<string | null> {
  const client = supabase;
  if (!client) return null;
  const fromUser = await currentUserId();
  if (!fromUser) return null;
  const nonce = Crypto.randomUUID();
  const { error } = await client.from('account_adoptions').insert({
    nonce,
    from_user: fromUser,
    expires_at: new Date(Date.now() + NONCE_TTL).toISOString(),
  });
  return error ? null : nonce;
}

/** Garde le nonce en mémoire et sur le téléphone, le temps que l'utilisateur ouvre le lien ou saisisse le code. */
export async function rememberNonce(nonce: string) {
  pendingNonce = nonce;
  await writeStoredNonce(nonce);
}

export async function clearNonce() {
  pendingNonce = null;
  await SecureStore.deleteItemAsync(NONCE_KEY).catch(() => {});
  await AsyncStorage.removeItem(LEGACY_NONCE_KEY).catch(() => {});
}

/** Le serveur dit « nonce » quand il est inconnu, expiré ou déjà pris : réessayer n'y changera rien. */
export function permanentAdoptionError(message: string): boolean {
  return message.includes('nonce');
}

/** Reprend ce que l'anonyme avait fait. `permanent` : l'erreur ne passera pas en réessayant (nonce invalide ou expiré). */
export async function adoptOutcome(client: SupabaseClient, nonce: string): Promise<{ error: string | null; permanent: boolean }> {
  try {
    const { error } = await client.rpc('adopt_account', { p_nonce: nonce });
    if (!error) return { error: null, permanent: false };
    return { error: adoptionMessage(error.message), permanent: permanentAdoptionError(error.message) };
  } catch {
    return { error: 'La reprise n’a pas pu partir. Réessaie quand tu as du réseau.', permanent: false };
  }
}

export async function adopt(client: SupabaseClient, nonce: string): Promise<string | null> {
  return (await adoptOutcome(client, nonce)).error;
}

/**
 * Une fois connecté par le lien ou par le code : reprend avec le nonce en attente, s'il y en a un. Le nonce n'est
 * oublié qu'après la réussite ou une erreur définitive ; un réseau absent le laisse pour un nouvel essai.
 */
export function adoptPending(): Promise<string | null> {
  // Le retour de la connexion et la reprise automatique peuvent se croiser : un seul appel part, les deux en lisent le résultat.
  pendingAdoption ??= runPendingAdoption().finally(() => {
    pendingAdoption = null;
  });
  return pendingAdoption;
}

let pendingAdoption: Promise<string | null> | null = null;

async function runPendingAdoption(): Promise<string | null> {
  const nonce = pendingNonce ?? (await readStoredNonce());
  if (!nonce) return null;
  if (!supabase) {
    await clearNonce();
    return null;
  }
  const { error, permanent } = await adoptOutcome(supabase, nonce);
  if (!error || permanent) await clearNonce();
  return error;
}

/** Y a-t-il une reprise restée en attente (réseau absent lors de la connexion) ? */
export async function hasPendingNonce(): Promise<boolean> {
  return !!(pendingNonce ?? (await readStoredNonce()));
}

/**
 * `linked` si la session est en place, `exists` si l'identité appartient déjà à quelqu'un.
 * Seul un code est accepté : il ne s'échange que contre le secret PKCE gardé par ce téléphone. Un lien
 * porteur de jetons (access_token) ou d'un token_hash ouvrirait la session de qui l'a forgé.
 */
export async function finishRedirect(url: string): Promise<'linked' | 'exists' | string> {
  const client = supabase;
  if (!client) return 'Supabase n’est pas configuré.';
  const params = readParams(url);
  const code = String(params.error_code ?? '');
  if (code === 'identity_already_exists' || code === 'email_exists') return 'exists';
  if (params.error_description) return String(params.error_description);
  if (typeof params.code === 'string') {
    const flowId = params.sb_flow_id;
    const { error } = await client.auth.exchangeCodeForSession(params.code, flowId ? { flowId } : undefined);
    return error ? error.message : 'linked';
  }
  return 'Ce lien ne correspond à aucune connexion démarrée depuis ce téléphone.';
}

const openingUrls = new Map<string, Promise<string | null>>();

/** Termine la connexion quand on ouvre le lien reçu par e-mail. */
export function openAuthUrl(url: string): Promise<string | null> {
  const existing = openingUrls.get(url);
  if (existing) return existing;
  const task = finishEmailLink(url).then((error) => {
    if (error) openingUrls.delete(url);
    return error;
  });
  openingUrls.set(url, task);
  return task;
}

async function finishEmailLink(url: string): Promise<string | null> {
  const outcome = await finishRedirect(url);
  if (outcome !== 'linked') return outcome === 'exists' ? 'Ce lien ne correspond pas à une connexion.' : outcome;
  return adoptPending();
}
