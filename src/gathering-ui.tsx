import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { WEEKDAYS } from './dates';
import {
  durationLabel,
  endTimeLabel,
  type Gathering,
  gatheringsChanged,
  myGatherings,
  occurrenceLabel,
  participantsLabel,
  prayerKindLabel,
  presentLabel,
  type Upcoming,
  upcomingGatherings,
  whenLabel,
  zoneMention,
} from './gatherings';
import { openGroup, openRoom } from './group-ui';
import { Button } from './profile-ui';
import { notificationsSupported, reminderPermissionGranted, requestReminderPermission } from './reminder';
import { Text } from './text';
import { useThemed } from './theme';

/** Les notifications sont-elles autorisées ? `null` : on ne sait pas encore. Toujours faux sur le web. */
export function useReminderPermission() {
  const [granted, setGranted] = useState<boolean | null>(notificationsSupported ? null : false);

  useFocusEffect(
    useCallback(() => {
      if (notificationsSupported) void reminderPermissionGranted().then(setGranted);
    }, []),
  );

  const ask = useCallback(async () => {
    const ok = await requestReminderPermission();
    setGranted(ok);
    if (ok) gatheringsChanged();
    // Refusé pour de bon : seul le réglage du téléphone peut encore l'accorder.
    else void Linking.openSettings().catch(() => {});
    return ok;
  }, []);

  return { granted, ask };
}

/** Sous le bouton « Je participe » : ce qui se passera pour le rappel, mot pour mot ce que fait l'app. */
function reminderNote(granted: boolean | null): string | null {
  if (!notificationsSupported) return 'Les rappels ne sont disponibles que dans l’app sur téléphone.';
  if (granted === null) return null;
  return granted ? 'Tu recevras un rappel sur ce téléphone.' : 'Autorise les notifications pour recevoir un rappel sur ce téléphone.';
}

const PRAYER_ICONS: Record<Exclude<Gathering['prayerKind'], 'libre'>, keyof typeof Ionicons.glyphMap> = {
  chapelet: 'ellipse-outline',
  office: 'book-outline',
  adoration: 'sunny-outline',
};

