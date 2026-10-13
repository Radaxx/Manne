import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

/** Sous la limite historique du trousseau iOS, pour y loger une session découpée. */
const CHUNK = 1800;

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
  const parts = await SecureStore.getItemAsync(`${key}.n`);
  if (parts != null) {
    const n = Number(parts);
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      out += part;
    }
    return out;
  }
  return SecureStore.getItemAsync(key);
}

async function secureRemove(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  const parts = await SecureStore.getItemAsync(`${key}.n`);
  const n = parts == null ? 0 : Number(parts);
  await SecureStore.deleteItemAsync(key).catch(() => {});
  await SecureStore.deleteItemAsync(`${key}.n`).catch(() => {});
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await secureRemove(key);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  }
  await SecureStore.setItemAsync(`${key}.n`, String(n));
}

const storage = {
  getItem: (key: string) => secureGet(key),
  setItem: (key: string, value: string) => secureSet(key, value),
  removeItem: (key: string) => secureRemove(key),
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null tant que le projet Supabase n'est pas configuré : l'app reste lisible hors ligne. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

let sessionInflight: Promise<boolean> | null = null;
/** Utilisateur déjà confirmé auprès du serveur, pour ne pas le revérifier à chaque appel. */
let checkedUserId: string | null = null;

function missingUser(error: { code?: string; message?: string; status?: number } | null) {
  if (!error) return false;
  return error.code === 'user_not_found' || error.status === 404 || /does not exist/i.test(error.message ?? '');
}

/** La session locale peut survivre à la suppression de l'utilisateur. On la jette alors. */
async function sessionAlive(client: SupabaseClient): Promise<boolean> {
  const { data } = await client.auth.getSession();
  const id = data.session?.user.id;
  if (!id) return false;
  if (checkedUserId === id) return true;
  const { data: userData, error } = await client.auth.getUser();
  if (!error && userData.user) {
    checkedUserId = userData.user.id;
    return true;
  }
  if (!missingUser(error)) return true;
  checkedUserId = null;
  await client.auth.signOut({ scope: 'local' });
  return false;
}

/** Ouvre une session anonyme au premier besoin. Faux si le réseau ou le projet manque. */
export function ensureSession(): Promise<boolean> {
  const client = supabase;
  if (!client) return Promise.resolve(false);
  if (!sessionInflight) {
    sessionInflight = (async () => {
      try {
        if (await sessionAlive(client)) return true;
        const { data: signed, error } = await client.auth.signInAnonymously();
        if (!error && signed.session) checkedUserId = signed.session.user.id;
        return !error && !!signed.session;
      } catch {
        return false;
      } finally {
        sessionInflight = null;
      }
    })();
  }
  return sessionInflight;
}

export async function currentUserId(): Promise<string | null> {
  const client = supabase;
  if (!client || !(await ensureSession())) return null;
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}
