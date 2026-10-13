import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { VERSES } from './data/content';

// Rappel quotidien à l'heure choisie. Ouvrir l'app ne suffit plus : le rappel d'aujourd'hui part
// encore si la journée (Évangile, lecture, prière) n'est pas faite et que l'heure est devant nous.
// Les notifications locales ne s'annulent pas toutes seules ; chaque ouverture reprogramme la suite.

export type ReminderSettings = { enabled: boolean; hour: number; minute: number };

export const DEFAULT_REMINDER: ReminderSettings = { enabled: false, hour: 8, minute: 0 };

export const REMINDER_TIMES: [number, number][] = [
  [7, 0],
  [8, 0],
  [12, 30],
  [18, 0],
  [20, 0],
  [21, 30],
];

export const formatTime = (h: number, m: number) => `${h}h${m ? String(m).padStart(2, '0') : ''}`;

export const notificationsSupported = Platform.OS !== 'web';

const CHANNEL = 'rappel-quotidien';
const DAYS_AHEAD = 30; // iOS limite à 64 notifications programmées

const TITLES = [
  'Ta manne du jour t’attend',
  'Une parole pour aujourd’hui',
  'Quelques versets avant de scroller ailleurs ?',
  'Prends un instant avec Dieu',
];

// Versets assez courts pour tenir dans une notification.
const SHORT_VERSES = VERSES.filter((v) => v.text.length <= 110);

/** Contenu du rappel d'un jour donné : un titre et un verset, qui changent chaque jour. */
export function reminderContent(date: Date) {
  const n = Math.floor(date.getTime() / 86_400_000);
  const verse = SHORT_VERSES[n % SHORT_VERSES.length];
  return { title: TITLES[n % TITLES.length], body: `« ${verse.text} » — ${verse.reference}` };
}

let configured = false;

async function configure() {
  if (configured || !notificationsSupported) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rappel quotidien',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Demande l'autorisation d'envoyer des notifications ; renvoie true si elle est accordée. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  await configure();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function reminderPermissionGranted(): Promise<boolean> {
  if (!notificationsSupported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

let pending: Promise<void> = Promise.resolve();
let generation = 0;

/**
 * Reprogramme les rappels. Aujourd'hui est inclus tant que la journée est incomplète et l'heure à venir.
 * Les appels passent l'un après l'autre et seul le dernier demandé compte : deux programmations mêlées
 * laisseraient des rappels en double.
 */
export function scheduleReminders(settings: ReminderSettings, todayDone = false): Promise<void> {
  const gen = ++generation;
  const stale = () => gen !== generation;
  pending = pending.catch(() => {}).then(() => (stale() ? undefined : reschedule(settings, todayDone, stale)));
  return pending;
}

async function reschedule(settings: ReminderSettings, todayDone: boolean, stale: () => boolean) {
  if (!notificationsSupported) return;
  await configure();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled || !(await reminderPermissionGranted())) return;
  const now = new Date();
  const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), settings.hour, settings.minute);
  const first = !todayDone && todayAt.getTime() > now.getTime() ? 0 : 1;
  for (let d = first; d <= DAYS_AHEAD; d++) {
    // Une demande plus récente attend : elle repartira de zéro, inutile de finir celle-ci.
    if (stale()) return;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, settings.hour, settings.minute);
    await Notifications.scheduleNotificationAsync({
      content: reminderContent(date),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
    });
  }
}
