import * as CRAMPON from './data/bible/crampon';
import * as LSG from './data/bible/lsg';
import type { BookMeta } from './data/bible/types';

export type { BookMeta };

export type TranslationId = 'lsg' | 'crampon';

export type Translation = { id: TranslationId; name: string; about: string };

export const TRANSLATIONS: Translation[] = [
  {
    id: 'lsg',
    name: 'Louis Segond 1910',
    about:
      'La traduction protestante la plus répandue en français. Les livres deutérocanoniques, qu’elle n’a pas, sont lus dans la Crampon.',
  },
  {
    id: 'crampon',
    name: 'Bible Crampon 1923',
    about: 'Traduction catholique faite sur l’hébreu et le grec, avec les livres deutérocanoniques. Elle écrit le nom divin « Yahweh ».',
  },
];

export const DEFAULT_TRANSLATION: TranslationId = 'lsg';

export const isTranslation = (v: unknown): v is TranslationId => v === 'lsg' || v === 'crampon';

export const translationName = (t: TranslationId) => (t === 'lsg' ? 'Louis Segond 1910' : 'Bible Crampon 1923');

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Les numéros de livres sont des clés (marque-pages, plans, favoris) : 1-66 dans l'ordre de la Louis Segond,
 * puis les deutérocanoniques Tobie, Judith, 1 et 2 Maccabées, Sagesse, Siracide et Baruch (67-73).
 */
export const DEUTEROCANONICAL = range(67, 73);

/** L'Ancien Testament dans l'ordre de la Bible catholique. */
export const OLD_TESTAMENT = [...range(1, 16), 67, 68, 17, 69, 70, ...range(18, 22), 71, 72, 23, 24, 25, 73, ...range(26, 39)];

export const NEW_TESTAMENT = range(40, 66);

/** L'ordre de lecture : de la Genèse à l'Apocalypse, avec les deutérocanoniques à leur place. */
export const BOOK_ORDER = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

const RANK = new Map(BOOK_ORDER.map((n, i) => [n, i]));

/** Rang d'un livre dans l'ordre de lecture, pour comparer deux positions. */
export const bookRank = (n: number) => RANK.get(n) ?? -1;

export const isBook = (n: unknown): n is number => typeof n === 'number' && RANK.has(n);

export const isNewTestament = (n: number) => n >= 40 && n <= 66;

export const isDeuterocanonical = (n: number) => n >= 67;

/** Le livre suivant ; après l'Apocalypse, on revient à la Genèse. */
export const nextBook = (n: number) => BOOK_ORDER[(bookRank(n) + 1) % BOOK_ORDER.length];

export const prevBook = (n: number): number | null => (bookRank(n) > 0 ? BOOK_ORDER[bookRank(n) - 1] : null);

/** Les chapitres grecs d'Esther (11-16) et de Daniel (13-14), absents de la Louis Segond : premier chapitre emprunté. */
const GREEK_CHAPTERS: Record<number, number> = { 17: 11, 27: 13 };

/** Nombre de chapitres d'un livre sans les chapitres grecs d'Esther et de Daniel. */
export const hebrewChapters = (n: number, t: TranslationId) => Math.min(bookMeta(n, t).verses.length, (GREEK_CHAPTERS[n] ?? Infinity) - 1);

/**
 * La Louis Segond n'a ni les deutérocanoniques ni les chapitres grecs d'Esther et de Daniel :
 * elle les emprunte à la Crampon, pour que les deux traductions aient les mêmes livres et chapitres.
 */
const LSG_BOOKS: BookMeta[] = CRAMPON.BOOKS.map((crampon) => {
  const lsg = LSG.BOOKS[crampon.n - 1];
  if (!lsg) return crampon;
  const borrowed = GREEK_CHAPTERS[crampon.n];
  return { n: crampon.n, name: lsg.name, verses: borrowed ? [...lsg.verses, ...crampon.verses.slice(borrowed - 1)] : lsg.verses };
});

const META: Record<TranslationId, BookMeta[]> = { lsg: LSG_BOOKS, crampon: CRAMPON.BOOKS };

/** Les livres d'une traduction, rangés par numéro (books(t)[n - 1] est le livre n). */
export const books = (t: TranslationId) => META[t];

export const bookMeta = (n: number, t: TranslationId) => META[t][n - 1];

/** Le nombre de chapitres de la Bible (le même dans les deux traductions). */
export const TOTAL_CHAPTERS = CRAMPON.BOOKS.reduce((n, b) => n + b.verses.length, 0);

/** La traduction dont vient vraiment le texte d'un chapitre. */
export function chapterSource(n: number, chapter: number, t: TranslationId): TranslationId {
  if (t === 'crampon') return 'crampon';
  const lsg = LSG.BOOKS[n - 1];
  return lsg && chapter <= lsg.verses.length ? 'lsg' : 'crampon';
}

/** Les versets d'un chapitre (vide si le chapitre n'existe pas dans cette traduction). */
export function loadChapter(n: number, chapter: number, t: TranslationId): string[] {
  const source = chapterSource(n, chapter, t) === 'lsg' ? LSG : CRAMPON;
  return source.loadBook(n)[chapter - 1] ?? [];
}

/** Les versets d'un passage, du premier au dernier inclus. */
export const loadPassage = (n: number, chapter: number, from: number, to: number, t: TranslationId) =>
  loadChapter(n, chapter, t).slice(from - 1, to);

/** Ramène un chapitre dans les bornes du livre (Joël 4 n'existe que dans la Crampon, Malachie 4 que dans la Segond). */
export const clampChapter = (n: number, chapter: number, t: TranslationId) => Math.max(1, Math.min(chapter, bookMeta(n, t).verses.length));

/** « Psaumes 23:1-6 » */
export const passageLabel = (n: number, chapter: number, from: number, to: number, t: TranslationId) =>
  `${bookMeta(n, t).name} ${chapter}:${from}${to > from ? `-${to}` : ''}`;
