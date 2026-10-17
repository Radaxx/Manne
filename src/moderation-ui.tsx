import { type ReactElement, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from './appearance';
import { haptic } from './haptics';
import { REPORT_REASONS, type ReportReason, reasonLabel } from './moderation';
import { Text } from './text';
import { useThemed } from './theme';

/** Ce qu'on demande avant d'envoyer un signalement : un titre, ce qui se passera, et ce qu'il faut envoyer. */
export type ReportRequest = {
  title: string;
  message: string;
  send: (reason: ReportReason) => void;
};

function ReasonSheet({ request, onClose }: { request: ReportRequest; onClose: () => void }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent visible>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Annuler" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">
            {request.title}
          </Text>
          <Text style={styles.message}>{request.message}</Text>
          <Text style={styles.ask}>Pour quelle raison ?</Text>
          {REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => {
                haptic();
                onClose();
                request.send(reason);
              }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.optionText}>{reasonLabel(reason)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Le choix du motif, partout où l'on signale. `ask` ouvre la feuille ; `sheet` est à poser dans l'écran, une fois.
 * Choisir un motif envoie le signalement : la feuille remplace la confirmation.
 */
export function useReportSheet(): { ask: (request: ReportRequest) => void; sheet: ReactElement | null } {
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const close = useCallback(() => setRequest(null), []);
  return { ask: setRequest, sheet: request ? <ReasonSheet request={request} onClose={close} /> : null };
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.shadow, opacity: 0.45 },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 22, gap: 8 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    message: { color: C.muted, fontSize: 14, lineHeight: 20 },
    ask: { color: C.faint, fontSize: 13, fontWeight: '700', marginTop: 8 },
    option: { backgroundColor: C.cardHi, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
    pressed: { opacity: 0.75 },
    optionText: { color: C.text, fontSize: 16, fontWeight: '600' },
    cancel: { alignItems: 'center', paddingVertical: 14 },
    cancelText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  });
