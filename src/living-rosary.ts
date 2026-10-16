import { MYSTERIES } from './data/prayers';
import { MONTHS, shiftDay } from './dates';
import { deviceTimeZone, isTimeZone, parseLocalTime, zonedInstant, zonedParts } from './gatherings';
import { asRecord, call, type Result, readRows } from './profile';

// Rosaire vivant de groupe (supabase/migrations/012_living_rosary.sql).
//
// 20 mystères, dans l'ordre de MYSTERIES (src/data/prayers.ts) : joyeux 1 à 5 (index 0 à 4), lumineux 6 à 10 (5 à 9),
// douloureux 11 à 15 (10 à 14), glorieux 16 à 20 (15 à 19). Une « équipe » a 20 places (5 équipes au plus : 100 personnes).
// Chaque participant garde une place de base `slot` (0 à 19) ; son mystère du mois est (slot + mois écoulés) mod 20, les mois
// écoulés se comptant depuis le mois de départ, DANS LE FUSEAU DU ROSAIRE (celui du créateur) : il change le 1er du mois à
// 0 h dans ce fuseau. Aucune tâche planifiée : ce calcul pur (le même que rosary_months / rosary_mystery côté serveur) suffit.
// Le serveur reste la référence pour accepter une action ; rien n'est gardé sur le téléphone, sauf les rappels que programme
// src/rosary-reminders.ts.

export const ROSARY_SLOTS = 20;
export const MAX_TEAMS = 5;
export const MAX_PARTICIPANTS = ROSARY_SLOTS * MAX_TEAMS;
/** Un seul Rosaire vivant est rappelé à la fois (budget de notifications d'iOS, cf. src/reminder.ts). */
export const MAX_REMINDED_ROSARIES = 1;
/** Nombre de prochains jours rappelés. */
export const REMINDER_DAYS = 3;

// ---------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------

/** Ce qui décide du mystère d'une place : le mois de départ (AAAA-MM-01) et le fuseau du Rosaire. */
export type RosarySchedule = { startMonth: string; timezone: string };

/** Un mystère d'une équipe, ce mois-ci. */
export type MysteryCell = {
  /** 0 à 19. */
  mystery: number;
  taken: boolean;
  mine: boolean;
  /** Le participant a prié sa dizaine aujourd'hui (jour du fuseau du Rosaire). */
  prayed: boolean;
  /** Le pseudo du participant ; null si le mystère est libre, si c'est moi, ou si une personne bloquée (voir `hidden`). */
  handle: string | null;
  /** Pris par une personne bloquée dans un sens ou dans l'autre : l'app écrit « Un membre ». */
  hidden: boolean;
};

export type RosaryTeam = { team: number; takenCount: number; prayedCount: number; mysteries: MysteryCell[] };

/** Ma place dans le Rosaire vivant. */
export type RosaryMe = { team: number; slot: number; mystery: number; nextMystery: number; prayedToday: boolean };

/** Un Rosaire vivant d'un groupe, vu par un membre. */
export type LivingRosary = RosarySchedule & {
  id: string;
  groupId: string;
  groupName: string;
  groupEnded: boolean;
  canManage: boolean;
  /** Le jour du Rosaire (AAAA-MM-JJ) selon le serveur à la lecture. */
  today: string;
  monthsElapsed: number;
  /** Mon rappel quotidien « HH:MM » (heure du mur de mon téléphone), ou null. */
  reminderTime: string | null;
  me: RosaryMe | null;
  /** L'équipe où l'on prend place (la plus basse qui a une place libre), null si les 5 sont pleines. */
  openTeam: number | null;
  participantCount: number;
  teams: RosaryTeam[];
};

/** Un Rosaire où je participe : de quoi programmer les rappels et montrer l'accueil. */
export type MyRosary = RosarySchedule & {
  id: string;
  groupId: string;
  groupName: string;
  team: number;
  slot: number;
  today: string;
  prayedToday: boolean;
  reminderTime: string | null;
};

