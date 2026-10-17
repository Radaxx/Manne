// Modération éditeur : la file globale des éléments signalés, les suspensions de compte et le journal.
// Fonctions pures (lecteurs, libellés) et appels au serveur (supabase/migrations/016_publisher_moderation.sql).
// Seul un modérateur éditeur (table app_moderators, remplie à la main dans le dashboard Supabase) y a accès.

import { MONTHS } from './dates';
import { type ReasonCounts, SUSPENDED_TEXT } from './moderation';

import { failureMessage as baseFailure } from './profile';
import { supabase } from './supabase';

/** L'adresse à laquelle une personne suspendue peut écrire. */
export const SUSPENSION_CONTACT = 'radaxx.studio@gmail.com';

export const SUSPENSION_APPEAL = `Si tu penses que c’est une erreur, écris à ${SUSPENSION_CONTACT}.`;

export const REASON_MAX = 280;

/** Les éléments que la file peut contenir, et la façon dont le serveur les désigne. */
export const MOD_KINDS = ['echo', 'intention', 'profil', 'priere', 'groupe'] as const;
export type ModKind = (typeof MOD_KINDS)[number];

export const KIND_LABELS: Record<ModKind, string> = {
  echo: 'Écho',
  intention: 'Intention du fil',
  profil: 'Profil',
  priere: 'Prière de vitrine',
  groupe: 'Intention de groupe',
};

export const kindLabel = (kind: string): string => KIND_LABELS[kind as ModKind] ?? kind;

/** Un élément signalé et pas encore traité. `id` désigne l'élément auprès du serveur (jamais son auteur). */
export type ModItem = {
  kind: ModKind;
  id: string;
  body: string;
  /** Le pseudo de l'auteur ; nul si son compte n'a pas de profil. */
  handle: string | null;
  /** Le nom du groupe, pour une intention de groupe. */
  groupName: string | null;
  /** Masqué ou retiré pour les autres. */
  hidden: boolean;
  /** L'auteur est déjà suspendu. */
  suspended: boolean;
  reports: number;
  reasons: ReasonCounts;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
};

export type Suspension = {
  /** L'identifiant de la suspension (pas celui du compte). */
  id: string;
  handle: string | null;
  /** Nul : sans fin. */
  until: string | null;
  reason: string;
  suspendedBy: string | null;
  createdAt: string;
};

export type MySuspension = { until: string | null; reason: string };

export type LogEntry = {
  id: string;
  createdAt: string;
  moderator: string | null;
  action: string;
  kind: string;
  targetRef: string | null;
  targetHandle: string | null;
  note: string;
};

const asRecord = (row: unknown): Record<string, unknown> | null =>
  row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
const nat = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const date = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);
const word = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function readModItem(row: unknown): ModItem | null {
  const record = asRecord(row);
  if (!record) return null;
  const kind = MOD_KINDS.find((k) => k === record.kind);
  const id = word(record.id);
  if (!kind || !id) return null;
  const reasons: ReasonCounts = {
    insulte: nat(record.insulte),
    inapproprie: nat(record.inapproprie),
    spam: nat(record.spam),
    autre: nat(record.autre),
  };
  const sum = reasons.insulte + reasons.inapproprie + reasons.spam + reasons.autre;
  return {
    kind,
    id,
    body: typeof record.body === 'string' ? record.body : '',
    handle: word(record.handle),
    groupName: word(record.group_name),
    hidden: record.hidden === true,
    suspended: record.suspended === true,
    reports: Math.max(nat(record.reports), sum),
    reasons,
    firstReportedAt: date(record.first_reported_at),
    lastReportedAt: date(record.last_reported_at),
  };
}

export function readSuspension(row: unknown): Suspension | null {
  const record = asRecord(row);
  if (!record) return null;
  const id = word(record.id);
  const createdAt = date(record.created_at);
  if (!id || !createdAt) return null;
  return {
    id,
    handle: word(record.handle),
    until: date(record.until),
    reason: typeof record.reason === 'string' ? record.reason : '',
    suspendedBy: word(record.suspended_by),
    createdAt,
  };
}

/** La suspension de mon compte ; nulle si je ne suis pas suspendu (le serveur ne renvoie alors aucune ligne). */
export function readMySuspension(data: unknown): MySuspension | null {
  const record = asRecord(Array.isArray(data) ? data[0] : data);
  if (!record || !('reason' in record)) return null;
  return { until: date(record.until), reason: typeof record.reason === 'string' ? record.reason : '' };
}

