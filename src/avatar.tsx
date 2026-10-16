import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { initials } from './profile';
import { Text } from './text';
import { usePalette } from './theme';

/** Couleurs venues d'une œuvre (Découvrir) : le texte et le fond du cercle, à la place de la palette. */
export type AvatarTint = { ink: string; fill: string };

/** Les initiales du pseudo dans un cercle ; sans pseudo (anonyme, ou profil pas encore créé), une silhouette. */
export function Avatar({ handle, size = 36, tint }: { handle?: string | null; size?: number; tint?: AvatarTint }) {
  const C = usePalette();
  const letters = handle ? initials(handle) : '';
  if (!letters) {
    return <Ionicons name="person-circle-outline" size={size} color={tint?.ink ?? C.muted} />;
  }
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        tint ? { backgroundColor: tint.fill, borderColor: tint.ink } : { backgroundColor: C.card, borderColor: C.gold },
      ]}
    >
      <Text style={[styles.letters, { fontSize: Math.round(size * 0.38), color: tint?.ink ?? C.gold }]} allowFontScaling={false}>
        {letters}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  letters: { fontWeight: '800', letterSpacing: 0.5 },
});
