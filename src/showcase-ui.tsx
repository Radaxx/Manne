import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import type { Palette } from './appearance';
import { useAuth } from './auth';
import { haptic } from './haptics';
import type { Result } from './profile';
import { Text } from './text';
import { useThemed } from './theme';

/**
 * L'interrupteur « Afficher sur mon profil » : `on` vient de la vitrine du serveur, `change` fait l'appel.
 * L'interrupteur ne bascule qu'une fois le serveur d'accord ; sinon le message d'erreur s'affiche dessous.
 */
export function ShowSwitch({
  on,
  change,
  label = 'Afficher sur mon profil',
  hint,
}: {
  on: boolean;
  change: (next: boolean) => Promise<Result>;
  label?: string;
  hint?: string;
}) {
  const { C, styles } = useThemed(stylesFor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flip = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    haptic();
    const result = await change(next);
    if (!result.ok) setError(result.message);
    setBusy(false);
  };
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Switch
          value={on}
          onValueChange={(next) => void flip(next)}
          disabled={busy}
          trackColor={{ false: C.line, true: C.gold }}
          thumbColor={C.text}
          accessibilityLabel={label}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/** Une ligne discrète pour qui n'a pas encore de profil. Rien tant que le compte n'est pas relié ou que le profil se charge. */
export function ShowcaseInvite() {
  const { styles } = useThemed(stylesFor);
  const { configured, status, profile, profileLoaded, profileOffline } = useAuth();
  if (!configured) return null;
  const anonymous = status !== 'signedIn';
  if (!anonymous && (!profileLoaded || profileOffline || profile)) return null;
  return (
    <Pressable onPress={() => router.push(anonymous ? '/inscription' : '/inscription/pseudo')} accessibilityRole="link">
      <Text style={styles.invite}>Crée ton profil pour afficher des passages, des prières et des intentions.</Text>
    </Pressable>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 2 },
    error: { color: C.red, fontSize: 13, lineHeight: 18, marginTop: 4 },
    invite: { color: C.muted, fontSize: 13, lineHeight: 19, textDecorationLine: 'underline', marginBottom: 10 },
  });
