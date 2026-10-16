import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';
import { adoptionMessage, readParams } from './errors';
import { currentUserId } from './session';

/** Doit être identique à l'adresse enregistrée dans Supabase. */
export const REDIRECT = 'manne://auth/callback';

const NONCE_KEY = 'manne/auth/pending-nonce';

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
  await AsyncStorage.setItem(NONCE_KEY, nonce);
}

export async function clearNonce() {
  pendingNonce = null;
  await AsyncStorage.removeItem(NONCE_KEY);
}

/** Reprend ce que l'anonyme avait fait. */
export async function adopt(client: SupabaseClient, nonce: string): Promise<string | null> {
  const { error } = await client.rpc('adopt_account', { p_nonce: nonce });
  return error ? adoptionMessage(error.message) : null;
}

/** Une fois connecté par le lien ou par le code : reprend avec le nonce en attente, s'il y en a un. */
export async function adoptPending(): Promise<string | null> {
  const nonce = pendingNonce ?? (await AsyncStorage.getItem(NONCE_KEY));
  await clearNonce();
  if (!nonce || !supabase) return null;
  return adopt(supabase, nonce);
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
