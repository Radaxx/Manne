import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { VERSES, type Passage, type Theme } from './data/content';
import { planById, planChapters, planIndex, type PlanState } from './plans';
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
  plans: Record<string, PlanState>; // plans de lecture en cours, chacun avec son marque-page
  reminder: ReminderSettings;
  pinnedPrayers: string[]; // dans l'ordre d'épinglage
  customPrayers: CustomPrayer[]; // prières écrites par l'utilisateur
  confession: { items: ConfessionItem[]; lastConfession: string | null }; // préparation de la confession
  confessionLock: boolean; // protéger la confession par empreinte / Face ID
  rosary: RosaryProgress; // chapelet guidé
  adoration: AdorationProgress; // adoration guidée
};

/** Un chapelet commencé : on peut le quitter et le reprendre là où on s'était arrêté. */
export type RosarySession = { set: number; decade: number | null; fatima: boolean; step: number; intention: string; day: string };

export type RosaryProgress = {
  session: RosarySession | null;
  last: string | null; // dernier chapelet terminé (AAAA-MM-JJ)
  count: number; // chapelets et dizaines terminés
  fatima: boolean; // « Ô mon Jésus » après chaque dizaine
  texts: boolean; // afficher le texte complet des prières
};

export type AdorationMode = 'contemplative' | 'guided';

/** Une adoration commencée : on peut la quitter et la reprendre à l'étape où on s'était arrêté. */
export type AdorationSession = { mode: AdorationMode; minutes: number; step: number; day: string };

export type AdorationIntention = { id: string; text: string; at: number };

export type AdorationProgress = {
  session: AdorationSession | null;
  last: string | null; // dernière adoration terminée (AAAA-MM-JJ)
  count: number; // adorations terminées
  mode: AdorationMode; // dernier choix, proposé par défaut
  minutes: number; // dernière durée choisie
  intentions: AdorationIntention[]; // à confier à chaque adoration, jusqu'à ce qu'on les retire
};

export type ConfessionItem = { id: string; text: string; at: number };

