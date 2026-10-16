import { dayLabel, daysSince, localDate, shiftDay } from './dates';
import { deviceTimeZone, isTimeZone, parseLocalTime, zonedInstant, zonedParts } from './gatherings';
import { INTENTION_MAX } from './groups';
import { asRecord, call, type Result, readRows } from './profile';

// Neuvaines collectives de groupe (supabase/migrations/011_group_novenas.sql). Le contenu des modèles (passages,
// méditations, prières) est dans src/data/novenas.ts ; le serveur ne garde que ce qui décide des jours.
// Rien n'est gardé sur le téléphone, sauf les rappels que programme src/novena-reminders.ts.
//
// Jour N = jour local de début + N - 1, dans le FUSEAU DU CRÉATEUR (comme les rendez-vous hebdomadaires de 009). Le
// serveur calcule le jour courant et refuse un jour futur ; ici, `novenaDay` fait le même calcul avec Intl
// (réutilise zonedParts de src/gatherings.ts) pour que l'écran change de jour à minuit sans recharger. Si un moteur ne
// connaissait pas le fuseau, tout échoue en douceur : jour 0, aucun rappel, jamais une erreur.
// Compteurs : les priants sont COMPTÉS, jamais listés ; ils sont anonymes, donc les personnes bloquées n'y sont pas
// retirées (rien ne les désigne). On ne compte que les membres actuels du groupe.

export type NovenaModel = 'esprit-saint' | 'saint-joseph' | 'sacre-coeur' | 'notre-dame' | 'personnalisee';
export const NOVENA_MODELS: NovenaModel[] = ['esprit-saint', 'saint-joseph', 'sacre-coeur', 'notre-dame', 'personnalisee'];
/** Les suites de passages que peut choisir une neuvaine personnalisée (facultatif). */
export type PassageSetId = 'psaumes' | 'evangile';
export const PASSAGE_SETS: PassageSetId[] = ['psaumes', 'evangile'];

export const NOVENA_DAYS = 9;
export const MAX_ACTIVE_NOVENAS = 3;
export const MAX_REMINDED_NOVENAS = 3;
/** Une neuvaine peut commencer aujourd'hui ou dans les 30 prochains jours. */
export const START_MAX_DAYS = 30;
export const NOVENA_INTENTION_MAX = INTENTION_MAX;
export const CUSTOM_PRAYER_MAX = 2000;
/** Une neuvaine finie reste visible (récapitulatif) 7 jours dans la liste du groupe. */
export const FINISHED_VISIBLE_DAYS = 7;

/** Une neuvaine d'un groupe, vue par un membre. */
export type Novena = {
  id: string;
  groupId: string;
  groupName: string;
  groupEnded: boolean;
  canManage: boolean;
  model: NovenaModel;
  title: string;
  intention: string;
  /** Modèle personnalisé : la prière du créateur. */
  customPrayer: string | null;
  passageSet: PassageSetId | null;
  /** AAAA-MM-JJ du jour 1, dans `timezone`. */
  startDate: string;
  timezone: string;
  /** Le jour courant selon le serveur à la lecture : 0 (pas commencée), 1 à 9, 10 (terminée). */
  currentDay: number;
  /** Pour chaque jour de 1 à 9 (index 0 à 8) : membres qui l'ont prié. */
  dayCounts: number[];
  /** Les jours que j'ai priés (1 à 9, en ordre). */
  myDays: number[];
  /** Mon rappel quotidien « HH:MM » (heure du mur de mon téléphone), ou null. */
  reminderTime: string | null;
  /** Membres qui l'ont priée jusqu'au bout (les 9 jours). */
  finisherCount: number;
  memberCount: number;
};

/** Ce qui décide des jours d'une neuvaine. */
export type NovenaSchedule = { startDate: string; timezone: string };

/** Une de mes neuvaines en cours ou à venir : de quoi programmer les rappels et montrer l'accueil. */
export type MyNovena = NovenaSchedule & {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  model: NovenaModel;
  currentDay: number;
  myDays: number[];
  reminderTime: string | null;
};

