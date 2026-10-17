import type { ReportReason } from './moderation';
import { asRecord, call, readRows } from './profile';

// Vitrine du profil : les passages, prières et intentions qu'on choisit d'afficher, et le blocage.
// Afficher publie une COPIE côté serveur (passage : la référence seulement ; prière : titre et texte ; intention :
// un drapeau sur l'intention du fil). Retirer supprime la copie. La donnée locale ne bouge jamais.

export const MAX_PASSAGES = 30;
export const MAX_PRAYERS = 20;
export const PRAYER_TITLE_MAX = 80;
export const PRAYER_BODY_MAX = 4000;

/** Un passage : livre, chapitre, premier et dernier verset. */
export type ShowcasePassage = { book: number; chapter: number; from: number; to: number };
/** `hidden` : la prière est masquée pour les autres après plusieurs signalements (le serveur ne l'envoie qu'à son propriétaire). */
export type ShowcasePrayer = { id: string; title: string; text: string; hidden?: boolean };
export type ShowcaseIntention = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  carries: number;
  carrying: boolean;
};
export type Showcase = { passages: ShowcasePassage[]; prayers: ShowcasePrayer[]; intentions: ShowcaseIntention[] };

export const EMPTY_SHOWCASE: Showcase = { passages: [], prayers: [], intentions: [] };

/** Clé d'un passage, la même que celle de la communauté : `livre:chapitre:premier-dernier`. */
export function passageKey(p: ShowcasePassage): string {
  return `${p.book}:${p.chapter}:${p.from}-${p.to}`;
}

const int = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Un passage dont les bornes tiennent côté serveur (livre 1 à 73, chapitre et versets de 1 à 999, début avant fin). */
export function isShowablePassage(p: ShowcasePassage): boolean {
  return (
    int(p.book, 1, 73) !== null &&
    int(p.chapter, 1, 999) !== null &&
    int(p.from, 1, 999) !== null &&
    int(p.to, 1, 999) !== null &&
    p.to >= p.from
  );
}

/** Une ligne du serveur (`book`, `chapter`, `verse_from`, `verse_to`) en passage, ou null si elle est invalide. */
export function readPassageRow(row: unknown): ShowcasePassage | null {
  const record = asRecord(row);
  if (!record) return null;
  const book = int(record.book, 1, 73);
  const chapter = int(record.chapter, 1, 999);
  const from = int(record.verse_from, 1, 999);
  const to = int(record.verse_to, 1, 999);
  if (book === null || chapter === null || from === null || to === null || to < from) return null;
  return { book, chapter, from, to };
}

export function readPrayerRow(row: unknown): ShowcasePrayer | null {
  const record = asRecord(row);
  if (!record) return null;
  const { prayer_id: id, title, body } = record;
  if (typeof id !== 'string' || !id || id.length > 64) return null;
  if (typeof title !== 'string' || !title.trim() || title.length > PRAYER_TITLE_MAX) return null;
  if (typeof body !== 'string' || !body.trim() || body.length > PRAYER_BODY_MAX) return null;
  return record.hidden === true ? { id, title, text: body, hidden: true } : { id, title, text: body };
}

export function readIntentionRow(row: unknown): ShowcaseIntention | null {
  const record = asRecord(row);
  if (!record) return null;
  const { id, body, created_at: createdAt, mine, carrying } = record;
  if (typeof id !== 'string' || !id || typeof body !== 'string' || !body.trim() || typeof createdAt !== 'string') return null;
  if (typeof mine !== 'boolean' || typeof carrying !== 'boolean') return null;
  const carries = int(record.carries, 0, Number.MAX_SAFE_INTEGER);
  if (carries === null) return null;
  return { id, body, createdAt, mine, carries, carrying };
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** La vitrine renvoyée par `get_my_showcase` / `get_showcase`. Toute ligne invalide est ignorée. */
export function readShowcase(data: unknown): Showcase {
  const record = asRecord(data);
  if (!record) return EMPTY_SHOWCASE;
  return {
    passages: readRows(list(record.passages), readPassageRow),
    prayers: readRows(list(record.prayers), readPrayerRow),
    intentions: readRows(list(record.intentions), readIntentionRow),
  };
}

export const hasShowcase = (s: Showcase) => s.passages.length + s.prayers.length + s.intentions.length > 0;

/** Les clés de passages qui étaient gardés avant et ne le sont plus : leur copie doit disparaître. */
export function removedKeys(before: ShowcasePassage[], after: ShowcasePassage[]): string[] {
  const kept = new Set(after.map(passageKey));
  return before.map(passageKey).filter((key) => !kept.has(key));
}

/** Un extrait d'une prière : sa première ligne non vide, coupée à `max` caractères. */
export function excerpt(text: string, max = 90): string {
  const line = text.split('\n').find((l) => l.trim()) ?? '';
  const clean = line.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

// ——— Appels ———

export async function fetchMyShowcase(): Promise<{ ok: true; showcase: Showcase } | { ok: false; message: string }> {
  const result = await call('get_my_showcase');
  return result.ok ? { ok: true, showcase: readShowcase(result.data) } : result;
}

export async function fetchShowcase(handle: string): Promise<{ ok: true; showcase: Showcase } | { ok: false; message: string }> {
  const result = await call('get_showcase', { p_handle: handle.trim().replace(/^@+/, '').toLowerCase() });
  return result.ok ? { ok: true, showcase: readShowcase(result.data) } : result;
}

const passageArgs = (p: ShowcasePassage) => ({ p_book: p.book, p_chapter: p.chapter, p_from: p.from, p_to: p.to });

export const showPassage = (p: ShowcasePassage) => call('show_passage', passageArgs(p));
export const hidePassage = (p: ShowcasePassage) => call('hide_passage', passageArgs(p));
export const showPrayer = (id: string, title: string, text: string) =>
  call('show_prayer', { p_prayer_id: id, p_title: title, p_body: text });
export const hidePrayer = (id: string) => call('hide_prayer', { p_prayer_id: id });

export const setIntentionOnProfile = (id: string, on: boolean) => call('set_intention_on_profile', { p_id: id, p_on: on });

export async function blockPerson(handle: string) {
  return call('block', { p_handle: handle });
}

export async function unblockPerson(handle: string) {
  return call('unblock', { p_handle: handle });
}

export async function listBlocked(): Promise<{ ok: true; handles: string[] } | { ok: false; message: string }> {
  const result = await call('list_blocked');
  if (!result.ok) return result;
  return {
    ok: true,
    handles: readRows(result.data, (row) => {
      const record = asRecord(row);
      return record && typeof record.handle === 'string' && record.handle ? record.handle : null;
    }),
  };
}

/** Signale le profil d'un pseudo exact (bio et paroisse). */
export async function reportProfile(handle: string, reason: ReportReason) {
  return call('report_profile', { p_handle: handle.trim().replace(/^@+/, '').toLowerCase(), p_reason: reason });
}

/** Signale une prière affichée sur le profil d'un pseudo exact. */
export async function reportProfilePrayer(handle: string, prayerId: string, reason: ReportReason) {
  return call('report_profile_prayer', {
    p_handle: handle.trim().replace(/^@+/, '').toLowerCase(),
    p_prayer_id: prayerId,
    p_reason: reason,
  });
}
