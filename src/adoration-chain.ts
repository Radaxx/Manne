import { dayLabel, daysSince, localDate, shiftDay, WEEKDAYS } from './dates';
import {
  deviceTimeZone,
  isTimeZone,
  parseLocalTime,
  type SpanChoice,
  TITLE_MAX,
  timeLabel,
  titleProblem,
  untilLabel,
  weekdaysInZone,
  weekdaysPhrase,
  zoneCity,
  zonedInstant,
  zonedParts,
} from './gatherings';
import { DESCRIPTION_MAX } from './groups';
import { localDateIn } from './novenas';
import { asRecord, call, type Result, readRows } from './profile';

// Chaîne d'adoration de groupe (supabase/migrations/013_adoration_chains.sql, 014_recurrences.sql). Rien n'est gardé sur le
// téléphone, sauf les rappels que programme src/adoration-reminders.ts.
//
// Deux formes. `once` : un début et une fin (de 1 h à 7 jours), une seule OCCURRENCE. `weekly` : des jours de la semaine
// (0 = dimanche), une heure locale de début et une de fin (la fin peut tomber le lendemain : 21 h -> 7 h), un premier et un
// dernier jour (au plus un an), dans le fuseau de la chaîne : une OCCURRENCE par jour qui convient, 400 au plus.
//
// Créneaux : à l'intérieur d'une occurrence, de `slotMinutes` en `slotMinutes` à partir de son début. Un créneau est
// IDENTIFIÉ par l'instant de son début (`slot_start`), pas par un index. Une occurrence commence à l'heure du mur du fuseau
// puis est convertie en instant, et FINIT à l'heure du mur de `localEnd` : la nuit d'un changement d'heure compte donc un
// créneau de plus ou de moins (21 h -> 7 h fait 11 h le 25 octobre 2026 à Paris), jamais un créneau coupé. Tous les libellés
// sont écrits dans le fuseau du téléphone (`zone` sert aux tests) ; si la chaîne a été créée sous une autre heure, `originMention`
// le dit. Le serveur reste la référence pour accepter une action ; ces fonctions pures ne servent qu'à l'écran et aux rappels.
//
// Le détail d'une chaîne hebdomadaire ne contient qu'une FENÊTRE d'occurrences (4 semaines) : « Voir les semaines suivantes »
// en demande d'autres.

export type SlotMinutes = 30 | 60;
export const SLOT_CHOICES: SlotMinutes[] = [30, 60];

export type ChainRecurrence = 'once' | 'weekly';

export const CHAIN_TITLE_MAX = TITLE_MAX;
export const CHAIN_INTENTION_MAX = DESCRIPTION_MAX;
export const PLACE_MAX = 80;
/** Un groupe a 3 chaînes à venir ou en cours au plus. */
export const MAX_ACTIVE_CHAINS = 3;
/** 12 créneaux non terminés au plus par personne et par chaîne (toutes occurrences confondues) ; 10 adorateurs au plus par créneau. */
export const MAX_SLOTS_PER_PERSON = 12;
export const MAX_PER_SLOT = 10;
/** Une chaîne commence dans les 60 prochains jours. Ponctuelle : de 1 h à 7 jours. */
export const START_MAX_DAYS = 60;
export const MIN_CHAIN_MINUTES = 60;
export const MAX_CHAIN_MINUTES = 7 * 24 * 60;
/** Hebdomadaire : une occurrence dure de 30 min à 24 h ; 400 occurrences au plus ; du premier au dernier jour, un an au plus (366 jours). */
export const MIN_OCCURRENCE_MINUTES = 30;
export const MAX_OCCURRENCE_MINUTES = 24 * 60;
export const OCCURRENCES_MAX = 400;
export const SPAN_MAX_DAYS = 366;
/** Le détail d'une chaîne hebdomadaire montre les 4 prochaines semaines, puis 4 de plus à chaque « Voir les semaines suivantes ». */
export const WINDOW_WEEKS = 4;
/** « C'est bientôt ton heure d'adoration » et le rappel : 10 minutes avant le début du créneau. */
export const SOON_MIN = 10;
/** On rappelle mes 3 prochains créneaux (budget de notifications d'iOS, cf. src/reminder.ts). */
export const MAX_REMINDED_SLOTS = 3;

/** Les durées rapides du formulaire d'une chaîne ponctuelle. */
export const DURATION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 60, label: '1 h' },
  { minutes: 180, label: '3 h' },
  { minutes: 600, label: '10 h, une nuit' },
  { minutes: 1440, label: '24 h' },
  { minutes: 4320, label: '3 jours' },
  { minutes: 10080, label: '7 jours' },
];

/** Les choix de « Pendant » d'une chaîne hebdomadaire (une date de fin explicite se choisit à part). */
export const CHAIN_SPANS: SpanChoice[] = [
  { id: 'w3', label: '3 semaines', weeks: 3 },
  { id: 'm2', label: '2 mois', months: 2 },
  { id: 'm4', label: '4 mois', months: 4 },
  { id: 'm6', label: '6 mois', months: 6 },
  { id: 'y1', label: '1 an', months: 12 },
];

// ---------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------

/** Ce qui décide des occurrences d'une chaîne. */
export type ChainSchedule = {
  recurrence: ChainRecurrence;
  slotMinutes: SlotMinutes;
  /** Le fuseau du créateur (celui dans lequel il a choisi les heures). */
  timezone: string;
  /** Les bornes : début de la première occurrence, fin de la dernière (ISO). */
  startsAt: string;
  endsAt: string;
  /** Hebdomadaire : les jours, 0 (dimanche) à 6 ; vide pour une chaîne ponctuelle. */
  weekdays: number[];
  /** Hebdomadaire : « HH:MM » de début et de fin dans le fuseau de la chaîne (la fin est le lendemain si elle n'est pas après le début). */
  localStart: string | null;
  localEnd: string | null;
  /** Hebdomadaire : premier et dernier jour (AAAA-MM-JJ, dans le fuseau de la chaîne). */
  firstOn: string | null;
  lastOn: string | null;
};

/** Un créneau d'une occurrence, vu par moi : sans moi (voir `mine`) dans `handles`, et sans les personnes bloquées (comptées dans `hidden`). */
export type Slot = {
  start: Date;
  end: Date;
  count: number;
  mine: boolean;
  handles: string[];
  hidden: number;
};

/** Une occurrence d'une chaîne et ses créneaux. */
export type Occurrence = { start: Date; end: Date; slots: Slot[] };

