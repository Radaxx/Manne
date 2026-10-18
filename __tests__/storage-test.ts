const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockSecure.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockSecure.delete(k);
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { loadConfessionItems, saveConfessionItems } from '../src/confession-store';
import { CORRUPT_KEY, loadStored, prepareStored, today } from '../src/storage';
import { mergeProgress } from '../src/sync';
import { currentStreak } from '../src/today';

const KEY = 'manne/progress/v1';

describe('loadStored', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecure.clear();
  });

  it('démarre vide et écrivable sans progression enregistrée', async () => {
    expect(await loadStored()).toEqual({ progress: null, writable: true, secure: true, savedItems: '[]' });
  });

  it('relit la progression enregistrée', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ liked: ['a'] }));
    const result = await loadStored();
    expect(result.writable).toBe(true);
    expect(result.progress?.liked).toEqual(['a']);
  });

  it('retente une lecture qui échoue', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ liked: ['a'] }));
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('io'));
    const result = await loadStored();
    expect(result.progress?.liked).toEqual(['a']);
    expect(result.writable).toBe(true);
  });

  it('n’autorise pas l’écriture si la lecture échoue deux fois', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('io')).mockRejectedValueOnce(new Error('io'));
    expect(await loadStored()).toEqual({ progress: null, writable: false, secure: false, savedItems: null });
  });

  it('met de côté un contenu illisible avant d’autoriser l’écriture', async () => {
    await AsyncStorage.setItem(KEY, '{pas du json');
    const result = await loadStored();
    expect(result).toEqual({ progress: null, writable: true, secure: true, savedItems: '[]' });
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CORRUPT_KEY));
    expect(keys).toHaveLength(1);
    expect(await AsyncStorage.getItem(keys[0])).toBe('{pas du json');
  });

  it('n’autorise pas l’écriture si la sauvegarde du contenu illisible échoue', async () => {
    await AsyncStorage.setItem(KEY, '{pas du json');
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('full'));
    expect((await loadStored()).writable).toBe(false);
  });
});

const GARBAGE: unknown[] = [null, undefined, 0, NaN, 'texte', true, [], [1, 2], {}, { a: 1 }, () => 1];
const FIELDS = [
  'liked',
  'saved',
  'themeScores',
  'day',
  'readToday',
  'chaptersToday',
  'days',
  'seenMilestones',
  'displayName',
  'lastOffice',
  'streak',
  'lastActiveDay',
  'currentBook',
  'positions',
  'chaptersRead',
  'plans',
  'reminder',
  'appearance',
  'translation',
  'cultureCalendar',
  'pinnedPrayers',
  'customPrayers',
  'confession',
  'confessionLock',
  'rosary',
  'adoration',
  'journeys',
  'stamps',
];

