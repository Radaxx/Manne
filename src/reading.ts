import { BOOKS, loadBook, type BookMeta } from './data/bible';
import type { Passage } from './data/content';

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
