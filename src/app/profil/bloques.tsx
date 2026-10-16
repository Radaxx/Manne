import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../appearance';
import { Avatar } from '../../avatar';
import { haptic } from '../../haptics';
import { listBlocked, unblockPerson } from '../../showcase';
import { useThemed } from '../../theme';

export default function Bloques() {
  const { C, styles } = useThemed(stylesFor);
  const [handles, setHandles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listBlocked();
    if (!result.ok) {
      setError(result.message);
      setHandles([]);
      return;
    }
    setError(null);
    setHandles(result.handles);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unblock = async (handle: string) => {
    haptic();
    const result = await unblockPerson(handle);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await load();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.muted}>
        Ces personnes ne peuvent ni te trouver ni voir ton profil, et vous ne pouvez pas vous suivre. En les débloquant, vous pourrez de
        nouveau vous trouver ; vos anciens abonnements ne reviennent pas.
      </Text>
      {handles === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {handles && handles.length === 0 && !error ? <Text style={styles.muted}>Tu n’as bloqué personne.</Text> : null}
      {handles?.map((handle) => (
        <View key={handle} style={styles.person}>
          <Avatar handle={handle} size={44} />
          <Text style={styles.name} numberOfLines={1}>
            @{handle}
          </Text>
          <Pressable
            onPress={() => void unblock(handle)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Débloquer @${handle}`}
          >
            <Text style={styles.unblock}>Débloquer</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 4 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    error: { color: C.red, fontSize: 14, marginBottom: 8 },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    name: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
    unblock: { color: C.gold, fontSize: 14, fontWeight: '700' },
  });
