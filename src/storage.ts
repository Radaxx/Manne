import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VERSES, type Passage, type Theme } from './data/content';
import { normalize, type Position } from './reading';

/** Objectif quotidien, en versets lus (un chapitre en compte souvent 20 à 40). */
export const DAILY_GOAL = 30;

/** Livre proposé par défaut : Marc, court et direct, idéal pour commencer. */
const FIRST_BOOK = 41;

export type Progress = {
  liked: string[];
  saved: Passage[];
  themeScores: Partial<Record<Theme, number>>;
  day: string; // AAAA-MM-JJ
  readToday: string[]; // clés « livre:chapitre:verset »
  chaptersToday: string[];
  streak: number;
  lastActiveDay: string | null;
  currentBook: number;
  positions: Record<number, { chapter: number; verse: number }>;
  chaptersRead: string[]; // clés « livre:chapitre »
};

const KEY = 'manne/progress/v1';

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDay(new Date());
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDay(d);
};

const initial = (): Progress => ({
  liked: [],
  saved: [],
  themeScores: {},
  day: today(),
  readToday: [],
  chaptersToday: [],
  streak: 0,
  lastActiveDay: null,
  currentBook: FIRST_BOOK,
  positions: {},
  chaptersRead: [],
});

export const verseKeys = (p: Passage) => Array.from({ length: p.to - p.from + 1 }, (_, i) => `${p.book}:${p.chapter}:${p.from + i}`);

export function readingPosition(p: Progress): Position {
  const pos = p.positions[p.currentBook] ?? { chapter: 1, verse: 1 };
  return { book: p.currentBook, ...pos };
}

/** Compte une activité du jour et met à jour la série. */
function touch(p: Progress): Pick<Progress, 'streak' | 'lastActiveDay'> {
  const d = today();
  return { streak: p.lastActiveDay === d ? p.streak : p.lastActiveDay === yesterday() ? p.streak + 1 : 1, lastActiveDay: d };
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(initial);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(progress);
  ref.current = progress;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const stored = { ...initial(), ...(JSON.parse(raw) as Progress) };
        // Anciennes versions : les favoris étaient des identifiants de versets.
        stored.saved = (stored.saved as (Passage | string)[])
          .map((s) => (typeof s === 'string' ? VERSES.find((v) => v.id === s) : s))
          .filter((s): s is Passage => !!s);
        // Nouveau jour : on remet les compteurs quotidiens à zéro.
        if (stored.day !== today()) {
          stored.day = today();
          stored.readToday = [];
          stored.chaptersToday = [];
        }
        setProgress(stored);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(progress)).catch(() => {});
  }, [progress, loaded]);

  const markRead = useCallback((passage: Passage) => {
    setProgress((p) => {
      const fresh = verseKeys(passage).filter((k) => !p.readToday.includes(k));
      if (fresh.length === 0) return p;
      return { ...p, readToday: [...p.readToday, ...fresh], ...touch(p) };
    });
  }, []);

  /** Avance le marque-page de lecture juste après ce passage. */
  const advanceReading = useCallback((passage: Passage, chapterEnd: boolean) => {
    setProgress((p) => {
      const next = normalize({ book: passage.book, chapter: passage.chapter, verse: passage.to + 1 });
      const chapterKey = `${passage.book}:${passage.chapter}`;
      return {
        ...p,
        currentBook: next.book,
        positions: { ...p.positions, [next.book]: { chapter: next.chapter, verse: next.verse } },
        chaptersRead: chapterEnd && !p.chaptersRead.includes(chapterKey) ? [...p.chaptersRead, chapterKey] : p.chaptersRead,
        chaptersToday: chapterEnd && !p.chaptersToday.includes(chapterKey) ? [...p.chaptersToday, chapterKey] : p.chaptersToday,
      };
    });
  }, []);

  const selectBook = useCallback((book: number, restart = false) => {
    setProgress((p) => ({
      ...p,
      currentBook: book,
      positions: restart ? { ...p.positions, [book]: { chapter: 1, verse: 1 } } : p.positions,
    }));
  }, []);

  const toggleLike = useCallback((id: string, theme?: Theme, force?: boolean) => {
    setProgress((p) => {
      const has = p.liked.includes(id);
      if (force && has) return p;
      const delta = has ? -1 : 1;
      return {
        ...p,
        liked: has ? p.liked.filter((x) => x !== id) : [...p.liked, id],
        themeScores: theme ? { ...p.themeScores, [theme]: Math.max(0, (p.themeScores[theme] ?? 0) + delta) } : p.themeScores,
      };
    });
  }, []);

  const toggleSave = useCallback((passage: Passage) => {
    setProgress((p) => {
      const has = p.saved.some((s) => s.id === passage.id);
      // On ne garde que les champs du passage (pas les données d'affichage).
      const { id, book, bookName, chapter, from, to, reference, text } = passage;
      return { ...p, saved: has ? p.saved.filter((s) => s.id !== id) : [{ id, book, bookName, chapter, from, to, reference, text }, ...p.saved] };
    });
  }, []);

  const getScores = useCallback(() => ref.current.themeScores, []);

  return { progress, loaded, markRead, advanceReading, selectBook, toggleLike, toggleSave, getScores };
}