export function readLogEntry(row: unknown): LogEntry | null {
  const record = asRecord(row);
  if (!record) return null;
  const createdAt = date(record.created_at);
  const action = word(record.action);
  const kind = word(record.kind);
  if (record.id === null || record.id === undefined || !createdAt || !action || !kind) return null;
  return {
    id: String(record.id),
    createdAt,
    moderator: word(record.moderator),
    action,
    kind,
    targetRef: word(record.target_ref),
    targetHandle: word(record.target_handle),
    note: typeof record.note === 'string' ? record.note : '',
  };
}

/** « @marie », ou « Compte sans profil ». */
export const authorLabel = (handle: string | null): string => (handle ? `@${handle}` : 'Compte sans profil');

/** Où en est l'élément pour les autres personnes. */
export function stateLabel(item: Pick<ModItem, 'kind' | 'hidden'>): string {
  if (!item.hidden) return 'Encore visible pour les autres.';
  if (item.kind === 'intention') return 'Retirée du fil commun.';
  if (item.kind === 'profil') return 'Bio et paroisse masquées pour les autres.';
  if (item.kind === 'groupe') return 'Masquée pour les membres du groupe.';
  return 'Masqué pour les autres.';
}

/** La confirmation avant de retirer un élément : ce qui se passe, et le libellé du bouton. */
export function removeCopy(kind: ModKind): { title: string; message: string; label: string } {
  switch (kind) {
    case 'echo':
      return { title: 'Supprimer cet écho ?', message: 'Il est supprimé pour tout le monde.', label: 'Supprimer' };
    case 'intention':
      return { title: 'Retirer cette intention ?', message: 'Elle disparaît du fil commun.', label: 'Retirer' };
    case 'profil':
      return {
        title: 'Effacer la bio et la paroisse ?',
        message: 'Le pseudo reste. La personne pourra écrire une nouvelle bio.',
        label: 'Effacer',
      };
    case 'priere':
      return {
        title: 'Retirer cette prière de la vitrine ?',
        message: 'Elle disparaît du profil et sa copie est supprimée.',
        label: 'Retirer',
      };
    case 'groupe':
      return { title: 'Retirer cette intention de groupe ?', message: 'Elle disparaît pour tous les membres du groupe.', label: 'Retirer' };
  }
}

/** « Groupe « Les amis de saint Paul » · géré par le groupe » : les intentions de groupe sont d'abord modérées par le groupe. */
export const groupNote = (groupName: string): string => `Groupe « ${groupName} » · géré par le groupe`;

/** « 3 signalements » */
export const reportsLabel = (n: number): string => (n === 1 ? '1 signalement' : `${n} signalements`);

/** Le nombre d'éléments à traiter, pour la ligne des réglages. */
export function pendingLabel(n: number): string {
  if (n <= 0) return 'Rien à traiter';
  return n === 1 ? '1 élément à traiter' : `${n} éléments à traiter`;
}

/** Les durées proposées ; `days: null` : sans fin. */
export const SUSPENSION_DURATIONS: readonly { days: number | null; label: string }[] = [
  { days: 1, label: '1 jour' },
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: null, label: 'Sans fin' },
];

export function durationLabel(days: number | null): string {
  if (days === null) return 'Sans fin';
  return days === 1 ? '1 jour' : `${days} jours`;
}

/** « 24 octobre » (avec l'année si ce n'est pas celle de `now`), en jour local. */
export function untilDay(iso: string, now: Date = new Date()): string {
  const day = new Date(iso);
  const label = `${day.getDate() === 1 ? '1er' : day.getDate()} ${MONTHS[day.getMonth()]}`;
  return day.getFullYear() === now.getFullYear() ? label : `${label} ${day.getFullYear()}`;
}

/** « jusqu’au 24 octobre », ou « pour une durée indéterminée ». */
export function untilPhrase(until: string | null, now: Date = new Date()): string {
  return until ? `jusqu’au ${untilDay(until, now)}` : 'pour une durée indéterminée';
}

/** Le bandeau de la personne suspendue : « Ton compte est suspendu jusqu’au 24 octobre ». */
export const suspensionTitle = (until: string | null, now: Date = new Date()): string =>
  `Ton compte est suspendu ${untilPhrase(until, now)}`;

