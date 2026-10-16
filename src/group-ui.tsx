import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { useAuth } from './auth';
import { type GroupKind, kindLabel, memberCountLabel } from './groups';
import { Button } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

export function openGroup(id: string) {
  router.push({ pathname: '/groupe/[id]', params: { id } });
}

/** La chaîne d'adoration d'un groupe (id de la chaîne). */
export function openAdorationChain(id: string) {
  router.push({ pathname: '/adoration-chaine/[id]', params: { id } });
}

/** La salle de prière en direct d'un rendez-vous (id du rendez-vous). */
export function openRoom(gatheringId: string) {
  router.push({ pathname: '/salle/[id]', params: { id: gatheringId } });
}

/** Les groupes demandent un compte relié ET un profil, parce que le pseudo est visible des autres membres. */
export function useGroupGate(): { ready: boolean; loading: boolean } {
  const { configured, status, profile, profileLoaded } = useAuth();
  return { ready: configured && status === 'signedIn' && !!profile, loading: status === 'signedIn' && !profileLoaded };
}

export function NeedProfile() {
  const { styles } = useThemed(stylesFor);
  const { status } = useAuth();
  return (
    <View style={styles.need}>
      <Text style={styles.needTitle}>Crée ton profil</Text>
      <Text style={styles.needText}>
        Pour rejoindre ou créer un groupe de prière, il faut un compte relié et un profil : les autres membres voient ton pseudo.
      </Text>
      <Button label="Créer mon profil" onPress={() => router.push(status === 'signedIn' ? '/inscription/pseudo' : '/inscription')} />
    </View>
  );
}

export const KIND_ICONS: Record<GroupKind, keyof typeof Ionicons.glyphMap> = {
  fraternite: 'lock-closed-outline',
  communaute: 'people-outline',
  ephemere: 'hourglass-outline',
};

/** Un groupe dans une liste : nom, type, nombre de membres, et une pastille (demandes en attente) ou une note. */
export function GroupRow({
  name,
  kind,
  memberCount,
  note,
  badge,
  onPress,
}: {
  name: string;
  kind: GroupKind;
  memberCount: number;
  note?: string;
  badge?: number;
  onPress: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.icon}>
        <Ionicons name={KIND_ICONS[kind]} size={22} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {kindLabel(kind)} · {memberCountLabel(memberCount)}
          {note ? ` · ${note}` : ''}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge} accessibilityLabel={`${badge} demande${badge > 1 ? 's' : ''} en attente`}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10 },
    pressed: { opacity: 0.75 },
    need: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, margin: 20 },
    needTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    needText: { color: C.muted, fontSize: 14, lineHeight: 20 },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.highlight,
    },
    name: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
    sub: { color: C.muted, fontSize: 13, lineHeight: 19 },
    badge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.gold,
    },
    badgeText: { color: C.onGold, fontSize: 13, fontWeight: '800' },
  });
