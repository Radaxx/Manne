import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** light : un geste courant ; medium : un palier (une dizaine) ; success : la fin d'une prière. */
export type HapticKind = 'light' | 'medium' | 'success';

/** Un retour tactile discret. Rien sur le web, et un échec n'interrompt jamais le geste. */
export function haptic(kind: HapticKind = 'light') {
  if (Platform.OS === 'web') return;
  const done =
    kind === 'success'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  done.catch(() => {});
}
