import { dayLabel, MONTHS, shiftDay, WEEKDAYS } from './dates';
import { DESCRIPTION_MAX } from './groups';
import { asRecord, call, type Result, readRows } from './profile';

// Rendez-vous de prière de groupe (supabase/migrations/009_group_gatherings.sql). Rien n'est gardé sur le téléphone,
// sauf les rappels que programme src/gathering-reminders.ts pour les rendez-vous auxquels on s'est inscrit.
//
// Jour de la semaine : 0 à 6, DIMANCHE = 0 (comme getDay(), WEEKDAYS de src/dates.ts et extract(dow) côté serveur).
// Un hebdomadaire a un ou plusieurs jours (`weekdays`, 1 à 7 valeurs distinctes) et une fin facultative (`endsOn`, dernier jour
// local, dans son fuseau : aucune occurrence n'a lieu après ce jour).
// Fuseaux : le serveur calcule avec `at time zone` ; ici, `nextOccurrences` fait le même calcul avec Intl
// (Intl.DateTimeFormat + timeZone + formatToParts), sans dépendance. Intl avec fuseau IANA existe dans Node (Jest) et
// dans Hermes sur iOS et Android (ICU) ; si un moteur ne le supportait pas, tout échoue en douceur : aucune occurrence,
// donc aucun rappel, jamais une erreur.

export type Recurrence = 'weekly' | 'once';

/** La prière que propose un rendez-vous : libre, ou l'un des écrans guidés de l'app (chacun à son rythme). */
export type PrayerKind = 'libre' | 'chapelet' | 'office' | 'adoration';
export const PRAYER_KINDS: PrayerKind[] = ['libre', 'chapelet', 'office', 'adoration'];
const PRAYER_LABELS: Record<PrayerKind, string> = {
  libre: 'Prière libre',
  chapelet: 'Chapelet',
  office: 'Office',
  adoration: 'Adoration',
};

export function prayerKindLabel(kind: PrayerKind): string {
  return PRAYER_LABELS[kind];
}

/** Une valeur inconnue (ou absente, serveur plus ancien) vaut « libre ». */
export function readPrayerKind(value: unknown): PrayerKind {
  return PRAYER_KINDS.find((kind) => kind === value) ?? 'libre';
}

export const TITLE_MIN = 3;
export const TITLE_MAX = 60;
export const GATHERING_DESCRIPTION_MAX = DESCRIPTION_MAX;
export const DURATION_MIN = 10;
export const DURATION_MAX = 180;
export const DEFAULT_DURATION = 30;
export const DURATION_CHOICES = [15, 30, 45, 60, 90];
export const MAX_ACTIVE_GATHERINGS = 10;
/** Un rendez-vous ponctuel se choisit dans les 60 prochains jours (le serveur accepte jusqu'à un an). */
export const ONCE_MAX_DAYS = 60;
/** « Je suis là » s'ouvre 10 minutes avant le début. */
export const PRESENCE_LEAD_MIN = 10;

/** Ce qui décide des occurrences d'un rendez-vous. */
export type Schedule = {
  recurrence: Recurrence;
  /** Hebdomadaire : les jours, 0 (dimanche) à 6 (samedi), triés, sans doublon ; vide pour un ponctuel. */
  weekdays: number[];
  /** Hebdomadaire : « HH:MM » dans le fuseau du créateur. */
  localTime: string | null;
  /** Hebdomadaire : fuseau IANA du créateur, par exemple Europe/Paris. */
  timezone: string | null;
  /** Ponctuel : l'instant (ISO). */
  startsAt: string | null;
  /** Hebdomadaire : dernier jour (AAAA-MM-JJ, dans le fuseau du rendez-vous), ou nul s'il n'a pas de fin. */
  endsOn: string | null;
  durationMin: number;
};

export type Gathering = Schedule & {
  id: string;
  title: string;
  description: string;
  /** Début de la prochaine occurrence (nul pour un ponctuel déjà commencé). */
  nextStart: string | null;
  /** Début de l'occurrence en cours, de 10 minutes avant à la fin de la durée ; sinon nul. */
  currentStart: string | null;
  participantCount: number;
  participating: boolean;
  /** Présents à l'occurrence en cours (0 hors fenêtre). */
  presentCount: number;
  present: boolean;
  prayerKind: PrayerKind;
};

