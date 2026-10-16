import { localDate, longDate } from './dates';
import { asRecord, call, type Result, readRows } from './profile';

// Groupes de prière. Être membre demande un compte relié ET un profil : le pseudo est vu des autres membres.
// Tout passe par des fonctions du serveur (supabase/migrations/008_groups.sql) ; rien n'est gardé sur le téléphone.

export type GroupKind = 'fraternite' | 'communaute' | 'ephemere';
export type GroupRole = 'owner' | 'moderator' | 'member';
/** Ma situation devant un groupe : membre, demande envoyée, ou rien. */
export type MyStatus = 'member' | 'requested' | 'none';

export const NAME_MIN = 3;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 280;
export const INTENTION_MAX = 280;
export const THANKS_MAX = 280;
export const MAX_MEMBERS = 200;
export const MAX_GROUPS = 20;
export const MAX_END_DAYS = 365;

/** Un groupe dont je suis membre (« Mes groupes »). */
export type MyGroup = {
  id: string;
  name: string;
  description: string;
  kind: GroupKind;
  endsAt: string | null;
  ended: boolean;
  role: GroupRole;
  memberCount: number;
  pendingRequests: number;
};

/** Ce qu'un non-membre voit : nom, description, type, nombre de membres, date de fin. */
export type GroupCard = {
  id: string;
  name: string;
  description: string;
  kind: GroupKind;
  endsAt: string | null;
  ended: boolean;
  memberCount: number;
  myStatus: MyStatus;
};

/** Une carte venue d'un code d'invitation : on sait en plus si le groupe est complet. */
export type InvitedGroup = GroupCard & { full: boolean };

/** Le détail d'un groupe : le code d'invitation et le rôle ne sont renseignés que pour un membre. */
export type GroupDetail = GroupCard & {
  myRole: GroupRole | null;
  inviteCode: string | null;
  pendingRequests: number;
};

export type GroupMember = { handle: string; role: GroupRole; joinedAt: string; mine: boolean };
export type GroupRequest = { handle: string; createdAt: string };

export type GroupIntention = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  handle: string;
  carries: number;
  carrying: boolean;
  answeredAt: string | null;
  thanks: string | null;
  hidden: boolean;
  /** Le titre du rendez-vous dont la salle de prière a vu naître l'intention ; nul sinon. */
  gatheringTitle: string | null;
};

// ---------------------------------------------------------------------------------------------------------------
// Libellés et validation (fonctions pures)
// ---------------------------------------------------------------------------------------------------------------

export const KIND_ORDER: GroupKind[] = ['fraternite', 'communaute', 'ephemere'];

const KIND_LABELS: Record<GroupKind, string> = {
  fraternite: 'Fraternité',
  communaute: 'Communauté',
  ephemere: 'Groupe éphémère',
};

/** Une phrase par type : qui peut trouver le groupe, qui peut y entrer. Mot pour mot ce que fait le serveur. */
export const KIND_HELP: Record<GroupKind, string> = {
  fraternite: 'Privée et introuvable : on n’y entre qu’avec le code ou le lien d’invitation, sans validation.',
  communaute:
    'Trouvable par son nom : on envoie une demande, que le propriétaire ou un modérateur accepte ou refuse. Le code ou le lien d’invitation fait entrer directement.',
  ephemere:
    'Trouvable par son nom : on y entre tout de suite, jusqu’à la date de fin. Ensuite le groupe reste en lecture seule et n’apparaît plus dans la recherche.',
};

export function kindLabel(kind: GroupKind): string {
  return KIND_LABELS[kind];
}

const ROLE_LABELS: Record<GroupRole, string> = { owner: 'Propriétaire', moderator: 'Modérateur', member: 'Membre' };

export function roleLabel(role: GroupRole): string {
  return ROLE_LABELS[role];
}

/** Propriétaire ou modérateur : peut traiter les demandes, retirer une intention, exclure un membre. */
export function canModerate(role: GroupRole | null | undefined): boolean {
  return role === 'owner' || role === 'moderator';
}

export function memberCountLabel(n: number): string {
  return n === 1 ? '1 membre' : `${n} membres`;
}

/** Pourquoi ce nom est refusé, en français, ou null s'il convient. */
export function nameProblem(value: string): string | null {
  const name = value.trim();
  if (name.length < NAME_MIN) return `Le nom fait au moins ${NAME_MIN} caractères.`;
  if (name.length > NAME_MAX) return `Le nom fait ${NAME_MAX} caractères au plus.`;
  return null;
}