/** Une chaîne d'adoration d'un groupe, vue par un membre. Dans une liste, `occurrences` n'a que l'occurrence en cours ou la prochaine, sans pseudos. */
export type AdorationChain = ChainSchedule & {
  id: string;
  groupId: string;
  groupName: string;
  groupEnded: boolean;
  canManage: boolean;
  title: string;
  intention: string;
  /** Vide : chacun adore là où il est. */
  place: string;
  /** Combien d'occurrences en tout (la fenêtre n'en montre qu'une partie). */
  occurrenceCount: number;
  /** Mes créneaux non terminés, du plus proche au plus lointain, toutes occurrences (même hors de la fenêtre). */
  mySlots: Date[];
  /** Au moins un créneau est réservé (par n'importe qui) : le rythme de la chaîne ne change plus. */
  reserved: boolean;
  /** Des occurrences restent après la fenêtre. */
  hasMore: boolean;
  /** Hebdomadaire : le jour (AAAA-MM-JJ) où commence la fenêtre suivante ; nul si le serveur ne l'a pas dit. */
  windowTo: string | null;
  occurrences: Occurrence[];
};

/** Un de mes prochains créneaux : de quoi programmer les rappels et montrer l'accueil. */
export type MyAdorationSlot = {
  chainId: string;
  groupId: string;
  groupName: string;
  title: string;
  place: string;
  timezone: string;
  slotMinutes: SlotMinutes;
  /** Début et fin du créneau (instants ISO). */
  startsAt: string;
  endsAt: string;
};

// ---------------------------------------------------------------------------------------------------------------
// Occurrences et créneaux (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

/** Une plage de temps : le début et la fin d'une occurrence. */
export type Span = { start: Date; end: Date };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Les jours d'un hebdomadaire sont-ils valides ? (1 à 7 valeurs distinctes de 0 à 6) */
export function weekdaysValid(days: number[]): boolean {
  return (
    days.length >= 1 && days.length <= 7 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(days).size === days.length
  );
}

/** Les minutes du mur d'une heure « HH:MM », ou null. */
function wallMinutes(value: string | null): number | null {
  const time = parseLocalTime(value);
  return time ? time.hour * 60 + time.minute : null;
}

/**
 * La durée d'une occurrence hebdomadaire en minutes de mur, de début à fin : la fin est le lendemain si elle n'est pas après le
 * début (21:00 -> 07:00 fait 600 minutes) ; des heures égales font 24 h. Null si une heure est illisible.
 */
export function occurrenceMinutes(localStart: string | null, localEnd: string | null): number | null {
  const a = wallMinutes(localStart);
  const b = wallMinutes(localEnd);
  if (a === null || b === null) return null;
  return b > a ? b - a : b - a + 24 * 60;
}

/** Un hebdomadaire sans le reste : de quoi calculer ses occurrences. */
export type WeeklyPattern = {
  weekdays: number[];
  localStart: string;
  localEnd: string;
  timezone: string;
  firstOn: string;
  lastOn: string;
};

/**
 * Les occurrences d'un hebdomadaire entre deux jours (inclus, par défaut du premier au dernier jour), dans l'ordre : pour
 * chaque jour qui convient, le début à `localStart` et la fin à `localEnd` (le lendemain si besoin), à l'heure du mur du
 * fuseau puis converties en instants. Même calcul que le serveur (adoration_weekly_occurrences). [] si une donnée est invalide ;
 * jamais plus de 401 résultats.
 */
export function weeklyOccurrences(pattern: WeeklyPattern, fromOn: string = pattern.firstOn, toOn: string = pattern.lastOn): Span[] {
  const a = parseLocalTime(pattern.localStart);
  const b = parseLocalTime(pattern.localEnd);
  if (!a || !b || !weekdaysValid(pattern.weekdays) || !ISO_DAY.test(fromOn) || !ISO_DAY.test(toOn)) return [];
  const startMin = a.hour * 60 + a.minute;
  const endMin = b.hour * 60 + b.minute;
  const nextDay = endMin > startMin ? 0 : 1;
  const first = dayMs(fromOn);
  const last = dayMs(toOn);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > (SPAN_MAX_DAYS + 2) * MS_DAY) return [];
  const found: Span[] = [];
  try {
    for (let day = first; day <= last && found.length <= OCCURRENCES_MAX; day += MS_DAY) {
      const d = new Date(day);
      if (!pattern.weekdays.includes(d.getUTCDay())) continue;
      const e = new Date(day + nextDay * MS_DAY);
      found.push({
        start: new Date(zonedInstant(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), a.hour, a.minute, pattern.timezone)),
        end: new Date(zonedInstant(e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate(), b.hour, b.minute, pattern.timezone)),
      });
    }
  } catch {
    return [];
  }
  return found;
}

/** Le motif hebdomadaire d'une chaîne, ou null si elle est ponctuelle ou incomplète. */
export function patternOf(chain: ChainSchedule): WeeklyPattern | null {
  if (chain.recurrence !== 'weekly' || !chain.localStart || !chain.localEnd || !chain.firstOn || !chain.lastOn) return null;
  return {
    weekdays: chain.weekdays,
    localStart: chain.localStart,
    localEnd: chain.localEnd,
    timezone: chain.timezone,
    firstOn: chain.firstOn,
    lastOn: chain.lastOn,
  };
}

/** Toutes les occurrences d'une chaîne (instants seulement, sans créneaux), dans l'ordre. */
export function chainSpans(chain: ChainSchedule): Span[] {
  if (chain.recurrence === 'once') {
    const start = Date.parse(chain.startsAt);
    const end = Date.parse(chain.endsAt);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start: new Date(start), end: new Date(end) }] : [];
  }
  const pattern = patternOf(chain);
  return pattern ? weeklyOccurrences(pattern) : [];
}

/** Combien d'occurrences a ce motif ? (0 s'il est invalide ; plafonné à 401) */
export const occurrenceCountOf = (pattern: WeeklyPattern): number => weeklyOccurrences(pattern).length;

/**
 * Les occurrences de la FENÊTRE qui commence le jour `fromOn` (dans le fuseau de la chaîne) et dure `weeks` semaines : celles qui
 * finissent après minuit de `fromOn` et commencent avant minuit de `fromOn` + 7 x `weeks` jours. Une chaîne ponctuelle a
 * toujours son unique occurrence. Même règle que get_adoration_chain.
 */