// ---------------------------------------------------------------------------------------------------------------
// Jours et fuseaux (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** AAAA-MM-JJ de l'instant `ts` (ms) dans `zone`. */
export function localDateIn(ts: number, zone: string): string {
  const p = zonedParts(ts, zone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Le jour courant à `now` : 0 si la neuvaine n'a pas commencé, 1 à 9, ou 10 une fois le jour 9 passé. Même calcul que
 * novena_current_day côté serveur : le jour change à minuit dans le fuseau de la neuvaine.
 */
export function novenaDay(schedule: NovenaSchedule, now: Date): number {
  try {
    const diff = daysSince(schedule.startDate, localDateIn(now.getTime(), schedule.timezone));
    if (!Number.isFinite(diff)) return 0;
    return diff < 0 ? 0 : diff >= NOVENA_DAYS ? NOVENA_DAYS + 1 : diff + 1;
  } catch {
    return 0;
  }
}

/**
 * Le jour `day` (1 à 9) peut-il être prié à `now` ? Le jour en cours et les jours passés (rattrapage) oui, jamais un jour
 * futur. Le serveur refuse de toute façon un jour futur (set_day_prayed) : ceci ne sert qu'à verrouiller l'écran.
 */
export function isDayOpen(schedule: NovenaSchedule, day: number, now: Date): boolean {
  return day >= 1 && day <= NOVENA_DAYS && day <= novenaDay(schedule, now);
}

/** Les 9 dates (AAAA-MM-JJ) de la neuvaine, jour 1 en premier. */
export function novenaDates(startDate: string): string[] {
  return Array.from({ length: NOVENA_DAYS }, (_, i) => shiftDay(startDate, i));
}

/** L'instant où le jour `day` (1 à 9) s'ouvre : minuit dans le fuseau de la neuvaine. */
export function dayOpensAt(schedule: NovenaSchedule, day: number): Date {
  const [y, m, d] = shiftDay(schedule.startDate, day - 1)
    .split('-')
    .map(Number);
  return new Date(zonedInstant(y, m, d, 0, 0, schedule.timezone));
}

/** L'instant où le jour 9 est fini : minuit qui suit le jour 9, dans le fuseau de la neuvaine. */
export function novenaEnd(schedule: NovenaSchedule): Date {
  return dayOpensAt(schedule, NOVENA_DAYS + 1);
}

/** Cette neuvaine finit-elle après la fin du groupe éphémère ? (le serveur la refuse alors) */
export function endsAfterGroup(schedule: NovenaSchedule, groupEndsAt: string | null): boolean {
  if (!groupEndsAt) return false;
  const ends = Date.parse(groupEndsAt);
  try {
    return Number.isFinite(ends) && novenaEnd(schedule).getTime() > ends;
  } catch {
    return false;
  }
}

/** Le jour 1, `offset` jours après aujourd'hui (jour du calendrier de ce téléphone). */
export function startDateFor(offset: number, now: Date = new Date()): string {
  return shiftDay(localDate(now), offset);
}

/** Pourquoi ce début est refusé (aujourd'hui ou dans les 30 prochains jours, dans le fuseau donné), ou null. */
export function startProblem(startDate: string, zone: string, now: Date = new Date()): string | null {
  try {
    const diff = daysSince(localDateIn(now.getTime(), zone), startDate);
    if (!Number.isFinite(diff) || diff < 0 || diff > START_MAX_DAYS) {
      return `Choisis un début entre aujourd’hui et les ${START_MAX_DAYS} prochains jours.`;
    }
    return null;
  } catch {
    return 'Ce fuseau horaire n’est pas reconnu.';
  }
}

/**
 * L'instant du rappel du jour `day` : l'heure du mur du téléphone (`deviceZone`) à la date de ce jour. Si ce moment tombe
 * avant l'ouverture du jour dans le fuseau du créateur (un téléphone plus à l'est), il est repoussé à l'ouverture, pour
 * ne jamais annoncer un jour que le serveur refuserait encore.
 */
export function reminderInstant(schedule: NovenaSchedule, day: number, time: string, deviceZone: string = deviceTimeZone()): Date | null {
  const t = parseLocalTime(time);
  if (!t || day < 1 || day > NOVENA_DAYS) return null;
  try {
    const [y, m, d] = shiftDay(schedule.startDate, day - 1)
      .split('-')
      .map(Number);
    const wall = zonedInstant(y, m, d, t.hour, t.minute, deviceZone);
    const opens = dayOpensAt(schedule, day).getTime();
    return new Date(Math.max(wall, opens));
  } catch {
    return null;
  }
}

/** Un rappel de neuvaine à programmer. */
export type DayReminder = { day: number; at: Date };

/** Les `count` prochains jours non priés à rappeler : ceux dont l'heure est encore devant nous, jusqu'au jour 9. */
export function nextReminderDays(
  novena: NovenaSchedule & { myDays: number[]; reminderTime: string | null },
  now: Date,
  count = 3,
  deviceZone: string = deviceTimeZone(),
): DayReminder[] {
  if (!novena.reminderTime) return [];
  const found: DayReminder[] = [];
  for (let day = 1; day <= NOVENA_DAYS && found.length < count; day++) {
    if (novena.myDays.includes(day)) continue;
    const at = reminderInstant(novena, day, novena.reminderTime, deviceZone);
    if (at && at.getTime() > now.getTime()) found.push({ day, at });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------------------------------------------

/** « Jour 4 sur 9 » */
export const dayOfLabel = (day: number) => `Jour ${day} sur ${NOVENA_DAYS}`;

/** « Jour 4 sur 9 », « Commence demain », « Commence dans 5 jours », « Terminée ». */
export function statusLabel(schedule: NovenaSchedule, now: Date = new Date()): string {
  const day = novenaDay(schedule, now);
  if (day > NOVENA_DAYS) return 'Terminée';
  if (day >= 1) return dayOfLabel(day);
  try {
    const wait = daysSince(localDateIn(now.getTime(), schedule.timezone), schedule.startDate);
    return wait === 1 ? 'Commence demain' : `Commence dans ${wait} jours`;
  } catch {
    return 'Pas encore commencée';
  }
}

/** « 7 ont prié aujourd’hui » */
export function prayedTodayLabel(count: number): string {
  if (count <= 0) return 'Personne n’a encore prié aujourd’hui';
  return count === 1 ? '1 a prié aujourd’hui' : `${count} ont prié aujourd’hui`;
}

/** « 7 ont prié » : le compteur d'un jour de la frise. */
export function dayCountLabel(count: number): string {
  if (count <= 0) return 'Personne n’a prié';
  return count === 1 ? '1 a prié' : `${count} ont prié`;
}

/** « 12 membres l’ont priée jusqu’au bout » */
export function finishersLabel(count: number): string {
  if (count <= 0) return 'Personne ne l’a encore priée jusqu’au bout';
  return count === 1 ? '1 membre l’a priée jusqu’au bout' : `${count} membres l’ont priée jusqu’au bout`;
}

/** « Prier le jour 4 » */
export const prayDayLabel = (day: number) => `Prier le jour ${day}`;

/** « Ce jour s’ouvre le mercredi 21 octobre » */
export function lockedLabel(schedule: NovenaSchedule, day: number): string {
  return `Ce jour s’ouvre le ${dayLabel(shiftDay(schedule.startDate, day - 1))}`;
}

/** Le jour à ouvrir par défaut : le jour courant, le jour 1 avant le début, le jour 9 après la fin. */
export const defaultDay = (currentDay: number) => Math.min(NOVENA_DAYS, Math.max(1, currentDay));

/** Pourquoi cette intention est refusée, ou null. */
export function intentionProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return 'Écris pour quoi vous priez.';
  if (text.length > NOVENA_INTENTION_MAX) return `L’intention fait ${NOVENA_INTENTION_MAX} caractères au plus.`;
  return null;
}

/** Pourquoi cette prière personnalisée est refusée, ou null. */
export function customPrayerProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return 'Écris la prière récitée chaque jour.';
  if (text.length > CUSTOM_PRAYER_MAX) return `La prière fait ${CUSTOM_PRAYER_MAX} caractères au plus.`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Mises à jour optimistes (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** « J'ai prié le jour N » (on) ou décocher (off) sur une neuvaine ; sans effet si c'est déjà l'état. */
export function withDayPrayed(novena: Novena, day: number, on: boolean): Novena {
  if (day < 1 || day > NOVENA_DAYS || novena.myDays.includes(day) === on) return novena;
  const before = novena.myDays.length === NOVENA_DAYS;
  const myDays = on ? [...novena.myDays, day].sort((a, b) => a - b) : novena.myDays.filter((d) => d !== day);
  const after = myDays.length === NOVENA_DAYS;
  return {
    ...novena,
    myDays,
    dayCounts: novena.dayCounts.map((n, i) => (i === day - 1 ? Math.max(0, n + (on ? 1 : -1)) : n)),
    finisherCount: Math.max(0, novena.finisherCount + (after && !before ? 1 : before && !after ? -1 : 0)),
  };
}

/** Pour l'accueil et la liste d'un groupe : mon jour courant est-il déjà prié ? Null hors des jours 1 à 9. */
export function prayedToday(novena: { myDays: number[] } & NovenaSchedule, now: Date): boolean | null {
  const day = novenaDay(novena, now);
  return day >= 1 && day <= NOVENA_DAYS ? novena.myDays.includes(day) : null;
}

/** Mes neuvaines en cours aujourd'hui (jours 1 à 9), les moins avancées à prier d'abord. */
export function runningNovenas(list: MyNovena[], now: Date): MyNovena[] {
  return list
    .filter((n) => {
      const day = novenaDay(n, now);
      return day >= 1 && day <= NOVENA_DAYS;
    })
    .sort((a, b) => Number(prayedToday(a, now)) - Number(prayedToday(b, now)) || a.startDate.localeCompare(b.startDate));
}

// ---------------------------------------------------------------------------------------------------------------
// Lecteurs de lignes (défensifs : une ligne inattendue est ignorée, jamais une erreur)
// ---------------------------------------------------------------------------------------------------------------

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const nat = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

export function readModel(value: unknown): NovenaModel | null {
  return NOVENA_MODELS.find((model) => model === value) ?? null;
}

function readPassageSet(value: unknown): PassageSetId | null {
  return PASSAGE_SETS.find((set) => set === value) ?? null;
}

function readDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    ? value
    : null;
}

function readTime(value: unknown): string | null {
  const time = parseLocalTime(value);
  return time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : null;
}

function readDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const days = value.flatMap((v) => {
    const n = nat(v);
    return n !== null && n >= 1 && n <= NOVENA_DAYS ? [n] : [];
  });
  return [...new Set(days)].sort((a, b) => a - b);
}

function readCounts(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== NOVENA_DAYS) return null;
  const counts = value.map(nat);
  return counts.every((n): n is number => n !== null) ? counts : null;
}

function readSchedule(record: Record<string, unknown>): NovenaSchedule | null {
  const startDate = readDate(record.start_date);
  const timezone = str(record.timezone);
  return startDate && timezone && isTimeZone(timezone) ? { startDate, timezone } : null;
}

export function readNovena(row: unknown): Novena | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const title = str(record.title);
  const intention = str(record.intention);
  const model = readModel(record.model);
  const currentDay = nat(record.current_day);
  const dayCounts = readCounts(record.day_counts);
  const finisherCount = nat(record.finisher_count);
  const memberCount = nat(record.member_count);
  if (!schedule || !id || !groupId || !groupName || !title || !intention || !model) return null;
  if (currentDay === null || currentDay > NOVENA_DAYS + 1 || !dayCounts || finisherCount === null || memberCount === null) return null;
  const customPrayer = typeof record.custom_prayer === 'string' && record.custom_prayer.trim() ? record.custom_prayer : null;
  // Une neuvaine personnalisée sans sa prière n'a rien à réciter : ligne ignorée.
  if (model === 'personnalisee' && !customPrayer) return null;
  return {
    ...schedule,
    id,
    groupId,
    groupName,
    groupEnded: record.group_ended === true,
    canManage: record.can_manage === true,
    model,
    title,
    intention,
    customPrayer: model === 'personnalisee' ? customPrayer : null,
    passageSet: model === 'personnalisee' ? readPassageSet(record.passage_set) : null,
    currentDay,
    dayCounts,
    myDays: readDays(record.my_days),
    reminderTime: readTime(record.reminder_time),
    finisherCount,
    memberCount,
  };
}

