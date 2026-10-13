import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { pruneAelfCache } from './aelf';
import { type AppearanceSettings, DEFAULT_APPEARANCE, normalizeAppearance } from './appearance';
import { bookMeta, clampChapter, DEFAULT_TRANSLATION, isBook, isTranslation, type TranslationId } from './bible';
import { queueLike } from './community';
import { type Passage, type Theme, VERSES } from './data/content';
import { MYSTERIES } from './data/prayers';
import { localDate } from './dates';
import { movePlan, type PlanState, planById, planChapters, planIndex } from './plans';
import { normalize, type Position } from './reading';
import { DEFAULT_REMINDER, type ReminderSettings } from './reminder';
import { DAILY_GOAL, type DayLog, EMPTY_DAY, readingDone, streakFrom } from './today';

export { DAILY_GOAL };

/** Livre proposé par défaut : Marc, court et direct, idéal pour commencer. */
const FIRST_BOOK = 41;

export type Progress = {
  liked: string[];
  saved: Passage[];
  themeScores: Partial<Record<Theme, number>>;
  day: string; // AAAA-MM-JJ
  readToday: string[]; // clés « livre:chapitre:verset »
  chaptersToday: string[];
  days: Record<string, DayLog>; // journal, une entrée par jour, conservée
  seenMilestones: string[];
  displayName: string;
  lastOffice: string | null; // dernier office prié (AAAA-MM-JJ)
  streak: number;
  lastActiveDay: string | null;
  currentBook: number;
  positions: Record<number, { chapter: number; verse: number }>;
  chaptersRead: string[]; // clés « livre:chapitre »
  plans: Record<string, PlanState>; // plans de lecture en cours, chacun avec son marque-page
  reminder: ReminderSettings;
  appearance: AppearanceSettings; // thème, chapelet, fond de lecture
  translation: TranslationId; // traduction de la Bible pour la lecture, les plans et les prières bibliques
  pinnedPrayers: string[]; // dans l'ordre d'épinglage
  customPrayers: CustomPrayer[]; // prières écrites par l'utilisateur
  confession: { items: ConfessionItem[]; lastConfession: string | null }; // préparation de la confession
  confessionLock: boolean; // protéger la confession par empreinte / Face ID
  rosary: RosaryProgress; // chapelet guidé
  adoration: AdorationProgress; // adoration guidée
  /**
   * Date (ms) du dernier geste explicite sur un élément : retrait, remise, déplacement en arrière,
   * fin de session. La synchro s'en sert pour savoir qui a le dernier mot ; sans elle, une fusion
   * ne ferait que des unions et des « plus avancé gagne », et rien ne pourrait être retiré ni reculé.
   * Clés : liked:<id>, saved:<id>, pin:<id>, prayer:<id>, intent:<id>, plan:<id>, pos:<livre>, scores, rosary, adoration, appearance,
   * translation.
   */
  stamps: Record<string, number>;
};

/** Un chapelet commencé : on peut le quitter et le reprendre là où on s'était arrêté. */
export type RosarySession = { set: number; decade: number | null; fatima: boolean; step: number; intention: string; day: string };