/** « 17 octobre à 14 h 05 », en heure locale (avec l'année si ce n'est pas celle de `now`). */
export function stamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return `${untilDay(iso, now)} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

const ACTIONS: Record<string, string> = {
  restore: 'Rétabli',
  dismiss: 'Laissé visible',
  remove: 'Retiré',
  suspend: 'Compte suspendu',
  unsuspend: 'Suspension levée',
  group_restore: 'Rétabli par le groupe',
  group_dismiss: 'Laissé visible par le groupe',
  group_remove: 'Retiré par le groupe',
  group_ban: 'Banni du groupe',
  group_unban: 'Bannissement levé',
};

export const actionLabel = (action: string): string => ACTIONS[action] ?? action;

/** Ce que la ligne du journal désigne : « Écho », « Compte de @marie »… */
export function logSubject(entry: Pick<LogEntry, 'action' | 'kind' | 'targetHandle'>): string {
  if (entry.action === 'group_ban' || entry.action === 'group_unban') {
    return entry.targetHandle ? `Membre @${entry.targetHandle}` : 'Membre d’un groupe';
  }
  if (entry.kind === 'compte' || entry.action === 'suspend' || entry.action === 'unsuspend')
    return entry.targetHandle ? `Compte de @${entry.targetHandle}` : 'Compte sans profil';
  const label = kindLabel(entry.kind);
  return entry.targetHandle ? `${label} de @${entry.targetHandle}` : label;
}

/** Les messages du serveur propres à la modération éditeur, en français ; le reste suit les messages du profil. */
export function failureText(message: string): string {
  if (message.includes('compte_suspendu')) return SUSPENDED_TEXT;
  if (message.includes('interdit')) return 'Cette action est réservée aux modérateurs de l’éditeur.';
  if (message.includes('kind_invalide')) return 'Ce type d’élément n’existe pas.';
  if (message.includes('duree_invalide')) return 'La durée va de 1 jour à dix ans, ou sans fin.';
  if (message.includes('motif_invalide')) return `Écris un motif de ${REASON_MAX} caractères au plus.`;
  if (message.includes('introuvable')) return 'Cet élément n’existe plus : la liste va se mettre à jour.';
  return baseFailure(message);
}

type Raw = { ok: true; data: unknown } | { ok: false; message: string };

async function rpc(fn: string, args?: Record<string, unknown>): Promise<Raw> {
  const client = supabase;
  if (!client) return { ok: false, message: 'La modération n’est pas reliée pour le moment.' };
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) return { ok: false, message: failureText(error.message) };
    return { ok: true, data };
  } catch {
    return { ok: false, message: 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.' };
  }
}

const rows = <T>(data: unknown, read: (row: unknown) => T | null): T[] =>
  Array.isArray(data) ? data.flatMap((row) => read(row) ?? []) : [];

/** Suis-je modérateur éditeur ? Faux au moindre doute (réseau, pas de session). */
export async function amIModerator(): Promise<boolean> {
  const result = await rpc('am_i_app_moderator');
  return result.ok && result.data === true;
}

export async function modQueue(): Promise<{ ok: true; items: ModItem[] } | { ok: false; message: string }> {
  const result = await rpc('mod_queue');
  return result.ok ? { ok: true, items: rows(result.data, readModItem) } : result;
}

export async function modSuspensions(): Promise<{ ok: true; suspensions: Suspension[] } | { ok: false; message: string }> {
  const result = await rpc('mod_suspensions');
  return result.ok ? { ok: true, suspensions: rows(result.data, readSuspension) } : result;
}

export async function modLog(limit = 100): Promise<{ ok: true; entries: LogEntry[] } | { ok: false; message: string }> {
  const result = await rpc('mod_log', { p_limit: limit });
  return result.ok ? { ok: true, entries: rows(result.data, readLogEntry) } : result;
}

type Done = { ok: true } | { ok: false; message: string };
const done = (result: Raw): Done => (result.ok ? { ok: true } : result);

export async function modRestore(item: Pick<ModItem, 'kind' | 'id'>): Promise<Done> {
  return done(await rpc('mod_restore', { p_kind: item.kind, p_id: item.id }));
}

export async function modDismiss(item: Pick<ModItem, 'kind' | 'id'>): Promise<Done> {
  return done(await rpc('mod_dismiss', { p_kind: item.kind, p_id: item.id }));
}

export async function modRemove(item: Pick<ModItem, 'kind' | 'id'>): Promise<Done> {
  return done(await rpc('mod_remove', { p_kind: item.kind, p_id: item.id }));
}

/** Suspend l'auteur de l'élément ; `days: null` : sans fin. */
export async function modSuspend(item: Pick<ModItem, 'kind' | 'id'>, days: number | null, reason: string): Promise<Done> {
  return done(await rpc('mod_suspend', { p_kind: item.kind, p_id: item.id, p_days: days, p_reason: reason.trim() }));
}

export async function modUnsuspend(suspensionId: string): Promise<Done> {
  return done(await rpc('mod_unsuspend', { p_ref: suspensionId }));
}

/** Ma suspension en cours ; `suspension: null` si je ne suis pas suspendu. Échoue en silence hors connexion. */
export async function mySuspension(): Promise<{ ok: true; suspension: MySuspension | null } | { ok: false }> {
  const result = await rpc('my_suspension');
  return result.ok ? { ok: true, suspension: readMySuspension(result.data) } : { ok: false };
}
