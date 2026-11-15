// Stockage d'une valeur trop longue pour une seule entrée du trousseau (la session Supabase), découpée en morceaux.
// Fonctions pures autour d'un stockage injecté : aucun import natif, pour pouvoir simuler une app tuée en pleine écriture.
//
// Une écriture ne doit jamais effacer l'ancienne valeur avant que la nouvelle soit lisible : sinon une app tuée au
// mauvais moment (au retour en arrière-plan, juste après un renouvellement de jeton) se réveille sans session, et
// l'utilisateur se retrouve anonyme alors que son compte existe toujours.
//
// Format : deux emplacements, `a` et `b`, qui alternent. Les morceaux vont dans `<clé>.<emplacement>.<i>`, et
// `<clé>.n` vaut `<emplacement>:<nombre>`. On écrit dans l'emplacement libre, puis on bascule `<clé>.n` en une seule
// écriture : c'est elle qui rend la nouvelle valeur visible. L'ancien emplacement n'est nettoyé qu'ensuite.
//
// Ancien format, encore lu pour ne déconnecter personne à la mise à jour : la valeur entière dans `<clé>`, ou
// `<clé>.n` = nombre et les morceaux dans `<clé>.<i>`.

export type KeyValueBackend = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

type Slot = 'a' | 'b';
type Pointer = { kind: 'slot'; slot: Slot; n: number } | { kind: 'legacy'; n: number };

/** Sous la limite historique du trousseau iOS. */
export const CHUNK = 1800;

export function parsePointer(raw: string | null): Pointer | null {
  if (raw == null) return null;
  const slotted = /^([ab]):(\d+)$/.exec(raw);
  if (slotted) return { kind: 'slot', slot: slotted[1] as Slot, n: Number(slotted[2]) };
  if (/^\d+$/.test(raw)) return { kind: 'legacy', n: Number(raw) };
  return null;
}

function chunkKey(key: string, pointer: Pointer, i: number): string {
  return pointer.kind === 'slot' ? `${key}.${pointer.slot}.${i}` : `${key}.${i}`;
}

export function split(value: string, size = CHUNK): string[] {
  if (value.length === 0) return [''];
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return parts;
}

async function quietly(op: Promise<void>) {
  await op.catch(() => {});
}

async function removeChunks(backend: KeyValueBackend, key: string, pointer: Pointer | null) {
  if (!pointer) return;
  for (let i = 0; i < pointer.n; i++) await quietly(backend.remove(chunkKey(key, pointer, i)));
}

export function chunkedStore(backend: KeyValueBackend, size = CHUNK) {
  // Une opération à la fois : deux écritures entremêlées mélangeraient leurs morceaux, et une lecture pendant le
  // nettoyage lirait un emplacement en cours d'effacement.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(op: () => Promise<T>): Promise<T> => {
    const next = queue.then(op, op);
    queue = next.catch(() => {});
    return next;
  };

  async function read(key: string): Promise<string | null> {
    const pointer = parsePointer(await backend.get(`${key}.n`));
    if (!pointer) return backend.get(key);
    let out = '';
    for (let i = 0; i < pointer.n; i++) {
      const part = await backend.get(chunkKey(key, pointer, i));
      if (part == null) return null;
      out += part;
    }
    return out;
  }

  async function write(key: string, value: string) {
    const previous = parsePointer(await backend.get(`${key}.n`));
    const slot: Slot = previous?.kind === 'slot' && previous.slot === 'a' ? 'b' : 'a';
    const parts = split(value, size);
    const next: Pointer = { kind: 'slot', slot, n: parts.length };
    // Si une de ces écritures échoue, le pointeur n'a pas bougé : l'ancienne valeur reste entière.
    for (let i = 0; i < parts.length; i++) await backend.set(chunkKey(key, next, i), parts[i]);
    await backend.set(`${key}.n`, `${slot}:${parts.length}`);
    // La nouvelle valeur est lisible : le reste n'est que du ménage, sans conséquence s'il est interrompu.
    await removeChunks(backend, key, previous);
    await quietly(backend.remove(key));
  }

  async function erase(key: string) {
    const pointer = parsePointer(await backend.get(`${key}.n`));
    // Le pointeur d'abord : dès qu'il disparaît, plus rien n'est lisible, même si le reste est interrompu.
    await quietly(backend.remove(`${key}.n`));
    await quietly(backend.remove(key));
    await removeChunks(backend, key, pointer);
  }

  return {
    getItem: (key: string) => serial(() => read(key)),
    setItem: (key: string, value: string) => serial(() => write(key, value)),
    removeItem: (key: string) => serial(() => erase(key)),
  };
}
