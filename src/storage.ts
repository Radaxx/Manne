import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { pruneAelfCache } from './aelf';
import { type AppearanceSettings, DEFAULT_APPEARANCE, normalizeAppearance } from './appearance';
import { bookMeta, clampChapter, DEFAULT_TRANSLATION, isBook, isTranslation, type TranslationId } from './bible';
import { queueLike } from './community';
import { CONFESSION_SECURE_AVAILABLE, loadConfessionItems, saveConfessionItems } from './confession-store';
import { type Passage, type Theme, VERSES } from './data/content';
import { MYSTERIES } from './data/prayers';
import { localDate } from './dates';
import { movePlan, type PlanState, planById, planChapters, planIndex } from './plans';
import { normalize, type Position } from './reading';
import { DEFAULT_REMINDER, type ReminderSettings } from './reminder';
import { currentStreak, DAILY_GOAL, type DayLog, EMPTY_DAY, readingDone, streakFrom } from './today';

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
  appearance: AppearanceSettings; // thème, accent, chapelet, fond de lecture
  translation: TranslationId; // traduction de la Bible pour la lecture, les plans et les prières bibliques
  cultureCalendar: boolean; // Découvrir met en avant les œuvres liées au jour et au temps liturgique
  pinnedPrayers: string[]; // dans l'ordre d'épinglage
  customPrayers: CustomPrayer[]; // prières écrites par l'utilisateur
  confession: { items: ConfessionItem[]; lastConfession: string | null }; // préparation de la confession
  confessionLock: boolean; // protéger la confession par empreinte / Face ID
  rosary: RosaryProgress; // chapelet guidé
  adoration: AdorationProgress; // adoration guidée
  journeys: Record<string, string[]>; // parcours de l'année liturgique (« avent-2026 ») : les jours vécus (AAAA-MM-JJ)
  /**
   * Date (ms) du dernier geste explicite sur un élément : retrait, remise, déplacement en arrière,
   * fin de session. La synchro s'en sert pour savoir qui a le dernier mot ; sans elle, une fusion
   * ne ferait que des unions et des « plus avancé gagne », et rien ne pourrait être retiré ni reculé.
   * Clés : liked:<id>, saved:<id>, pin:<id>, prayer:<id>, intent:<id>, plan:<id>, pos:<livre>, scores, rosary, adoration, appearance,
   * translation, culture, name, journey:<parcours>:<date>. pos:/plan: sont aussi datés par une lecture qui change de chapitre.
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
  cultureCalendar: true,
  pinnedPrayers: ['notre-pere', 'je-vous-salue-marie', 'acte-de-contrition'],
  customPrayers: [],
  confession: { items: [], lastConfession: null },
  confessionLock: true,
  rosary: { session: null, last: null, count: 0, fatima: true, texts: true, view3d: true },
  adoration: { session: null, last: null, count: 0, mode: 'guided', minutes: 30, intentions: [] },
  journeys: {},
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
    reading: prev.reading || readingDone(p.plans, verses, p.day, p.translation),
  };
}

function ensureToday(p: Progress): Progress {
  const d = today();
  if (p.day === d) return p;
  const days = pruneDays({ ...p.days, [p.day]: sealDay(p) });
  return { ...p, day: d, readToday: [], chaptersToday: [], days, streak: streakFrom(days, d) };
}

/** Met à jour le journal du jour et la série. Les drapeaux (prière, lecture) ne reviennent pas en arrière dans la journée. */
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
    reading: prev.reading || readingDone(rolled.plans, verses, rolled.day, rolled.translation),
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
  const base = initial();
  const stored = { ...base, ...(isRecord(raw) ? (raw as Partial<Progress>) : {}) };
  const rosary: Record<string, unknown> = isRecord(stored.rosary) ? stored.rosary : {};
  stored.rosary = {
    session: validRosarySession(rosary.session),
    last: typeof rosary.last === 'string' ? rosary.last : null,
    count: count(rosary.count),
    fatima: typeof rosary.fatima === 'boolean' ? rosary.fatima : base.rosary.fatima,
    texts: typeof rosary.texts === 'boolean' ? rosary.texts : base.rosary.texts,
    view3d: typeof rosary.view3d === 'boolean' ? rosary.view3d : base.rosary.view3d,
  };
  const adoration: Record<string, unknown> = isRecord(stored.adoration) ? stored.adoration : {};
  stored.adoration = {
    session: validAdorationSession(adoration.session),
    last: typeof adoration.last === 'string' ? adoration.last : null,
    count: count(adoration.count),
    mode: adoration.mode === 'contemplative' || adoration.mode === 'guided' ? adoration.mode : base.adoration.mode,
    minutes:
      typeof adoration.minutes === 'number' && Number.isFinite(adoration.minutes) && adoration.minutes > 0
        ? adoration.minutes
        : base.adoration.minutes,
    intentions: (Array.isArray(adoration.intentions) ? (adoration.intentions as unknown[]) : []).filter(isNote),
  };
  const confession: Record<string, unknown> = isRecord(stored.confession) ? stored.confession : {};
  stored.confession = {
    items: (Array.isArray(confession.items) ? (confession.items as unknown[]) : []).filter(isNote),
    lastConfession: typeof confession.lastConfession === 'string' ? confession.lastConfession : null,
  };
  stored.reminder = { ...base.reminder, ...(isRecord(stored.reminder) ? stored.reminder : {}) };
  stored.appearance = normalizeAppearance(stored.appearance);
  stored.translation = isTranslation(stored.translation) ? stored.translation : DEFAULT_TRANSLATION;
  stored.cultureCalendar = typeof stored.cultureCalendar === 'boolean' ? stored.cultureCalendar : true;
  stored.confessionLock = typeof stored.confessionLock === 'boolean' ? stored.confessionLock : true;
  stored.day = typeof stored.day === 'string' && DAY.test(stored.day) ? stored.day : today();
  stored.streak = typeof stored.streak === 'number' && Number.isFinite(stored.streak) && stored.streak >= 0 ? stored.streak : 0;
  stored.lastActiveDay = typeof stored.lastActiveDay === 'string' ? stored.lastActiveDay : null;
  stored.days = validDays(stored.days);
  stored.stamps = validStamps(stored.stamps);
  stored.themeScores = validScores(stored.themeScores);
  stored.seenMilestones = strings(stored.seenMilestones);
  stored.displayName = typeof stored.displayName === 'string' ? stored.displayName : '';
  stored.lastOffice = typeof stored.lastOffice === 'string' ? stored.lastOffice : null;
  stored.liked = strings(stored.liked);
  stored.chaptersRead = strings(stored.chaptersRead);
  stored.readToday = strings(stored.readToday);
  stored.chaptersToday = strings(stored.chaptersToday);
  stored.pinnedPrayers = Array.isArray(stored.pinnedPrayers) ? strings(stored.pinnedPrayers) : base.pinnedPrayers;
  stored.customPrayers = (Array.isArray(stored.customPrayers) ? (stored.customPrayers as unknown[]) : []).filter(
    (c): c is CustomPrayer =>
      isRecord(c) &&
      typeof c.id === 'string' &&
      typeof c.title === 'string' &&
      typeof c.text === 'string' &&
      typeof c.updatedAt === 'number',
  );
  stored.journeys = validJourneys(stored.journeys);
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
  stored.plans = validPlans(stored.plans, stored.translation);
  // Donnée dérivée : recalculée à chaque lecture, pour suivre la règle en vigueur sans attendre un geste.
  stored.streak = currentStreak(stored);
  return stored;
}

