import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import type { Palette } from './appearance';
import { haptic } from './haptics';
import { isGroupMuted, setGroupMuted } from './push';
import { Text } from './text';
import { useThemed } from './theme';

/**
 * « Notifications de ce groupe » : coupe toutes les notifications de ce groupe (demandes, signalements, intentions, nouveautés),
 * pour toi seulement. Le réglage est gardé avec ton compte. Les rappels de ton téléphone (rendez-vous...) ne changent pas.
 */
export function GroupNotificationsEntry({ groupId }: { groupId: string }) {
  const { C, styles } = useThemed(stylesFor);
  // null : pas encore lu (ou illisible) ; l'interrupteur est alors grisé.
  const [muted, setMuted] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isGroupMuted(groupId).then((result) => {
      if (alive && result.ok) setMuted(result.muted);
    });
    return () => {
      alive = false;
    };
  }, [groupId]);

  const change = async (on: boolean) => {
    haptic();
    const before = muted;
    setMuted(!on);
    const result = await setGroupMuted(groupId, !on);
    if (!result.ok) {
      setMuted(before);
      setError(result.message);
      return;
    }
    setError(null);
  };

  return (
    <View style={[styles.entry, muted === null && styles.disabled]}>
      <View style={styles.body}>
        <Text style={styles.label}>Notifications de ce groupe</Text>
        <Text style={styles.hint}>
          {error ?? (muted ? 'Coupées : tu ne reçois rien de ce groupe.' : 'Demandes, signalements, nouveautés selon tes réglages.')}
        </Text>
      </View>
      <Switch
        value={muted === false}
        disabled={muted === null}
        onValueChange={(on) => void change(on)}
        trackColor={{ true: C.gold, false: C.track }}
        thumbColor="#fff"
        accessibilityLabel="Notifications de ce groupe"
      />
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    entry: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
    disabled: { opacity: 0.5 },
    body: { flex: 1 },
    label: { color: C.text, fontSize: 16, fontWeight: '700' },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  });
