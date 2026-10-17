import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from './appearance';
import { haptic } from './haptics';
import {
  amIModerator,
  type MySuspension,
  modQueue,
  mySuspension,
  REASON_MAX,
  SUSPENSION_APPEAL,
  SUSPENSION_DURATIONS,
  suspensionTitle,
} from './publisher-moderation';
import { Text, TextInput } from './text';
import { useThemed } from './theme';

/** Ma suspension en cours, relue à chaque retour sur l'écran ; nulle si je ne suis pas suspendu ou hors connexion. */
export function useMySuspension(enabled: boolean): MySuspension | null {
  const [suspension, setSuspension] = useState<MySuspension | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setSuspension(null);
        return;
      }
      let alive = true;
      void mySuspension().then((result) => {
        if (alive && result.ok) setSuspension(result.suspension);
      });
      return () => {
        alive = false;
      };
    }, [enabled]),
  );
  return suspension;
}

/** Le bandeau d'une personne suspendue : jusqu'à quand, pourquoi, et à qui écrire. Ne montre rien sinon. */
export function SuspensionBanner({ suspension }: { suspension: MySuspension | null }) {
  const { styles } = useThemed(stylesFor);
  if (!suspension) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.bannerTitle}>{suspensionTitle(suspension.until)}</Text>
      {suspension.reason ? <Text style={styles.bannerText}>{suspension.reason}</Text> : null}
      <Text style={styles.bannerText}>{SUSPENSION_APPEAL}</Text>
    </View>
  );
}

/** Suis-je modérateur éditeur, et combien d'éléments attendent ? Relu à chaque retour sur l'écran. */
export function useModeratorStatus(enabled: boolean): { moderator: boolean; pending: number } {
  const [state, setState] = useState({ moderator: false, pending: 0 });
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setState({ moderator: false, pending: 0 });
        return;
      }
      let alive = true;
      void (async () => {
        const moderator = await amIModerator();
        const queue = moderator ? await modQueue() : null;
        if (alive) setState({ moderator, pending: queue?.ok ? queue.items.length : 0 });
      })();
      return () => {
        alive = false;
      };
    }, [enabled]),
  );
  return state;
}

/** Ce qu'on demande avant de suspendre l'auteur d'un élément : la durée et le motif. */
export type SuspendRequest = {
  /** « @marie » ou « ce compte ». */
  who: string;
  send: (days: number | null, reason: string) => void;
};

export function SuspendSheet({ request, onClose }: { request: SuspendRequest; onClose: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const [days, setDays] = useState<number | null>(7);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length > 0;
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent visible>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Annuler" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            <Text style={styles.title} accessibilityRole="header">
              Suspendre {request.who} ?
            </Text>
            <Text style={styles.message}>
              Pendant la suspension, ce compte ne peut plus rien publier. Il peut toujours lire, prier et supprimer son compte. Le motif lui
              est montré.
            </Text>
            <Text style={styles.ask}>Pendant combien de temps ?</Text>
            <View style={styles.durations}>
              {SUSPENSION_DURATIONS.map((option) => {
                const on = option.days === days;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => {
                      haptic();
                      setDays(option.days);
                    }}
                    style={[styles.duration, on && styles.durationOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.durationText, on && styles.durationTextOn]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.ask}>Motif</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              maxLength={REASON_MAX}
              multiline
              placeholder="Ce que la personne verra"
              placeholderTextColor={C.faint}
              style={styles.input}
              accessibilityLabel="Motif de la suspension"
            />
            <Text style={styles.count}>
              {reason.length} / {REASON_MAX}
            </Text>
            <Pressable
              onPress={() => {
                if (!ready) return;
                haptic('medium');
                onClose();
                request.send(days, reason);
              }}
              disabled={!ready}
              style={[styles.confirm, !ready && styles.off]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>Suspendre</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    banner: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.red, padding: 14, gap: 6, marginBottom: 12 },
    bannerTitle: { color: C.red, fontSize: 15, fontWeight: '800' },
    bannerText: { color: C.text, fontSize: 14, lineHeight: 20 },
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.shadow, opacity: 0.45 },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
    sheetBody: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8, gap: 8 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    message: { color: C.muted, fontSize: 14, lineHeight: 20 },
    ask: { color: C.faint, fontSize: 13, fontWeight: '700', marginTop: 8 },
    durations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    duration: { backgroundColor: C.cardHi, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
    durationOn: { backgroundColor: C.gold },
    durationText: { color: C.text, fontSize: 15, fontWeight: '600' },
    durationTextOn: { color: C.onGold },
    input: {
      backgroundColor: C.cardHi,
      borderRadius: 14,
      color: C.text,
      fontSize: 16,
      minHeight: 88,
      paddingHorizontal: 14,
      paddingVertical: 12,
      textAlignVertical: 'top',
    },
    count: { color: C.faint, fontSize: 12, textAlign: 'right' },
    confirm: { backgroundColor: C.red, borderRadius: 14, alignItems: 'center', paddingVertical: 14, marginTop: 6 },
    off: { opacity: 0.4 },
    confirmText: { color: C.bg, fontSize: 16, fontWeight: '800' },
    cancel: { alignItems: 'center', paddingVertical: 14 },
    cancelText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  });