export function readMyNovena(row: unknown): MyNovena | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const title = str(record.title);
  const model = readModel(record.model);
  const currentDay = nat(record.current_day);
  if (!schedule || !id || !groupId || !groupName || !title || !model || currentDay === null || currentDay > NOVENA_DAYS + 1) return null;
  return {
    ...schedule,
    id,
    groupId,
    groupName,
    title,
    model,
    currentDay,
    myDays: readDays(record.my_days),
    reminderTime: readTime(record.reminder_time),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };

// Les écrans qui changent une neuvaine ou un rappel préviennent NovenaSync (src/app/_layout.tsx), qui reprogramme les
// rappels du téléphone.
const listeners = new Set<() => void>();

/** Mes neuvaines ou mes rappels ont peut-être changé : à resynchroniser. */
export function novenasChanged() {
  for (const listener of listeners) listener();
}

export function onNovenasChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function changed(result: Result): Promise<Result> {
  if (result.ok) novenasChanged();
  return result;
}

export type NovenaInput = {
  model: NovenaModel;
  title: string;
  intention: string;
  /** Modèle personnalisé seulement. */
  customPrayer: string;
  passageSet: PassageSetId | null;
  /** AAAA-MM-JJ du jour 1 (aujourd'hui ou dans les 30 prochains jours). */
  startDate: string;
};