export type RosaryProgress = {
  session: RosarySession | null;
  last: string | null; // dernier chapelet terminé (AAAA-MM-JJ)
  count: number; // chapelets et dizaines terminés
  fatima: boolean; // « Ô mon Jésus » après chaque dizaine
  texts: boolean; // afficher le texte complet des prières
  view3d: boolean; // chapelet en 3D (sinon l'anneau dessiné à plat)
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

export const today = () => localDate();

const initial = (): Progress => ({
  liked: [],
  saved: [],
  themeScores: {},
  day: today(),
  readToday: [],
  chaptersToday: [],
  days: {},
  seenMilestones: [],
  displayName: '',
  lastOffice: null,
  streak: 0,
  lastActiveDay: null,
  currentBook: FIRST_BOOK,
  positions: {},
  chaptersRead: [],
  plans: {},
  reminder: DEFAULT_REMINDER,
  appearance: DEFAULT_APPEARANCE,
  translation: DEFAULT_TRANSLATION,
  pinnedPrayers: ['notre-pere', 'je-vous-salue-marie', 'acte-de-contrition'],
  customPrayers: [],
  confession: { items: [], lastConfession: null },
  confessionLock: true,
  rosary: { session: null, last: null, count: 0, fatima: true, texts: true, view3d: true },
  adoration: { session: null, last: null, count: 0, mode: 'guided', minutes: 30, intentions: [] },
  stamps: {},
});

/** Les stamps d'une progression, avec ces clés remises à maintenant. */
function stamped(p: Progress, ...keys: string[]): Progress['stamps'] {
  const at = Date.now();
  const stamps = { ...p.stamps };
  for (const key of keys) stamps[key] = at;
  return stamps;
}

export const verseKeys = (p: Passage) => Array.from({ length: p.to - p.from + 1 }, (_, i) => `${p.book}:${p.chapter}:${p.from + i}`);

/** Le marque-page de la lecture libre, ramené dans le livre (une position venue de l'autre traduction peut le dépasser). */
export function readingPosition(p: Progress): Position {
  const pos = p.positions[p.currentBook] ?? { chapter: 1, verse: 1 };
  const chapter = clampChapter(p.currentBook, pos.chapter, p.translation);
  return { book: p.currentBook, chapter, verse: chapter === pos.chapter ? pos.verse : 1 };
}

function pruneDays(days: Record<string, DayLog>): Record<string, DayLog> {
  const keys = Object.keys(days).sort();
  if (keys.length <= 400) return days;
  const keep = new Set(keys.slice(-400));
  return Object.fromEntries(Object.entries(days).filter(([key]) => keep.has(key)));
}

/** Fige le jour qu'on quitte : la lecture est recalculée une dernière fois, puis plus touchée. */
function sealDay(p: Progress): DayLog {
  const prev = p.days[p.day] ?? EMPTY_DAY;
  const verses = Math.max(prev.verses, p.readToday.length);
  return {
    verses,
    gospel: prev.gospel,
    office: prev.office,
    rosary: prev.rosary,
    adoration: prev.adoration,
    reading: readingDone(p.plans, verses, p.day, p.translation),
  };
}

function ensureToday(p: Progress): Progress {
  const d = today();
  if (p.day === d) return p;
  const days = pruneDays({ ...p.days, [p.day]: sealDay(p) });
  return { ...p, day: d, readToday: [], chaptersToday: [], days, streak: streakFrom(days, d) };
}

/** Met à jour le journal du jour et la série. Les drapeaux de prière ne reviennent pas en arrière. */
function touchDay(p: Progress, patch?: Partial<Pick<DayLog, 'gospel' | 'office' | 'rosary' | 'adoration'>>): Progress {
  const rolled = ensureToday(p);
  const prev = rolled.days[rolled.day] ?? EMPTY_DAY;
  const verses = Math.max(prev.verses, rolled.readToday.length);
  const log: DayLog = {
    verses,
    gospel: prev.gospel || !!patch?.gospel,
    office: prev.office || !!patch?.office,
    rosary: prev.rosary || !!patch?.rosary,
    adoration: prev.adoration || !!patch?.adoration,
    reading: readingDone(rolled.plans, verses, rolled.day, rolled.translation),
  };
  if (
    rolled === p &&
    prev.verses === log.verses &&
    prev.gospel === log.gospel &&
    prev.office === log.office &&
    prev.rosary === log.rosary &&
    prev.adoration === log.adoration &&
    prev.reading === log.reading
  ) {
    return p;
  }
  const days = pruneDays({ ...rolled.days, [rolled.day]: log });
  return { ...rolled, days, streak: streakFrom(days, today()) };
}

/** Compte un chapitre comme lu (statistiques et progression par livre). */
function withChapterRead(p: Progress, book: number, chapter: number): Progress {
  const key = `${book}:${chapter}`;
  return {
    ...p,
    chaptersRead: p.chaptersRead.includes(key) ? p.chaptersRead : [...p.chaptersRead, key],
    chaptersToday: p.chaptersToday.includes(key) ? p.chaptersToday : [...p.chaptersToday, key],
  };
}

/** Remet une progression lue du disque ou du cloud dans la forme actuelle, sans encore changer de jour. */
export function prepareStored(raw: unknown): Progress {
  const stored = { ...initial(), ...(raw && typeof raw === 'object' ? (raw as Partial<Progress>) : {}) };
  stored.rosary = { ...initial().rosary, ...(stored.rosary ?? {}) };
  stored.adoration = { ...initial().adoration, ...(stored.adoration ?? {}) };
  stored.confession = { ...initial().confession, ...(stored.confession ?? {}) };
  stored.reminder = { ...initial().reminder, ...(stored.reminder ?? {}) };
  stored.appearance = normalizeAppearance(stored.appearance);
  stored.translation = isTranslation(stored.translation) ? stored.translation : DEFAULT_TRANSLATION;
  stored.days = stored.days && typeof stored.days === 'object' && !Array.isArray(stored.days) ? stored.days : {};
  stored.stamps = stored.stamps && typeof stored.stamps === 'object' && !Array.isArray(stored.stamps) ? stored.stamps : {};
  stored.seenMilestones = Array.isArray(stored.seenMilestones) ? stored.seenMilestones : [];
  stored.displayName = typeof stored.displayName === 'string' ? stored.displayName : '';
  stored.lastOffice = typeof stored.lastOffice === 'string' ? stored.lastOffice : null;
  stored.liked = strings(stored.liked);
  stored.chaptersRead = strings(stored.chaptersRead);
  stored.readToday = strings(stored.readToday);
  stored.chaptersToday = strings(stored.chaptersToday);
  stored.pinnedPrayers = Array.isArray(stored.pinnedPrayers) ? strings(stored.pinnedPrayers) : initial().pinnedPrayers;
  stored.customPrayers = (Array.isArray(stored.customPrayers) ? (stored.customPrayers as unknown[]) : []).filter(
    (c): c is CustomPrayer =>
      isRecord(c) &&
      typeof c.id === 'string' &&
      typeof c.title === 'string' &&
      typeof c.text === 'string' &&
      typeof c.updatedAt === 'number',
  );
  stored.confession.items = (Array.isArray(stored.confession.items) ? (stored.confession.items as unknown[]) : []).filter(isNote);
  stored.adoration.intentions = (Array.isArray(stored.adoration.intentions) ? (stored.adoration.intentions as unknown[]) : []).filter(
    isNote,
  );
  stored.rosary.session = validRosarySession(stored.rosary.session);
  stored.adoration.session = validAdorationSession(stored.adoration.session);
  // Un livre ou une position hors de la Bible ferait planter l'accueil et la lecture.
  stored.currentBook = validBook(stored.currentBook) ? stored.currentBook : FIRST_BOOK;
  const positions: Progress['positions'] = {};
  for (const [key, pos] of Object.entries(isRecord(stored.positions) ? stored.positions : {})) {
    const book = Number(key);
    if (validBook(book) && isRecord(pos) && validPlace(book, pos.chapter, pos.verse)) {
      positions[book] = { chapter: pos.chapter as number, verse: pos.verse as number };
    }
  }
  stored.positions = positions;
  stored.saved = (Array.isArray(stored.saved) ? (stored.saved as (Passage | string)[]) : [])
    .map((s) => (typeof s === 'string' ? VERSES.find((v) => v.id === s) : s))
    .filter((s): s is Passage => !!s && typeof s === 'object' && typeof s.id === 'string');
  stored.plans = isRecord(stored.plans) ? stored.plans : {};
  for (const [id, state] of Object.entries(stored.plans as Record<string, PlanState & { done?: string[] }>)) {
    const plan = planById(id);
    if (!plan || !isRecord(state) || typeof state.start !== 'string') delete stored.plans[id];
    else if (state.pos === undefined) {
      const done = new Set(state.done ?? []);
      const chapters = planChapters(plan, stored.translation);
      const pos = chapters.findIndex((c) => !done.has(c.key));
      stored.plans[id] = { start: state.start, pos: pos === -1 ? chapters.length : pos, verse: 1 };
    } else if (!Number.isInteger(state.pos) || state.pos < 0 || !Number.isInteger(state.verse) || state.verse < 1) {
      stored.plans[id] = { start: state.start, pos: Math.max(0, Math.floor(Number(state.pos)) || 0), verse: 1 };
    }
  }
  return stored;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const isNote = (v: unknown): v is { id: string; text: string; at: number } =>
  isRecord(v) && typeof v.id === 'string' && typeof v.text === 'string' && typeof v.at === 'number';

const validBook = (book: unknown): book is number => Number.isInteger(book) && isBook(book);

/** Une position est gardée si elle existe dans l'une des traductions : on peut en changer sans la perdre. */
function validPlace(book: number, chapter: unknown, verse: unknown): boolean {
  const chapters = Math.max(bookMeta(book, 'lsg').verses.length, bookMeta(book, 'crampon').verses.length);
  return (
    Number.isInteger(chapter) &&
    Number.isInteger(verse) &&
    (chapter as number) >= 1 &&
    (chapter as number) <= chapters &&
    (verse as number) >= 1
  );
}

function validRosarySession(s: unknown): RosarySession | null {
  if (!isRecord(s)) return null;
  const { set, decade, step } = s;
  if (!Number.isInteger(set) || (set as number) < 0 || (set as number) >= MYSTERIES.length) return null;
  if (decade !== null && (!Number.isInteger(decade) || (decade as number) < 0 || (decade as number) > 4)) return null;
  if (!Number.isInteger(step) || (step as number) < 0) return null;
  return {
    set: set as number,
    decade: decade as number | null,
    step: step as number,
    fatima: s.fatima !== false,
    intention: typeof s.intention === 'string' ? s.intention : '',
    day: typeof s.day === 'string' ? s.day : today(),
  };
}

function validAdorationSession(s: unknown): AdorationSession | null {
  if (!isRecord(s)) return null;
  if (s.mode !== 'contemplative' && s.mode !== 'guided') return null;
  if (typeof s.minutes !== 'number' || s.minutes <= 0 || !Number.isInteger(s.step) || (s.step as number) < 0) return null;
  return { mode: s.mode, minutes: s.minutes, step: s.step as number, day: typeof s.day === 'string' ? s.day : today() };
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
        setProgress(touchDay(prepareStored(JSON.parse(raw) as unknown)));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Dernier état écrit sur le disque, pour ne pas réécrire le même.
  const written = useRef<string | null>(null);
  const persist = useCallback(() => {
    const json = JSON.stringify(ref.current);
    if (json === written.current) return;
    written.current = json;
    // Si le stockage est plein, on sacrifie le cache des textes liturgiques et on réessaie une fois.
    AsyncStorage.setItem(KEY, json)
      .catch(() => pruneAelfCache().then(() => AsyncStorage.setItem(KEY, json)))
      .catch((e) => {
        written.current = null;
        console.warn('Progression non enregistrée', e);
      });
  }, []);

  // Lire en faisant défiler change la progression à chaque verset : on n'écrit qu'une fois le calme revenu,
  // et tout de suite quand l'app passe en arrière-plan (elle peut y être tuée sans prévenir).
  // biome-ignore lint/correctness/useExhaustiveDependencies: chaque nouvelle progression relance le délai ; persist lit la dernière via ref.
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(persist, 500);
    return () => clearTimeout(timer);
  }, [progress, loaded, persist]);

  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') persist();
    });
    return () => {
      sub.remove();
      persist();
    };
  }, [loaded, persist]);

  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setProgress((p) => touchDay(p));
    });
    return () => sub.remove();
  }, [loaded]);

  const markRead = useCallback((passage: Passage) => {
    setProgress((p) => {
      const base = p.day === today() ? p : touchDay(p);
      const fresh = verseKeys(passage).filter((k) => !base.readToday.includes(k));
      if (fresh.length === 0) return base;
      return touchDay({ ...base, readToday: [...base.readToday, ...fresh] });
    });
  }, []);

  const markChapterRead = useCallback((book: number, chapter: number) => {
    setProgress((p) => withChapterRead(p, book, chapter));
  }, []);

  /** Lecture libre : avance le marque-page juste après ce passage. N'a aucun effet sur les plans. */
  const advanceReading = useCallback((passage: Passage, chapterEnd: boolean) => {
    setProgress((p) => {
      const next = normalize({ book: passage.book, chapter: passage.chapter, verse: passage.to + 1 }, p.translation);
      const moved = {
        ...p,
        currentBook: next.book,
        positions: { ...p.positions, [next.book]: { chapter: next.chapter, verse: next.verse } },
      };
      return touchDay(chapterEnd ? withChapterRead(moved, passage.book, passage.chapter) : moved);
    });
  }, []);

  /**
   * Lecture d'un plan : avance son propre marque-page jusqu'après ce passage, sans jamais reculer.
   * Tout ce qui précède la position atteinte compte comme lu, même si on a glissé vite.
   */
  const advancePlan = useCallback((id: string, passage: Pick<Passage, 'book' | 'chapter' | 'to'>, chapterEnd: boolean) => {
    setProgress((p) => {
      const base = p.day === today() ? p : touchDay(p);
      const plan = planById(id);
      const state = base.plans[id];
      if (!plan || !state) return base;
      const idx = planIndex(plan, passage.book, passage.chapter, base.translation);
      if (idx === -1) return base;
      const pos = chapterEnd ? idx + 1 : idx;
      const verse = chapterEnd ? 1 : passage.to + 1;
      if (pos < state.pos || (pos === state.pos && verse <= state.verse))
        return touchDay(chapterEnd ? withChapterRead(base, passage.book, passage.chapter) : base);
      const updated = { ...base, plans: { ...base.plans, [id]: { ...state, pos, verse } } };
      return touchDay(chapterEnd ? withChapterRead(updated, passage.book, passage.chapter) : updated);
    });
  }, []);

  const selectBook = useCallback((book: number, restart = false) => {
    setProgress((p) => ({
      ...p,
      currentBook: book,
      positions: restart ? { ...p.positions, [book]: { chapter: 1, verse: 1 } } : p.positions,
      stamps: restart ? stamped(p, `pos:${book}`) : p.stamps,
    }));
  }, []);

  /** Place le marque-page d'un plan à une position précise, en avant comme en arrière (« Marquer ici »). */
  const setPlanPosition = useCallback((id: string, pos: number, verse: number) => {
    setProgress((p) =>
      p.plans[id] ? { ...p, plans: { ...p.plans, [id]: { ...p.plans[id], pos, verse } }, stamps: stamped(p, `plan:${id}`) } : p,
    );
  }, []);

  /** Lecture libre : place le marque-page au début d'un chapitre choisi. */
  const goTo = useCallback((book: number, chapter: number) => {
    setProgress((p) => ({
      ...p,
      currentBook: book,
      positions: { ...p.positions, [book]: { chapter, verse: 1 } },
      stamps: stamped(p, `pos:${book}`),
    }));
  }, []);

  const startPlan = useCallback((id: string) => {
    setProgress((p) => {
      const base = p.day === today() ? p : touchDay(p);
      return touchDay({
        ...base,
        plans: { ...base.plans, [id]: { start: today(), pos: 0, verse: 1 } },
        stamps: stamped(base, `plan:${id}`),
      });
    });
  }, []);

  const stopPlan = useCallback((id: string) => {
    setProgress((p) => {
      const { [id]: _, ...plans } = p.plans;
      return touchDay({ ...p, plans, stamps: stamped(p, `plan:${id}`) });
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setProgress((p) => ({
      ...p,
      pinnedPrayers: p.pinnedPrayers.includes(id) ? p.pinnedPrayers.filter((x) => x !== id) : [...p.pinnedPrayers, id],
      stamps: stamped(p, `pin:${id}`),
    }));
  }, []);

  /** Crée ou met à jour une prière personnelle ; renvoie son identifiant. */
  const saveCustomPrayer = useCallback((prayer: { id?: string; title: string; text: string }) => {
    const id = prayer.id ?? `perso-${Date.now().toString(36)}`;
    const entry: CustomPrayer = { id, title: prayer.title, text: prayer.text, updatedAt: Date.now() };
    setProgress((p) => ({
      ...p,
      customPrayers: p.customPrayers.some((c) => c.id === id)
        ? p.customPrayers.map((c) => (c.id === id ? entry : c))
        : [entry, ...p.customPrayers],
      stamps: stamped(p, `prayer:${id}`),
    }));
    return id;
  }, []);

  const deleteCustomPrayer = useCallback((id: string) => {
    setProgress((p) => ({
      ...p,
      customPrayers: p.customPrayers.filter((c) => c.id !== id),
      pinnedPrayers: p.pinnedPrayers.filter((x) => x !== id),
      stamps: stamped(p, `prayer:${id}`, `pin:${id}`),
    }));
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
    setProgress((p) => ({ ...p, rosary: { ...p.rosary, session }, stamps: stamped(p, 'rosary') }));
  }, []);

  /** Chapelet terminé : on garde seulement la date et le compte. Une dizaine suffit pour la prière du jour. */
  const completeRosary = useCallback(() => {
    setProgress((p) =>
      touchDay(
        { ...p, rosary: { ...p.rosary, session: null, last: today(), count: p.rosary.count + 1 }, stamps: stamped(p, 'rosary') },
        { rosary: true },
      ),
    );
  }, []);

  const setRosaryPrefs = useCallback((prefs: Partial<Pick<RosaryProgress, 'fatima' | 'texts' | 'view3d'>>) => {
    setProgress((p) => ({ ...p, rosary: { ...p.rosary, ...prefs } }));
  }, []);

  const setAdorationSession = useCallback((session: AdorationSession | null) => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, session }, stamps: stamped(p, 'adoration') }));
  }, []);

  /** Adoration terminée : on garde seulement la date et le compte (les intentions restent). */
  const completeAdoration = useCallback(() => {
    setProgress((p) =>
      touchDay(
        {
          ...p,
          adoration: { ...p.adoration, session: null, last: today(), count: p.adoration.count + 1 },
          stamps: stamped(p, 'adoration'),
        },
        { adoration: true },
      ),
    );
  }, []);

  const markGospel = useCallback(() => {
    setProgress((p) => touchDay(p, { gospel: true }));
  }, []);

  const markOffice = useCallback(() => {
    setProgress((p) => ({ ...touchDay(p, { office: true }), lastOffice: today() }));
  }, []);

  const setDisplayName = useCallback((name: string) => {
    const displayName = name.trim().slice(0, 40);
    setProgress((p) => (p.displayName === displayName ? p : { ...p, displayName }));
  }, []);

  const seeMilestone = useCallback((id: string) => {
    setProgress((p) => (p.seenMilestones.includes(id) ? p : { ...p, seenMilestones: [...p.seenMilestones, id] }));
  }, []);

  /**
   * Applique le résultat d'une synchro. La mise à jour reçoit l'état le plus récent, pas celui que la
   * synchro avait vu avant son aller-retour réseau : ce qui a été fait entre-temps ne se perd pas.
   */
  const hydrate = useCallback((update: (local: Progress) => Progress) => {
    setProgress((local) => touchDay(update(local)));
  }, []);

  /**
   * Après une déconnexion, le chemin du compte quitte l'appareil. Reste la confession, qui n'a jamais
   * quitté ce téléphone, et le rappel.
   */
  const resetAccountData = useCallback(() => {
    setProgress((p) => ({
      ...initial(),
      reminder: p.reminder,
      appearance: p.appearance,
      translation: p.translation,
      confession: { ...initial().confession, items: p.confession.items },
      confessionLock: p.confessionLock,
    }));
  }, []);

  const setAdorationPrefs = useCallback((prefs: Partial<Pick<AdorationProgress, 'mode' | 'minutes'>>) => {
    setProgress((p) => ({ ...p, adoration: { ...p.adoration, ...prefs } }));
  }, []);

  const addAdorationIntention = useCallback((text: string) => {
    const intention: AdorationIntention = { id: `i-${Date.now().toString(36)}`, text, at: Date.now() };
    setProgress((p) => ({
      ...p,
      adoration: { ...p.adoration, intentions: [...p.adoration.intentions, intention] },
      stamps: stamped(p, `intent:${intention.id}`),
    }));
  }, []);

  const removeAdorationIntention = useCallback((id: string) => {
    setProgress((p) => ({
      ...p,
      adoration: { ...p.adoration, intentions: p.adoration.intentions.filter((i) => i.id !== id) },
      stamps: stamped(p, `intent:${id}`),
    }));
  }, []);

  const setReminder = useCallback((reminder: ReminderSettings) => {
    setProgress((p) => ({ ...p, reminder }));
  }, []);

  /** Change de traduction : chaque plan garde son chapitre (Joël et Malachie ne se découpent pas pareil). */
  const setTranslation = useCallback((translation: TranslationId) => {
    setProgress((p) => {
      if (p.translation === translation) return p;
      const plans: Progress['plans'] = {};
      for (const [id, state] of Object.entries(p.plans)) {
        const plan = planById(id);
        plans[id] = plan ? movePlan(plan, state, p.translation, translation) : state;
      }
      return { ...p, translation, plans, stamps: stamped(p, 'translation') };
    });
  }, []);

  const setAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setProgress((p) => {
      const appearance = normalizeAppearance({ ...p.appearance, ...patch });
      if (
        appearance.scheme === p.appearance.scheme &&
        appearance.rosary === p.appearance.rosary &&
        appearance.reading === p.appearance.reading
      )
        return p;
      return { ...p, appearance, stamps: stamped(p, 'appearance') };
    });
  }, []);

  const toggleLike = useCallback((id: string, theme?: Theme, force?: boolean, target?: string) => {
    const has = ref.current.liked.includes(id);
    if (force && has) return;
    const liked = !has;
    ref.current = {
      ...ref.current,
      liked: liked ? [...ref.current.liked, id] : ref.current.liked.filter((x) => x !== id),
    };
    setProgress((p) => {
      const currently = p.liked.includes(id);
      if (currently === liked) return p;
      const delta = liked ? 1 : -1;
      return {
        ...p,
        liked: liked ? [...p.liked, id] : p.liked.filter((x) => x !== id),
        themeScores: theme ? { ...p.themeScores, [theme]: Math.max(0, (p.themeScores[theme] ?? 0) + delta) } : p.themeScores,
        stamps: stamped(p, `liked:${id}`, ...(theme ? ['scores'] : [])),
      };
    });
    if (target) void queueLike(target, liked);
  }, []);

  const toggleSave = useCallback((passage: Passage) => {
    setProgress((p) => {
      const has = p.saved.some((s) => s.id === passage.id);
      // On ne garde que les champs du passage (pas les données d'affichage).
      const { id, book, bookName, chapter, from, to, reference, text } = passage;
      return {
        ...p,
        saved: has ? p.saved.filter((s) => s.id !== id) : [{ id, book, bookName, chapter, from, to, reference, text }, ...p.saved],
        stamps: stamped(p, `saved:${id}`),
      };
    });
  }, []);

  const getScores = useCallback(() => ref.current.themeScores, []);

  // Incrémenté quand on choisit où lire : le fil de lecture repart de la nouvelle position.
  const [readingSession, setReadingSession] = useState(0);
  const restartReading = useCallback(() => setReadingSession((n) => n + 1), []);

  // Toutes les actions sont stables (useCallback sans dépendance) : un seul objet, créé une fois, suffit.
  const [actions] = useState(() => ({
    markRead,
    markChapterRead,
    advanceReading,
    advancePlan,
    setPlanPosition,
    selectBook,
    goTo,
    startPlan,
    stopPlan,
    setReminder,
    setAppearance,
    setTranslation,
    togglePin,
    saveCustomPrayer,
    deleteCustomPrayer,
    addConfessionItem,
    removeConfessionItem,
    completeConfession,
    setConfessionLock,
    setRosarySession,
    completeRosary,
    setRosaryPrefs,
    setAdorationSession,
    completeAdoration,
    setAdorationPrefs,
    markGospel,
    markOffice,
    setDisplayName,
    seeMilestone,
    hydrate,
    resetAccountData,
    addAdorationIntention,
    removeAdorationIntention,
    toggleLike,
    toggleSave,
    getScores,
    restartReading,
  }));
  const state = useMemo(() => ({ progress, loaded, readingSession }), [progress, loaded, readingSession]);
  return { state, actions };
}

export type ProgressState = ReturnType<typeof useProgress>['state'];
export type ProgressActions = ReturnType<typeof useProgress>['actions'];
export type ProgressApi = ProgressState & ProgressActions;

const StateContext = createContext<ProgressState | null>(null);
const ActionsContext = createContext<ProgressActions | null>(null);

/**
 * Une seule progression partagée par tous les écrans. L'état et les actions passent par deux contexts :
 * un composant qui ne fait qu'agir (useActions) ne se redessine pas à chaque verset lu.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { state, actions } = useProgress();
  return createElement(ActionsContext.Provider, { value: actions }, createElement(StateContext.Provider, { value: state }, children));
}

export function useActions(): ProgressActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useActions doit être utilisé dans <ProgressProvider>');
  return actions;
}

export function useApp(): ProgressApi {
  const state = useContext(StateContext);
  const actions = useActions();
  const api = useMemo(() => (state ? { ...state, ...actions } : null), [state, actions]);
  if (!api) throw new Error('useApp doit être utilisé dans <ProgressProvider>');
  return api;
}