// ---------------------------------------------------------------------------------------------------------------
// Mois, jours et mystères (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** AAAA-MM-JJ de l'instant `ts` (ms) dans `zone`. */
export function localDateIn(ts: number, zone: string): string {
  const p = zonedParts(ts, zone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Le jour du Rosaire à `now` : il change à minuit dans le fuseau du Rosaire (rosary_today côté serveur). */
export function rosaryToday(schedule: Pick<RosarySchedule, 'timezone'>, now: Date): string {
  return localDateIn(now.getTime(), schedule.timezone);
}

/**
 * Mois écoulés depuis le mois de départ à `now`, comptés dans le fuseau du Rosaire : 0 le mois du lancement, +1 le 1er de
 * chaque mois à 0 h dans ce fuseau. Jamais négatif. Même calcul que rosary_months côté serveur. Si le fuseau est inconnu du
 * moteur, renvoie 0 au lieu d'échouer.
 */
export function monthsElapsed(schedule: RosarySchedule, now: Date): number {
  try {
    const p = zonedParts(now.getTime(), schedule.timezone);
    const [y, m] = schedule.startMonth.split('-').map(Number);
    const diff = p.year * 12 + p.month - (y * 12 + m);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
  } catch {
    return 0;
  }
}

/** Le mystère (0 à 19) d'une place de base après `months` mois : (slot + mois) mod 20. */
export const mysteryFor = (slot: number, months: number) => (((slot + months) % ROSARY_SLOTS) + ROSARY_SLOTS) % ROSARY_SLOTS;

/** Mon mystère ce mois-ci (`ahead` = 0) ou dans `ahead` mois, pour une place de base. */
export function mysteryOfMonth(schedule: RosarySchedule, slot: number, now: Date, ahead = 0): number {
  return mysteryFor(slot, monthsElapsed(schedule, now) + ahead);
}

/** Série (0 à 3, index dans MYSTERIES) et dizaine (1 à 5) d'un mystère 0 à 19. */
export function mysterySeries(mystery: number): { serie: number; dizaine: number } {
  return { serie: Math.floor(mystery / 5), dizaine: (mystery % 5) + 1 };
}

/** Le mystère 0 à 19 d'une série et d'une dizaine (1 à 5), ou null. */
export function mysteryIndex(serie: number, dizaine: number): number | null {
  if (!Number.isInteger(serie) || !Number.isInteger(dizaine) || serie < 0 || serie >= MYSTERIES.length || dizaine < 1 || dizaine > 5) {
    return null;
  }
  return serie * 5 + dizaine - 1;
}

/**
 * Les paramètres `serie` (0 à 3, index dans MYSTERIES) et `dizaine` (1 à 5) de `/chapelet`, lus en texte : la série et la
 * dizaine (index 0 à 4) à prier, ou null si l'un des deux manque ou est invalide.
 */
export function chapeletTarget(serie: string, dizaine: string): { set: number; decade: number } | null {
  if (!/^\d+$/.test(serie) || !/^\d+$/.test(dizaine)) return null;
  const index = mysteryIndex(Number(serie), Number(dizaine));
  return index === null ? null : { set: Number(serie), decade: Number(dizaine) - 1 };
}

/** « La Visitation », « Le Baptême de Jésus » : le nom du mystère 0 à 19, tel qu'écrit dans l'app. */
export function mysteryName(mystery: number): string {
  const { serie, dizaine } = mysterySeries(mystery);
  return MYSTERIES[serie]?.mysteries[dizaine - 1] ?? '';
}

/** « la Visitation », « l’Annonciation » : le nom en milieu de phrase (première lettre en minuscule). */
export function mysteryInSentence(mystery: number): string {
  const name = mysteryName(mystery);
  return name ? name.charAt(0).toLowerCase() + name.slice(1) : '';
}

/** « 2ᵉ mystère joyeux » : le rang dans la série (1ᵉʳ, 2ᵉ…) et la série. */
export function mysteryOrdinalLabel(mystery: number): string {
  const { serie, dizaine } = mysterySeries(mystery);
  return `${dizaine === 1 ? '1ᵉʳ' : `${dizaine}ᵉ`} mystère ${MYSTERIES[serie]?.adjective ?? ''}`.trim();
}

/** Le mois (1 à 12) de `now` dans le fuseau du Rosaire, décalé de `ahead` mois. */
export function monthNumber(schedule: Pick<RosarySchedule, 'timezone'>, now: Date, ahead = 0): number {
  try {
    const month = zonedParts(now.getTime(), schedule.timezone).month;
    return ((((month - 1 + ahead) % 12) + 12) % 12) + 1;
  } catch {
    return ((now.getMonth() + ahead) % 12) + 1;
  }
}

/** « Ton mystère en octobre : la Visitation » */
export function myMysteryLabel(schedule: RosarySchedule, slot: number, now: Date): string {
  return `Ton mystère en ${MONTHS[monthNumber(schedule, now) - 1]} : ${mysteryInSentence(mysteryOfMonth(schedule, slot, now))}`;
}

/** « En novembre : la Nativité » */
export function nextMysteryLabel(schedule: RosarySchedule, slot: number, now: Date): string {
  return `En ${MONTHS[monthNumber(schedule, now, 1) - 1]} : ${mysteryInSentence(mysteryOfMonth(schedule, slot, now, 1))}`;
}

/** « 14 dizaines sur 20 aujourd’hui » */
export function teamProgressLabel(prayed: number): string {
  return `${prayed} dizaine${prayed > 1 ? 's' : ''} sur ${ROSARY_SLOTS} aujourd’hui`;
}

/** « Équipe 2 » */
export const teamLabel = (team: number) => `Équipe ${team}`;

/** « 1 personne », « 12 personnes » */
export function participantsLabel(n: number): string {
  return n <= 1 ? `${n} personne` : `${n} personnes`;
}

/** Le nom d'un mystère pour l'écran : « Moi », « @marie » ou « Un membre » ; null s'il est libre. */
export function holderLabel(cell: MysteryCell): string | null {
  if (!cell.taken) return null;
  if (cell.mine) return 'Toi';
  if (cell.hidden || !cell.handle) return 'Un membre';
  return `@${cell.handle}`;
}

/**
 * La place libre que le serveur donne (join_rosary) : l'équipe la plus basse qui n'est pas pleine, puis le plus petit mystère
 * libre CE MOIS-CI (ou le mystère voulu, s'il est libre dans cette équipe, sinon l'équipe suivante). `taken` : les places
 * (équipe, slot) déjà prises. Renvoie null si rien n'est libre. Référence testée de la règle du serveur ; l'app s'en remet
 * au serveur pour attribuer.
 */
export function assignPlace(
  taken: { team: number; slot: number }[],
  months: number,
  wanted: number | null = null,
): { team: number; slot: number } | null {
  const used = new Set(taken.map((p) => `${p.team}:${p.slot}`));
  for (let team = 1; team <= MAX_TEAMS; team++) {
    if (taken.filter((p) => p.team === team).length >= ROSARY_SLOTS) continue;
    if (wanted !== null) {
      const slot = mysteryFor(wanted - months, 0);
      if (!used.has(`${team}:${slot}`)) return { team, slot };
      continue;
    }
    for (let mystery = 0; mystery < ROSARY_SLOTS; mystery++) {
      const slot = mysteryFor(mystery - months, 0);
      if (!used.has(`${team}:${slot}`)) return { team, slot };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Rappels (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** Un rappel de dizaine à programmer. */
export type DecadeReminder = { at: Date; mystery: number };

/**
 * Les `count` prochains jours à rappeler : l'heure du mur du téléphone (`deviceZone`) aujourd'hui puis les jours suivants,
 * ceux dont l'heure est encore devant nous. Le jour du Rosaire déjà prié n'est pas rappelé (c'est le jour du fuseau du
 * Rosaire qui compte, pas celui du téléphone). Chaque rappel porte le mystère du mois où il tombe.
 */
export function nextReminderDays(
  rosary: RosarySchedule & { slot: number; prayedToday: boolean; reminderTime: string | null },
  now: Date,
  count = REMINDER_DAYS,
  deviceZone: string = deviceTimeZone(),
): DecadeReminder[] {
  const time = parseLocalTime(rosary.reminderTime);
  if (!time) return [];
  try {
    const found: DecadeReminder[] = [];
    const first = localDateIn(now.getTime(), deviceZone);
    const prayedDay = rosary.prayedToday ? rosaryToday(rosary, now) : null;
    for (let i = 0; i <= count + 1 && found.length < count; i++) {
      const [y, m, d] = shiftDay(first, i).split('-').map(Number);
      const at = zonedInstant(y, m, d, time.hour, time.minute, deviceZone);
      if (at <= now.getTime()) continue;
      if (prayedDay && localDateIn(at, rosary.timezone) === prayedDay) continue;
      found.push({ at: new Date(at), mystery: mysteryOfMonth(rosary, rosary.slot, new Date(at)) });
    }
    return found;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Mises à jour optimistes (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

/** « J'ai prié ma dizaine » (on) ou décocher (off), sans effet si c'est déjà l'état ou si je ne participe pas. */
export function withDecadePrayed(rosary: LivingRosary, on: boolean): LivingRosary {
  if (!rosary.me || rosary.me.prayedToday === on) return rosary;
  const { team, mystery } = rosary.me;
  return {
    ...rosary,
    me: { ...rosary.me, prayedToday: on },
    teams: rosary.teams.map((t) =>
      t.team !== team
        ? t
        : {
            ...t,
            prayedCount: Math.max(0, t.prayedCount + (on ? 1 : -1)),
            mysteries: t.mysteries.map((c) => (c.mystery === mystery ? { ...c, prayed: on } : c)),
          },
    ),
  };
}

/** Pour l'accueil : mon mystère est-il prié aujourd'hui ? */
export const prayedLabel = (prayed: boolean) => (prayed ? 'Priée aujourd’hui' : 'À prier aujourd’hui');

// ---------------------------------------------------------------------------------------------------------------
// Lecteurs de lignes (défensifs : une ligne inattendue est ignorée, jamais une erreur)
// ---------------------------------------------------------------------------------------------------------------

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const nat = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
const inRange = (value: unknown, max: number): number | null => {
  const n = nat(value);
  return n !== null && n <= max ? n : null;
};

function readDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value ? value : null;
}

function readMonth(value: unknown): string | null {
  const date = readDate(value);
  return date?.endsWith('-01') ? date : null;
}

function readTime(value: unknown): string | null {
  const time = parseLocalTime(value);
  return time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : null;
}

function readSchedule(record: Record<string, unknown>): RosarySchedule | null {
  const startMonth = readMonth(record.start_month);
  const timezone = str(record.timezone);
  return startMonth && timezone && isTimeZone(timezone) ? { startMonth, timezone } : null;
}

function readCell(row: unknown): MysteryCell | null {
  const record = asRecord(row);
  if (!record) return null;
  const mystery = inRange(record.mystery, ROSARY_SLOTS - 1);
  if (mystery === null) return null;
  const taken = record.taken === true;
  const hidden = taken && record.hidden === true;
  const mine = taken && record.mine === true;
  return {
    mystery,
    taken,
    mine,
    prayed: taken && record.prayed === true,
    handle: taken && !mine && !hidden ? str(record.handle) : null,
    hidden,
  };
}

function readTeam(row: unknown): RosaryTeam | null {
  const record = asRecord(row);
  if (!record) return null;
  const team = nat(record.team);
  if (team === null || team < 1 || team > MAX_TEAMS || !Array.isArray(record.mysteries)) return null;
  const cells = record.mysteries.flatMap((c) => readCell(c) ?? []);
  // Les 20 mystères, une fois chacun : sinon l'équipe est ignorée.
  if (cells.length !== ROSARY_SLOTS || new Set(cells.map((c) => c.mystery)).size !== ROSARY_SLOTS) return null;
  const mysteries = [...cells].sort((a, b) => a.mystery - b.mystery);
  return {
    team,
    takenCount: mysteries.filter((c) => c.taken).length,
    prayedCount: mysteries.filter((c) => c.prayed).length,
    mysteries,
  };
}

function readMe(value: unknown): RosaryMe | null {
  const record = asRecord(value);
  if (!record) return null;
  const team = nat(record.team);
  const slot = inRange(record.slot, ROSARY_SLOTS - 1);
  const mystery = inRange(record.mystery, ROSARY_SLOTS - 1);
  const nextMystery = inRange(record.next_mystery, ROSARY_SLOTS - 1);
  if (team === null || team < 1 || team > MAX_TEAMS || slot === null || mystery === null || nextMystery === null) return null;
  return { team, slot, mystery, nextMystery, prayedToday: record.prayed_today === true };
}

export function readLivingRosary(row: unknown): LivingRosary | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const today = readDate(record.today);
  const months = nat(record.months_elapsed);
  const participantCount = nat(record.participant_count);
  if (!schedule || !id || !groupId || !groupName || !today || months === null || participantCount === null) return null;
  if (!Array.isArray(record.teams)) return null;
  const teams = record.teams.flatMap((t) => readTeam(t) ?? []);
  if (teams.length === 0) return null;
  const openTeam = nat(record.open_team);
  // Un participant sans place lisible (ligne `me` abîmée) est traité comme non participant : le serveur refusera de toute façon.
  const me = record.me === null || record.me === undefined ? null : readMe(record.me);
  return {
    ...schedule,
    id,
    groupId,
    groupName,
    groupEnded: record.group_ended === true,
    canManage: record.can_manage === true,
    today,
    monthsElapsed: months,
    reminderTime: readTime(record.reminder_time),
    me,
    openTeam: openTeam !== null && openTeam >= 1 && openTeam <= MAX_TEAMS ? openTeam : null,
    participantCount,
    teams: teams.sort((a, b) => a.team - b.team),
  };
}

export function readMyRosary(row: unknown): MyRosary | null {
  const record = asRecord(row);
  if (!record) return null;
  const schedule = readSchedule(record);
  const id = str(record.id);
  const groupId = str(record.group_id);
  const groupName = str(record.group_name);
  const team = nat(record.team);
  const slot = inRange(record.slot, ROSARY_SLOTS - 1);
  const today = readDate(record.today);
  if (!schedule || !id || !groupId || !groupName || team === null || team < 1 || team > MAX_TEAMS || slot === null || !today) return null;
  return {
    ...schedule,
    id,
    groupId,
    groupName,
    team,
    slot,
    today,
    prayedToday: record.prayed_today === true,
    reminderTime: readTime(record.reminder_time),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };

// Les écrans qui changent ma participation, un jour prié ou un rappel préviennent RosarySync (src/app/_layout.tsx), qui
// reprogramme les rappels du téléphone.
const listeners = new Set<() => void>();

/** Mes Rosaires vivants ou mes rappels ont peut-être changé : à resynchroniser. */
export function rosariesChanged() {
  for (const listener of listeners) listener();
}

export function onRosariesChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function changed(result: Result): Promise<Result> {
  if (result.ok) rosariesChanged();
  return result;
}

/** Lance un Rosaire vivant : le mois de départ est le mois en cours, dans le fuseau de ce téléphone. */
export function startRosary(groupId: string) {
  return call('start_rosary', { p_group: groupId, p_timezone: deviceTimeZone() }).then(changed);
}

export function cancelRosary(id: string) {
  return call('cancel_rosary', { p_id: id }).then(changed);
}

/** Le Rosaire vivant actif d'un groupe ; `rosary: null` s'il n'y en a pas (ou si la réponse est illisible). */
export async function getGroupRosary(groupId: string): Promise<{ ok: true; rosary: LivingRosary | null } | Failure> {
  const result = await call('get_group_rosary', { p_group: groupId });
  if (!result.ok) return result;
  return { ok: true, rosary: readLivingRosary(result.data) };
}

/** `rosary: null` : le Rosaire n'existe plus (ou la réponse est illisible). */
export async function getRosary(id: string): Promise<{ ok: true; rosary: LivingRosary | null } | Failure> {
  const result = await call('get_rosary', { p_id: id });
  if (!result.ok) return result;
  return { ok: true, rosary: readLivingRosary(result.data) };
}

/** Mes Rosaires vivants (ceux où je participe), dans les groupes où je suis encore membre. */
export async function myRosaries(): Promise<{ ok: true; rosaries: MyRosary[] } | Failure> {
  const result = await call('my_rosaries');
  if (!result.ok) return result;
  return { ok: true, rosaries: readRows(result.data, readMyRosary) };
}

/** « Prendre un mystère » : `mystery` null pour la première place libre, ou un mystère 0 à 19 libre ce mois-ci. */
export async function joinRosary(id: string, mystery: number | null): Promise<{ ok: true; rosary: LivingRosary | null } | Failure> {
  const result = await call('join_rosary', { p_id: id, p_mystery: mystery });
  if (!result.ok) return result;
  rosariesChanged();
  return { ok: true, rosary: readLivingRosary(result.data) };
}

export function leaveRosary(id: string) {
  return call('leave_rosary', { p_id: id }).then(changed);
}

/** « J'ai prié ma dizaine » (`on`) ou décocher, pour aujourd'hui seulement (jour du Rosaire, calculé par le serveur). */
export function setDecadePrayed(id: string, on: boolean) {
  return call('set_decade_prayed', { p_id: id, p_on: on }).then(changed);
}

/** Règle (« HH:MM ») ou retire (null) mon rappel quotidien pour ce Rosaire vivant. */
export function setRosaryReminder(id: string, time: string | null) {
  return call('set_rosary_reminder', { p_id: id, p_time: time }).then(changed);
}

/** Mes Rosaires du jour pour l'accueil : ceux où j'ai une place. */
export const participatingRosaries = (list: MyRosary[]) => [...list].sort((a, b) => Number(a.prayedToday) - Number(b.prayedToday));

/** L'équipe que montre un résumé : la mienne, sinon celle où l'on prend place, sinon la première. */
export function focusTeam(rosary: LivingRosary): RosaryTeam | null {
  return (
    rosary.teams.find((t) => t.team === rosary.me?.team) ?? rosary.teams.find((t) => t.team === rosary.openTeam) ?? rosary.teams[0] ?? null
  );
}