/** Plans lus du disque ou du cloud, dans un nouvel objet. Un plan inconnu (venu d'une version plus récente) reste tel quel. */
function validPlans(v: unknown, translation: TranslationId): Progress['plans'] {
  const plans: Progress['plans'] = {};
  for (const [id, state] of Object.entries(isRecord(v) ? v : {})) {
    if (!isRecord(state) || typeof state.start !== 'string' || !DAY.test(state.start)) continue;
    const plan = planById(id);
    const start = state.start;
    if (state.pos === undefined) {
      // Ancien format : la liste des chapitres faits. Impossible à relire sans le plan.
      if (!plan) continue;
      const done = new Set(strings(state.done));
      const chapters = planChapters(plan, translation);
      const pos = chapters.findIndex((c) => !done.has(c.key));
      plans[id] = { start, pos: pos === -1 ? chapters.length : pos, verse: 1 };
    } else if (!Number.isInteger(state.pos) || (state.pos as number) < 0 || !Number.isInteger(state.verse) || (state.verse as number) < 1) {
      plans[id] = { start, pos: Math.max(0, Math.floor(Number(state.pos)) || 0), verse: 1 };
    } else {
      plans[id] = { start, pos: state.pos as number, verse: state.verse as number };
    }
  }
  return plans;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

function validDays(v: unknown): Progress['days'] {
  const days: Progress['days'] = {};
  for (const [date, log] of Object.entries(isRecord(v) ? v : {})) {
    if (!DAY.test(date) || !isRecord(log) || typeof log.verses !== 'number' || !Number.isFinite(log.verses) || log.verses < 0) continue;
    days[date] = {
      verses: log.verses,
      gospel: log.gospel === true,
      office: log.office === true,
      rosary: log.rosary === true,
      adoration: log.adoration === true,
      reading: log.reading === true,
    };
  }
  return days;
}

function validStamps(v: unknown): Progress['stamps'] {
  const stamps: Progress['stamps'] = {};
  for (const [key, at] of Object.entries(isRecord(v) ? v : {})) if (typeof at === 'number' && Number.isFinite(at)) stamps[key] = at;
  return stamps;
}

function validScores(v: unknown): Progress['themeScores'] {
  const scores: Record<string, number> = {};
  for (const [theme, score] of Object.entries(isRecord(v) ? v : {})) {
    if (typeof score === 'number' && Number.isFinite(score)) scores[theme] = score;
  }
  return scores as Progress['themeScores'];
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

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Les jours vécus de chaque parcours : des dates, sans doublon. */
function validJourneys(v: unknown): Progress['journeys'] {
  const journeys: Progress['journeys'] = {};
  for (const [id, days] of Object.entries(isRecord(v) ? v : {})) {
    const valid = [...new Set(strings(days).filter((d) => DAY.test(d)))].sort();
    // Un parcours inconnu (d'une version plus récente) reste : seuls les identifiants vides ou absurdes sont écartés.
    if (id.length > 0 && id.length <= 64 && valid.length) journeys[id] = valid;
  }
  return journeys;
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

export function advanceReadingState(p: Progress, passage: Passage, chapterEnd: boolean): Progress {
  const next = normalize({ book: passage.book, chapter: passage.chapter, verse: passage.to + 1 }, p.translation);
  // Un changement de chapitre est daté, comme un geste : le dernier appareil à avoir lu l'emporte à la fusion.
  const changed = p.positions[next.book]?.chapter !== next.chapter;
  const moved = {
    ...p,
    currentBook: next.book,
    positions: { ...p.positions, [next.book]: { chapter: next.chapter, verse: next.verse } },
    stamps: changed ? stamped(p, `pos:${next.book}`) : p.stamps,
  };
  return touchDay(chapterEnd ? withChapterRead(moved, passage.book, passage.chapter) : moved);
}

export function advancePlanState(
  p: Progress,
  id: string,
  passage: Pick<Passage, 'book' | 'chapter' | 'to'>,
  chapterEnd: boolean,
): Progress {
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
  const updated = {
    ...base,
    plans: { ...base.plans, [id]: { ...state, pos, verse } },
    stamps: pos !== state.pos ? stamped(base, `plan:${id}`) : base.stamps,
  };
  return touchDay(chapterEnd ? withChapterRead(updated, passage.book, passage.chapter) : updated);
}

export function setDisplayNameState(p: Progress, name: string): Progress {
  const displayName = name.trim().slice(0, 40);
  return p.displayName === displayName ? p : { ...p, displayName, stamps: stamped(p, 'name') };
}

/** Met à jour le journal du jour et la série (exporté pour les tests). */
export const touchDayState = (p: Progress, patch?: Parameters<typeof touchDay>[1]) => touchDay(p, patch);

/** Copie de sauvegarde d'une progression illisible, gardée à côté pour qu'on puisse la récupérer. */
export const CORRUPT_KEY = `${KEY}.corrupt`;

/** La progression telle qu'elle va dans AsyncStorage : sans la liste de confession, gardée dans l'espace sécurisé. */
const withoutConfessionItems = (p: Progress): Progress => ({ ...p, confession: { ...p.confession, items: [] } });

/**
 * Lit la progression sur le disque. Une lecture qui échoue est retentée une fois. `writable` dit s'il est sûr d'y
 * écrire ensuite : faux si le disque n'a pas pu être lu, ou si son contenu abîmé n'a pas pu être mis de côté.
 *
 * La liste de confession est lue dans l'espace sécurisé. Une liste encore présente dans la progression (versions
 * précédentes) y est déplacée, et ne quitte la progression qu'une fois l'écriture sécurisée réussie.
 * `secure` dit si la liste est confiée à l'espace sécurisé (lisible, hors web) ; `savedItems` est alors ce qu'il contient.
 */
export async function loadStored(): Promise<{
  progress: Progress | null;
  writable: boolean;
  secure: boolean;
  savedItems: string | null;
}> {
  let raw: string | null = null;
  let read = false;
  for (let attempt = 0; attempt < 2 && !read; attempt++) {
    try {
      raw = await AsyncStorage.getItem(KEY);
      read = true;
    } catch {}
  }
  if (!read) return { progress: null, writable: false, secure: false, savedItems: null };
  let progress: Progress | null = null;
  if (raw) {
    try {
      progress = prepareStored(JSON.parse(raw) as unknown);
    } catch {
      try {
        await AsyncStorage.setItem(`${CORRUPT_KEY}-${Date.now()}`, raw);
      } catch {
        return { progress: null, writable: false, secure: false, savedItems: null };
      }
    }
  }
  if (!CONFESSION_SECURE_AVAILABLE) {
    return { progress: progress && touchDay(progress), writable: true, secure: false, savedItems: null };
  }
  let stored = await loadConfessionItems();
  // Sans progression sur le disque, l'app vient d'être installée : sur iOS, le trousseau survit à la désinstallation.
  // Une liste laissée par une installation précédente est effacée, comme le promet la politique de confidentialité.
  if (stored.ok && raw === null && stored.items.length > 0) {
    stored = (await saveConfessionItems([])) ? { items: [], ok: true } : { items: [], ok: false };
  }
  if (!stored.ok) {
    // Espace sécurisé illisible : la liste est inconnue, on n'y touche pas et elle reste dans la progression.
    return { progress: progress && touchDay(progress), writable: true, secure: false, savedItems: null };
  }
  const legacy = progress?.confession.items ?? [];
  const known = new Set(stored.items.map((i) => i.id));
  const items = [...stored.items, ...legacy.filter((i) => !known.has(i.id))];
  let savedItems: string | null = JSON.stringify(stored.items);
  // Migration : sécurisé d'abord ; si cela échoue, la liste reste dans la progression et on réessaiera.
  const moved = items.length === stored.items.length || (await saveConfessionItems(items));
  if (moved) {
    savedItems = JSON.stringify(items);
    if (progress && legacy.length > 0) {
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(withoutConfessionItems(progress)));
      } catch {}
    }
  }
  const full = progress
    ? { ...progress, confession: { ...progress.confession, items } }
    : items.length > 0
      ? prepareStored({ confession: { items } })
      : null;
  return { progress: full && touchDay(full), writable: true, secure: true, savedItems };
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(initial);
  const pristine = useRef(progress);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(progress);
  ref.current = progress;

  // Tant que le disque n'a pas été relu (ou sauvegardé s'il était abîmé), on n'y écrit rien : un état vide
  // ne doit jamais recouvrir une progression qu'on n'a pas pu lire.
  const canWrite = useRef(false);
  // La liste de confession va dans l'espace sécurisé quand il est lisible ; `savedItems` est ce qu'il contient.
  const secure = useRef(false);
  const savedItems = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStored()
      .then((result) => {
        if (cancelled) return;
        canWrite.current = result.writable;
        secure.current = result.secure;
        savedItems.current = result.savedItems;
        const stored = result.progress;
        if (stored) {
          // Une action faite avant la fin de la lecture ne se perd pas : elle est fusionnée dans ce qui vient du disque.
          setProgress((current) => {
            if (current === pristine.current) return touchDay(stored);
            const { mergeProgress } = require('./sync') as typeof import('./sync');
            return touchDay(mergeProgress(stored, current));
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dernier état écrit sur le disque, pour ne pas réécrire le même.
  const written = useRef<string | null>(null);
  // Les écritures se suivent une à une : deux enregistrements ne se mélangent jamais.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const persist = useCallback(() => {
    queue.current = queue.current.then(async () => {
      if (!canWrite.current) return;
      const current = ref.current;
      // La liste de confession est enregistrée à part (espace sécurisé) et ne quitte la progression qu'une fois
      // cet enregistrement réussi : en cas d'échec, elle reste dans la progression plutôt que d'être perdue.
      let strip = secure.current;
      if (strip) {
        const items = JSON.stringify(current.confession.items);
        if (items !== savedItems.current) {
          if (await saveConfessionItems(current.confession.items)) savedItems.current = items;
          else strip = false;
        }
      }
      const json = JSON.stringify(strip ? withoutConfessionItems(current) : current);
      if (json === written.current) return;
      written.current = json;
      // Si le stockage est plein, on sacrifie le cache des textes liturgiques et on réessaie une fois.
      await AsyncStorage.setItem(KEY, json)
        .catch(() => pruneAelfCache().then(() => AsyncStorage.setItem(KEY, json)))
        .catch((e) => {
          written.current = null;
          console.warn('Progression non enregistrée', e);
        });
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
    setProgress((p) => advanceReadingState(p, passage, chapterEnd));
  }, []);

  /**
   * Lecture d'un plan : avance son propre marque-page jusqu'après ce passage, sans jamais reculer.
   * Tout ce qui précède la position atteinte compte comme lu, même si on a glissé vite.
   */
  const advancePlan = useCallback((id: string, passage: Pick<Passage, 'book' | 'chapter' | 'to'>, chapterEnd: boolean) => {
    setProgress((p) => advancePlanState(p, id, passage, chapterEnd));
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

  /** Marque un jour d'un parcours comme vécu, ou retire la marque. */
  const toggleJourneyDay = useCallback((journey: string, date: string) => {
    setProgress((p) => {
      const days = p.journeys[journey] ?? [];
      const next = days.includes(date) ? days.filter((d) => d !== date) : [...days, date].sort();
      const { [journey]: _, ...others } = p.journeys;
      return {
        ...p,
        journeys: next.length ? { ...others, [journey]: next } : others,
        stamps: stamped(p, `journey:${journey}:${date}`),
      };
    });
  }, []);

  const markGospel = useCallback(() => {
    setProgress((p) => touchDay(p, { gospel: true }));
  }, []);

  const markOffice = useCallback(() => {
    setProgress((p) => ({ ...touchDay(p, { office: true }), lastOffice: today() }));
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setProgress((p) => setDisplayNameState(p, name));
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
      cultureCalendar: p.cultureCalendar,
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

  const setCultureCalendar = useCallback((cultureCalendar: boolean) => {
    setProgress((p) => (p.cultureCalendar === cultureCalendar ? p : { ...p, cultureCalendar, stamps: stamped(p, 'culture') }));
  }, []);

  const setAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setProgress((p) => {
      const appearance = normalizeAppearance({ ...p.appearance, ...patch });
      if (
        appearance.scheme === p.appearance.scheme &&
        appearance.accent === p.appearance.accent &&
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
    setCultureCalendar,
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
    toggleJourneyDay,
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
