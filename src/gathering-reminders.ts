import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { type MyGathering, myGatherings, nextOccurrences } from './gatherings';
import { localReminderAllowed } from './push';
import { configure, notificationsSupported, reminderPermissionGranted } from './reminder';
import { supabase } from './supabase';

// Rappels LOCAUX des rendez-vous de groupe : aucun push du serveur. Pour chaque rendez-vous auquel on s'est inscrit,
// le téléphone programme une notification à l'HEURE DE DÉBUT de ses 2 prochaines occurrences (un seul rappel, pas de
// « 10 minutes avant » : « Je suis là » s'ouvre 10 minutes avant le début, la notification arrive au moment de commencer).
// Les occurrences se calculent sur le téléphone (nextOccurrences) ; la liste des rendez-vous vient de my_gatherings.
//
// Budget iOS (64 notifications programmées en tout) : 15 rendez-vous x 2 occurrences = 30 au plus, plus 15 rappels
// quotidiens au plus (src/reminder.ts), 9 rappels de neuvaine au plus (src/novena-reminders.ts), 3 rappels de Rosaire vivant
// au plus (src/rosary-reminders.ts) et 3 rappels de chaîne d'adoration au plus (src/adoration-reminders.ts) = 60, marge de 4.

const PREFIX = 'gathering-';
const CHANNEL = 'rendez-vous-priere';
const OCCURRENCES = 2;
export const MAX_REMINDED = 15;
/** Le plus de rappels de rendez-vous programmés à la fois (pour le budget iOS, vérifié par les tests). */
export const GATHERING_REMINDERS_MAX = MAX_REMINDED * OCCURRENCES;

export const GATHERING_REMINDER_BODY = 'Le rendez-vous commence. Touche pour dire que tu es là.';

/** Le titre de la notification : « Chapelet — Fraternité de test ». */
export function reminderTitle(g: Pick<MyGathering, 'title' | 'groupName'>): string {
  return `${g.title} — ${g.groupName}`;
}

/** Un rappel à programmer. */
export type PlannedReminder = { identifier: string; at: Date; title: string; groupId: string };

/**
 * Les rappels à programmer : pour les `MAX_REMINDED` rendez-vous les plus proches, leurs 2 prochaines occurrences
 * après `now`. Fonction pure.
 */
export function planReminders(gatherings: MyGathering[], now: Date): PlannedReminder[] {
  return gatherings
    .map((g) => ({ g, starts: nextOccurrences(g, now, OCCURRENCES) }))
    .filter(({ starts }) => starts.length > 0)
    .sort((a, b) => a.starts[0].getTime() - b.starts[0].getTime())
    .slice(0, MAX_REMINDED)
    .flatMap(({ g, starts }) =>
      starts.map((at) => ({ identifier: `${PREFIX}${g.id}-${at.getTime()}`, at, title: reminderTitle(g), groupId: g.groupId })),
    );
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Rendez-vous de prière',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Retire les rappels de rendez-vous déjà programmés, et eux seuls : le rappel quotidien n'est jamais touché. */
async function clearGatheringReminders() {
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

/** Annule tous les rappels de rendez-vous (déconnexion, compte supprimé, plus de profil). */
export function cancelGatheringReminders(): Promise<void> {
  return enqueue(async () => {
    if (!notificationsSupported) return;
    await clearGatheringReminders();
  });
}

/**
 * Récupère mes rendez-vous et reprogramme les rappels.
 *  - Pas de compte relié (lu dans la session, pas dans l'état React) ou profil absent : tout est annulé.
 *  - Hors ligne ou erreur du serveur : on garde ce qui est programmé.
 *  - Notifications non autorisées : on ne programme rien (et on retire ce qui l'était).
 */
export function syncGatheringReminders({ profileMissing = false }: { profileMissing?: boolean } = {}): Promise<void> {
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
      await clearGatheringReminders();
      return;
    }
    // Interrupteur de l'écran Notifications (gardé avec le compte). Hors ligne : on garde ce qui est programmé.
    const allowed = await localReminderAllowed('local_gatherings');
    if (allowed === null || stale()) return;
    if (!allowed) {
      await clearGatheringReminders();
      return;
    }
    const result = await myGatherings();
    if (!result.ok || stale()) return;
    if (!(await reminderPermissionGranted())) {
      await clearGatheringReminders();
      return;
    }
    const planned = planReminders(result.gatherings, new Date());
    await ensureChannel();
    await clearGatheringReminders();
    for (const reminder of planned) {
      // Une demande plus récente attend : inutile de finir celle-ci.
      if (stale()) return;
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: GATHERING_REMINDER_BODY, data: { url: `/groupe/${reminder.groupId}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL },
      });
    }
  });
}

/** `/groupe/<id>` : l'identifiant d'un groupe lu dans la donnée d'une notification, ou null. */
export function groupIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/groupe\/([0-9a-fA-F-]{8,40})$/.exec(url);
  return match ? match[1] : null;
}
