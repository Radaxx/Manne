// Modération communautaire : motifs de signalement, file de signalements d'un groupe, personnes bannies.
// Fonctions pures : les appels au serveur sont dans groups.ts, showcase.ts et community.ts
// (supabase/migrations/015_community_moderation.sql).

/** Les motifs que le serveur connaît, dans l'ordre où l'app les propose. */
export const REPORT_REASONS = ['insulte', 'inapproprie', 'spam', 'autre'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REASON_LABELS: Record<ReportReason, string> = {
  insulte: 'Propos blessants',
  inapproprie: 'Contenu inapproprié',
  spam: 'Publicité ou spam',
  autre: 'Autre raison',
};

export function reasonLabel(reason: ReportReason): string {
  return REASON_LABELS[reason];
}

/** Un motif lu sur le serveur ; tout ce qui n'est pas connu vaut « autre », comme côté serveur. */
export function readReason(value: unknown): ReportReason {
  return REPORT_REASONS.find((reason) => reason === value) ?? 'autre';
}

/** Le texte a été refusé par le filtre du serveur (`contenu_refuse`) : un mot que la charte n'accepte pas. */
export const REFUSED_TEXT = 'Ce texte contient un mot que la charte n’accepte pas. Reformule-le, s’il te plaît.';

/** Une publication est refusée parce que le compte est suspendu (`compte_suspendu`, migration 016). */
export const SUSPENDED_TEXT = 'Ton compte est suspendu : tu ne peux pas publier pour le moment.';

/** Ce que voit le propriétaire d'un profil ou d'une prière de vitrine masqués. */
export const MASKED_NOTE = 'Masqué après plusieurs signalements';

export type ReasonCounts = Record<ReportReason, number>;

/** Une intention de groupe signalée, pas encore traitée. */
export type GroupReport = {
  /** L'identifiant de l'intention. */
  id: string;
  body: string;
  /** Le pseudo de l'auteur ; vide si le compte n'existe plus. */
  handle: string;
  authorRole: 'owner' | 'moderator' | 'member' | null;
  hidden: boolean;
  createdAt: string;
  lastReportedAt: string | null;
  reports: number;
  reasons: ReasonCounts;
};

export type GroupBan = { handle: string; bannedBy: string | null; createdAt: string };

const asRecord = (row: unknown): Record<string, unknown> | null =>
  row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
const nat = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const date = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);

export function readGroupReport(row: unknown): GroupReport | null {
  const record = asRecord(row);
  if (!record) return null;
  const { id, body } = record;
  const createdAt = date(record.created_at);
  if (typeof id !== 'string' || !id || typeof body !== 'string' || !body || !createdAt) return null;
  const reasons: ReasonCounts = {
    insulte: nat(record.insulte),
    inapproprie: nat(record.inapproprie),
    spam: nat(record.spam),
    autre: nat(record.autre),
  };
  const sum = REPORT_REASONS.reduce((total, reason) => total + reasons[reason], 0);
  const role = record.author_role;
  return {
    id,
    body,
    handle: typeof record.handle === 'string' ? record.handle : '',
    authorRole: role === 'owner' || role === 'moderator' || role === 'member' ? role : null,
    hidden: record.hidden === true,
    createdAt,
    lastReportedAt: date(record.last_reported_at),
    // Le total vient du serveur ; à défaut, la somme des motifs.
    reports: Math.max(nat(record.reports), sum),
    reasons,
  };
}

export function readGroupBan(row: unknown): GroupBan | null {
  const record = asRecord(row);
  if (!record) return null;
  const createdAt = date(record.created_at);
  if (typeof record.handle !== 'string' || !record.handle || !createdAt) return null;
  return {
    handle: record.handle,
    bannedBy: typeof record.banned_by === 'string' && record.banned_by ? record.banned_by : null,
    createdAt,
  };
}

/** « Publicité ou spam ×2 · Propos blessants ×1 » : les motifs présents, les plus fréquents d'abord. */
export function reasonSummary(reasons: ReasonCounts): string {
  return REPORT_REASONS.map((reason, order) => ({ reason, order, n: reasons[reason] }))
    .filter((entry) => entry.n > 0)
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .map((entry) => `${reasonLabel(entry.reason)} ×${entry.n}`)
    .join(' · ');
}

/** « 1 signalement à traiter », « 3 signalements à traiter » ; vide s'il n'y en a pas. */
export function pendingReportsLabel(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 signalement à traiter' : `${n} signalements à traiter`;
}

/**
 * Ce que je peux faire à l'auteur d'une intention signalée, comme à la page des membres : le propriétaire exclut tout le
 * monde sauf lui-même et un propriétaire ; un modérateur exclut un simple membre.
 */
export function canActOnAuthor(myRole: 'owner' | 'moderator' | 'member' | null, report: GroupReport, myHandle: string | null): boolean {
  if (!report.handle || report.handle === myHandle || report.authorRole === null || report.authorRole === 'owner') return false;
  if (myRole === 'owner') return true;
  return myRole === 'moderator' && report.authorRole === 'member';
}
