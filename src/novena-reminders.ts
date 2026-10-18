import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { type DayReminder, dayOfLabel, MAX_REMINDED_NOVENAS, type MyNovena, myNovenas, nextReminderDays } from './novenas';
import { localReminderAllowed } from './push';
import { configure, notificationsSupported, reminderPermissionGranted } from './reminder';
import { supabase } from './supabase';

// Rappels LOCAUX des neuvaines de groupe : aucun push du serveur. Pour chaque neuvaine où l'on a réglé « Me le rappeler
// chaque jour à HHhMM » (l'heure est gardée côté serveur avec l'inscription, donc retrouvée sur un autre appareil), le
// téléphone programme une notification pour chacun des 3 prochains jours NON PRIÉS. Les jours se calculent sur le
// téléphone (nextReminderDays) ; la liste vient de my_novenas. Prier un jour, ou changer le rappel, resynchronise.
//
// Budget iOS (64 notifications programmées en tout) : 3 neuvaines rappelées x 3 jours = 9 au plus, plus 15 rappels
// quotidiens (src/reminder.ts), 30 rappels de rendez-vous (src/gathering-reminders.ts), 3 rappels de Rosaire vivant
// (src/rosary-reminders.ts) et 3 rappels de chaîne d'adoration (src/adoration-reminders.ts) = 60, marge de 4.

const PREFIX = 'novena-';
const CHANNEL = 'neuvaines';
const DAYS_PER_NOVENA = 3;
export const MAX_REMINDED = MAX_REMINDED_NOVENAS;
/** Le plus de rappels de neuvaine programmés à la fois (pour le budget iOS, vérifié par les tests). */
export const NOVENA_REMINDERS_MAX = MAX_REMINDED * DAYS_PER_NOVENA;

/** Le titre de la notification : « Neuvaine à l’Esprit Saint — Fraternité de test ». */
export function reminderTitle(n: Pick<MyNovena, 'title' | 'groupName'>): string {
  return `${n.title} — ${n.groupName}`;
}

/** Le texte de la notification : « Jour 4 sur 9. Touche pour prier. » */
export const reminderBody = (day: number) => `${dayOfLabel(day)}. Touche pour prier.`;

/** Un rappel à programmer. */
export type PlannedReminder = { identifier: string; at: Date; title: string; body: string; novenaId: string; day: number };

/**
 * Les rappels à programmer : pour les `MAX_REMINDED` neuvaines rappelées les plus proches, leurs 3 prochains jours non
 * priés après `now`. Fonction pure ; `deviceZone` sert aux tests.
 */
export function planNovenaReminders(novenas: MyNovena[], now: Date, deviceZone?: string): PlannedReminder[] {
  return novenas
    .map((n) => ({ n, days: nextReminderDays(n, now, DAYS_PER_NOVENA, deviceZone) }))
    .filter(({ days }) => days.length > 0)
    .sort((a, b) => a.days[0].at.getTime() - b.days[0].at.getTime())
    .slice(0, MAX_REMINDED)
    .flatMap(({ n, days }) =>
      days.map(({ day, at }: DayReminder) => ({
        identifier: `${PREFIX}${n.id}-${day}`,
        at,
        title: reminderTitle(n),
        body: reminderBody(day),
        novenaId: n.id,
        day,
      })),
    );
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Neuvaines',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Retire les rappels de neuvaine déjà programmés, et eux seuls : ni le rappel quotidien ni les rendez-vous ne sont touchés. */
async function clearNovenaReminders() {
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

/** Annule tous les rappels de neuvaine (déconnexion, compte supprimé, plus de profil). */
export function cancelNovenaReminders(): Promise<void> {
  return enqueue(async () => {
    if (!notificationsSupported) return;
    await clearNovenaReminders();
  });
}

/**
 * Récupère mes neuvaines et reprogramme les rappels.
 *  - Pas de compte relié (lu dans la session, pas dans l'état React) ou profil absent : tous les `novena-…` sont annulés.
 *  - Hors ligne ou erreur du serveur : on garde ce qui est programmé.
 *  - Notifications non autorisées : on ne programme rien (et on retire ce qui l'était).
 */
export function syncNovenaReminders({ profileMissing = false }: { profileMissing?: boolean } = {}): Promise<void> {
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
      await clearNovenaReminders();
      return;
    }
    // Interrupteur de l'écran Notifications (gardé avec le compte). Hors ligne : on garde ce qui est programmé.
    const allowed = await localReminderAllowed('local_novenas');
    if (allowed === null || stale()) return;
    if (!allowed) {
      await clearNovenaReminders();
      return;
    }
    const result = await myNovenas();
    if (!result.ok || stale()) return;
    if (!(await reminderPermissionGranted())) {
      await clearNovenaReminders();
      return;
    }
    const planned = planNovenaReminders(result.novenas, new Date());
    // Une demande plus récente attend : on n'a encore rien touché, elle s'en chargera. Passé ce point, on efface puis on
    // programme sans s'interrompre (30 appels rapides au plus) : jamais de programme partiel, même si la suivante échoue.
    if (stale()) return;
    await ensureChannel();
    await clearNovenaReminders();
    for (const reminder of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: reminder.body, data: { url: `/neuvaine/${reminder.novenaId}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL },
      });
    }
  });
}

/** `/neuvaine/<id>` : l'identifiant d'une neuvaine lu dans la donnée d'une notification, ou null. */
export function novenaIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/neuvaine\/([0-9a-fA-F-]{8,40})$/.exec(url);
  return match ? match[1] : null;
}