export type CustomPrayer = { id: string; title: string; text: string; updatedAt: number };

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
  customPrayers: [],
  confession: { items: [], lastConfession: null },
  confessionLock: true,
  rosary: { session: null, last: null, count: 0, fatima: true, texts: true },
  adoration: { session: null, last: null, count: 0, mode: 'guided', minutes: 30, intentions: [] },
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
        // Anciennes versions : un plan gardait la liste des chapitres lus ; on la convertit en marque-page.
        for (const [id, state] of Object.entries(stored.plans as Record<string, PlanState & { done?: string[] }>)) {
          const plan = planById(id);
          if (!plan) delete stored.plans[id];
          else if (state.pos === undefined) {
            const done = new Set(state.done ?? []);
            const pos = planChapters(plan).findIndex((c) => !done.has(c.key));
            stored.plans[id] = { start: state.start, pos: pos === -1 ? planChapters(plan).length : pos, verse: 1 };
          }
        }
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

  /** Compte un chapitre comme lu (statistiques et progression par livre). */
  const withChapterRead = (p: Progress, book: number, chapter: number): Progress => {
    const key = `${book}:${chapter}`;
    return {
      ...p,
      chaptersRead: p.chaptersRead.includes(key) ? p.chaptersRead : [...p.chaptersRead, key],
      chaptersToday: p.chaptersToday.includes(key) ? p.chaptersToday : [...p.chaptersToday, key],
    };
  };

  const markChapterRead = useCallback((book: number, chapter: number) => {
    setProgress((p) => withChapterRead(p, book, chapter));
  }, []);

  /** Lecture libre : avance le marque-page juste après ce passage. N'a aucun effet sur les plans. */
  const advanceReading = useCallback((passage: Passage, chapterEnd: boolean) => {
    setProgress((p) => {
      const next = normalize({ book: passage.book, chapter: passage.chapter, verse: passage.to + 1 });
      const moved = { ...p, currentBook: next.book, positions: { ...p.positions, [next.book]: { chapter: next.chapter, verse: next.verse } } };
      return chapterEnd ? withChapterRead(moved, passage.book, passage.chapter) : moved;
    });
  }, []);

  /**
   * Lecture d'un plan : avance son propre marque-page jusqu'après ce passage, sans jamais reculer.
   * Tout ce qui précède la position atteinte compte comme lu, même si on a glissé vite.
   */
  const advancePlan = useCallback((id: string, passage: Pick<Passage, 'book' | 'chapter' | 'to'>, chapterEnd: boolean) => {
    setProgress((p) => {
      const plan = planById(id);
      const state = p.plans[id];
      if (!plan || !state) return p;
      const idx = planIndex(plan, passage.book, passage.chapter);
      if (idx === -1) return p;
      const pos = chapterEnd ? idx + 1 : idx;
      const verse = chapterEnd ? 1 : passage.to + 1;
      if (pos < state.pos || (pos === state.pos && verse <= state.verse)) return chapterEnd ? withChapterRead(p, passage.book, passage.chapter) : p;
      const updated = { ...p, plans: { ...p.plans, [id]: { ...state, pos, verse } } };
      return chapterEnd ? withChapterRead(updated, passage.book, passage.chapter) : updated;
    });
  }, []);

  const selectBook = useCallback((book: number, restart = false) => {
    setProgress((p) => ({
      ...p,
      currentBook: book,
      positions: restart ? { ...p.positions, [book]: { chapter: 1, verse: 1 } } : p.positions,
    }));
  }, []);

  /** Place le marque-page d'un plan à une position précise, en avant comme en arrière (« Marquer ici »). */
  const setPlanPosition = useCallback((id: string, pos: number, verse: number) => {
    setProgress((p) => (p.plans[id] ? { ...p, plans: { ...p.plans, [id]: { ...p.plans[id], pos, verse } } } : p));
  }, []);

  /** Lecture libre : place le marque-page au début d'un chapitre choisi. */
  const goTo = useCallback((book: number, chapter: number) => {
    setProgress((p) => ({ ...p, currentBook: book, positions: { ...p.positions, [book]: { chapter, verse: 1 } } }));
  }, []);

  const startPlan = useCallback((id: string) => {
    setProgress((p) => ({ ...p, plans: { ...p.plans, [id]: { start: today(), pos: 0, verse: 1 } } }));
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

  /** Crée ou met à jour une prière personnelle ; renvoie son identifiant. */
  const saveCustomPrayer = useCallback((prayer: { id?: string; title: string; text: string }) => {
    const id = prayer.id ?? `perso-${Date.now().toString(36)}`;
    const entry: CustomPrayer = { id, title: prayer.title, text: prayer.text, updatedAt: Date.now() };
    setProgress((p) => ({
      ...p,
      customPrayers: p.customPrayers.some((c) => c.id === id) ? p.customPrayers.map((c) => (c.id === id ? entry : c)) : [entry, ...p.customPrayers],
    }));
    return id;
  }, []);

  const deleteCustomPrayer = useCallback((id: string) => {
    setProgress((p) => ({ ...p, customPrayers: p.customPrayers.filter((c) => c.id !== id), pinnedPrayers: p.pinnedPrayers.filter((x) => x !== id) }));
  }, []);

  const addConfessionItem = useCallback((text: string) => {
    const item: ConfessionItem = { id: `c-${Date.now().toString(36)}`, text, at: Date.now() };
    setProgress((p) => ({ ...p, confession: { ...p.confession, items: [...p.confession.items, item] } }));
  }, []);

  const removeConfessionItem = useCallback((id: string) => {
    setProgress((p) => ({ ...p, confession: { ...p.confession, items: p.confession.items.filter((i) => i.id !== id) } }));
  }, []);

  /** Après l'absolution : la liste est effacée, on garde seulement la date. */
  const completeConfession = useCallback(() => {
    setProgress((p) => ({ ...p, confession: { items: [], lastConfession: today() } }));
  }, []);

  const setConfessionLock = useCallback((confessionLock: boolean) => {
    setProgress((p) => ({ ...p, confessionLock }));
  }, []);

  const setRosarySession = useCallback((session: RosarySession | null) => {
    setProgress((p) => ({ ...p, rosary: { ...p.rosary, session } }));
  }, []);

  /** Chapelet terminé : on garde seulement la date et le compte. */
  const completeRosary = useCallback(() => {
    setProgress((p) => ({ ...p, rosary: { ...p.rosary, session: null, last: today(), count: p.rosary.count + 1 } }));
  }, []);

  const setRosaryPrefs = useCallback((prefs: Partial<Pick<RosaryProgress, 'fatima' | 'texts'>>) => {
    setProgress((p) => ({ ...p, rosary: { ...p.rosary, ...prefs } }));
  }, []);

  const setAdorationSession = useCallback((session: AdorationSession | null) => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, session } }));
  }, []);

  /** Adoration terminée : on garde seulement la date et le compte (les intentions restent). */
  const completeAdoration = useCallback(() => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, session: null, last: today(), count: p.adoration.count + 1 }, ...touch(p) }));
  }, []);

  const setAdorationPrefs = useCallback((prefs: Partial<Pick<AdorationProgress, 'mode' | 'minutes'>>) => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, ...prefs } }));
  }, []);

  const addAdorationIntention = useCallback((text: string) => {
    const intention: AdorationIntention = { id: `i-${Date.now().toString(36)}`, text, at: Date.now() };
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, intentions: [...p.adoration.intentions, intention] } }));
  }, []);

  const removeAdorationIntention = useCallback((id: string) => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, intentions: p.adoration.intentions.filter((i) => i.id !== id) } }));
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

  return { progress, loaded, markRead, markChapterRead, advanceReading, advancePlan, setPlanPosition, selectBook, goTo, startPlan, stopPlan, setReminder, togglePin, saveCustomPrayer, deleteCustomPrayer, addConfessionItem, removeConfessionItem, completeConfession, setConfessionLock, setRosarySession, completeRosary, setRosaryPrefs, setAdorationSession, completeAdoration, setAdorationPrefs, addAdorationIntention, removeAdorationIntention, toggleLike, toggleSave, getScores, readingSession, restartReading };
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
