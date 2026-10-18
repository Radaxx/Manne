import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  type DecadeReminder,
  MAX_REMINDED_ROSARIES,
  type MyRosary,
  myRosaries,
  mysteryInSentence,
  nextReminderDays,
  REMINDER_DAYS,
} from './living-rosary';
import { localReminderAllowed } from './push';
import { configure, notificationsSupported, reminderPermissionGranted } from './reminder';
import { supabase } from './supabase';

// Rappels LOCAUX du Rosaire vivant : aucun push du serveur. Pour le Rosaire où l'on a réglé « Me rappeler ma dizaine chaque
// jour à HHhMM » (l'heure est gardée côté serveur avec la participation, donc retrouvée sur un autre appareil), le téléphone
// programme une notification pour chacun des 3 prochains jours (le jour déjà prié n'est pas rappelé). Les jours se calculent
// sur le téléphone (nextReminderDays) ; la liste vient de my_rosaries. Prier sa dizaine, ou changer le rappel, resynchronise.
//
// Budget iOS (64 notifications programmées en tout) : un seul Rosaire vivant rappelé x 3 jours = 3 au plus, plus 15 rappels
// quotidiens (src/reminder.ts), 30 rappels de rendez-vous (src/gathering-reminders.ts) et 9 rappels de neuvaine
// (src/novena-reminders.ts) et 3 rappels de chaîne d'adoration (src/adoration-reminders.ts) = 60, marge de 4.

const PREFIX = 'rosary-';
const CHANNEL = 'rosaire-vivant';
export const MAX_REMINDED = MAX_REMINDED_ROSARIES;
/** Le plus de rappels de Rosaire vivant programmés à la fois (pour le budget iOS, vérifié par les tests). */
export const ROSARY_REMINDERS_MAX = MAX_REMINDED * REMINDER_DAYS;

/** Le titre de la notification : « Rosaire vivant — Fraternité de test ». */
export const reminderTitle = (r: Pick<MyRosary, 'groupName'>) => `Rosaire vivant — ${r.groupName}`;

/** Le texte de la notification : « Ta dizaine : la Visitation. Touche pour prier. » */
export const reminderBody = (mystery: number) => `Ta dizaine : ${mysteryInSentence(mystery)}. Touche pour prier.`;

/** Un rappel à programmer. */
export type PlannedReminder = { identifier: string; at: Date; title: string; body: string; rosaryId: string };

/**
 * Les rappels à programmer : pour le Rosaire rappelé (un seul), ses 3 prochains jours après `now`. Fonction pure ;
 * `deviceZone` sert aux tests.
 */
export function planRosaryReminders(rosaries: MyRosary[], now: Date, deviceZone?: string): PlannedReminder[] {
  return rosaries
    .map((r) => ({ r, days: nextReminderDays(r, now, REMINDER_DAYS, deviceZone) }))
    .filter(({ days }) => days.length > 0)
    .sort((a, b) => a.days[0].at.getTime() - b.days[0].at.getTime())
    .slice(0, MAX_REMINDED)
    .flatMap(({ r, days }) =>
      days.map(({ at, mystery }: DecadeReminder) => ({
        identifier: `${PREFIX}${r.id}-${at.getTime()}`,
        at,
        title: reminderTitle(r),
        body: reminderBody(mystery),
        rosaryId: r.id,
      })),
    );
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Rosaire vivant',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Retire les rappels de Rosaire vivant déjà programmés, et eux seuls : ni le rappel quotidien, ni les rendez-vous, ni les neuvaines. */
async function clearRosaryReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Même file que scheduleReminders : les demandes passent l'une après l'autre, seule la dernière compte.
let pending: Promise<void> = Promise.resolve();
let generation = 0;

function enqueue(task: (stale: () => boolean) => Promise<void>): Promise<void> {
  const gen = ++generation;
  const stale = () => gen !== generation;
  pending = pending.catch(() => {}).then(() => (stale() ? undefined : task(stale)));
  return pending;
}

/** Annule tous les rappels de Rosaire vivant (déconnexion, compte supprimé, plus de profil). */
export function cancelRosaryReminders(): Promise<void> {
  return enqueue(async () => {
    if (!notificationsSupported) return;
    await clearRosaryReminders();
  });
}

/**
 * Récupère mes Rosaires vivants et reprogramme les rappels.
 *  - Pas de compte relié (lu dans la session, pas dans l'état React) ou profil absent : tous les `rosary-…` sont annulés.
 *  - Hors ligne ou erreur du serveur : on garde ce qui est programmé.
 *  - Notifications non autorisées : on ne programme rien (et on retire ce qui l'était).
 */
export function syncRosaryReminders({ profileMissing = false }: { profileMissing?: boolean } = {}): Promise<void> {
  return enqueue(async (stale) => {
    if (!notificationsSupported) return;
    await configure();
    const client = supabase;
    let linked = false;
    if (client) {
      try {
        const { data } = await client.auth.getSession();
        linked = data.session?.user?.is_anonymous === false;
      } catch {
        return; // session illisible : on ne défait rien
      }
    }
    if (stale()) return;
    if (!linked || profileMissing) {
      await clearRosaryReminders();
      return;
    }
    // Interrupteur de l'écran Notifications (gardé avec le compte). Hors ligne : on garde ce qui est programmé.
    const allowed = await localReminderAllowed('local_rosary');
    if (allowed === null || stale()) return;
    if (!allowed) {
      await clearRosaryReminders();
      return;
    }
    const result = await myRosaries();
    if (!result.ok || stale()) return;
    if (!(await reminderPermissionGranted())) {
      await clearRosaryReminders();
      return;
    }
    const planned = planRosaryReminders(result.rosaries, new Date());
    // Une demande plus récente attend : on n'a encore rien touché, elle s'en chargera. Passé ce point, on efface puis on
    // programme sans s'interrompre (30 appels rapides au plus) : jamais de programme partiel, même si la suivante échoue.
    if (stale()) return;
    await ensureChannel();
    await clearRosaryReminders();
    for (const reminder of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: reminder.body, data: { url: `/rosaire/${reminder.rosaryId}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL },
      });
    }
  });
}

/** `/rosaire/<id>` : l'identifiant d'un Rosaire vivant lu dans la donnée d'une notification, ou null. */
export function rosaryIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/rosaire\/([0-9a-fA-F-]{8,40})$/.exec(url);
  return match ? match[1] : null;
}