export function descriptionProblem(value: string): string | null {
  return value.trim().length > DESCRIPTION_MAX ? `La description fait ${DESCRIPTION_MAX} caractères au plus.` : null;
}

/** Pourquoi cette date de fin est refusée (il en faut une dans le futur, à un an au plus), ou null. */
export function endsAtProblem(endsAt: Date | null, now: Date = new Date()): string | null {
  if (!endsAt || Number.isNaN(endsAt.getTime())) return 'Choisis une date de fin.';
  if (endsAt.getTime() <= now.getTime()) return 'La date de fin doit être dans le futur.';
  if (endsAt.getTime() > now.getTime() + MAX_END_DAYS * 86_400_000) return 'La date de fin est dans un an au plus.';
  return null;
}

/** Les durées proposées pour un groupe éphémère : une neuvaine, quarante jours, un mois, trois mois. */
export const END_CHOICES = [
  { id: '9j', label: '9 jours', days: 9, months: 0 },
  { id: '40j', label: '40 jours', days: 40, months: 0 },
  { id: '1m', label: '1 mois', days: 0, months: 1 },
  { id: '3m', label: '3 mois', days: 0, months: 3 },
] as const;
export type EndChoiceId = (typeof END_CHOICES)[number]['id'];

/** La fin d'un groupe éphémère : le soir (23 h 59, heure locale) du jour qui tombe après la durée choisie. */
export function endDateFor(choice: EndChoiceId, now: Date = new Date()): Date {
  const found = END_CHOICES.find((c) => c.id === choice) ?? END_CHOICES[0];
  return new Date(now.getFullYear(), now.getMonth() + found.months, now.getDate() + found.days, 23, 59, 0, 0);
}

/** Le groupe est-il terminé (lecture seule) ? Sans date de fin, jamais. */
export function isGroupEnded(endsAt: string | null, now: number = Date.now()): boolean {
  if (!endsAt) return false;
  const time = Date.parse(endsAt);
  return Number.isFinite(time) && time <= now;
}

/** « Se termine le 13 octobre 2026 » ou « Terminé le 13 octobre 2026 » ; null sans date de fin. */
export function endLabel(endsAt: string | null, now: number = Date.now()): string | null {
  if (!endsAt) return null;
  const time = Date.parse(endsAt);
  if (!Number.isFinite(time)) return null;
  const day = longDate(localDate(new Date(time)));
  return time <= now ? `Terminé le ${day}` : `Se termine le ${day}`;
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

/** Ce que le serveur compare : majuscules, sans espace, tiret ni autre séparateur. */
export function normalizeInviteCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Un code de la forme que le serveur génère : 8 caractères, ni 0, ni O, ni 1, ni I. */
export function isInviteCode(value: string): boolean {
  const code = normalizeInviteCode(value);
  return code.length === INVITE_LENGTH && [...code].every((char) => INVITE_ALPHABET.includes(char));
}

/** « ABCD-EFGH » : plus lisible à dicter ; la saisie tolère le tiret. */
export function formatInviteCode(value: string): string {
  const code = normalizeInviteCode(value);
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Le lien d'invitation : il ouvre l'écran « Rejoindre » de l'app (schéma `manne`). */
export function inviteLink(value: string): string {
  return `manne://rejoindre/${normalizeInviteCode(value)}`;
}

/** Le message à partager : le lien et le code en clair. */
export function inviteMessage(name: string, code: string): string {
  return `Rejoins « ${name.trim()} » sur Manne : ${inviteLink(code)}\nCode d’invitation : ${formatInviteCode(code)}`;
}

/** Extrait le paramètre d'une route dynamique, qui peut arriver en tableau. */
export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

// ---------------------------------------------------------------------------------------------------------------
// Lecteurs de lignes (défensifs : une ligne inattendue est ignorée, jamais une erreur)
// ---------------------------------------------------------------------------------------------------------------

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const optStr = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);
const nat = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};
const date = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);

export function readKind(value: unknown): GroupKind | null {
  return value === 'fraternite' || value === 'communaute' || value === 'ephemere' ? value : null;
}

export function readRole(value: unknown): GroupRole | null {
  return value === 'owner' || value === 'moderator' || value === 'member' ? value : null;
}