export function occurrencesInWindow(chain: ChainSchedule, fromOn: string, weeks: number = WINDOW_WEEKS): Span[] {
  const all = chainSpans(chain);
  if (chain.recurrence === 'once') return all;
  if (!ISO_DAY.test(fromOn)) return [];
  try {
    const [y, m, d] = fromOn.split('-').map(Number);
    const to = shiftDay(fromOn, weeks * 7);
    const [ty, tm, td] = to.split('-').map(Number);
    const windowStart = zonedInstant(y, m, d, 0, 0, chain.timezone);
    const windowEnd = zonedInstant(ty, tm, td, 0, 0, chain.timezone);
    return all.filter((span) => span.end.getTime() > windowStart && span.start.getTime() < windowEnd);
  } catch {
    return [];
  }
}

/** Nombre de créneaux entiers d'une occurrence. */
export function slotCountOf(span: Span, slotMinutes: number): number {
  const minutes = (span.end.getTime() - span.start.getTime()) / MS_MIN;
  return minutes > 0 && slotMinutes > 0 ? Math.floor(minutes / slotMinutes) : 0;
}

/** Les débuts des créneaux d'une occurrence : de `slotMinutes` en `slotMinutes` à partir de son début. */
export function slotStartsOf(span: Span, slotMinutes: number): Date[] {
  return Array.from({ length: slotCountOf(span, slotMinutes) }, (_, i) => new Date(span.start.getTime() + i * slotMinutes * MS_MIN));
}

/**
 * Cet instant est-il EXACTEMENT le début d'un créneau d'une occurrence de la chaîne ? Pour une hebdomadaire on regarde
 * l'occurrence du jour local de l'instant et celle de la veille (une occurrence de nuit commence la veille). Même règle que
 * adoration_slot_occurrence côté serveur.
 */
export function isChainSlot(chain: ChainSchedule, slotStart: Date): boolean {
  const t = slotStart.getTime();
  if (!Number.isFinite(t)) return false;
  const length = chain.slotMinutes * MS_MIN;
  const fits = (span: Span) => t >= span.start.getTime() && t + length <= span.end.getTime() && (t - span.start.getTime()) % length === 0;
  if (chain.recurrence === 'once') return chainSpans(chain).some(fits);
  const pattern = patternOf(chain);
  if (!pattern) return false;
  try {
    const day = localDateIn(t, chain.timezone);
    return [0, 1].some((back) => {
      const on = shiftDay(day, -back);
      if (on < pattern.firstOn || on > pattern.lastOn) return false;
      return weeklyOccurrences(pattern, on, on).some(fits);
    });
  } catch {
    return false;
  }
}

/** La clé d'un créneau : l'instant de son début, en millisecondes. */
export const slotKey = (slot: Pick<Slot, 'start'>): number => slot.start.getTime();

export type SlotPhase = 'past' | 'live' | 'soon' | 'later';

/** Où en est un créneau : terminé, en cours, « bientôt » (10 minutes avant le début) ou plus tard. */
export function slotPhase(start: Date, end: Date, now: Date): SlotPhase {
  const t = now.getTime();
  if (t >= end.getTime()) return 'past';
  if (t >= start.getTime()) return 'live';
  return t >= start.getTime() - SOON_MIN * MS_MIN ? 'soon' : 'later';
}

/** Tous les créneaux chargés de la chaîne, dans l'ordre. */
export function allSlots(chain: Pick<AdorationChain, 'occurrences'>): Slot[] {
  return chain.occurrences.flatMap((occurrence) => occurrence.slots);
}

/** Le créneau en cours à `now` parmi les occurrences chargées, ou null. */
export function currentSlot(chain: Pick<AdorationChain, 'occurrences'>, now: Date): Slot | null {
  return allSlots(chain).find((slot) => slotPhase(slot.start, slot.end, now) === 'live') ?? null;
}

export type SlotState = 'past' | 'mine' | 'covered' | 'free';

/** L'état affiché d'un créneau : passé, à moi, couvert par d'autres, ou libre. */
export function slotState(slot: Slot, now: Date): SlotState {
  if (slotPhase(slot.start, slot.end, now) === 'past') return 'past';
  if (slot.mine) return 'mine';
  return slot.count > 0 ? 'covered' : 'free';
}

