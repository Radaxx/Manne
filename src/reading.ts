import { BOOKS, type BookMeta, loadBook } from './data/bible';
import type { Passage } from './data/content';
import { type Plan, planChapters, planIndex } from './plans';

export type Position = { book: number; chapter: number; verse: number };

export type ReadingPassage = Passage & { verses: [number, string][] };

export type ReadingCard =
  | { key: string; kind: 'intro'; book: BookMeta }
  | { key: string; kind: 'passage'; passage: ReadingPassage; book: BookMeta; chapterEnd: boolean }
  | { key: string; kind: 'chapterEnd'; book: BookMeta; chapter: number; prompt: string };

/** Taille cible d'un écran de lecture : assez pour avancer, assez court pour rester lisible. */
const TARGET_CHARS = 260;
const MAX_CHARS = 480;
const MAX_VERSES = 5;

const PROMPTS = [
  'Qu’est-ce que ce chapitre te dit de Dieu ?',
  'Quel verset t’a marqué ? Garde-le avec le marque-page.',
  'Y a-t-il quelque chose à mettre en pratique aujourd’hui ?',
  'Transforme ce que tu viens de lire en une courte prière.',
  'Qu’est-ce que ce passage dit de l’être humain — et de toi ?',
  'Si tu devais résumer ce chapitre en une phrase, que dirais-tu ?',
];

export const TOTAL_CHAPTERS = BOOKS.reduce((n, b) => n + b.verses.length, 0);

export const bookMeta = (n: number) => BOOKS[n - 1];

export const isNewTestament = (n: number) => n >= 40;

/** Ramène une position « après la fin » au début du chapitre ou du livre suivant. */
export function normalize({ book, chapter, verse }: Position): Position {
  const meta = bookMeta(book);
  if (verse > meta.verses[chapter - 1]) {
    chapter += 1;
    verse = 1;
  }
  if (chapter > meta.verses.length) return { book: book === 66 ? 1 : book + 1, chapter: 1, verse: 1 };
  return { book, chapter, verse };
}

export class ReadingGenerator {
  private pos: Position;
  private n = 0;

  constructor(start: Position) {
    this.pos = normalize(start);
  }

  next(count: number): ReadingCard[] {
    const cards: ReadingCard[] = [];
    while (cards.length < count) cards.push(...this.step());
    return cards;
  }

  private step(): ReadingCard[] {
    const { book, chapter, verse } = this.pos;
    const meta = bookMeta(book);
    const out: ReadingCard[] = [];
    if (chapter === 1 && verse === 1) out.push({ key: `r${++this.n}`, kind: 'intro', book: meta });

    const texts = loadBook(book)[chapter - 1];
    const verses: [number, string][] = [];
    let chars = 0;
    let v = verse;
    while (v <= texts.length) {
      const t = texts[v - 1];
      if (verses.length > 0 && (chars >= TARGET_CHARS || chars + t.length > MAX_CHARS || verses.length >= MAX_VERSES)) break;
      verses.push([v, t]);
      chars += t.length;
      v++;
    }
    // Ne pas laisser un tout petit reste seul en fin de chapitre.
    const rest = texts.slice(v - 1);
    if (rest.length > 0 && rest.length <= 2 && rest.join(' ').length < 120 && chars < MAX_CHARS) {
      for (const t of rest) verses.push([v++, t]);
    }

    const from = verse;
    const to = v - 1;
    const chapterEnd = to === texts.length;
    out.push({
      key: `r${++this.n}`,
      kind: 'passage',
      book: meta,
      chapterEnd,
      passage: {
        id: `${book}-${chapter}-${from}`,
        book,
        bookName: meta.name,
        chapter,
        from,
        to,
        reference: `${meta.name} ${chapter}:${from}${to > from ? `-${to}` : ''}`,
        text: verses.map(([, t]) => t).join(' '),
        verses,
      },
    });
    if (chapterEnd) {
      out.push({ key: `r${++this.n}`, kind: 'chapterEnd', book: meta, chapter, prompt: PROMPTS[(book * 7 + chapter) % PROMPTS.length] });
    }
    this.pos = normalize({ book, chapter, verse: to + 1 });
    return out;
  }
}

// ——— Lecture d'un plan ———

export type PlanReadingCard = ReadingCard | { key: string; kind: 'planGoal' } | { key: string; kind: 'planEnd' };

/**
 * Le fil d'un plan : la lecture suivie à partir de son propre marque-page, avec une carte quand la
 * portion du jour est atteinte (on peut continuer pour prendre de l'avance) et une fin de plan.
 */
export class PlanReadingGenerator {
  private gen: ReadingGenerator | null;
  private done = false;
  private n = 0;
  private total: number;

  /** goal : nombre de chapitres qui devraient être lus à la fin de la journée. */
  constructor(
    private plan: Plan,
    startIdx: number,
    verse: number,
    private goal: number,
  ) {
    const chapters = planChapters(plan);
    this.total = chapters.length;
    const start = chapters[startIdx];
    this.gen = start ? new ReadingGenerator({ book: start.book, chapter: start.chapter, verse }) : null;
  }

  next(count: number): PlanReadingCard[] {
    const out: PlanReadingCard[] = [];
    if (!this.gen) {
      if (!this.done) out.push({ key: 'plan-end', kind: 'planEnd' });
      this.done = true;
      return out;
    }
    while (out.length < count && !this.done) {
      for (const card of this.gen.next(1)) {
        out.push(card);
        if (card.kind !== 'chapterEnd') continue;
        const idx = planIndex(this.plan, card.book.n, card.chapter);
        if (idx + 1 === this.goal && idx + 1 < this.total) out.push({ key: `plan-goal-${++this.n}`, kind: 'planGoal' });
        if (idx + 1 >= this.total) {
          out.push({ key: 'plan-end', kind: 'planEnd' });
          this.done = true;
          break;
        }
      }
    }
    return out;
  }
}

// ——— Reprendre au marque-page en gardant ce qui précède ———

type AnyCard = { kind: string; passage?: { book: number; chapter: number; from: number; to: number }; book?: BookMeta };

/** La carte où reprendre : le passage qui contient la position (ou la présentation du livre en tout début). */
export function isResumeCard(card: AnyCard, pos: Position): boolean {
  if (pos.chapter === 1 && pos.verse === 1 && card.kind === 'intro') return card.book?.n === pos.book;
  const p = card.passage;
  return card.kind === 'passage' && !!p && p.book === pos.book && p.chapter === pos.chapter && p.from <= pos.verse && pos.verse <= p.to;
}

/**
 * Génère les cartes depuis un point de départ antérieur jusqu'à la carte cible (comprise), plus quelques
 * suivantes, et renvoie l'index de la cible : le fil s'ouvre là, mais on peut remonter pour relire.
 */
export function cardsUntil<C extends AnyCard>(gen: { next(n: number): C[] }, isTarget: (c: C) => boolean, after = 6, limit = 800) {
  const cards: C[] = [];
  let index = -1;
  while (index === -1 && cards.length < limit) {
    const batch = gen.next(10);
    if (batch.length === 0) break;
    for (const c of batch) {
      if (index === -1 && isTarget(c)) index = cards.length;
      cards.push(c);
    }
  }
  cards.push(...gen.next(after));
  return { cards, index: Math.max(0, index) };
}