export function readStatus(value: unknown): MyStatus | null {
  return value === 'member' || value === 'requested' || value === 'none' ? value : null;
}

function readCardRow(record: Record<string, unknown>): GroupCard | null {
  const id = str(record.id);
  const name = str(record.name);
  const kind = readKind(record.kind);
  const memberCount = nat(record.member_count);
  const myStatus = readStatus(record.my_status);
  if (!id || !name || !kind || memberCount === null || !myStatus) return null;
  const endsAt = record.ends_at === null || record.ends_at === undefined ? null : date(record.ends_at);
  // Un groupe éphémère sans date lisible n'a pas de sens : on ne le montre pas.
  if (kind === 'ephemere' && !endsAt) return null;
  return {
    id,
    name,
    description: typeof record.description === 'string' ? record.description : '',
    kind,
    endsAt,
    ended: record.ended === true || isGroupEnded(endsAt),
    memberCount,
    myStatus,
  };
}

export function readGroupCard(row: unknown): GroupCard | null {
  const record = asRecord(row);
  return record ? readCardRow(record) : null;
}

export function readInvitedGroup(row: unknown): InvitedGroup | null {
  const record = asRecord(row);
  const card = record ? readCardRow(record) : null;
  if (!record || !card) return null;
  return { ...card, full: record.is_full === true };
}

export function readGroupDetail(row: unknown): GroupDetail | null {
  const record = asRecord(row);
  const card = record ? readCardRow(record) : null;
  if (!record || !card) return null;
  const myRole = readRole(record.my_role);
  // Le code n'est donné qu'à un membre : sans rôle, on l'ignore même si le serveur en envoyait un.
  const inviteCode = myRole ? str(record.invite_code) : null;
  return { ...card, myRole, inviteCode, pendingRequests: myRole && canModerate(myRole) ? (nat(record.pending_requests) ?? 0) : 0 };
}

export function readMyGroup(row: unknown): MyGroup | null {
  const record = asRecord(row);
  if (!record) return null;
  const role = readRole(record.role);
  const card = readCardRow({ ...record, my_status: 'member' });
  if (!role || !card) return null;
  return {
    id: card.id,
    name: card.name,
    description: card.description,
    kind: card.kind,
    endsAt: card.endsAt,
    ended: card.ended,
    memberCount: card.memberCount,
    role,
    pendingRequests: canModerate(role) ? (nat(record.pending_requests) ?? 0) : 0,
  };
}

export function readMember(row: unknown): GroupMember | null {
  const record = asRecord(row);
  if (!record) return null;
  const handle = str(record.handle);
  const role = readRole(record.role);
  const joinedAt = date(record.joined_at);
  if (!handle || !role || !joinedAt) return null;
  return { handle, role, joinedAt, mine: record.mine === true };
}

export function readRequest(row: unknown): GroupRequest | null {
  const record = asRecord(row);
  if (!record) return null;
  const handle = str(record.handle);
  const createdAt = date(record.created_at);
  return handle && createdAt ? { handle, createdAt } : null;
}

