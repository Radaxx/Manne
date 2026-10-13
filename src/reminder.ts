import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { VERSES } from './data/content';

// Rappel quotidien : une notification par jour à l'heure choisie, mais seulement les jours où
// l'app n'a pas encore été ouverte. Les notifications locales ne peuvent pas être annulées « à la
// volée » ; on programme donc un rappel daté pour chacun des prochains jours, et chaque ouverture
// de l'app les reprogramme à partir de demain.

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

/** (Re)programme les rappels à partir de demain : l'app est ouverte, inutile de rappeler aujourd'hui. */
export async function scheduleReminders(settings: ReminderSettings) {
  if (!notificationsSupported) return;
  await configure();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled || !(await reminderPermissionGranted())) return;
  const now = new Date();
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, settings.hour, settings.minute);
    await Notifications.scheduleNotificationAsync({
      content: reminderContent(date),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
    });
  }
}