export function GatheringCard({
  gathering,
  granted,
  ended,
  canManage,
  busy,
  onParticipate,
  onPresent,
  onEnterRoom,
  onEdit,
  onCancel,
}: {
  gathering: Gathering;
  granted: boolean | null;
  ended: boolean;
  canManage: boolean;
  /** L'action en cours sur CE rendez-vous (les autres cartes ne sont pas touchées). */
  busy: 'participate' | 'present' | null;
  onParticipate: (on: boolean) => void;
  onPresent: () => void;
  onEnterRoom: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const now = new Date();
  const mention = zoneMention(gathering, now);
  const current = gathering.currentStart ? new Date(gathering.currentStart) : null;
  const note = gathering.participating ? reminderNote(granted) : null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{gathering.title}</Text>
      <Text style={styles.when}>{whenLabel(gathering, now)}</Text>
      {mention ? <Text style={styles.hint}>{mention}</Text> : null}
      <Text style={styles.hint}>
        {durationLabel(gathering.durationMin)} · {participantsLabel(gathering.participantCount)}
      </Text>
      {gathering.prayerKind !== 'libre' ? (
        <View style={styles.kind}>
          <Ionicons name={PRAYER_ICONS[gathering.prayerKind]} size={14} color={C.muted} />
          <Text style={styles.hint}>{prayerKindLabel(gathering.prayerKind)}</Text>
        </View>
      ) : null}
      {gathering.description ? <Text style={styles.description}>{gathering.description}</Text> : null}

      {current ? (
        <View style={styles.live}>
          <View style={styles.liveHead}>
            <Ionicons name="radio-button-on" size={16} color={C.gold} />
            <Text style={styles.liveTitle}>En cours</Text>
            <Text style={styles.liveEnd}>jusqu’à {endTimeLabel(current, gathering.durationMin)}</Text>
          </View>
          <View style={styles.liveRow}>
            {gathering.present ? (
              <View style={styles.here}>
                <Ionicons name="checkmark-circle" size={16} color={C.onGold} />
                <Text style={styles.hereText}>Tu es là</Text>
              </View>
            ) : (
              <Pressable
                onPress={onPresent}
                disabled={!!busy || ended}
                style={[styles.presentBtn, (!!busy || ended) && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <Text style={styles.presentText}>Je suis là</Text>
              </Pressable>
            )}
            <Text style={styles.count}>{presentLabel(gathering.presentCount)}</Text>
          </View>
          {gathering.present && !ended ? <Button label="Entrer dans la salle" onPress={onEnterRoom} /> : null}
        </View>
      ) : null}

      {gathering.participating ? (
        <Button
          label="Je ne participe plus"
          kind="secondary"
          busy={busy === 'participate'}
          disabled={!!busy}
          onPress={() => onParticipate(false)}
        />
      ) : ended ? null : (
        <Button label="Je participe" busy={busy === 'participate'} disabled={!!busy} onPress={() => onParticipate(true)} />
      )}
      {note ? <Text style={styles.hint}>{note}</Text> : null}

      {canManage ? (
        <View style={styles.manage}>
          {ended ? null : (
            <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel={`Modifier le rendez-vous ${gathering.title}`}>
              <Text style={styles.link}>Modifier</Text>
            </Pressable>
          )}
          <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel={`Annuler le rendez-vous ${gathering.title}`}>
            <Text style={styles.link}>Annuler le rendez-vous</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Le bouton qui demande l'autorisation des notifications, affiché seulement si elle manque. */
export function AllowNotifications({ granted, ask }: { granted: boolean | null; ask: () => Promise<boolean> }) {
  const { styles } = useThemed(stylesFor);
  if (!notificationsSupported || granted !== false) return null;
  return (
    <View style={styles.allow}>
      <Text style={styles.hint}>Les notifications sont désactivées pour Manne : tu ne recevras pas de rappel.</Text>
      <Button label="Autoriser les notifications" kind="secondary" onPress={() => void ask()} />
    </View>
  );
}

/**
 * Android 14+ n'accorde plus d'office les alarmes exactes : l'heure exacte d'un rappel dépend de « Alarmes et rappels »
 * dans les réglages du téléphone. L'app ne peut pas lire cet état sans module natif : la phrase reste vraie accordé ou non.
 */
export function ExactAlarmNote({ visible, spaced }: { visible: boolean; spaced?: boolean }) {
  const { styles } = useThemed(stylesFor);
  if (Platform.OS !== 'android' || !notificationsSupported || !visible) return null;
  return (
    <View style={[styles.allow, spaced && { marginTop: 12 }]}>
      <Text style={styles.hint}>
        Pour que le rappel arrive à l’heure exacte, autorise « Alarmes et rappels » pour Manne dans les réglages du téléphone.
      </Text>
      <Pressable onPress={() => Linking.openSettings().catch(() => {})} hitSlop={8} accessibilityRole="link">
        <Text style={styles.settingsLink}>Ouvrir les réglages</Text>
      </Pressable>
    </View>
  );
}

/**
 * Mes 3 prochains rendez-vous (ceux où je suis inscrit), rafraîchis à chaque retour sur l'écran. Rien (liste vide) si
 * `enabled` est faux, si je n'en ai aucun ou si le serveur ne répond pas : aucune erreur n'est montrée.
 */
export function useUpcomingGatherings(enabled: boolean): Upcoming[] {
  const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setUpcoming([]);
        return;
      }
      let live = true;
      void myGatherings()
        .then((result) => {
          if (live) setUpcoming(result.ok ? upcomingGatherings(result.gatherings, new Date()) : []);
        })
        .catch(() => {
          if (live) setUpcoming([]);
        });
      return () => {
        live = false;
      };
    }, [enabled]),
  );
  return upcoming;
}

const openMeeting = ({ gathering, current }: Upcoming) =>
  current && gathering.present ? openRoom(gathering.id) : openGroup(gathering.groupId);

/** Le jour du rendez-vous dans un carré : « VEN. » puis « 16 ». */
function DateBadge({ at }: { at: Date }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.badge} accessible={false}>
      <Text style={styles.badgeDay}>{`${WEEKDAYS[at.getDay()].slice(0, 3)}.`.toUpperCase()}</Text>
      <Text style={styles.badgeNum}>{at.getDate()}</Text>
    </View>
  );
}

