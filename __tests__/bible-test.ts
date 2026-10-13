import {
  BOOK_ORDER,
  bookMeta,
  books,
  chapterSource,
  DEUTEROCANONICAL,
  loadChapter,
  passageLabel,
  TOTAL_CHAPTERS,
  type TranslationId,
} from '../src/bible';
import { BOOKS as LSG } from '../src/data/bible/lsg';
import { movePlan, PLANS, planById, planChapters, planIndex } from '../src/plans';
import { normalize } from '../src/reading';

const BOTH: TranslationId[] = ['lsg', 'crampon'];

describe('les deux traductions', () => {
  it('ont les 73 livres de la Bible catholique, dans l’ordre de lecture', () => {
    expect(BOOK_ORDER).toHaveLength(73);
    expect(new Set(BOOK_ORDER).size).toBe(73);
    for (const t of BOTH) expect(books(t).map((b) => b.n)).toEqual(Array.from({ length: 73 }, (_, i) => i + 1));
    expect(BOOK_ORDER.slice(15, 20)).toEqual([16, 67, 68, 17, 69]); // Néhémie, Tobie, Judith, Esther, 1 Maccabées
  });

  it('ont autant de chapitres, pour que les plans gardent la même longueur', () => {
    for (const t of BOTH) expect(books(t).reduce((n, b) => n + b.verses.length, 0)).toBe(TOTAL_CHAPTERS);
    for (const plan of PLANS) expect(planChapters(plan, 'lsg')).toHaveLength(planChapters(plan, 'crampon').length);
  });

  it('n’ont aucun verset vide', () => {
    for (const t of BOTH)
      for (const book of books(t))
        book.verses.forEach((count, c) => {
          const verses = loadChapter(book.n, c + 1, t);
          expect(verses).toHaveLength(count);
          expect(verses.every((v) => v.trim().length > 0)).toBe(true);
        });
  });

  it('font lire dans la Crampon ce que la Louis Segond n’a pas', () => {
    for (const n of DEUTEROCANONICAL) expect(chapterSource(n, 1, 'lsg')).toBe('crampon');
    expect(chapterSource(17, 10, 'lsg')).toBe('lsg');
    expect(chapterSource(17, 11, 'lsg')).toBe('crampon'); // Esther grec
    expect(chapterSource(27, 13, 'lsg')).toBe('crampon'); // Susanne
    expect(bookMeta(17, 'lsg').verses).toHaveLength(16);
    expect(loadChapter(17, 11, 'lsg')).toEqual(loadChapter(17, 11, 'crampon'));
  });

  it('gardent chacune leur découpage de Joël et de Malachie', () => {
    expect(bookMeta(29, 'lsg').verses).toHaveLength(3);
    expect(bookMeta(29, 'crampon').verses).toHaveLength(4);
    expect(bookMeta(39, 'lsg').verses).toHaveLength(4);
    expect(bookMeta(39, 'crampon').verses).toHaveLength(3);
    expect(passageLabel(23, 40, 31, 31, 'lsg')).toBe('Ésaïe 40:31');
    expect(passageLabel(23, 40, 31, 31, 'crampon')).toBe('Isaïe 40:31');
  });
});

describe('normalize', () => {
  it('passe au livre suivant dans l’ordre catholique', () => {
    expect(normalize({ book: 16, chapter: 14, verse: 1 }, 'crampon')).toEqual({ book: 67, chapter: 1, verse: 1 });
    expect(normalize({ book: 39, chapter: 3, verse: 25 }, 'crampon')).toEqual({ book: 40, chapter: 1, verse: 1 });
    expect(normalize({ book: 66, chapter: 23, verse: 1 }, 'lsg')).toEqual({ book: 1, chapter: 1, verse: 1 });
    expect(normalize({ book: 73, chapter: 7, verse: 1 }, 'lsg')).toEqual({ book: 26, chapter: 1, verse: 1 }); // Baruch → Ézéchiel
  });
});

describe('plans et traductions', () => {
  it('garde l’ancien plan de 66 livres tel qu’il était, dans les deux traductions', () => {
    const old = planById('bible-365');
    if (!old) throw new Error('plan bible-365 introuvable');
    const before = LSG.flatMap((b) => b.verses.map((_, i) => `${b.n}:${i + 1}`));
    expect(planChapters(old, 'lsg').map((c) => c.key)).toEqual(before);
    expect(planChapters(old, 'crampon')).toHaveLength(before.length);
  });

  it('garde le marque-page d’un plan sur le même chapitre en changeant de traduction', () => {
    const plan = planById('bible-catholique-365');
    if (!plan) throw new Error('plan bible-catholique-365 introuvable');
    const amos = planIndex(plan, 30, 1, 'lsg');
    const moved = movePlan(plan, { start: '2026-01-01', pos: amos, verse: 3 }, 'lsg', 'crampon');
    expect(planChapters(plan, 'crampon')[moved.pos].key).toBe('30:1');
    expect(moved.pos).toBe(amos + 1); // Joël a un chapitre de plus dans la Crampon
    expect(moved.verse).toBe(3);
  });
});
