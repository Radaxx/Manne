import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from '../appearance';
import {
  CONTACT_MAX,
  deviceInfo,
  draftProblem,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  FEEDBACK_PLACEHOLDERS,
  type FeedbackKind,
  feedbackDevice,
  sendFeedback,
} from '../feedback';
import { haptic } from '../haptics';
import { Button, Field, FormScreen, Lead } from '../profile-ui';
import { Text } from '../text';
import { useThemed } from '../theme';

export default function RetourScreen() {
  const { C, styles } = useThemed(stylesFor);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [body, setBody] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const device = deviceInfo();
  const draft = { kind, body, contact };

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await sendFeedback(draft, device);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    haptic('success');
    setSent(true);
  };

  if (sent) {
    return (
      <FormScreen>
        <View style={styles.done}>
          <Ionicons name="checkmark-circle-outline" size={44} color={C.gold} />
          <Text style={styles.doneTitle}>Merci pour ton retour</Text>
          <Text style={styles.doneText}>Il est bien arrivé. Chaque message est lu.</Text>
        </View>
        <Button label="Revenir aux réglages" onPress={() => router.back()} />
        <Button
          label="Envoyer un autre retour"
          kind="quiet"
          onPress={() => {
            setBody('');
            setSent(false);
          }}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen>
      <Lead>Un bug, une idée, une remarque sur l’app : écris-le ici, ton message arrive directement à l’équipe de Manne.</Lead>

      <View style={styles.segment}>
        {FEEDBACK_KINDS.map((option) => {
          const on = kind === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                haptic();
                setKind(option);
              }}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{FEEDBACK_KIND_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Message" value={body} onChangeText={setBody} max={FEEDBACK_MAX} multiline placeholder={FEEDBACK_PLACEHOLDERS[kind]} />
      <Field
        label="Adresse pour te répondre (facultatif)"
        value={contact}
        onChangeText={setContact}
        max={CONTACT_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="toi@exemple.fr"
        hint="Seulement si tu veux une réponse."
      />

      <Text style={styles.privacy}>
        Partent avec ton message : la version de l’app et du téléphone ({feedbackDevice(device)}). Le retour est rattaché à ton compte, et
        l’équipe voit ton pseudo si tu as un profil. Rien de ta progression ni de ta confession. Supprimer ton compte efface aussi tes
        retours.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Envoyer" onPress={() => void send()} disabled={!!draftProblem(draft)} busy={busy} />
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, gap: 4, marginTop: 16 },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
    segmentOn: { backgroundColor: C.gold },
    segmentText: { color: C.text, fontSize: 14, fontWeight: '700' },
    segmentTextOn: { color: C.onGold },
    privacy: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 12 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
    done: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    doneTitle: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
    doneText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  });
