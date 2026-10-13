import { BOOK_ORDER, bookMeta, hebrewChapters, type TranslationId } from './bible';
import { daysSince } from './dates';

export type Plan = {
  id: string;
  title: string;
  description: string;
  days: number;
  books: number[];
  /** Sans les chapitres grecs d'Esther et de Daniel : la liste des chapitres d'avant les deutérocanoniques. */
  hebrewOnly?: boolean;
  /** Remplacé : il n'est plus proposé, mais ceux qui l'ont commencé le gardent. */
  retired?: boolean;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const PLANS: Plan[] = [
  {
    id: 'evangiles-30',
    title: 'Les Évangiles en 30 jours',
    description: 'Matthieu, Marc, Luc et Jean : la vie de Jésus, environ 3 chapitres par jour.',
    days: 30,
    books: [40, 41, 42, 43],
  },
  {
    id: 'psaumes-30',
    title: 'Les Psaumes en 30 jours',
    description: 'Cinq psaumes par jour pour apprendre à prier avec la Bible.',
    days: 30,
    books: [19],
  },
  {
    id: 'proverbes-31',
    title: 'Un proverbe par jour',
    description: 'Un chapitre des Proverbes chaque jour du mois : de la sagesse pour le quotidien.',
    days: 31,
    books: [20],
  },
  {
    id: 'actes-28',
    title: 'Les Actes en 28 jours',
    description: 'La naissance de l’Église, de la Pentecôte jusqu’à Rome, un chapitre par jour.',
    days: 28,
    books: [44],
  },
  {
    id: 'nt-90',
    title: 'Le Nouveau Testament en 90 jours',
    description: 'Des Évangiles à l’Apocalypse, environ 3 chapitres par jour.',
    days: 90,
    books: range(40, 66),
  },
  {
    id: 'bible-catholique-365',
    title: 'Toute la Bible en un an',
    description: 'De la Genèse à l’Apocalypse, avec les livres deutérocanoniques, 3 à 4 chapitres par jour.',
    days: 365,
    books: BOOK_ORDER,
  },
  {
    // Les 66 livres de la Louis Segond : son marque-page est un rang dans cette liste, qui ne doit plus bouger.
    id: 'bible-365',
    title: 'Toute la Bible en un an (66 livres)',
    description: 'De la Genèse à l’Apocalypse, sans les livres deutérocanoniques, 3 à 4 chapitres par jour.',
    days: 365,
    books: range(1, 66),
    hebrewOnly: true,
    retired: true,
  },
];

export type ChapterRef = { book: number; chapter: number; key: string };

const chaptersCache = new Map<string, ChapterRef[]>();

/**
 * Les chapitres d'un plan dans une traduction. Joël et Malachie ne se découpent pas pareil dans les deux,
 * mais un plan a toujours autant de chapitres : seul le chapitre à un rang donné peut changer.
 */
export function planChapters(plan: Plan, t: TranslationId): ChapterRef[] {
  const cacheKey = `${plan.id}/${t}`;
  let chapters = chaptersCache.get(cacheKey);
  if (!chapters) {
    chapters = plan.books.flatMap((book) => {
      const count = plan.hebrewOnly ? hebrewChapters(book, t) : bookMeta(book, t).verses.length;
      return Array.from({ length: count }, (_, i) => ({ book, chapter: i + 1, key: `${book}:${i + 1}` }));
    });
    chaptersCache.set(cacheKey, chapters);
  }
  return chapters;
}

export const planById = (id: string) => PLANS.find((p) => p.id === id);

/** « Marc 4–6 », « Psaumes 1–5 », « Matthieu 28 – Marc 2 ». */
export function formatRange(chapters: ChapterRef[], t: TranslationId) {
  if (chapters.length === 0) return '';
  const first = chapters[0];
  const last = chapters[chapters.length - 1];
  const name = (b: number) => bookMeta(b, t).name;
  if (first.key === last.key) return `${name(first.book)} ${first.chapter}`;
  if (first.book === last.book) return `${name(first.book)} ${first.chapter}–${last.chapter}`;
  return `${name(first.book)} ${first.chapter} – ${name(last.book)} ${last.chapter}`;
}

/**
 * État d'un plan : son propre marque-page, indépendant de la lecture libre.
 * pos = index (dans planChapters) du prochain chapitre à lire ; tous ceux d'avant sont lus.
 * verse = verset où reprendre dans ce chapitre.
 */
export type PlanState = { start: string; pos: number; verse: number };

const indexCache = new Map<string, Map<string, number>>();

/** Position d'un chapitre dans le plan, ou -1 s'il n'en fait pas partie. */
export function planIndex(plan: Plan, book: number, chapter: number, t: TranslationId): number {
  const cacheKey = `${plan.id}/${t}`;
  let index = indexCache.get(cacheKey);
  if (!index) {
    index = new Map(planChapters(plan, t).map((c, i) => [c.key, i]));
    indexCache.set(cacheKey, index);
  }
  return index.get(`${book}:${chapter}`) ?? -1;
}

/** Garde le marque-page d'un plan sur le même chapitre quand on change de traduction. */
export function movePlan(plan: Plan, state: PlanState, from: TranslationId, to: TranslationId): PlanState {
  const current = planChapters(plan, from)[state.pos];
  const pos = current ? planIndex(plan, current.book, current.chapter, to) : -1;
  return pos === -1 || pos === state.pos ? state : { ...state, pos };
}

export type PlanStatus = {
  plan: Plan;
  day: number; // jour courant du plan, à partir de 0
  done: number; // chapitres lus
  total: number;
  today: ChapterRef[]; // portion prévue aujourd'hui
  todayDone: number;
  todayComplete: boolean; // la lecture prévue jusqu'à aujourd'hui inclus est faite
  expected: number; // chapitres qui devraient être lus à la fin de la journée
  next: ChapterRef | null; // où reprendre
  nextVerse: number;
  behind: number; // chapitres en retard sur les jours précédents
  ahead: number; // chapitres d'avance sur le rythme prévu
  finished: boolean;
};

export function planStatus(plan: Plan, state: PlanState, today: string, t: TranslationId): PlanStatus {
  const all = planChapters(plan, t);
  const total = all.length;
  const day = Math.min(Math.max(daysSince(state.start, today), 0), plan.days - 1);
  const todayStart = Math.floor((day * total) / plan.days);
  const expected = Math.floor(((day + 1) * total) / plan.days);
  const done = Math.min(state.pos, total);
  const todays = all.slice(todayStart, expected);
  return {
    plan,
    day,
    done,
    total,
    today: todays,
    todayDone: Math.min(Math.max(done - todayStart, 0), todays.length),
    todayComplete: done >= expected,
    expected,
    next: all[done] ?? null,
    nextVerse: done < total ? state.verse : 1,
    behind: Math.max(0, todayStart - done),
    ahead: Math.max(0, done - expected),
    finished: done >= total,
  };
}