/**
 * Un rendez-vous auquel je suis inscrit : de quoi programmer les rappels. `present` : déclaré présent à l'occurrence en cours
 * au moment de la lecture (la salle de prière s'ouvre alors d'un toucher).
 */
export type MyGathering = Schedule & { id: string; groupId: string; groupName: string; title: string; present: boolean };

// ---------------------------------------------------------------------------------------------------------------
// Fuseaux (fonctions pures, Intl)
// ---------------------------------------------------------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let found = formatters.get(zone);
  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, found);
  }
  return found;
}

/** Le fuseau du téléphone (UTC si le moteur ne le dit pas). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Ce fuseau IANA est-il connu du moteur ? */
export function isTimeZone(zone: string): boolean {
  try {
    formatter(zone);
    return true;
  } catch {
    return false;
  }
}

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

/** L'heure du mur dans `zone` à l'instant `ts` (ms). weekday : 0 = dimanche. */
export function zonedParts(ts: number, zone: string): ZonedParts {
  const parts = formatter(zone).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return {
    year,
    month,
    day,
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Décalage de `zone` par rapport à UTC à l'instant `ts`, en ms. */
function offsetMs(ts: number, zone: string): number {
  const p = zonedParts(ts, zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

/**
 * L'instant où il est `hour:minute` le `year-month-day` dans `zone`. Deux passes suffisent à corriger le décalage
 * quand il change entre le premier essai et le résultat. Une heure qui n'existe pas (passage à l'heure d'été) est
 * décalée vers l'avant, comme `at time zone` de Postgres (02:30 devient 03:30) ; une heure qui existe deux fois (retour
 * à l'heure d'hiver) prend la seconde, à l'heure d'hiver.
 */
export function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, zone: string): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetMs(wall, zone);
  return wall - offsetMs(first, zone);
}

/** « HH:MM » en heure et minute, ou null. */
export function parseLocalTime(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Les jours d'un hebdomadaire, ou rien s'ils sont invalides. */
function validWeekdays(days: number[]): boolean {
  return (
    days.length >= 1 && days.length <= 7 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(days).size === days.length
  );
}

const isoOfUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Les `n` prochaines occurrences (début), strictement après `from`, en ordre. Un hebdomadaire tient compte du fuseau de
 * son créateur, de ses jours, de sa fin éventuelle (`endsOn`, incluse) et des changements d'heure ; un ponctuel passé n'en a
 * aucune. Même calcul que le serveur (weekly_next_start). Renvoie [] au lieu d'échouer si le fuseau est inconnu du moteur.
 */
export function nextOccurrences(rdv: Schedule, from: Date, n: number): Date[] {
  if (n <= 0 || Number.isNaN(from.getTime())) return [];
  try {
    if (rdv.recurrence === 'once') {
      const start = rdv.startsAt ? Date.parse(rdv.startsAt) : Number.NaN;
      return Number.isFinite(start) && start > from.getTime() ? [new Date(start)] : [];
    }
    const time = parseLocalTime(rdv.localTime);
    if (!time || !rdv.timezone || !validWeekdays(rdv.weekdays)) return [];
    const zone = rdv.timezone;
    const first = zonedParts(from.getTime(), zone);
    const found: Date[] = [];
    let day = Date.UTC(first.year, first.month - 1, first.day);
    // Au plus une semaine par occurrence demandée (un seul jour), plus la marge d'un jour de départ.
    for (let k = 0; k < 7 * n + 14 && found.length < n; k++, day += 86_400_000) {
      if (rdv.endsOn && isoOfUtc(day) > rdv.endsOn) break;
      const date = new Date(day);
      if (!rdv.weekdays.includes(date.getUTCDay())) continue;
      const ts = zonedInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), time.hour, time.minute, zone);
      if (ts > from.getTime()) found.push(new Date(ts));
    }
    return found;
  } catch {
    return [];
  }
}

/** Le début de la dernière occurrence d'un hebdomadaire qui a une fin (le dernier jour de la semaine voulu <= endsOn), ou null. */
export function lastOccurrence(rdv: Schedule): Date | null {
  if (rdv.recurrence !== 'weekly' || !rdv.endsOn || !rdv.timezone) return null;
  const time = parseLocalTime(rdv.localTime);
  if (!time || !validWeekdays(rdv.weekdays) || !/^\d{4}-\d{2}-\d{2}$/.test(rdv.endsOn)) return null;
  try {
    const [y, m, d] = rdv.endsOn.split('-').map(Number);
    for (let k = 0; k < 7; k++) {
      const date = new Date(Date.UTC(y, m - 1, d - k));
      if (rdv.weekdays.includes(date.getUTCDay())) {
        return new Date(
          zonedInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), time.hour, time.minute, rdv.timezone),
        );
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** La fenêtre de « Je suis là » d'une occurrence : de 10 minutes avant le début jusqu'à la fin de la durée. */
export function presenceWindow(start: Date, durationMin: number): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(start.getTime() - PRESENCE_LEAD_MIN * 60_000),
    closesAt: new Date(start.getTime() + durationMin * 60_000),
  };
}

export function inPresenceWindow(start: Date, durationMin: number, now: Date): boolean {
  const { opensAt, closesAt } = presenceWindow(start, durationMin);
  return now.getTime() >= opensAt.getTime() && now.getTime() < closesAt.getTime();
}

// ---------------------------------------------------------------------------------------------------------------
// Mises à jour optimistes de la liste d'un groupe (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

const replaceOne = (list: Gathering[], id: string, change: (item: Gathering) => Gathering) =>
  list.map((item) => (item.id === id ? change(item) : item));

/** « Je participe » (on) ou « Je ne participe plus » (off) sur un seul rendez-vous ; sans effet si c'est déjà l'état. */
export function withParticipation(list: Gathering[], id: string, on: boolean): Gathering[] {
  return replaceOne(list, id, (item) =>
    item.participating === on ? item : { ...item, participating: on, participantCount: Math.max(0, item.participantCount + (on ? 1 : -1)) },
  );
}

/** « Je suis là » sur un seul rendez-vous ; sans effet hors de la fenêtre ou si l'on est déjà présent. */
export function withPresence(list: Gathering[], id: string): Gathering[] {
  return replaceOne(list, id, (item) =>
    item.present || !item.currentStart ? item : { ...item, present: true, presentCount: item.presentCount + 1 },
  );
}

/** Remet un rendez-vous dans l'état d'avant (l'appel a échoué) sans toucher aux autres. */
export function restoreGathering(list: Gathering[], previous: Gathering): Gathering[] {
  return replaceOne(list, previous.id, () => previous);
}

/**
 * Réconcilie la liste locale avec celle du serveur : l'ordre et le contenu viennent du serveur, sauf pour les rendez-vous
 * dont une action est encore en vol, qui gardent leur état local pour ne pas clignoter.
 */
export function mergeServer(local: Gathering[], server: Gathering[], inflight: ReadonlySet<string>): Gathering[] {
  if (inflight.size === 0) return server;
  const mine = new Map(local.map((item) => [item.id, item]));
  return server.map((item) => (inflight.has(item.id) ? (mine.get(item.id) ?? item) : item));
}

// ---------------------------------------------------------------------------------------------------------------
// Prochains rendez-vous (accueil, Communauté)
// ---------------------------------------------------------------------------------------------------------------

export type Upcoming = { gathering: MyGathering; at: Date; current: boolean };

/**
 * Le début de l'occurrence EN COURS à `now` (de 10 minutes avant le début jusqu'à la fin de la durée, comme « Je suis
 * là » et le serveur), ou null.
 */
export function currentOccurrence(rdv: Schedule, now: Date): Date | null {
  const from = new Date(now.getTime() - rdv.durationMin * 60_000);
  return nextOccurrences(rdv, from, 2).find((start) => inPresenceWindow(start, rdv.durationMin, now)) ?? null;
}

/** Les `limit` rendez-vous les plus proches : ceux en cours d'abord, puis par date de début. */
export function upcomingGatherings(list: MyGathering[], now: Date, limit = 3): Upcoming[] {
  return list
    .flatMap((gathering): Upcoming[] => {
      const live = currentOccurrence(gathering, now);
      if (live) return [{ gathering, at: live, current: true }];
      const next = nextOccurrences(gathering, now, 1)[0];
      return next ? [{ gathering, at: next, current: false }] : [];
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || a.at.getTime() - b.at.getTime())
    .slice(0, limit);
}

// ---------------------------------------------------------------------------------------------------------------
// Libellés (dans le fuseau du téléphone par défaut ; `zone` sert aux tests)
// ---------------------------------------------------------------------------------------------------------------

/** « 21 h », « 20 h 30 », « 9 h 05 » */
export function timeLabel(hour: number, minute: number): string {
  return minute === 0 ? `${hour} h` : `${hour} h ${String(minute).padStart(2, '0')}`;
}

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** « Mardi 21 octobre à 20 h 30 » : le jour et l'heure d'une occurrence, à l'heure de `zone`. */
export function occurrenceLabel(start: Date, zone: string = deviceTimeZone()): string {
  try {
    const p = zonedParts(start.getTime(), zone);
    const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    return `${capitalize(dayLabel(iso))} à ${timeLabel(p.hour, p.minute)}`;
  } catch {
    return '';
  }
}

/** Les jours de la semaine dans l'ordre d'un calendrier français : lundi d'abord, dimanche en dernier. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * « Chaque jour » (7 jours), « Chaque vendredi » (1 jour) ou « Les mardis, jeudis et samedis » : les jours d'un hebdomadaire,
 * dans l'ordre de la semaine (lundi d'abord).
 */
export function weekdaysPhrase(days: number[]): string {
  const sorted = WEEK_ORDER.filter((d) => days.includes(d));
  if (sorted.length === 0) return '';
  if (sorted.length === 7) return 'Chaque jour';
  if (sorted.length === 1) return `Chaque ${WEEKDAYS[sorted[0]]}`;
  const names = sorted.map((d) => `${WEEKDAYS[d]}s`);
  return `Les ${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/**
 * Les jours d'un hebdomadaire vus depuis `zone` : ceux du fuseau d'origine, décalés d'autant que le jour de l'occurrence
 * `reference` change d'un fuseau à l'autre (un jeudi 19 h à Toronto est un vendredi 1 h à Paris).
 */
export function weekdaysInZone(days: number[], reference: Date, originZone: string, zone: string): number[] {
  try {
    const delta = (zonedParts(reference.getTime(), zone).weekday - zonedParts(reference.getTime(), originZone).weekday + 7) % 7;
    return days.map((d) => (d + delta) % 7);
  } catch {
    return days;
  }
}

/** « 30 novembre », « 1er décembre » : un jour sans l'année. */
export function dayMonthLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
}

/** « jusqu’au 30 novembre » : le jour de la dernière occurrence (à l'heure de `zone`). */
export function untilLabel(last: Date, zone: string = deviceTimeZone()): string {
  const p = zonedParts(last.getTime(), zone);
  return `jusqu’au ${dayMonthLabel(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`)}`;
}

/**
 * La récurrence d'un hebdomadaire à l'heure de `zone`, d'après son occurrence `reference` (la prochaine) :
 * « Les mardis, jeudis et samedis de 10 h à 10 h 15 », « Chaque jour de 10 h à 10 h 15 », puis « , jusqu’au 30 novembre »
 * s'il a une fin.
 */
export function recurrenceText(
  rdv: Pick<Schedule, 'weekdays' | 'timezone' | 'localTime' | 'durationMin' | 'endsOn' | 'recurrence'>,
  reference: Date,
  zone: string = deviceTimeZone(),
): string {
  if (rdv.recurrence !== 'weekly' || !rdv.timezone) return '';
  try {
    const p = zonedParts(reference.getTime(), zone);
    const phrase = weekdaysPhrase(weekdaysInZone(rdv.weekdays, reference, rdv.timezone, zone));
    const base = `${phrase} de ${timeLabel(p.hour, p.minute)} à ${endTimeLabel(reference, rdv.durationMin, zone)}`;
    const last = lastOccurrence(rdv as Schedule);
    return last ? `${base}, ${untilLabel(last, zone)}` : base;
  } catch {
    return '';
  }
}

/**
 * « Les mardis, jeudis et samedis de 10 h à 10 h 15, jusqu’au 30 novembre » (hebdomadaire) ou « Mardi 21 octobre à 20 h 30 »
 * (ponctuel), à l'heure de `zone`.
 */
export function whenLabel(rdv: Schedule, from: Date = new Date(), zone: string = deviceTimeZone()): string {
  try {
    if (rdv.recurrence === 'once') {
      const start = rdv.startsAt ? Date.parse(rdv.startsAt) : Number.NaN;
      return Number.isFinite(start) ? occurrenceLabel(new Date(start), zone) : '';
    }
    const next = nextOccurrences(rdv, from, 1)[0];
    return next ? recurrenceText(rdv, next, zone) : '';
  } catch {
    return '';
  }
}

/** La ville d'un fuseau IANA : « Europe/Paris » donne « Paris » ; null s'il n'a pas de ville (« UTC »). */
export function zoneCity(zone: string): string | null {
  if (!zone.includes('/')) return null;
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

/**
 * Pour un hebdomadaire créé sous une autre heure que celle du téléphone : l'heure d'origine, « 21 h, heure de Paris ».
 * Nul si l'heure est la même chez les deux (deux fuseaux de même décalage ne méritent pas de mention).
 */
export function zoneMention(rdv: Schedule, from: Date = new Date(), zone: string = deviceTimeZone()): string | null {
  if (rdv.recurrence !== 'weekly' || !rdv.timezone) return null;
  const time = parseLocalTime(rdv.localTime);
  const next = nextOccurrences(rdv, from, 1)[0];
  if (!time || !next) return null;
  try {
    if (offsetMs(next.getTime(), rdv.timezone) === offsetMs(next.getTime(), zone)) return null;
  } catch {
    return null;
  }
  const label = timeLabel(time.hour, time.minute);
  const city = zoneCity(rdv.timezone);
  return city ? `${label}, heure de ${city}` : `${label} (${rdv.timezone})`;
}

/** « 15 min », « 1 h », « 1 h 30 » */
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const rest = min % 60;
  return rest === 0 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / 60)} h ${String(rest).padStart(2, '0')}`;
}

/** L'heure de fin d'une occurrence qui commence à `start`, dans `zone` : « 21 h 30 ». */
export function endTimeLabel(start: Date, durationMin: number, zone: string = deviceTimeZone()): string {
  try {
    const p = zonedParts(start.getTime() + durationMin * 60_000, zone);
    return timeLabel(p.hour, p.minute);
  } catch {
    return '';
  }
}

export const participantsLabel = (n: number) => (n > 1 ? `${n} inscrits` : `${n} inscrit`);
export const presentLabel = (n: number) => (n > 1 ? `${n} présents` : `${n} présent`);

/** Pourquoi ce titre est refusé, en français, ou null s'il convient. */
export function titleProblem(value: string): string | null {
  const title = value.trim();
  if (title.length < TITLE_MIN) return `Le titre fait au moins ${TITLE_MIN} caractères.`;
  if (title.length > TITLE_MAX) return `Le titre fait ${TITLE_MAX} caractères au plus.`;
  return null;
}

export function gatheringDescriptionProblem(value: string): string | null {
  return value.trim().length > GATHERING_DESCRIPTION_MAX ? `La description fait ${GATHERING_DESCRIPTION_MAX} caractères au plus.` : null;
}

/** Pourquoi ce moment est refusé pour un rendez-vous ponctuel (futur, dans les 60 prochains jours), ou null. */
export function onceProblem(at: Date | null, now: Date = new Date()): string | null {
  if (!at || Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return 'Choisis un moment à venir.';
  if (at.getTime() > now.getTime() + ONCE_MAX_DAYS * 86_400_000) return `Choisis un moment dans les ${ONCE_MAX_DAYS} prochains jours.`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// « Pendant » : la fin d'un hebdomadaire (fonctions pures, calendrier UTC pour éviter les changements d'heure)
// ---------------------------------------------------------------------------------------------------------------

/** Une durée rapide : un nombre de semaines ou de mois, à partir d'un premier jour. */
export type SpanChoice = { id: string; label: string; weeks?: number; months?: number };

/** Les choix de « Pendant » d'un rendez-vous (« Sans fin » ou une durée ; une date de fin explicite se choisit à part). */
export const ENDS_CHOICES: SpanChoice[] = [
  { id: 'none', label: 'Sans fin' },
  { id: 'w1', label: '1 semaine', weeks: 1 },
  { id: 'w2', label: '2 semaines', weeks: 2 },
  { id: 'm1', label: '1 mois', months: 1 },
  { id: 'm3', label: '3 mois', months: 3 },
  { id: 'm6', label: '6 mois', months: 6 },
  { id: 'y1', label: '1 an', months: 12 },
];

/** La fin est dans un an au plus (le serveur compte un an de calendrier, jusqu'à 366 jours). */
export const ENDS_MAX_MONTHS = 12;

/** AAAA-MM-JJ plus `n` mois, le jour ramené au dernier du mois s'il n'existe pas (31 janvier + 1 mois = 28 ou 29 février). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const index = m - 1 + n;
  const year = y + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Le dernier jour d'une durée qui commence le `first` : 3 semaines depuis le 23 octobre se terminent le 12 novembre (21 jours
 * en tout), 2 mois depuis le 23 octobre le 22 décembre. Nul pour « Sans fin ».
 */
export function lastDayFor(choice: SpanChoice, first: string): string | null {
  if (choice.weeks) return shiftDay(first, choice.weeks * 7 - 1);
  if (choice.months) return shiftDay(addMonths(first, choice.months), -1);
  return null;
}

/**
 * Pourquoi cette fin est refusée pour un hebdomadaire, en français, ou null : une fin passée, à plus d'un an, ou qui ne laisse
 * aucune occurrence à venir. `today` : le jour d'aujourd'hui dans le fuseau du rendez-vous.
 */
export function endsOnProblem(rdv: Schedule, today: string, now: Date = new Date()): string | null {
  if (rdv.recurrence !== 'weekly' || !rdv.endsOn) return null;
  if (rdv.endsOn < today) return 'Choisis une fin à venir.';
  if (rdv.endsOn > addMonths(today, ENDS_MAX_MONTHS)) return 'La fin est dans un an au plus.';
  if (nextOccurrences(rdv, now, 1).length === 0) return 'Aucun rendez-vous n’a lieu avant cette fin.';
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

/** Les jours d'une ligne du serveur : `weekdays`, ou à défaut l'ancien `weekday` seul. Vide si invalide. */
function readWeekdays(record: Record<string, unknown>): number[] {
  const raw = Array.isArray(record.weekdays)
    ? record.weekdays
    : record.weekday === null || record.weekday === undefined
      ? []
      : [record.weekday];
  const days = raw.map(nat);
  if (days.some((d) => d === null || d > 6)) return [];
  const unique = [...new Set(days as number[])].sort((a, b) => a - b);
  return unique.length >= 1 && unique.length <= 7 ? unique : [];
}

function readSchedule(record: Record<string, unknown>): Schedule | null {
  const durationMin = nat(record.duration_min);
  if (durationMin === null || durationMin < DURATION_MIN || durationMin > DURATION_MAX) return null;
  if (record.recurrence === 'once') {
    const startsAt = isoDate(record.starts_at);
    return startsAt ? { recurrence: 'once', weekdays: [], localTime: null, timezone: null, startsAt, endsOn: null, durationMin } : null;
  }
  if (record.recurrence === 'weekly') {
    const weekdays = readWeekdays(record);
    const time = parseLocalTime(record.local_time);
    const timezone = str(record.timezone);
    if (weekdays.length === 0 || !time || !timezone || !isTimeZone(timezone)) return null;
    const localTime = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    const endsOn = typeof record.ends_on === 'string' && /^\d{4}-\d{2}-\d{2}/.test(record.ends_on) ? record.ends_on.slice(0, 10) : null;
    return { recurrence: 'weekly', weekdays, localTime, timezone, startsAt: null, endsOn, durationMin };
  }
  return null;
}

export function readGathering(row: unknown): Gathering | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const title = str(record.title);
  const participantCount = nat(record.participant_count);
  const presentCount = nat(record.present_count);
  if (!schedule || !id || !title || participantCount === null || presentCount === null) return null;
  const currentStart = record.current_start === null || record.current_start === undefined ? null : isoDate(record.current_start);
  const nextStart = record.next_start === null || record.next_start === undefined ? null : isoDate(record.next_start);
  return {
    ...schedule,
    id,
    title,
    description: typeof record.description === 'string' ? record.description : '',
    nextStart,
    currentStart,
    participantCount,
    participating: record.participating === true,
    // Les présents et « tu es là » n'ont de sens que pendant la fenêtre.
    presentCount: currentStart ? presentCount : 0,
    present: currentStart ? record.present === true : false,
    prayerKind: readPrayerKind(record.prayer_kind),
  };
}

export function readMyGathering(row: unknown): MyGathering | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const title = str(record.title);
  if (!schedule || !id || !groupId || !groupName || !title) return null;
  return { ...schedule, id, groupId, groupName, title, present: record.present === true };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };

// Les écrans qui changent les inscriptions ou les rendez-vous préviennent GatheringSync (src/app/_layout.tsx),
// qui reprogramme les rappels du téléphone.
const listeners = new Set<() => void>();

/** Les rendez-vous auxquels je suis inscrit ont peut-être changé : à resynchroniser. */
export function gatheringsChanged() {
  for (const listener of listeners) listener();
}

export function onGatheringsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function changed(result: Result): Promise<Result> {
  if (result.ok) gatheringsChanged();
  return result;
}

export type GatheringInput = {
  title: string;
  description: string;
  durationMin: number;
  recurrence: Recurrence;
  /** Hebdomadaire : les jours, 0 (dimanche) à 6. */
  weekdays: number[];
  hour: number;
  minute: number;
  /** Hebdomadaire : dernier jour (AAAA-MM-JJ, à l'heure du téléphone), ou nul pour un rendez-vous sans fin. */
  endsOn: string | null;
  /** Ponctuel : le moment. */
  startsAt: Date | null;
  prayerKind: PrayerKind;
};

function fields(input: GatheringInput) {
  const weekly = input.recurrence === 'weekly';
  return {
    p_title: input.title.trim(),
    p_description: input.description.trim(),
    p_duration: input.durationMin,
    p_recurrence: input.recurrence,
    // `p_weekday` ne sert qu'aux téléphones d'avant (un seul jour) : le serveur lit `p_weekdays` d'abord.
    p_weekday: null,
    p_weekdays: weekly ? [...input.weekdays].sort((a, b) => a - b) : null,
    p_ends_on: weekly ? input.endsOn : null,
    p_local_time: weekly ? `${String(input.hour).padStart(2, '0')}:${String(input.minute).padStart(2, '0')}` : null,
    // Le fuseau du téléphone de celui qui enregistre : l'heure saisie est celle de son mur.
    p_timezone: weekly ? deviceTimeZone() : null,
    p_starts_at: !weekly && input.startsAt ? input.startsAt.toISOString() : null,
    p_prayer_kind: input.prayerKind,
  };
}

/** Crée un rendez-vous : en cas de succès, `data` est son identifiant. */
export function createGathering(groupId: string, input: GatheringInput) {
  return call('create_gathering', { p_group: groupId, ...fields(input) }).then(changed);
}

export function updateGathering(id: string, input: GatheringInput) {
  return call('update_gathering', { p_id: id, ...fields(input) }).then(changed);
}

export function cancelGathering(id: string) {
  return call('cancel_gathering', { p_id: id }).then(changed);
}

export async function listGatherings(groupId: string): Promise<{ ok: true; gatherings: Gathering[] } | Failure> {
  const result = await call('list_gatherings', { p_group: groupId });
  if (!result.ok) return result;
  return { ok: true, gatherings: readRows(result.data, readGathering) };
}

/** Mes rendez-vous inscrits, à venir, dans les groupes où je suis encore membre. */
export async function myGatherings(): Promise<{ ok: true; gatherings: MyGathering[] } | Failure> {
  const result = await call('my_gatherings');
  if (!result.ok) return result;
  return { ok: true, gatherings: readRows(result.data, readMyGathering) };
}

export function setParticipation(id: string, on: boolean) {
  return call('set_participation', { p_id: id, p_on: on }).then(changed);
}

export function markPresent(id: string) {
  return call('mark_present', { p_id: id });
}