describe('prepareStored face aux données abîmées', () => {
  const sane = (p: ReturnType<typeof prepareStored>) => {
    expect(Array.isArray(p.liked)).toBe(true);
    expect(p.seenMilestones.every((m) => typeof m === 'string')).toBe(true);
    expect(Number.isFinite(p.rosary.count)).toBe(true);
    expect(Number.isFinite(p.adoration.count)).toBe(true);
    expect(Number.isFinite(p.adoration.minutes)).toBe(true);
    expect(Number.isFinite(p.streak)).toBe(true);
    expect(p.confession.lastConfession === null || typeof p.confession.lastConfession === 'string').toBe(true);
    expect(Array.isArray(p.confession.items)).toBe(true);
    for (const log of Object.values(p.days)) expect(Number.isFinite(log.verses)).toBe(true);
    for (const at of Object.values(p.stamps)) expect(Number.isFinite(at)).toBe(true);
    expect(() => JSON.stringify(p)).not.toThrow();
    expect(() => mergeProgress(p, p)).not.toThrow();
  };

  it.each(GARBAGE.map((g) => [String(g), g]))('accepte %s comme progression entière', (_name, value) => {
    sane(prepareStored(value));
  });

  for (const field of FIELDS) {
    it(`ne plante pas sur un champ ${field} abîmé`, () => {
      for (const value of GARBAGE) sane(prepareStored({ [field]: value }));
    });
  }

  it('écarte les entrées abîmées sous rosary, adoration et confession', () => {
    const p = prepareStored({
      rosary: { count: 'beaucoup', last: 3, fatima: 'oui' },
      adoration: { count: NaN, minutes: -5, mode: 'x', last: [] },
      confession: { items: 'x', lastConfession: 12 },
      seenMilestones: ['a', 1, null, { x: 1 }],
    });
    expect(p.rosary).toMatchObject({ count: 0, last: null, fatima: true });
    expect(p.adoration).toMatchObject({ count: 0, minutes: 30, mode: 'guided', last: null });
    expect(p.confession).toEqual({ items: [], lastConfession: null });
    expect(p.seenMilestones).toEqual(['a']);
  });

  it('écarte les jours mal formés pour que la fusion ne produise pas de NaN', () => {
    const d = today();
    const p = prepareStored({
      days: {
        [d]: { verses: 3, gospel: true },
        '2020-01-01': { verses: 'x' },
        '2020-01-02': null,
        '2020-01-03': { verses: NaN },
        demain: { verses: 1 },
        '2020-01-04': [],
      },
    });
    expect(Object.keys(p.days)).toEqual([d]);
    expect(p.days[d]).toMatchObject({ verses: 3, gospel: true, office: false, reading: false });
    const merged = mergeProgress(p, prepareStored({ days: { [d]: { verses: 5 } } }));
    expect(merged.days[d].verses).toBe(5);
  });

  it('vérifie la date de début d’un plan et ne modifie pas l’objet reçu', () => {
    const raw = { plans: { 'psaumes-30': { start: 'bientôt', pos: 1, verse: 1 }, 'psaumes-31': { start: today(), pos: 1, verse: 1 } } };
    const copy = JSON.parse(JSON.stringify(raw));
    const p = prepareStored(raw as never);
    expect(p.plans['psaumes-30']).toBeUndefined();
    expect(p.plans['psaumes-31']).toBeDefined();
    expect(raw).toEqual(copy);
  });

  it('fusionner un état avec lui-même ne le change pas', () => {
    const d = today();
    const base = prepareStored({
      liked: ['a', 'b'],
      day: d,
      readToday: ['41:1:1'],
      chaptersToday: ['41:1'],
      chaptersRead: ['41:1', '41:2'],
      days: { [d]: { verses: 1, gospel: true, office: true, rosary: false, adoration: false, reading: false } },
      seenMilestones: ['x'],
      displayName: 'Alexis',
      lastOffice: d,
      positions: { 41: { chapter: 2, verse: 3 } },
      plans: { 'psaumes-30': { start: d, pos: 2, verse: 1 } },
      journeys: { 'avent-2026': ['2026-12-01'] },
      themeScores: { paix: 2 } as never,
      rosary: { session: null, last: d, count: 4, fatima: true, texts: true, view3d: false },
      adoration: { session: null, last: d, count: 2, mode: 'guided', minutes: 45, intentions: [{ id: 'i1', text: 't', at: 1 }] },
      confession: { items: [{ id: 'c1', text: 's', at: 1 }], lastConfession: d },
      customPrayers: [{ id: 'perso-1', title: 'T', text: 'X', updatedAt: 1 }],
      stamps: { 'pos:41': Date.now(), 'liked:a': Date.now() },
    });
    const x = { ...base, streak: currentStreak(base) };
    expect(mergeProgress(x, x)).toEqual(x);
  });
});

