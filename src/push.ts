import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { asRecord, call } from './profile';
import { notificationsSupported, requestReminderPermission } from './reminder';

// Notifications push de la communauté (Expo Push Service) et préférences de notification.
//  - Les push sont envoyées par le serveur (Supabase -> Expo -> Google FCM ou Apple APNs) ; elles ne contiennent jamais le
//    texte d'une intention : seulement le type d'événement et le nom du groupe ou le @pseudo.
//  - Les préférences sont gardées CÔTÉ SERVEUR (elles suivent le compte sur tous les appareils). Sans compte relié il n'y en
//    a pas : seul le rappel quotidien, réglé sur l'appareil (src/reminder.ts), fonctionne.
//  - Les rappels programmés par le téléphone (rendez-vous, neuvaines, Rosaire vivant, adoration) lisent ici leur interrupteur.

/** Canal Android des push de la communauté. */
export const PUSH_CHANNEL = 'communaute';

export type PushKey = 'admin' | 'follows' | 'group_life' | 'group_news';
export type LocalKey = 'local_gatherings' | 'local_novenas' | 'local_rosary' | 'local_adoration';
export type PrefKey = PushKey | LocalKey;
export type NotificationPrefs = Record<PrefKey, boolean>;

/** Les valeurs de départ : les mêmes que celles du serveur (get_notification_prefs). */
export const DEFAULT_PREFS: NotificationPrefs = {
  admin: true,
  follows: true,
  group_life: false,
  group_news: false,
  local_gatherings: true,
  local_novenas: true,
  local_rosary: true,
  local_adoration: true,
};

export const PREF_KEYS = Object.keys(DEFAULT_PREFS) as PrefKey[];

export type PrefItem<K extends PrefKey> = { key: K; label: string; hint: string };

/** Les push de la communauté, dans l'ordre de l'écran Notifications. */
export const PUSH_ITEMS: PrefItem<PushKey>[] = [
  {
    key: 'admin',
    label: 'Responsable de groupe',
    hint: 'Une demande pour rejoindre un groupe dont tu es responsable, ou un signalement à traiter.',
  },
  { key: 'follows', label: 'Abonnements', hint: 'Quelqu’un s’abonne à toi.' },
  {
    key: 'group_life',
    label: 'Vie de tes groupes',
    hint: 'Une nouvelle intention dans un de tes groupes, ou une intention que tu portes exaucée.',
  },
  {
    key: 'group_news',
    label: 'Nouveautés de tes groupes',
    hint: 'Un nouveau rendez-vous, une neuvaine, un Rosaire vivant ou une chaîne d’adoration.',
  },
];

/** Les rappels programmés par le téléphone (le rappel quotidien est à part : il se règle sur l'appareil). */
export const LOCAL_ITEMS: PrefItem<LocalKey>[] = [
  { key: 'local_gatherings', label: 'Rendez-vous de groupe', hint: 'À l’heure de début des rendez-vous auxquels tu participes.' },
  { key: 'local_novenas', label: 'Neuvaines', hint: 'Chaque jour, pour les neuvaines où tu as demandé un rappel.' },
  { key: 'local_rosary', label: 'Rosaire vivant', hint: 'Chaque jour, si tu as demandé un rappel pour ta dizaine.' },
  { key: 'local_adoration', label: 'Créneaux d’adoration', hint: '10 minutes avant tes prochains créneaux.' },
];

export const PUSH_UNAVAILABLE = 'Les notifications de la communauté ne sont pas encore disponibles sur cet appareil.';

/** Lit la ligne de get_notification_prefs ; une valeur absente ou mal formée garde son défaut. */
export function readPrefs(row: unknown): NotificationPrefs {
  const record = asRecord(row);
  const prefs = { ...DEFAULT_PREFS };
  if (!record) return prefs;
  for (const key of PREF_KEYS) if (typeof record[key] === 'boolean') prefs[key] = record[key];
  return prefs;
}

// --- Adresses ouvertes au toucher d'une notification -------------------------------------------------------------------

