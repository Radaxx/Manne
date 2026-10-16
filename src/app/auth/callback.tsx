import * as Linking from 'expo-linking';
import { router, Stack, useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { googleFlowInProgress, handledInApp, openAuthUrl } from '../../auth';
import { Text } from '../../text';
import { useThemed } from '../../theme';

const AUTH_KEYS = ['code', 'access_token', 'refresh_token', 'token_hash', 'type', 'error_code', 'error_description', 'sb_flow_id'] as const;

function one(value: string | string[] | undefined): string | undefined {
  const picked = Array.isArray(value) ? value[0] : value;
  return picked || undefined;
}

/** Reconstruit l'adresse si le routeur a déjà extrait le jeton, sans le fragment. */
function urlFromParams(params: Record<string, string | string[] | undefined>): string | null {
  const flat: Record<string, string> = {};
  for (const key of AUTH_KEYS) {
    const value = one(params[key]);
    if (value) flat[key] = value;
  }
  if (!flat.code && !flat.access_token && !flat.token_hash && !flat.error_description && !flat.error_code) return null;
  const query = Object.entries(flat)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `manne://auth/callback?${query}`;
}

function usable(url: string | null | undefined): url is string {
  if (!url) return false;
  return AUTH_KEYS.some((key) => url.includes(`${key}=`));
}

/** Revient là d'où la connexion est partie (l'inscription, le compte…), ou au compte si on arrive de l'extérieur. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/compte');
}

/** Le lien du mail revient ici et termine la création du compte. */
export default function AuthCallback() {
  const { C, styles } = useThemed(stylesFor);
  const linkingUrl = Linking.useLinkingURL();
  const params = useGlobalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const fromParams = urlFromParams(params);

  useEffect(() => {
    let alive = true;
    const done = (message: string | null) => {
      if (!alive) return;
      if (message) setError(message);
      else leave();
    };
    // Retour d'une connexion Google : c'est l'app qui la termine (voir providers.ts). On attend, puis on revient.
    const google = googleFlowInProgress();
    if (google) {
      void google.finally(() => {
        if (alive) leave();
      });
      return () => {
        alive = false;
      };
    }
    const candidate = fromParams ?? [linkingUrl].find(usable) ?? null;
    if (!candidate) {
      const timer = setTimeout(() => {
        Linking.getInitialURL().then((initial) => {
          if (!alive) return;
          if (usable(initial))
            openAuthUrl(initial)
              .then(done)
              .catch(() => done('La connexion a échoué.'));
          else done('Le lien n’a pas transmis la session. Ouvre-le depuis ce téléphone.');
        });
      }, 1500);
      return () => {
        alive = false;
        clearTimeout(timer);
      };
    }
    if (handledInApp(candidate)) {
      leave();
      return () => {
        alive = false;
      };
    }
    openAuthUrl(candidate)
      .then(done)
      .catch(() => done('La connexion a échoué.'));
    return () => {
      alive = false;
    };
  }, [linkingUrl, fromParams]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Connexion' }} />
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={leave} style={styles.btn}>
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

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
    muted: { color: C.muted, fontSize: 16 },
    error: { color: C.red, fontSize: 16, textAlign: 'center', lineHeight: 22 },
    btn: { backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
  });