/** Mes créneaux de cette chaîne qui ne sont pas terminés, le plus proche d'abord (toutes occurrences, même hors fenêtre). */
export function myUpcomingSlots(chain: Pick<AdorationChain, 'mySlots' | 'slotMinutes'>, now: Date): Span[] {
  return chain.mySlots
    .map((start) => ({ start, end: new Date(start.getTime() + chain.slotMinutes * MS_MIN) }))
    .filter((span) => span.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Peut-on encore réserver ce créneau ? (non terminé, pas plein, pas déjà à moi, et moins de 12 créneaux non terminés à moi) */
export function canReserve(chain: AdorationChain, slot: Slot, now: Date): boolean {
  return (
    !chain.groupEnded &&
    !slot.mine &&
    slot.end.getTime() > now.getTime() &&
    slot.count < MAX_PER_SLOT &&
    myUpcomingSlots(chain, now).length < MAX_SLOTS_PER_PERSON
  );
}

/** La chaîne avec l'occurrence que le serveur vient de renvoyer à la place de l'ancienne, et mes créneaux à jour. */
export function withOccurrence(chain: AdorationChain, update: AdorationChain): AdorationChain {
  const incoming = update.occurrences[0];
  const occurrences = incoming
    ? chain.occurrences.map((o) => (o.start.getTime() === incoming.start.getTime() ? incoming : o))
    : chain.occurrences;
  return { ...chain, occurrences, mySlots: update.mySlots, reserved: update.reserved };
}

/** La chaîne avec la fenêtre suivante ajoutée à la fin (sans doublon, dans l'ordre). */
export function withWindow(chain: AdorationChain, next: AdorationChain): AdorationChain {
  const known = new Set(chain.occurrences.map((o) => o.start.getTime()));
  const occurrences = [...chain.occurrences, ...next.occurrences.filter((o) => !known.has(o.start.getTime()))].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  return { ...chain, occurrences, mySlots: next.mySlots, reserved: next.reserved, hasMore: next.hasMore, windowTo: next.windowTo };
}

/**
 * La première fenêtre relue (toutes les minutes, ou en tirant l'écran) fusionnée dans ce qui est déjà affiché : les occurrences
 * relues remplacent les mêmes, celles des fenêtres suivantes déjà chargées restent.
 */
export function withRefresh(chain: AdorationChain, fresh: AdorationChain): AdorationChain {
  const byStart = new Map(fresh.occurrences.map((o) => [o.start.getTime(), o]));
  const known = new Set(chain.occurrences.map((o) => o.start.getTime()));
  const occurrences = [
    ...chain.occurrences.map((o) => byStart.get(o.start.getTime()) ?? o),
    ...fresh.occurrences.filter((o) => !known.has(o.start.getTime())),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  const further = chain.windowTo !== null && fresh.windowTo !== null && chain.windowTo > fresh.windowTo;
  return { ...fresh, occurrences, hasMore: further ? chain.hasMore : fresh.hasMore, windowTo: further ? chain.windowTo : fresh.windowTo };
}

// ---------------------------------------------------------------------------------------------------------------
// Couverture et trous (par occurrence)
// ---------------------------------------------------------------------------------------------------------------

export type Coverage = { covered: number; total: number };

export function coverage(slots: Pick<Slot, 'count'>[]): Coverage {
  return { covered: slots.filter((slot) => slot.count > 0).length, total: slots.length };
}

/** « 18/24 créneaux couverts » (les cartes d'une chaîne ponctuelle, les libellés d'accessibilité) */
export const coverageShort = (c: Coverage) =>
  c.total > 1 ? `${c.covered}/${c.total} créneaux couverts` : `${c.covered}/${c.total} créneau couvert`;

/** « 3/4 couverts » (l'en-tête d'une journée ou d'une occurrence) */
export const coverageTag = (c: Coverage) => `${c.covered}/${c.total} ${c.total > 1 ? 'couverts' : 'couvert'}`;

/** « 18 créneaux sur 24 couverts » (le détail) */
export function coverageLong(c: Coverage): string {
  return c.covered > 1 ? `${c.covered} créneaux sur ${c.total} couverts` : `${c.covered} créneau sur ${c.total} couvert`;
}

/** Une plage de créneaux libres consécutifs (index inclus, dans la liste des créneaux d'une occurrence). */
export type Gap = { from: number; to: number };

/** Les trous : plages de créneaux sans adorateur, parmi ceux qui ne sont pas terminés (un trou passé ne se comble plus). */
export function gaps(slots: Slot[], now: Date): Gap[] {
  const found: Gap[] = [];
  let open: Gap | null = null;
  slots.forEach((slot, index) => {
    if (slot.count === 0 && slot.end.getTime() > now.getTime()) {
      if (open) open.to = index;
      else {
        open = { from: index, to: index };
        found.push(open);
      }
    } else {
      open = null;
    }
  });
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// Libellés (dans le fuseau du téléphone par défaut ; `zone` sert aux tests)
// ---------------------------------------------------------------------------------------------------------------

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);
const isoOf = (p: { year: number; month: number; day: number }) =>
  `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
const shortDay = (weekday: number) => `${WEEKDAYS[weekday].slice(0, 3)}.`;

/** « 3 h – 5 h » : l'heure de début et l'heure de fin, à l'heure de `zone`. */
export function rangeLabel(start: Date, end: Date, zone: string = deviceTimeZone()): string {
  try {
    const a = zonedParts(start.getTime(), zone);
    const b = zonedParts(end.getTime(), zone);
    return `${timeLabel(a.hour, a.minute)} – ${timeLabel(b.hour, b.minute)}`;
  } catch {
    return '';
  }
}

/** « jeudi 3 h – 4 h » : le jour où le créneau commence, puis la plage. */
export function slotLabel(start: Date, end: Date, zone: string = deviceTimeZone()): string {
  try {
    const a = zonedParts(start.getTime(), zone);
    return `${WEEKDAYS[a.weekday]} ${rangeLabel(start, end, zone)}`;
  } catch {
    return '';
  }
}

/** « Vendredi 24 octobre · 21 h – 22 h » : la date complète, puis la plage (une occurrence, ou un créneau d'une chaîne qui se répète). */
export function slotDateLabel(start: Date, end: Date, zone: string = deviceTimeZone()): string {
  try {
    return `${capitalize(dayLabel(localDateIn(start.getTime(), zone)))} · ${rangeLabel(start, end, zone)}`;
  } catch {
    return '';
  }
}

/** Une plage s'étend-elle sur plusieurs jours (du téléphone) ? Sert à écrire les trous avec ou sans jour. */
export function spansSeveralDays(start: Date, end: Date, zone: string = deviceTimeZone()): boolean {
  try {
    return localDateIn(start.getTime(), zone) !== localDateIn(end.getTime() - 1, zone);
  } catch {
    return false;
  }
}

/** « 3 h – 5 h » (ou « ven. 23 h – sam. 2 h » pour une occurrence sur plusieurs jours) */
export function gapLabel(slots: Slot[], gap: Gap, zone: string = deviceTimeZone()): string {
  const first = slots[gap.from];
  const last = slots[gap.to];
  if (!first || !last) return '';
  const whole = spansSeveralDays(slots[0].start, slots[slots.length - 1].end, zone);
  if (!whole) return rangeLabel(first.start, last.end, zone);
  try {
    const a = zonedParts(first.start.getTime(), zone);
    const b = zonedParts(last.end.getTime(), zone);
    const from = `${shortDay(a.weekday)} ${timeLabel(a.hour, a.minute)}`;
    const to = isoOf(a) === isoOf(b) ? timeLabel(b.hour, b.minute) : `${shortDay(b.weekday)} ${timeLabel(b.hour, b.minute)}`;
    return `${from} – ${to}`;
  } catch {
    return '';
  }
}

/** « Trous : 3 h – 5 h, 6 h – 7 h » ; null s'il n'y en a pas. */
export function gapsLabel(slots: Slot[], now: Date, zone: string = deviceTimeZone()): string | null {
  const list = gaps(slots, now);
  return list.length === 0 ? null : `Trous : ${list.map((gap) => gapLabel(slots, gap, zone)).join(', ')}`;
}

/** « Du jeudi 22 octobre à 21 h au vendredi 23 octobre à 7 h » ; « Le jeudi 22 octobre, de 14 h à 17 h » sur un seul jour. */
export function periodLabel(period: Pick<ChainSchedule, 'startsAt' | 'endsAt'>, zone: string = deviceTimeZone()): string {
  try {
    const start = zonedParts(Date.parse(period.startsAt), zone);
    const end = zonedParts(Date.parse(period.endsAt), zone);
    if (isoOf(start) === isoOf(end)) {
      return `Le ${dayLabel(isoOf(start))}, de ${timeLabel(start.hour, start.minute)} à ${timeLabel(end.hour, end.minute)}`;
    }
    return `Du ${dayLabel(isoOf(start))} à ${timeLabel(start.hour, start.minute)} au ${dayLabel(isoOf(end))} à ${timeLabel(end.hour, end.minute)}`;
  } catch {
    return '';
  }
}

/** L'occurrence de référence d'une chaîne pour écrire sa récurrence : la première chargée, sinon la première tout court. */
function referenceSpan(chain: ChainSchedule & { occurrences?: Occurrence[] }): Span | null {
  const loaded = chain.occurrences?.[0];
  return loaded ?? chainSpans(chain)[0] ?? null;
}

/**
 * « Chaque vendredi de 21 h à 22 h, jusqu’au 16 janvier » : la récurrence d'une chaîne hebdomadaire à l'heure de `zone`
 * (« Les mardis et jeudis de 21 h à 7 h, jusqu’au… » ; « Chaque jour de… » pour 7 jours). Vide pour une chaîne ponctuelle.
 */
export function recurrenceLabel(chain: ChainSchedule & { occurrences?: Occurrence[] }, zone: string = deviceTimeZone()): string {
  const pattern = patternOf(chain);
  const reference = referenceSpan(chain);
  if (!pattern || !reference) return '';
  try {
    const a = zonedParts(reference.start.getTime(), zone);
    const b = zonedParts(reference.end.getTime(), zone);
    const phrase = weekdaysPhrase(weekdaysInZone(chain.weekdays, reference.start, chain.timezone, zone));
    const base = `${phrase} de ${timeLabel(a.hour, a.minute)} à ${timeLabel(b.hour, b.minute)}`;
    const last = weeklyOccurrences(pattern, shiftDay(pattern.lastOn, -6), pattern.lastOn).pop();
    return last ? `${base}, ${untilLabel(last.start, zone)}` : base;
  } catch {
    return '';
  }
}

/** « 9 plages · créneaux de 30 min » (hebdomadaire) ou « 24 créneaux de 60 min » (ponctuelle) */
export function slotSummary(chain: Pick<AdorationChain, 'recurrence' | 'slotMinutes' | 'startsAt' | 'endsAt' | 'occurrenceCount'>): string {
  if (chain.recurrence === 'weekly') {
    return chain.occurrenceCount > 0
      ? `${chain.occurrenceCount} ${chain.occurrenceCount > 1 ? 'plages' : 'plage'} · créneaux de ${chain.slotMinutes} min`
      : '';
  }
  const n = slotCountOf({ start: new Date(chain.startsAt), end: new Date(chain.endsAt) }, chain.slotMinutes);
  return n > 0 ? `${n} créneaux de ${chain.slotMinutes} min` : '';
}

/**
 * Pour une chaîne créée sous une autre heure que celle du téléphone : l'heure de départ d'origine, « Début à 21 h, heure de
 * Paris ». Nul si l'heure du mur est la même chez les deux.
 */
export function originMention(chain: Pick<AdorationChain, 'startsAt' | 'timezone'>, zone: string = deviceTimeZone()): string | null {
  try {
    const ts = Date.parse(chain.startsAt);
    const origin = zonedParts(ts, chain.timezone);
    const here = zonedParts(ts, zone);
    if (isoOf(origin) === isoOf(here) && origin.hour === here.hour && origin.minute === here.minute) return null;
    const label = timeLabel(origin.hour, origin.minute);
    const city = zoneCity(chain.timezone);
    return city ? `Début à ${label}, heure de ${city}` : `Début à ${label} (${chain.timezone})`;
  } catch {
    return null;
  }
}

/** « Toi, @marie, Un membre » : qui adore sur ce créneau ; vide si personne. */
export function adorersLabel(slot: Pick<Slot, 'mine' | 'handles' | 'hidden'>): string {
  const names = [
    ...(slot.mine ? ['Toi'] : []),
    ...slot.handles.map((handle) => `@${handle}`),
    ...(slot.hidden > 0 ? [slot.hidden === 1 ? 'Un membre' : `${slot.hidden} membres`] : []),
  ];
  return names.join(', ');
}

/** « En ce moment : @marie, @paul » ; null si aucun créneau n'est en cours. */
export function nowLine(chain: Pick<AdorationChain, 'occurrences'>, now: Date): string | null {
  const slot = currentSlot(chain, now);
  if (!slot) return null;
  const names = adorersLabel(slot);
  return `En ce moment : ${names || 'personne'}`;
}

export type DayGroup = { date: string; label: string; slots: Slot[] };

/** Des créneaux regroupés par jour (du téléphone) : « Jeudi 22 octobre ». */
export function groupByDay(slots: Slot[], zone: string = deviceTimeZone()): DayGroup[] {
  const days: DayGroup[] = [];
  for (const slot of slots) {
    let date: string;
    try {
      date = localDateIn(slot.start.getTime(), zone);
    } catch {
      date = '1970-01-01';
    }
    const last = days[days.length - 1];
    if (last && last.date === date) last.slots.push(slot);
    else days.push({ date, label: capitalize(dayLabel(date)), slots: [slot] });
  }
  return days;
}

/**
 * Une section repliable de l'écran d'une chaîne : une journée d'une chaîne ponctuelle, une occurrence d'une chaîne
 * hebdomadaire. `title` : « Vendredi 24 octobre » ; `range` : « 21 h – 22 h ».
 */
export type Section = { key: string; title: string; range: string; start: Date; end: Date; slots: Slot[]; coverage: Coverage };

function sectionOf(key: string, title: string, slots: Slot[], zone: string): Section {
  const start = slots[0].start;
  const end = slots[slots.length - 1].end;
  return { key, title, range: rangeLabel(start, end, zone), start, end, slots, coverage: coverage(slots) };
}

/** Les sections de la chaîne : par jour pour une ponctuelle, par occurrence pour une hebdomadaire (celles qui ont des créneaux). */
export function chainSections(chain: Pick<AdorationChain, 'recurrence' | 'occurrences'>, zone: string = deviceTimeZone()): Section[] {
  const sections: Section[] = [];
  for (const occurrence of chain.occurrences) {
    if (occurrence.slots.length === 0) continue;
    if (chain.recurrence === 'weekly') {
      const date = localDateIn(occurrence.slots[0].start.getTime(), zone);
      sections.push(sectionOf(`occ-${occurrence.start.getTime()}`, capitalize(dayLabel(date)), occurrence.slots, zone));
    } else {
      for (const day of groupByDay(occurrence.slots, zone)) sections.push(sectionOf(`day-${day.date}`, day.label, day.slots, zone));
    }
  }
  return sections;
}

/** Où en est une section : terminée, en cours, ou à venir. */
export function sectionPhase(section: Pick<Section, 'start' | 'end'>, now: Date): 'past' | 'live' | 'upcoming' {
  if (section.end.getTime() <= now.getTime()) return 'past';
  return section.start.getTime() <= now.getTime() ? 'live' : 'upcoming';
}

/**
 * La section dépliée par défaut : celle en cours, sinon la prochaine. Les autres sont repliées, les passées aussi. Null si tout
 * est terminé.
 */
export function defaultOpenKey(sections: Pick<Section, 'key' | 'start' | 'end'>[], now: Date): string | null {
  return sections.find((section) => sectionPhase(section, now) !== 'past')?.key ?? null;
}

/** « 3 créneaux à toi » (la carte d'un groupe) */
export function myCountLabel(n: number): string {
  return n === 0 ? 'Aucun créneau à toi' : n === 1 ? '1 créneau à toi' : `${n} créneaux à toi`;
}

// ---------------------------------------------------------------------------------------------------------------
// Mon heure d'adoration (accueil, Communauté, écran de la chaîne)
// ---------------------------------------------------------------------------------------------------------------

/** « C'est ton heure d'adoration » pendant le créneau, « C'est bientôt ton heure d'adoration » dans les 10 minutes avant. */
export function myHourTitle(phase: SlotPhase): string | null {
  if (phase === 'live') return 'C’est ton heure d’adoration';
  if (phase === 'soon') return 'C’est bientôt ton heure d’adoration';
  return null;
}

/** Mon créneau en cours ou le prochain (le premier qui n'est pas terminé), avec sa phase. */
export function currentOrNext(
  slots: MyAdorationSlot[],
  now: Date,
): { slot: MyAdorationSlot; phase: Exclude<SlotPhase, 'past'>; start: Date; end: Date } | null {
  const upcoming = slots
    .map((slot) => ({ slot, start: new Date(slot.startsAt), end: new Date(slot.endsAt) }))
    .filter(({ end }) => end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const first = upcoming[0];
  if (!first) return null;
  const phase = slotPhase(first.start, first.end, now);
  return phase === 'past' ? null : { ...first, phase };
}

/**
 * La ligne de l'accueil et de la Communauté : « Ton heure d'adoration : jeudi 3 h – 4 h · Fraternité de test ». Au-delà d'une
 * semaine, le jour s'écrit en entier (« vendredi 6 novembre · 21 h – 22 h ») : une chaîne qui se répète a le même jour chaque
 * semaine.
 */
export function hourLine(slots: MyAdorationSlot[], now: Date, zone: string = deviceTimeZone()): string | null {
  const next = currentOrNext(slots, now);
  if (!next) return null;
  const far = next.start.getTime() - now.getTime() > 6 * MS_DAY;
  const when = far ? slotDateLabel(next.start, next.end, zone) : slotLabel(next.start, next.end, zone);
  const title = myHourTitle(next.phase) ?? `Ton heure d’adoration : ${when}`;
  return `${title} · ${next.slot.groupName}`;
}

/** Mes prochains créneaux à rappeler : ceux dont le rappel (10 minutes avant) est encore devant nous, les 3 plus proches. */
export function nextSlotsToRemind(slots: MyAdorationSlot[], now: Date, limit: number = MAX_REMINDED_SLOTS): MyAdorationSlot[] {
  return slots
    .filter((slot) => Date.parse(slot.startsAt) - SOON_MIN * MS_MIN > now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.chainId.localeCompare(b.chainId))
    .slice(0, limit);
}

/** L'instant du rappel d'un créneau : 10 minutes avant son début. */
export const reminderAt = (slot: Pick<MyAdorationSlot, 'startsAt'>): Date => new Date(Date.parse(slot.startsAt) - SOON_MIN * MS_MIN);

// ---------------------------------------------------------------------------------------------------------------
// Formulaire (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** L'instant `dayOffset` jours après aujourd'hui à `hour:minute`, à l'heure de ce téléphone (secondes à zéro). */
export function localInstant(dayOffset: number, hour: number, minute: number, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0);
}

/** Nombre de jours calendaires entre aujourd'hui et `date`, à l'heure de ce téléphone. */
export function dayOffsetOf(date: Date, now: Date = new Date()): number {
  return daysSince(localDate(now), localDate(date));
}

export function chainIntentionProblem(value: string): string | null {
  return value.trim().length > CHAIN_INTENTION_MAX ? `L’intention fait ${CHAIN_INTENTION_MAX} caractères au plus.` : null;
}

export function placeProblem(value: string): string | null {
  return value.trim().length > PLACE_MAX ? `Le lieu fait ${PLACE_MAX} caractères au plus.` : null;
}

export const chainTitleProblem = titleProblem;

/**
 * Pourquoi cette période est refusée pour une chaîne PONCTUELLE, en français, ou null. `keepStart` : la chaîne a déjà commencé (ou
 * son début ne change pas) : on ne vérifie pas que le début est à venir. `groupEndsAt` : un groupe éphémère.
 */
export function periodProblem({
  start,
  end,
  slotMinutes,
  now = new Date(),
  groupEndsAt = null,
  keepStart = false,
}: {
  start: Date | null;
  end: Date | null;
  slotMinutes: number;
  now?: Date;
  groupEndsAt?: string | null;
  keepStart?: boolean;
}): string | null {
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Choisis un début et une fin.';
  if (!keepStart) {
    if (start.getTime() <= now.getTime()) return 'Choisis un début à venir.';
    if (start.getTime() > now.getTime() + START_MAX_DAYS * MS_DAY) return `Le début est dans les ${START_MAX_DAYS} prochains jours.`;
  }
  const minutes = (end.getTime() - start.getTime()) / MS_MIN;
  if (minutes < MIN_CHAIN_MINUTES || minutes > MAX_CHAIN_MINUTES) return 'Une chaîne dure de 1 h à 7 jours.';
  if (!Number.isInteger(minutes / slotMinutes)) return `La fin doit tomber sur un créneau entier de ${slotMinutes} min.`;
  if (end.getTime() <= now.getTime()) return 'La fin doit être à venir.';
  if (groupEndsAt) {
    const ends = Date.parse(groupEndsAt);
    if (Number.isFinite(ends) && end.getTime() > ends) return 'Ce groupe se termine avant la fin de la chaîne.';
  }
  return null;
}

/**
 * Pourquoi ce rythme est refusé pour une chaîne HEBDOMADAIRE, en français, ou null : au moins un jour, une plage de 30 min à
 * 24 h en créneaux entiers, du premier au dernier jour un an au plus, au moins une plage et 400 au plus, la première à venir
 * (sauf `keepStart` : la chaîne a commencé ou son début ne change pas) dans les 60 jours, la dernière avant la fin d'un groupe
 * éphémère.
 */
export function weeklyProblem({
  pattern,
  slotMinutes,
  now = new Date(),
  groupEndsAt = null,
  keepStart = false,
}: {
  pattern: WeeklyPattern;
  slotMinutes: number;
  now?: Date;
  groupEndsAt?: string | null;
  keepStart?: boolean;
}): string | null {
  if (!weekdaysValid(pattern.weekdays)) return 'Choisis au moins un jour de la semaine.';
  const minutes = occurrenceMinutes(pattern.localStart, pattern.localEnd);
  if (minutes === null) return 'Choisis une heure de début et une heure de fin.';
  if (minutes < MIN_OCCURRENCE_MINUTES || minutes > MAX_OCCURRENCE_MINUTES || minutes % slotMinutes !== 0) {
    return `Une plage d’adoration dure de 30 min à 24 h, en créneaux entiers de ${slotMinutes} min.`;
  }
  if (!ISO_DAY.test(pattern.firstOn) || !ISO_DAY.test(pattern.lastOn)) return 'Choisis un premier et un dernier jour.';
  const span = daysSince(pattern.firstOn, pattern.lastOn);
  if (span < 0) return 'Le dernier jour est avant le premier.';
  if (span > SPAN_MAX_DAYS) return 'Une chaîne dure un an au plus.';
  const occurrences = weeklyOccurrences(pattern);
  if (occurrences.length === 0) return 'Aucune plage ne tombe entre ces deux jours.';
  if (occurrences.length > OCCURRENCES_MAX) return `Une chaîne a ${OCCURRENCES_MAX} plages au plus.`;
  const first = occurrences[0];
  if (!keepStart) {
    if (first.start.getTime() <= now.getTime()) return 'Choisis un début à venir.';
    if (first.start.getTime() > now.getTime() + START_MAX_DAYS * MS_DAY) return `Le début est dans les ${START_MAX_DAYS} prochains jours.`;
  }
  if (groupEndsAt) {
    const ends = Date.parse(groupEndsAt);
    if (Number.isFinite(ends) && occurrences[occurrences.length - 1].end.getTime() > ends)
      return 'Ce groupe se termine avant la fin de la chaîne.';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Lecteurs de lignes (défensifs : une ligne inattendue est ignorée, jamais une erreur)
// ---------------------------------------------------------------------------------------------------------------

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const nat = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
const isoDate = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);
const day = (value: unknown): string | null => (typeof value === 'string' && ISO_DAY.test(value.slice(0, 10)) ? value.slice(0, 10) : null);
const hhmm = (value: unknown): string | null => {
  const time = parseLocalTime(value);
  return time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : null;
};

export function readSlotMinutes(value: unknown): SlotMinutes | null {
  const n = nat(value);
  return n === 30 || n === 60 ? n : null;
}

function readSlot(value: unknown, slotMinutes: number): Slot | null {
  const record = asRecord(value);
  const startsAt = record ? isoDate(record.start) : null;
  if (!record || !startsAt) return null;
  const start = new Date(startsAt);
  return {
    start,
    end: new Date(start.getTime() + slotMinutes * MS_MIN),
    count: nat(record.count) ?? 0,
    mine: record.mine === true,
    handles: Array.isArray(record.handles) ? record.handles.filter((h): h is string => typeof h === 'string' && h.length > 0) : [],
    hidden: nat(record.hidden) ?? 0,
  };
}

function readOccurrence(value: unknown, slotMinutes: number): Occurrence | null {
  const record = asRecord(value);
  const start = record ? isoDate(record.start) : null;
  const end = record ? isoDate(record.end) : null;
  if (!record || !start || !end || Date.parse(end) <= Date.parse(start)) return null;
  const slots = Array.isArray(record.slots) ? record.slots.flatMap((s) => readSlot(s, slotMinutes) ?? []) : [];
  return { start: new Date(start), end: new Date(end), slots };
}

export function readChain(row: unknown): AdorationChain | null {
  const record = asRecord(row);
  if (!record) return null;
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const title = str(record.title);
  const startsAt = isoDate(record.starts_at);
  const endsAt = isoDate(record.ends_at);
  const slotMinutes = readSlotMinutes(record.slot_minutes);
  const timezone = str(record.timezone);
  const recurrence: ChainRecurrence | null =
    record.recurrence === 'weekly' ? 'weekly' : record.recurrence === 'once' || record.recurrence === undefined ? 'once' : null;
  if (!id || !groupId || !groupName || !title || !startsAt || !endsAt || !slotMinutes || !timezone || !recurrence || !isTimeZone(timezone))
    return null;
  let weekdays: number[] = [];
  let localStart: string | null = null;
  let localEnd: string | null = null;
  let firstOn: string | null = null;
  let lastOn: string | null = null;
  if (recurrence === 'weekly') {
    const days = Array.isArray(record.weekdays) ? record.weekdays.map(nat) : [];
    weekdays = [...new Set(days.filter((d): d is number => d !== null && d <= 6))].sort((a, b) => a - b);
    localStart = hhmm(record.local_start);
    localEnd = hhmm(record.local_end);
    firstOn = day(record.first_on);
    lastOn = day(record.last_on);
    if (!weekdaysValid(weekdays) || !localStart || !localEnd || !firstOn || !lastOn) return null;
  } else if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    return null;
  }
  const occurrences = Array.isArray(record.occurrences) ? record.occurrences.flatMap((o) => readOccurrence(o, slotMinutes) ?? []) : [];
  const mySlots = Array.isArray(record.my_slots)
    ? record.my_slots.flatMap((v) => (isoDate(v) ? [new Date(v as string)] : [])).sort((a, b) => a.getTime() - b.getTime())
    : [];
  return {
    recurrence,
    slotMinutes,
    timezone,
    startsAt,
    endsAt,
    weekdays,
    localStart,
    localEnd,
    firstOn,
    lastOn,
    id,
    groupId,
    groupName,
    groupEnded: record.group_ended === true,
    canManage: record.can_manage === true,
    title,
    intention: typeof record.intention === 'string' ? record.intention : '',
    place: typeof record.place === 'string' ? record.place : '',
    occurrenceCount: nat(record.occurrence_count) ?? occurrences.length,
    mySlots,
    reserved: record.reserved === true,
    hasMore: record.has_more === true,
    windowTo: day(record.window_to),
    occurrences,
  };
}

export function readMySlot(row: unknown): MyAdorationSlot | null {
  const record = asRecord(row);
  if (!record) return null;
  const chainId = str(record.chain_id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const title = str(record.title);
  const timezone = str(record.timezone);
  const slotMinutes = readSlotMinutes(record.slot_minutes);
  const startsAt = isoDate(record.starts_at);
  const endsAt = isoDate(record.ends_at);
  if (!chainId || !groupId || !groupName || !title || !timezone || !slotMinutes || !startsAt || !endsAt) return null;
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return null;
  return {
    chainId,
    groupId,
    groupName,
    title,
    place: typeof record.place === 'string' ? record.place : '',
    timezone,
    slotMinutes,
    startsAt,
    endsAt,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };

// Les écrans qui changent mes réservations ou une chaîne préviennent AdorationSync (src/app/_layout.tsx), qui reprogramme les
// rappels du téléphone.
const listeners = new Set<() => void>();

/** Mes créneaux ont peut-être changé : à resynchroniser. */
export function adorationChanged() {
  for (const listener of listeners) listener();
}

export function onAdorationChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function changed(result: Result): Promise<Result> {
  if (result.ok) adorationChanged();
  return result;
}

type ChainTexts = { title: string; intention: string; place: string; slotMinutes: SlotMinutes };

/** Ce que contient une chaîne à créer ou à modifier. */
export type ChainInput =
  | (ChainTexts & { recurrence: 'once'; startsAt: Date; endsAt: Date })
  | (ChainTexts & { recurrence: 'weekly'; weekdays: number[]; localStart: string; localEnd: string; firstOn: string; lastOn: string });

function fields(input: ChainInput) {
  const base = {
    p_title: input.title.trim(),
    p_intention: input.intention.trim(),
    p_place: input.place.trim(),
    p_slot_minutes: input.slotMinutes,
    p_recurrence: input.recurrence,
    // Le fuseau du téléphone de celui qui enregistre : les heures saisies sont celles de son mur.
    p_timezone: deviceTimeZone(),
  };
  if (input.recurrence === 'once') {
    return {
      ...base,
      p_starts_at: input.startsAt.toISOString(),
      p_ends_at: input.endsAt.toISOString(),
      p_weekdays: null,
      p_local_start: null,
      p_local_end: null,
      p_first_on: null,
      p_last_on: null,
    };
  }
  return {
    ...base,
    p_starts_at: null,
    p_ends_at: null,
    p_weekdays: [...input.weekdays].sort((a, b) => a - b),
    p_local_start: input.localStart,
    p_local_end: input.localEnd,
    p_first_on: input.firstOn,
    p_last_on: input.lastOn,
  };
}

/** Organise une chaîne : en cas de succès, `data` est son identifiant. */
export function createChain(groupId: string, input: ChainInput) {
  return call('create_adoration_chain', { p_group: groupId, ...fields(input) }).then(changed);
}

export function updateChain(id: string, input: ChainInput) {
  return call('update_adoration_chain', { p_id: id, ...fields(input) }).then(changed);
}

export function cancelChain(id: string) {
  return call('cancel_adoration_chain', { p_id: id }).then(changed);
}

/** Les chaînes d'un groupe : à venir, en cours, ou terminées depuis moins de 2 jours (l'occurrence en cours ou la prochaine, sans les pseudos). */
export async function listChains(groupId: string): Promise<{ ok: true; chains: AdorationChain[] } | Failure> {
  const result = await call('list_adoration_chains', { p_group: groupId });
  if (!result.ok) return result;
  return { ok: true, chains: readRows(result.data, readChain) };
}

/**
 * Le détail d'une chaîne. Hebdomadaire : une fenêtre de `weeks` semaines qui commence le jour `from` (AAAA-MM-JJ, dans le
 * fuseau de la chaîne ; par défaut aujourd'hui). `chain: null` : la chaîne n'existe plus (ou la réponse est illisible).
 */
export async function getChain(
  id: string,
  options: { from?: string | null; weeks?: number } = {},
): Promise<{ ok: true; chain: AdorationChain | null } | Failure> {
  const result = await call('get_adoration_chain', { p_id: id, p_from: options.from ?? null, p_weeks: options.weeks ?? WINDOW_WEEKS });
  if (!result.ok) return result;
  return { ok: true, chain: readChain(result.data) };
}

/** Mes prochains créneaux, en cours ou à venir, dans les groupes où je suis encore membre. */
export async function myAdorationSlots(): Promise<{ ok: true; slots: MyAdorationSlot[] } | Failure> {
  const result = await call('my_adoration_slots');
  if (!result.ok) return result;
  return { ok: true, slots: readRows(result.data, readMySlot) };
}

/** La chaîne renvoyée par une action : seule l'occurrence du créneau touché y figure (à remplacer avec `withOccurrence`). */
type ChainResult = { ok: true; chain: AdorationChain | null } | Failure;

async function chainChanged(result: Result): Promise<ChainResult> {
  if (!result.ok) return result;
  adorationChanged();
  return { ok: true, chain: readChain(result.data) };
}

/** Réserver un créneau (identifié par l'instant de son début). */
export function reserveSlot(chainId: string, slotStart: Date): Promise<ChainResult> {
  return call('reserve_slot', { p_chain: chainId, p_slot_start: slotStart.toISOString() }).then(chainChanged);
}

/** Libérer mon créneau. */
export function releaseSlot(chainId: string, slotStart: Date): Promise<ChainResult> {
  return call('release_slot', { p_chain: chainId, p_slot_start: slotStart.toISOString() }).then(chainChanged);
}

/** Modération (propriétaire ou modérateur) : retirer la réservation de @handle sur ce créneau. */
export function removeReservation(chainId: string, slotStart: Date, handle: string): Promise<ChainResult> {
  return call('remove_slot_reservation', { p_chain: chainId, p_slot_start: slotStart.toISOString(), p_handle: handle }).then(chainChanged);
}
