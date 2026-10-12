import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { VERSES, type Passage, type Theme } from './data/content';
import { planById } from './plans';
import { DEFAULT_REMINDER, type ReminderSettings } from './reminder';
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
  plans: Record<string, { start: string; done: string[] }>; // plans de lecture en cours
  reminder: ReminderSettings;
  pinnedPrayers: string[]; // dans l'ordre d'épinglage
};

const KEY = 'manne/progress/v1';

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => localDay(new Date());
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
  plans: {},
  reminder: DEFAULT_REMINDER,
  pinnedPrayers: ['notre-pere', 'je-vous-salue-marie', 'acte-de-contrition'],
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
      // Un chapitre terminé compte pour chaque plan en cours qui le contient.
      const plans = { ...p.plans };
      if (chapterEnd) {
        for (const [id, state] of Object.entries(plans)) {
          if (planById(id)?.books.includes(passage.book) && !state.done.includes(chapterKey)) plans[id] = { ...state, done: [...state.done, chapterKey] };
        }
      }
      return {
        ...p,
        currentBook: next.book,
        positions: { ...p.positions, [next.book]: { chapter: next.chapter, verse: next.verse } },
        chaptersRead: chapterEnd && !p.chaptersRead.includes(chapterKey) ? [...p.chaptersRead, chapterKey] : p.chaptersRead,
        chaptersToday: chapterEnd && !p.chaptersToday.includes(chapterKey) ? [...p.chaptersToday, chapterKey] : p.chaptersToday,
        plans,
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

  /** Place le marque-page au début d'un chapitre précis (plans de lecture, « continuer »). */
  const goTo = useCallback((book: number, chapter: number) => {
    setProgress((p) => ({ ...p, currentBook: book, positions: { ...p.positions, [book]: { chapter, verse: 1 } } }));
  }, []);

  const startPlan = useCallback((id: string) => {
    setProgress((p) => ({ ...p, plans: { ...p.plans, [id]: { start: today(), done: [] } } }));
  }, []);

  const stopPlan = useCallback((id: string) => {
    setProgress((p) => {
      const { [id]: _, ...plans } = p.plans;
      return { ...p, plans };
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setProgress((p) => ({ ...p, pinnedPrayers: p.pinnedPrayers.includes(id) ? p.pinnedPrayers.filter((x) => x !== id) : [...p.pinnedPrayers, id] }));
  }, []);

  const setReminder = useCallback((reminder: ReminderSettings) => {
    setProgress((p) => ({ ...p, reminder }));
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

  // Incrémenté quand on choisit où lire : le fil de lecture repart de la nouvelle position.
  const [readingSession, setReadingSession] = useState(0);
  const restartReading = useCallback(() => setReadingSession((n) => n + 1), []);

  return { progress, loaded, markRead, advanceReading, selectBook, goTo, startPlan, stopPlan, setReminder, togglePin, toggleLike, toggleSave, getScores, readingSession, restartReading };
}

export type ProgressApi = ReturnType<typeof useProgress>;

const ProgressContext = createContext<ProgressApi | null>(null);

/** Une seule progression partagée par tous les écrans. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  return createElement(ProgressContext.Provider, { value: useProgress() }, children);
}

export function useApp(): ProgressApi {
  const api = useContext(ProgressContext);
  if (!api) throw new Error('useApp doit être utilisé dans <ProgressProvider>');
  return api;
}
