// Retours des testeurs : un message écrit depuis les réglages, lu par les modérateurs de l'éditeur.
// Fonctions pures (validation, lecteurs, libellés) et appels au serveur (supabase/migrations/019_feedback.sql).

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ensureSession } from './auth/session';
import { failureText } from './publisher-moderation';
import { supabase } from './supabase';

export const FEEDBACK_MAX = 2000;
export const CONTACT_MAX = 200;

export const FEEDBACK_KINDS = ['bug', 'idee', 'autre'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Un bug',
  idee: 'Une idée',
  autre: 'Autre chose',
};

/** Ce que le champ du message propose, selon le type. */
export const FEEDBACK_PLACEHOLDERS: Record<FeedbackKind, string> = {
  bug: 'Ce que tu faisais, ce qui s’est passé, ce que tu attendais',
  idee: 'Ce qui te manque, ce qui t’aiderait',
  autre: 'Ton message',
};

export const feedbackKindLabel = (kind: string): string => FEEDBACK_KIND_LABELS[kind as FeedbackKind] ?? kind;

/** L'appareil qui envoie le retour : la version de l'app et le système. */
export type DeviceInfo = { appVersion: string | null; platform: string; osVersion: string | null };

export function deviceInfo(): DeviceInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
    osVersion: Platform.Version === undefined || Platform.Version === null ? null : String(Platform.Version),
  };
}

/** « Android 15 », « iOS 18.2 », « Web » ; Android donne le niveau d'API, affiché tel quel. */
export function systemLabel(platform: string | null, osVersion: string | null): string {
  const name = platform === 'ios' ? 'iOS' : platform === 'android' ? 'Android' : platform === 'web' ? 'Web' : (platform ?? '');
  if (!name) return '';
  if (!osVersion || platform === 'web') return name;
  return platform === 'android' ? `${name} (API ${osVersion})` : `${name} ${osVersion}`;
}

export type FeedbackDraft = { kind: FeedbackKind; body: string; contact: string };

/** Le message d'erreur à montrer avant l'envoi, ou null si le brouillon peut partir. */
export function draftProblem(draft: FeedbackDraft): string | null {
  const body = draft.body.trim();
  if (!body) return 'Écris ton message.';
  if (body.length > FEEDBACK_MAX) return `Ton message dépasse ${FEEDBACK_MAX} caractères.`;
  if (draft.contact.trim().length > CONTACT_MAX) return `L’adresse dépasse ${CONTACT_MAX} caractères.`;
  return null;
}

/** Les messages du serveur propres aux retours, en français ; le reste suit les messages de la modération. */
export function feedbackFailure(message: string): string {
  if (message.includes('trop_de_retours')) return 'Tu as envoyé beaucoup de retours d’un coup. Réessaie un peu plus tard.';
  if (message.includes('retour_vide')) return 'Écris ton message.';
  if (message.includes('kind_invalide')) return 'Choisis le type de retour.';
  if (message.includes('longueur')) return 'Ton message ou ton adresse est trop long.';
  return failureText(message);
}

const OFFLINE = 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.';

type Done = { ok: true } | { ok: false; message: string };

/** Envoie le retour avec la version de l'app et le système. Ouvre une session anonyme au besoin. */
export async function sendFeedback(draft: FeedbackDraft, device: DeviceInfo = deviceInfo()): Promise<Done> {
  const problem = draftProblem(draft);
  if (problem) return { ok: false, message: problem };
  const client = supabase;
  if (!client) return { ok: false, message: 'Les retours ne sont pas reliés pour le moment.' };
  if (!(await ensureSession())) return { ok: false, message: OFFLINE };
  try {
    const { error } = await client.rpc('send_feedback', {
      p_kind: draft.kind,
      p_body: draft.body.trim(),
      p_contact: draft.contact.trim() || null,
      p_app_version: device.appVersion,
      p_platform: device.platform,
      p_os_version: device.osVersion,
    });
    return error ? { ok: false, message: feedbackFailure(error.message) } : { ok: true };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

/** Un retour, tel que le voit un modérateur de l'éditeur. */
export type Feedback = {
  id: string;
  createdAt: string;
  kind: FeedbackKind;
  body: string;
  contact: string | null;
  appVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  /** Le pseudo de l'auteur ; nul sans profil. */
  handle: string | null;
  /** Envoyé depuis une session anonyme (pas de compte relié). */
  anonymous: boolean;
  resolvedAt: string | null;
};

const asRecord = (row: unknown): Record<string, unknown> | null =>
  row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
const date = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);
const word = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

export function readFeedback(row: unknown): Feedback | null {
  const record = asRecord(row);
  if (!record) return null;
  const id = word(record.id);
  const createdAt = date(record.created_at);
  const kind = FEEDBACK_KINDS.find((k) => k === record.kind);
  if (!id || !createdAt || !kind) return null;
  return {
    id,
    createdAt,
    kind,
    body: typeof record.body === 'string' ? record.body : '',
    contact: word(record.contact),
    appVersion: word(record.app_version),
    platform: word(record.platform),
    osVersion: word(record.os_version),
    handle: word(record.handle),
    anonymous: record.anonymous === true,
    resolvedAt: date(record.resolved_at),
  };
}

/** « @marie », « Compte sans profil » ou « Session anonyme ». */
export function feedbackAuthor(item: Pick<Feedback, 'handle' | 'anonymous'>): string {
  if (item.handle) return `@${item.handle}`;
  return item.anonymous ? 'Session anonyme' : 'Compte sans profil';
}

/** « Manne 1.5.2 · Android (API 35) », ce qui est connu de l'appareil. */
export function feedbackDevice(item: Pick<Feedback, 'appVersion' | 'platform' | 'osVersion'>): string {
  return [item.appVersion ? `Manne ${item.appVersion}` : '', systemLabel(item.platform, item.osVersion)].filter(Boolean).join(' · ');
}

/** Le nombre de retours non classés, pour l'onglet de la modération. */
export function openFeedbackLabel(n: number): string {
  if (n <= 0) return 'Aucun retour à lire';
  return n === 1 ? '1 retour à lire' : `${n} retours à lire`;
}

async function modRpc(fn: string, args?: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { ok: false; message: string }> {
  const client = supabase;
  if (!client) return { ok: false, message: 'La modération n’est pas reliée pour le moment.' };
  try {
    const { data, error } = await client.rpc(fn, args);
    return error ? { ok: false, message: feedbackFailure(error.message) } : { ok: true, data };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

export async function modFeedback(limit = 100): Promise<{ ok: true; items: Feedback[] } | { ok: false; message: string }> {
  const result = await modRpc('mod_feedback', { p_limit: limit });
  if (!result.ok) return result;
  return { ok: true, items: Array.isArray(result.data) ? result.data.flatMap((row) => readFeedback(row) ?? []) : [] };
}

/** Classe le retour (`resolved`), ou le remet parmi ceux à lire. */
export async function modResolveFeedback(id: string, resolved = true): Promise<Done> {
  const result = await modRpc('mod_resolve_feedback', { p_id: id, p_resolved: resolved });
  return result.ok ? { ok: true } : result;
}