export function readGroupIntention(row: unknown): GroupIntention | null {
  const record = asRecord(row);
  if (!record) return null;
  const id = str(record.id);
  const body = str(record.body);
  const createdAt = date(record.created_at);
  const carries = nat(record.carries);
  if (!id || !body || !createdAt || carries === null) return null;
  const answeredAt = record.answered_at === null || record.answered_at === undefined ? null : date(record.answered_at);
  return {
    id,
    body,
    createdAt,
    mine: record.mine === true,
    handle: typeof record.handle === 'string' ? record.handle : '',
    carries,
    carrying: record.carrying === true,
    answeredAt,
    // Un mot d'action de grâce n'a de sens que sur une intention exaucée.
    thanks: answeredAt ? optStr(record.thanks) : null,
    hidden: record.hidden === true,
    gatheringTitle: optStr(record.gathering_title),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };
type Listed<K extends string, T> = ({ ok: true } & { [P in K]: T }) | Failure;

async function list<T, K extends string>(
  fn: string,
  args: Record<string, unknown> | undefined,
  read: (row: unknown) => T | null,
  key: K,
): Promise<Listed<K, T[]>> {
  const result = await call(fn, args);
  if (!result.ok) return result;
  return { ok: true, [key]: readRows(result.data, read) } as Listed<K, T[]>;
}

export type NewGroup = { name: string; description: string; kind: GroupKind; endsAt: Date | null };

/** Crée un groupe : en cas de succès, `data` est l'identifiant du groupe. */
export async function createGroup(input: NewGroup): Promise<Result> {
  return call('create_group', {
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_kind: input.kind,
    p_ends_at: input.kind === 'ephemere' && input.endsAt ? input.endsAt.toISOString() : null,
  });
}

export function updateGroup(id: string, name: string, description: string) {
  return call('update_group', { p_id: id, p_name: name.trim(), p_description: description.trim() });
}

export function deleteGroup(id: string) {
  return call('delete_group', { p_id: id });
}

/** Un nouveau code : `data` est le code. L'ancien code, et donc l'ancien lien, ne marche plus. */
export function regenerateInvite(id: string) {
  return call('regenerate_invite', { p_id: id });
}

export function listMyGroups() {
  return list('my_groups', undefined, readMyGroup, 'groups');
}

export async function getGroup(id: string): Promise<{ ok: true; group: GroupDetail | null } | Failure> {
  const result = await call('get_group', { p_id: id });
  if (!result.ok) return result;
  return { ok: true, group: readRows(result.data, readGroupDetail)[0] ?? null };
}

/** `group: null` : aucun groupe ne porte ce code. */
export async function groupByCode(code: string): Promise<{ ok: true; group: InvitedGroup | null } | Failure> {
  const result = await call('group_by_code', { p_code: normalizeInviteCode(code) });
  if (!result.ok) return result;
  return { ok: true, group: readRows(result.data, readInvitedGroup)[0] ?? null };
}

/** Entre avec un code : `groupId` est nul si le code est inconnu. */
export async function joinByCode(code: string): Promise<{ ok: true; groupId: string | null } | Failure> {
  const result = await call('join_by_code', { p_code: normalizeInviteCode(code) });
  if (!result.ok) return result;
  return { ok: true, groupId: str(result.data) };
}

export function searchGroups(query: string) {
  return list('search_groups', { p_query: query.trim() }, readGroupCard, 'groups');
}

export function joinGroup(id: string) {
  return call('join_group', { p_id: id });
}

export function requestJoin(id: string) {
  return call('request_join', { p_id: id });
}

export function cancelRequest(id: string) {
  return call('cancel_request', { p_id: id });
}

export function listRequests(id: string) {
  return list('list_requests', { p_id: id }, readRequest, 'requests');
}

export function answerRequest(id: string, handle: string, accept: boolean) {
  return call('answer_request', { p_id: id, p_handle: handle, p_accept: accept });
}

export function listMembers(id: string) {
  return list('list_members', { p_id: id }, readMember, 'members');
}

export function setRole(id: string, handle: string, role: 'moderator' | 'member') {
  return call('set_role', { p_id: id, p_handle: handle, p_role: role });
}

export function transferOwnership(id: string, handle: string) {
  return call('transfer_ownership', { p_id: id, p_handle: handle });
}

export function removeMember(id: string, handle: string) {
  return call('remove_member', { p_id: id, p_handle: handle });
}

export function leaveGroup(id: string) {
  return call('leave_group', { p_id: id });
}

export function listGroupIntentions(id: string) {
  return list('list_group_intentions', { p_id: id }, readGroupIntention, 'intentions');
}

export function postGroupIntention(id: string, body: string) {
  return call('post_group_intention', { p_id: id, p_body: body.trim() });
}

export function withdrawGroupIntention(intentionId: string) {
  return call('withdraw_group_intention', { p_intention_id: intentionId });
}

/** Marque l'intention exaucée, avec un mot d'action de grâce facultatif. */
export function markAnswered(intentionId: string, thanks: string) {
  return call('mark_answered', { p_intention_id: intentionId, p_thanks: thanks.trim() || null });
}

export function setGroupCarry(intentionId: string, on: boolean) {
  return call('set_group_carry', { p_intention_id: intentionId, p_on: on });
}

export function reportGroupIntention(intentionId: string) {
  return call('report_group_intention', { p_intention_id: intentionId });
}

/** Modération : le propriétaire ou un modérateur retire l'intention d'un membre. */
export function removeGroupIntention(intentionId: string) {
  return call('remove_group_intention', { p_intention_id: intentionId });
}
