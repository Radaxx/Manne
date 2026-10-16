import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { haptic } from '../../haptics';
import { saveMyProfile } from '../../profile';
import { Button, FormScreen, Title } from '../../profile-ui';
import { useSignup } from '../../signup';
import { useThemed } from '../../theme';

const WHO_SEES = [
  'Quelqu’un qui connaît ton pseudo exact voit ton pseudo.',
  'Ta bio, ta paroisse et le nombre de tes abonnés et de tes abonnements ne sont visibles que par les personnes que tu suis et les membres de tes groupes.',
  'Quand tu suis quelqu’un, tu lui ouvres ton profil.',
  'Les membres d’un groupe voient ton pseudo, et ton profil s’ouvre à eux comme aux personnes que tu suis. Ce que tu écris dans un groupe n’est vu que par ses membres.',
  'Ta progression et ta confession ne sont jamais sur ton profil. Tes passages, tes prières et tes intentions n’y apparaissent que si tu choisis de les afficher.',
];

const CHARTER = [
  'Reste bienveillant : on vient ici pour prier et avancer ensemble.',
  'Pas de prosélytisme agressif, pas de contenu blessant.',
  'Un message qui te blesse : signale-le plutôt que d’y répondre.',
  'Les messages signalés peuvent être retirés.',
];

function Check({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? C.gold : C.muted} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function InscriptionCharte() {
  const { styles } = useThemed(stylesFor);
  const { status, refreshProfile } = useAuth();
  const { draft } = useSignup();
  const [charter, setCharter] = useState(false);
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'signedIn') return <Redirect href="/inscription" />;

  const create = async () => {
    if (busy || !charter || !age) return;
    setBusy(true);
    setError(null);
    const result = await saveMyProfile(draft, true);
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    await refreshProfile();
    setBusy(false);
    haptic('success');
    router.replace('/profil');
  };

  return (
    <FormScreen>
      <Title>Avant de commencer</Title>
      <Text style={styles.section}>Qui voit quoi</Text>
      <View style={styles.card}>
        {WHO_SEES.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={styles.section}>La charte de la communauté</Text>
      <View style={styles.card}>
        {CHARTER.map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
      <Check label="J’accepte la charte" checked={charter} onPress={() => setCharter((value) => !value)} />
      <Check label="J’ai 15 ans ou plus" checked={age} onPress={() => setAge((value) => !value)} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Créer mon profil" onPress={() => void create()} disabled={!charter || !age} busy={busy} />
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 6 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
    line: { color: C.text, fontSize: 15, lineHeight: 22 },
    check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    checkLabel: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