/** Lance une neuvaine : en cas de succès, `data` est son identifiant. Le fuseau enregistré est celui de ce téléphone. */
export function startNovena(groupId: string, input: NovenaInput) {
  const custom = input.model === 'personnalisee';
  return call('start_novena', {
    p_group: groupId,
    p_model: input.model,
    p_title: input.title.trim(),
    p_intention: input.intention.trim(),
    p_custom_prayer: custom ? input.customPrayer.trim() : null,
    p_passage_set: custom ? input.passageSet : null,
    p_start_date: input.startDate,
    p_timezone: deviceTimeZone(),
  }).then(changed);
}

export function cancelNovena(id: string) {
  return call('cancel_novena', { p_id: id }).then(changed);
}

/** Les neuvaines d'un groupe : en cours, à venir, ou terminées depuis moins de 7 jours. */
export async function listNovenas(groupId: string): Promise<{ ok: true; novenas: Novena[] } | Failure> {
  const result = await call('list_novenas', { p_group: groupId });
  if (!result.ok) return result;
  return { ok: true, novenas: readRows(result.data, readNovena) };
}

/** `novena: null` : la neuvaine n'existe plus (ou la réponse est illisible). */
export async function getNovena(id: string): Promise<{ ok: true; novena: Novena | null } | Failure> {
  const result = await call('get_novena', { p_id: id });
  if (!result.ok) return result;
  return { ok: true, novena: readNovena(result.data) };
}

/** Mes neuvaines à venir ou en cours, dans les groupes où je suis encore membre. */
export async function myNovenas(): Promise<{ ok: true; novenas: MyNovena[] } | Failure> {
  const result = await call('my_novenas');
  if (!result.ok) return result;
  return { ok: true, novenas: readRows(result.data, readMyNovena) };
}

/** « J'ai prié le jour N » (`on`) ou décocher. Le serveur refuse un jour futur. */
export function setDayPrayed(id: string, day: number, on: boolean) {
  return call('set_day_prayed', { p_id: id, p_day: day, p_on: on }).then(changed);
}

/** Règle (« HH:MM ») ou retire (null) mon rappel quotidien pour cette neuvaine. */
export function setNovenaReminder(id: string, time: string | null) {
  return call('set_novena_reminder', { p_id: id, p_time: time }).then(changed);
}
