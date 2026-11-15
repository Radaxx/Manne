import { chunkedStore, type KeyValueBackend, parsePointer, split } from '../src/chunked-store';

const KEY = 'sb-session';

/** Un trousseau en mémoire. `killAfter` simule une app tuée : au-delà de ce nombre d'écritures ou d'effacements, tout échoue. */
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  let killAfter = Number.POSITIVE_INFINITY;
  const tick = () => {
    if (writes >= killAfter) throw new Error('app tuée');
    writes++;
  };
  const backend: KeyValueBackend = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      tick();
      data.set(key, value);
    },
    remove: async (key) => {
      tick();
      data.delete(key);
    },
  };
  return {
    backend,
    data,
    kill(after: number) {
      writes = 0;
      killAfter = after;
    },
    revive() {
      killAfter = Number.POSITIVE_INFINITY;
    },
    get writes() {
      return writes;
    },
  };
}

const OLD = 'x'.repeat(25);
const NEW = 'y'.repeat(32);
const SIZE = 10;

describe('parsePointer', () => {
  it('lit le nouveau format, l’ancien, et rejette le reste', () => {
    expect(parsePointer('a:3')).toEqual({ kind: 'slot', slot: 'a', n: 3 });
    expect(parsePointer('b:1')).toEqual({ kind: 'slot', slot: 'b', n: 1 });
    expect(parsePointer('4')).toEqual({ kind: 'legacy', n: 4 });
    expect(parsePointer(null)).toBeNull();
    expect(parsePointer('c:2')).toBeNull();
  });
});

describe('split', () => {
  it('découpe sans rien perdre', () => {
    expect(split('abcdefg', 3)).toEqual(['abc', 'def', 'g']);
    expect(split('', 3)).toEqual(['']);
  });
});

describe('chunkedStore', () => {
  it('relit ce qu’il a écrit, petit ou grand, et alterne les emplacements', async () => {
    const mem = memory();
    const store = chunkedStore(mem.backend, SIZE);
    await store.setItem(KEY, OLD);
    expect(mem.data.get(`${KEY}.n`)).toBe('a:3');
    expect(await store.getItem(KEY)).toBe(OLD);
    await store.setItem(KEY, 'court');
    expect(mem.data.get(`${KEY}.n`)).toBe('b:1');
    expect(await store.getItem(KEY)).toBe('court');
    // L'ancien emplacement est nettoyé.
    expect([...mem.data.keys()].sort()).toEqual([`${KEY}.b.0`, `${KEY}.n`]);
  });

  it('lit l’ancien format en une entrée, puis le remplace proprement', async () => {
    const mem = memory({ [KEY]: OLD });
    const store = chunkedStore(mem.backend, SIZE);
    expect(await store.getItem(KEY)).toBe(OLD);
    await store.setItem(KEY, NEW);
    expect(await store.getItem(KEY)).toBe(NEW);
    expect(mem.data.has(KEY)).toBe(false);
  });

  it('lit l’ancien format découpé, puis le remplace proprement', async () => {
    const mem = memory({ [`${KEY}.n`]: '3', [`${KEY}.0`]: 'x'.repeat(10), [`${KEY}.1`]: 'x'.repeat(10), [`${KEY}.2`]: 'x'.repeat(5) });
    const store = chunkedStore(mem.backend, SIZE);
    expect(await store.getItem(KEY)).toBe(OLD);
    await store.setItem(KEY, NEW);
    expect(await store.getItem(KEY)).toBe(NEW);
    expect([...mem.data.keys()].filter((k) => /\.\d$/.test(k) && !/\.[ab]\.\d$/.test(k))).toEqual([]);
  });

  it('efface tout, pointeur compris', async () => {
    const mem = memory();
    const store = chunkedStore(mem.backend, SIZE);
    await store.setItem(KEY, OLD);
    await store.removeItem(KEY);
    expect(await store.getItem(KEY)).toBeNull();
    expect(mem.data.size).toBe(0);
  });

  // Le cas du bug : l'ancien code effaçait la session avant d'écrire la nouvelle.
  const starts: [string, Record<string, string>][] = [
    ['nouveau format', {}],
    ['ancien format en une entrée', { [KEY]: OLD }],
    [
      'ancien format découpé',
      { [`${KEY}.n`]: '3', [`${KEY}.0`]: 'x'.repeat(10), [`${KEY}.1`]: 'x'.repeat(10), [`${KEY}.2`]: 'x'.repeat(5) },
    ],
  ];

  it.each(starts)('app tuée à n’importe quel moment d’une écriture (%s) : jamais sans session', async (_label, initial) => {
    // Combien d'opérations une écriture complète demande, pour essayer chaque point d'arrêt.
    const probe = memory(initial);
    const probeStore = chunkedStore(probe.backend, SIZE);
    if (!Object.keys(initial).length) await probeStore.setItem(KEY, OLD);
    probe.kill(Number.POSITIVE_INFINITY);
    await probeStore.setItem(KEY, NEW);
    const total = probe.writes;
    expect(total).toBeGreaterThan(3);

    for (let after = 0; after <= total; after++) {
      const mem = memory(initial);
      const before = chunkedStore(mem.backend, SIZE);
      if (!Object.keys(initial).length) await before.setItem(KEY, OLD);
      mem.kill(after);
      await before.setItem(KEY, NEW).catch(() => {});
      mem.revive();
      // Au relancement, un nouveau magasin relit le trousseau.
      const value = await chunkedStore(mem.backend, SIZE).getItem(KEY);
      expect([OLD, NEW]).toContain(value);
    }
  });

  it('une écriture qui échoue laisse l’ancienne valeur et ne bloque pas les suivantes', async () => {
    const mem = memory();
    const store = chunkedStore(mem.backend, SIZE);
    await store.setItem(KEY, OLD);
    mem.kill(1);
    await expect(store.setItem(KEY, NEW)).rejects.toThrow('app tuée');
    mem.revive();
    expect(await store.getItem(KEY)).toBe(OLD);
    await store.setItem(KEY, NEW);
    expect(await store.getItem(KEY)).toBe(NEW);
  });

  it('deux écritures simultanées ne mélangent pas leurs morceaux', async () => {
    const mem = memory();
    const slow: KeyValueBackend = {
      ...mem.backend,
      set: async (key, value) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 3));
        await mem.backend.set(key, value);
      },
    };
    const store = chunkedStore(slow, SIZE);
    const first = 'a'.repeat(30);
    const second = 'b'.repeat(30);
    const reads = Promise.all([store.setItem(KEY, first), store.setItem(KEY, second), store.getItem(KEY)]);
    const [, , during] = await reads;
    expect(during).toBe(second);
    expect(await store.getItem(KEY)).toBe(second);
  });
});