/** Un écran qu'une notification peut ouvrir (jamais une adresse arbitraire). */
export type PushRoute =
  | { pathname: '/groupe/reglages'; params: { id: string } }
  | { pathname: '/profil/[handle]'; params: { handle: string } };

const ID = '[0-9a-fA-F-]{8,40}';

/**
 * `/groupe/reglages?id=<id>` (demande ou signalement) et `/profil/<pseudo>` (abonné). Les autres adresses (`/groupe/<id>`,
 * `/neuvaine/<id>`, `/rosaire/<id>`, `/adoration-chaine/<id>`) sont lues par les modules de rappels, qui les connaissaient déjà.
 */
export function pushRouteFromUrl(url: unknown): PushRoute | null {
  if (typeof url !== 'string') return null;
  const settings = new RegExp(`^/groupe/reglages\\?id=(${ID})$`).exec(url);
  if (settings) return { pathname: '/groupe/reglages', params: { id: settings[1] } };
  const profile = /^\/profil\/([a-z0-9_.]{3,20})$/.exec(url);
  if (profile) return { pathname: '/profil/[handle]', params: { handle: profile[1] } };
  return null;
}

// --- Préférences (serveur) ---------------------------------------------------------------------------------------------

let cached: { at: number; prefs: NotificationPrefs } | null = null;
const CACHE_MS = 60_000;
/** Change à chaque oubli du cache : une lecture partie avant ne peut plus l'écrire après. */
let generation = 0;
let inflightPrefs: Promise<PrefsResult> | null = null;

type PrefsResult = { ok: true; prefs: NotificationPrefs } | { ok: false; message: string };

/** Oublie les préférences lues (changement de compte, déconnexion). */
export function clearPrefsCache() {
  cached = null;
  generation++;
  inflightPrefs = null;
}

export function getPrefs(): Promise<PrefsResult> {
  if (cached && Date.now() - cached.at < CACHE_MS) return Promise.resolve({ ok: true, prefs: cached.prefs });
  // Les appelants simultanés (quatre rappels au lancement) partagent une seule lecture.
  if (inflightPrefs) return inflightPrefs;
  const started = generation;
  const task = (async (): Promise<PrefsResult> => {
    const result = await call('get_notification_prefs');
    if (!result.ok) return result;
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    const prefs = readPrefs(row);
    if (started === generation) cached = { at: Date.now(), prefs };
    return { ok: true, prefs };
  })().finally(() => {
    if (inflightPrefs === task) inflightPrefs = null;
  });
  inflightPrefs = task;
  return task;
}

export async function setPref(key: PrefKey, on: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  clearPrefsCache();
  const result = await call('set_notification_pref', { p_key: key, p_on: on });
  return result.ok ? { ok: true } : result;
}

/**
 * Le rappel local de cette catégorie est-il autorisé ? `null` : on ne sait pas (hors ligne, pas de compte) ; l'appelant
 * garde alors ce qui est déjà programmé.
 */
export async function localReminderAllowed(key: LocalKey): Promise<boolean | null> {
  const result = await getPrefs();
  return result.ok ? result.prefs[key] : null;
}

export async function isGroupMuted(groupId: string): Promise<{ ok: true; muted: boolean } | { ok: false; message: string }> {
  const result = await call('is_group_muted', { p_group: groupId });
  return result.ok ? { ok: true, muted: result.data === true } : result;
}

export async function setGroupMuted(groupId: string, muted: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await call('set_group_muted', { p_group: groupId, p_on: muted });
  return result.ok ? { ok: true } : result;
}

// --- Jeton de l'appareil -----------------------------------------------------------------------------------------------

/**
 *  - `unsupported` : web.
 *  - `denied` : notifications refusées dans les réglages du téléphone.
 *  - `unavailable` : pas de jeton (Firebase non configuré dans cette version, émulateur sans Google Play, hors ligne).
 *  - `ready` : le jeton est enregistré pour ce compte.
 */
export type PushStatus = 'unsupported' | 'denied' | 'unavailable' | 'ready';

let lastToken: string | null = null;
let lastRegistered = 0;
const REREGISTER_MS = 60 * 60 * 1000;

