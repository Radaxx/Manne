import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  MAX_REMINDED_SLOTS,
  type MyAdorationSlot,
  myAdorationSlots,
  nextSlotsToRemind,
  rangeLabel,
  reminderAt,
  SOON_MIN,
} from './adoration-chain';
import { configure, notificationsSupported, reminderPermissionGranted } from './reminder';
import { supabase } from './supabase';

// Rappels LOCAUX de la chaîne d'adoration : aucun push du serveur. Pour chacun de mes 3 prochains créneaux (toutes chaînes
// confondues), le téléphone programme une notification 10 minutes avant le début. La liste vient de my_adoration_slots ; le
// choix des 3 créneaux (nextSlotsToRemind) et l'heure du rappel se calculent sur le téléphone. Réserver, libérer un créneau ou
// modifier une chaîne resynchronise.
//
// Budget iOS (64 notifications programmées en tout) : 3 rappels de créneau au plus, plus 15 rappels quotidiens
// (src/reminder.ts), 30 rappels de rendez-vous (src/gathering-reminders.ts), 9 rappels de neuvaine
// (src/novena-reminders.ts) et 3 rappels de Rosaire vivant (src/rosary-reminders.ts) = 60, marge de 4.

const PREFIX = 'adoration-';
const CHANNEL = 'chaine-adoration';
export const MAX_REMINDED = MAX_REMINDED_SLOTS;
/** Le plus de rappels de chaîne d'adoration programmés à la fois (pour le budget iOS, vérifié par les tests). */
export const ADORATION_REMINDERS_MAX = MAX_REMINDED;
/** Le rappel arrive 10 minutes avant le début du créneau. */
export const REMINDER_LEAD_MIN = SOON_MIN;

/** Le titre de la notification : « Nuit d’adoration — Fraternité de test ». */
export const reminderTitle = (s: Pick<MyAdorationSlot, 'title' | 'groupName'>) => `${s.title} — ${s.groupName}`;

/** Le texte de la notification : « C’est bientôt ton heure d’adoration : 3 h – 4 h. Touche pour ouvrir la chaîne. » */
export function reminderBody(slot: Pick<MyAdorationSlot, 'startsAt' | 'endsAt'>, zone?: string): string {
  return `C’est bientôt ton heure d’adoration : ${rangeLabel(new Date(slot.startsAt), new Date(slot.endsAt), zone)}. Touche pour ouvrir la chaîne.`;
}

/** Un rappel à programmer. */
export type PlannedReminder = { identifier: string; at: Date; title: string; body: string; chainId: string };

/** Les rappels à programmer : mes 3 prochains créneaux dont le rappel est encore devant nous. Fonction pure ; `zone` sert aux tests. */
export function planAdorationReminders(slots: MyAdorationSlot[], now: Date, zone?: string): PlannedReminder[] {
  return nextSlotsToRemind(slots, now, MAX_REMINDED).map((slot) => ({
    identifier: `${PREFIX}${slot.chainId}-${Date.parse(slot.startsAt)}`,
    at: reminderAt(slot),
    title: reminderTitle(slot),
    body: reminderBody(slot, zone),
    chainId: slot.chainId,
  }));
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Chaîne d’adoration',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Retire les rappels de chaîne d'adoration déjà programmés, et eux seuls : ni le rappel quotidien, ni les rendez-vous, ni les neuvaines, ni le Rosaire. */
async function clearAdorationReminders() {
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

/** Annule tous les rappels de chaîne d'adoration (déconnexion, compte supprimé, plus de profil). */
export function cancelAdorationReminders(): Promise<void> {
  return enqueue(async () => {
    if (!notificationsSupported) return;
    await clearAdorationReminders();
  });
}

/**
 * Récupère mes créneaux d'adoration et reprogramme les rappels.
 *  - Pas de compte relié (lu dans la session, pas dans l'état React) ou profil absent : tous les `adoration-…` sont annulés.
 *  - Hors ligne ou erreur du serveur : on garde ce qui est programmé.
 *  - Notifications non autorisées : on ne programme rien (et on retire ce qui l'était).
 */
export function syncAdorationReminders({ profileMissing = false }: { profileMissing?: boolean } = {}): Promise<void> {
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
      await clearAdorationReminders();
      return;
    }
    const result = await myAdorationSlots();
    if (!result.ok || stale()) return;
    if (!(await reminderPermissionGranted())) {
      await clearAdorationReminders();
      return;
    }
    const planned = planAdorationReminders(result.slots, new Date());
    await ensureChannel();
    await clearAdorationReminders();
    for (const reminder of planned) {
      // Une demande plus récente attend : inutile de finir celle-ci.
      if (stale()) return;
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: reminder.title, body: reminder.body, data: { url: `/adoration-chaine/${reminder.chainId}` } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: CHANNEL },
      });
    }
  });
}

/** `/adoration-chaine/<id>` : l'identifiant d'une chaîne lu dans la donnée d'une notification, ou null. */
export function adorationChainIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^\/adoration-chaine\/([0-9a-fA-F-]{8,40})$/.exec(url);
  return match ? match[1] : null;
}
