import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { openAuthUrl } from '../../auth';
import { C } from '../../liturgy';

/** Le lien du mail revient ici et termine la création du compte. */
export default function AuthCallback() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url?.includes('auth/callback')) return;
    let alive = true;
    openAuthUrl(url).then((message) => {
      if (!alive) return;
      if (message) setError(message);
      else if (router.canGoBack()) router.back();
      else router.replace('/compte');
    });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Connexion' }} />
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/compte'))} style={styles.btn}>
            <Text style={styles.btnText}>Retour</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={C.gold} />
          <Text style={styles.muted}>Connexion en cours…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  muted: { color: C.muted, fontSize: 16 },
  error: { color: C.red, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  btn: { backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  btnText: { color: C.bg, fontWeight: '800', fontSize: 15 },
});
