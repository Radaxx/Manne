import { BOOKS } from './data/bible';

export type Position = { book: number; chapter: number; verse: number };

const PROMPTS = [
  'Qu’est-ce que ce chapitre te dit de Dieu ?',
  'Quel verset t’a marqué ? Garde-le avec le marque-page.',
  'Y a-t-il quelque chose à mettre en pratique aujourd’hui ?',
  'Transforme ce que tu viens de lire en une courte prière.',
  'Qu’est-ce que ce passage dit de l’être humain — et de toi ?',
  'Si tu devais résumer ce chapitre en une phrase, que dirais-tu ?',
];

/** La question de méditation qui clôt un chapitre (toujours la même pour un chapitre donné). */
export const chapterPrompt = (book: number, chapter: number) => PROMPTS[(book * 7 + chapter) % PROMPTS.length];

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
