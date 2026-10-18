import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ConfessionItem } from './storage';

/**
 * La liste de confession vit dans l'espace sécurisé du système (trousseau iOS, Keystore Android), réservé à cet
 * appareil : elle n'entre ni dans les sauvegardes iCloud / iTunes, ni dans la restauration sur un nouvel iPhone.
 * Sur le web, rien de tel n'existe : la liste reste alors dans la progression (voir storage.ts).
 */
export const CONFESSION_SECURE_AVAILABLE = Platform.OS !== 'web';

const PREFIX = 'manne.confession.items';
const META_KEY = `${PREFIX}.meta`;
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/**
 * Taille d'un morceau, en unités UTF-16. La doc d'Expo ne fixe pas de limite, mais certaines versions d'iOS
 * refusent des valeurs de plus de ~2048 octets : 500 unités font au plus 1500 octets en UTF-8 (3 octets par unité).
 */
export const CHUNK_SIZE = 500;

const chunkKey = (generation: string, index: number) => `${PREFIX}.${generation}.${index}`;

const isNote = (v: unknown): v is ConfessionItem =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as ConfessionItem).id === 'string' &&
  typeof (v as ConfessionItem).text === 'string' &&
  typeof (v as ConfessionItem).at === 'number';

function split(json: string): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < json.length) {
    let end = Math.min(start + CHUNK_SIZE, json.length);
    // Ne coupe jamais une paire de substitution (emoji) en deux.
    const last = json.charCodeAt(end - 1);
    if (end < json.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    parts.push(json.slice(start, end));
    start = end;
  }
  return parts;
}

type Meta = { generation: string; count: number };

function parseMeta(raw: string | null): Meta | null {
  if (!raw) return null;
  const [generation, count] = raw.split(':');
  const n = Number(count);
  return generation && Number.isInteger(n) && n >= 0 ? { generation, count: n } : null;
}

/** `ok` est faux si l'espace sécurisé n'a pas pu être lu : la liste est alors inconnue, pas vide. */
export async function loadConfessionItems(): Promise<{ items: ConfessionItem[]; ok: boolean }> {
  if (!CONFESSION_SECURE_AVAILABLE) return { items: [], ok: false };
  try {
    const rawMeta = await SecureStore.getItemAsync(META_KEY);
    if (rawMeta === null) return { items: [], ok: true };
    const meta = parseMeta(rawMeta);
    if (!meta) return { items: [], ok: false };
    let json = '';
    for (let i = 0; i < meta.count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(meta.generation, i));
      if (part === null) return { items: [], ok: false };
      json += part;
    }
    const parsed: unknown = JSON.parse(json || '[]');
    if (!Array.isArray(parsed)) return { items: [], ok: false };
    return { items: parsed.filter(isNote), ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

/**
 * Enregistre la liste. Les nouveaux morceaux (d'une nouvelle génération) sont écrits en entier avant que l'index ne
 * les désigne, puis seulement les anciens sont effacés : une coupure en route laisse toujours une liste complète.
 */
export async function saveConfessionItems(items: ConfessionItem[]): Promise<boolean> {
  if (!CONFESSION_SECURE_AVAILABLE) return false;
  try {
    const previous = parseMeta(await SecureStore.getItemAsync(META_KEY));
    if (items.length === 0) {
      await SecureStore.deleteItemAsync(META_KEY);
      await removeChunks(previous);
      return true;
    }
    const parts = split(JSON.stringify(items));
    let generation = Date.now().toString(36);
    if (previous?.generation === generation) generation += 'x';
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(chunkKey(generation, i), parts[i], OPTIONS);
    await SecureStore.setItemAsync(META_KEY, `${generation}:${parts.length}`, OPTIONS);
    await removeChunks(previous, generation);
    return true;
  } catch {
    return false;
  }
}

async function removeChunks(meta: Meta | null, keepGeneration?: string) {
  if (!meta || meta.generation === keepGeneration) return;
  for (let i = 0; i < meta.count; i++) {
    try {
      await SecureStore.deleteItemAsync(chunkKey(meta.generation, i));
    } catch {}
  }
}
