import { bookMeta, nextBook, type TranslationId } from './bible';

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

/** Ramène une position « après la fin » au début du chapitre ou du livre suivant (dans l'ordre de lecture). */
export function normalize({ book, chapter, verse }: Position, t: TranslationId): Position {
  const meta = bookMeta(book, t);
  if (chapter <= meta.verses.length && verse > meta.verses[chapter - 1]) {
    chapter += 1;
    verse = 1;
  }
  if (chapter > meta.verses.length) return { book: nextBook(book), chapter: 1, verse: 1 };
  return { book, chapter, verse };
}