describe('liste de confession dans l’espace sécurisé', () => {
  const item = (n: number, text = `péché ${n}`) => ({ id: `c-${n}`, text, at: n });

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockSecure.clear();
    jest.clearAllMocks();
  });

  it('fait un aller-retour par morceaux, sans dépasser la taille', async () => {
    const items = Array.from({ length: 40 }, (_, n) => item(n, `é😀 ${'x'.repeat(100)}`));
    expect(await saveConfessionItems(items)).toBe(true);
    const chunks = [...mockSecure.entries()].filter(([k]) => !k.endsWith('.meta'));
    expect(chunks.length).toBeGreaterThan(3);
    for (const [, v] of chunks) expect(new TextEncoder().encode(v).length).toBeLessThan(2048);
    expect(await loadConfessionItems()).toEqual({ items, ok: true });
    const options = (SecureStore.setItemAsync as jest.Mock).mock.calls[0][2];
    expect(options).toEqual({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });

  it('retire les anciens morceaux après avoir écrit les nouveaux', async () => {
    await saveConfessionItems(Array.from({ length: 40 }, (_, n) => item(n, 'y'.repeat(100))));
    const small = [item(1)];
    await saveConfessionItems(small);
    expect(mockSecure.size).toBe(2);
    expect((await loadConfessionItems()).items).toEqual(small);
    await saveConfessionItems([]);
    expect(mockSecure.size).toBe(0);
    expect(await loadConfessionItems()).toEqual({ items: [], ok: true });
  });

  it('efface une liste laissée par une installation précédente', async () => {
    await saveConfessionItems([item(1)]);
    const result = await loadStored();
    expect(result.progress).toBeNull();
    expect(await loadConfessionItems()).toEqual({ items: [], ok: true });
  });

  it('signale une lecture impossible', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    expect(await loadConfessionItems()).toEqual({ items: [], ok: false });
  });

  it('déplace la liste de la progression vers l’espace sécurisé, puis l’en retire', async () => {
    const items = [item(1), item(2)];
    await AsyncStorage.setItem(KEY, JSON.stringify({ liked: ['a'], confession: { items, lastConfession: '2026-01-01' } }));
    const result = await loadStored();
    expect(result.secure).toBe(true);
    expect(result.progress?.confession.items).toEqual(items);
    expect((await loadConfessionItems()).items).toEqual(items);
    const blob = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    expect(blob.confession.items).toEqual([]);
    expect(blob.confession.lastConfession).toBe('2026-01-01');
    expect(blob.liked).toEqual(['a']);
    // Relecture : la liste vient de l'espace sécurisé.
    expect((await loadStored()).progress?.confession.items).toEqual(items);
  });

  it('garde la liste dans la progression si l’écriture sécurisée échoue', async () => {
    const items = [item(1)];
    const raw = JSON.stringify({ confession: { items, lastConfession: null } });
    await AsyncStorage.setItem(KEY, raw);
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    const result = await loadStored();
    expect(result.progress?.confession.items).toEqual(items);
    expect(result.savedItems).toBe('[]');
    expect(await AsyncStorage.getItem(KEY)).toBe(raw);
    expect(mockSecure.has('manne.confession.items.meta')).toBe(false);
  });

  it('fusionne une liste sécurisée et des restes dans la progression sans doublon', async () => {
    await saveConfessionItems([item(1)]);
    await AsyncStorage.setItem(KEY, JSON.stringify({ confession: { items: [item(1), item(2)], lastConfession: null } }));
    const result = await loadStored();
    expect(result.progress?.confession.items.map((i) => i.id)).toEqual(['c-1', 'c-2']);
    expect((await loadConfessionItems()).items).toHaveLength(2);
  });

  it('ne touche pas à la progression si l’espace sécurisé est illisible', async () => {
    const raw = JSON.stringify({ confession: { items: [item(1)], lastConfession: null } });
    await AsyncStorage.setItem(KEY, raw);
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    const result = await loadStored();
    expect(result.secure).toBe(false);
    expect(result.progress?.confession.items).toHaveLength(1);
    expect(await AsyncStorage.getItem(KEY)).toBe(raw);
  });
});