function projectId(): string | undefined {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? undefined;
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: 'Communauté',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Le jeton Expo de cet appareil, ou null (sans erreur) quand il n'est pas disponible. */
async function fetchToken(): Promise<string | null> {
  try {
    const id = projectId();
    if (!id) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  } catch {
    return null;
  }
}

/** Peut-on encore demander l'autorisation ? (jamais demandée : la fenêtre du téléphone s'affichera) */
export async function canAskNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  return !current.granted && current.canAskAgain && current.status === Notifications.PermissionStatus.UNDETERMINED;
}

/**
 * Enregistre le jeton de l'appareil pour le compte relié courant. `ask` : demande l'autorisation si elle ne l'est pas encore
 * (écran Notifications) ; sinon on n'enregistre que si elle est déjà accordée. Ne lève jamais d'erreur.
 */
export async function registerPushToken({ ask = false, force = false }: { ask?: boolean; force?: boolean } = {}): Promise<PushStatus> {
  if (!notificationsSupported) return 'unsupported';
  try {
    await retryPendingUnregister();
    await ensureChannel();
    const granted = ask ? await requestReminderPermission() : (await Notifications.getPermissionsAsync()).granted;
    if (!granted) return 'denied';
    if (!force && lastToken && Date.now() - lastRegistered < REREGISTER_MS) return 'ready';
    const token = await fetchToken();
    if (!token) return 'unavailable';
    const result = await call('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    if (!result.ok) return 'unavailable';
    lastToken = token;
    lastRegistered = Date.now();
    return 'ready';
  } catch {
    return 'unavailable';
  }
}

/** Le téléphone a reçu un nouveau jeton : on le déclare tout de suite. */
export function onPushTokenChanged(listener: () => void): () => void {
  if (!notificationsSupported) return () => {};
  const sub = Notifications.addPushTokenListener(listener);
  return () => sub.remove();
}

const PENDING_UNREGISTER_KEY = 'manne/push/pending-unregister/v1';

/**
 * Le serveur ne supprime que les jetons du compte relié courant : le marqueur ne garde donc que le jeton. Retiré à la
 * déconnexion si le réseau manquait, il est rejoué au prochain enregistrement, avant celui du compte suivant.
 */
async function readPendingUnregister(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_UNREGISTER_KEY);
    const token = raw ? (JSON.parse(raw) as { token?: unknown }).token : null;
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  }
}

async function unregisterOnServer(token: string): Promise<boolean> {
  const result = await call('unregister_push_token', { p_token: token });
  return result.ok;
}

/** Rejoue le retrait resté en attente. Le marqueur ne tombe qu'une fois le serveur d'accord. */
export async function retryPendingUnregister(): Promise<void> {
  const token = await readPendingUnregister();
  if (!token) return;
  try {
    if (await unregisterOnServer(token)) await AsyncStorage.removeItem(PENDING_UNREGISTER_KEY);
  } catch {
    // Reste en attente pour le prochain lancement.
  }
}

/** Déconnexion : retire le jeton de ce téléphone du compte, avant que la session ne soit fermée. Ne lève jamais d'erreur. */
export async function unregisterPushToken(): Promise<void> {
  clearPrefsCache();
  if (!notificationsSupported) return;
  try {
    const token = lastToken ?? (await fetchToken());
    lastToken = null;
    lastRegistered = 0;
    if (!token) return;
    // Noté d'abord : si l'appel échoue (hors ligne) ou que l'app s'arrête, le retrait sera rejoué plus tard.
    await AsyncStorage.setItem(PENDING_UNREGISTER_KEY, JSON.stringify({ token }));
    if (await unregisterOnServer(token)) await AsyncStorage.removeItem(PENDING_UNREGISTER_KEY);
  } catch {
    // Le marqueur (s'il a pu être écrit) fera rejouer le retrait ; sinon le jeton est supprimé après 60 jours sans être revu.
  }
}

/** Compte supprimé : le serveur a déjà tout effacé (cascade), il ne reste qu'à oublier le jeton en mémoire. */
export function forgetPushToken() {
  clearPrefsCache();
  lastToken = null;
  lastRegistered = 0;
}