/**
 * Les prochains rendez-vous en lignes, à poser dans une carte : un toucher ouvre le groupe, ou la salle de
 * prière d'un rendez-vous en cours où l'on est présent.
 */
export function UpcomingGatheringRows({ items }: { items: Upcoming[] }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <>
      {items.map((item) => {
        const { gathering, at, current } = item;
        return (
          <Pressable
            key={gathering.id}
            onPress={() => openMeeting(item)}
            style={({ pressed }) => [styles.meeting, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <DateBadge at={at} />
            <View style={{ flex: 1 }}>
              <Text style={styles.meetingTitle} numberOfLines={1}>
                {gathering.title}
              </Text>
              <Text style={styles.meetingSub} numberOfLines={2}>
                {current ? <Text style={styles.meetingLive}>En cours</Text> : occurrenceLabel(at)} · {gathering.groupName}
              </Text>
              {current && gathering.present ? <Text style={styles.meetingLive}>Entrer dans la salle</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        );
      })}
    </>
  );
}

/** Les prochains rendez-vous en cartes à faire défiler (l'accueil). */
export function UpcomingGatheringCards({ items }: { items: Upcoming[] }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <>
      {items.map((item) => {
        const { gathering, at, current } = item;
        return (
          <Pressable
            key={gathering.id}
            onPress={() => openMeeting(item)}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <View style={styles.tileKicker}>
              <Ionicons name={current ? 'radio-button-on' : 'time-outline'} size={14} color={C.gold} />
              <Text style={styles.tileKickerText} numberOfLines={1}>
                {current ? 'EN COURS' : occurrenceLabel(at).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {gathering.title}
            </Text>
            <Text style={styles.meetingSub} numberOfLines={1}>
              {gathering.groupName}
            </Text>
            {current && gathering.present ? <Text style={styles.meetingLive}>Entrer dans la salle</Text> : null}
          </Pressable>
        );
      })}
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 8 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    when: { color: C.gold, fontSize: 15, fontWeight: '700' },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    description: { color: C.text, fontSize: 15, lineHeight: 22 },
    kind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    count: { color: C.muted, fontSize: 14, fontWeight: '700' },
    live: { backgroundColor: C.highlight, borderRadius: 14, padding: 14, gap: 10 },
    liveHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    liveTitle: { color: C.gold, fontSize: 14, fontWeight: '800' },
    liveEnd: { color: C.muted, fontSize: 13 },
    liveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    presentBtn: { backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
    presentText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
    here: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.gold,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    hereText: { color: C.onGold, fontWeight: '800', fontSize: 14 },
    manage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginTop: 2 },
    link: { color: C.faint, fontSize: 13, fontWeight: '700' },
    allow: { gap: 8 },
    settingsLink: { color: C.gold, fontSize: 13, fontWeight: '700', paddingBottom: 15 },
    meeting: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    badge: {
      width: 52,
      height: 56,
      borderRadius: 14,
      backgroundColor: C.highlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeDay: { color: C.gold, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
    badgeNum: { color: C.gold, fontSize: 22, lineHeight: 26, fontWeight: '800' },
    meetingTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    meetingSub: { color: C.muted, fontSize: 14, lineHeight: 20 },
    meetingLive: { color: C.gold, fontWeight: '800' },
    tile: { width: 280, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 4 },
    tileKicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tileKickerText: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800', flexShrink: 1 },
    tileTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  });
