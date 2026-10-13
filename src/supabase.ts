import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

let sessionInflight: Promise<boolean> | null = null;

/** Ouvre une session anonyme au premier besoin. Faux si le réseau ou le projet manque. */
export function ensureSession(): Promise<boolean> {
  const client = supabase;
  if (!client) return Promise.resolve(false);
  if (!sessionInflight) {
    sessionInflight = (async () => {
      try {
        const { data } = await client.auth.getSession();
        if (data.session) return true;
        const { data: signed, error } = await client.auth.signInAnonymously();
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
