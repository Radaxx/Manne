import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { type Palette, paletteFor } from '../appearance';
import { EchoHost } from '../echoes';
import { liturgicalDay } from '../liturgical-year';
import { scheduleReminders } from '../reminder';
import { ProgressProvider, useApp } from '../storage';
import { supabase } from '../supabase';
import { syncProgress } from '../sync';
import { PaletteProvider } from '../theme';
import { dayComplete, liveLog } from '../today';

function navigationTheme(palette: Palette) {
  const base = palette.statusBar === 'light' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, background: palette.bg, card: palette.bg, primary: palette.gold, text: palette.text, border: palette.line },
  };
}

/** Envoie la progression dès qu'une session existe, et la fusionne au retour du cloud. */
function ProgressSync() {
  const { loaded, progress, hydrate } = useApp();
  const ref = useRef(progress);
  ref.current = progress;
  useEffect(() => {
    if (!loaded || !supabase) return;
    ref.current = progress;
    const timer = setTimeout(() => {
      syncProgress(() => ref.current, hydrate).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [loaded, progress, hydrate]);
  useEffect(() => {
    const client = supabase;
    if (!loaded || !client) return;
    syncProgress(() => ref.current, hydrate).catch(() => {});
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') syncProgress(() => ref.current, hydrate).catch(() => {});
    });
    return () => data.subscription.unsubscribe();
  }, [loaded, hydrate]);
  return null;
}

/** Le rappel part aujourd'hui tant que la journée n'est pas faite et que l'heure est encore devant. */
function ReminderSync() {
  const { loaded, progress } = useApp();
  const { reminder } = progress;
  const todayDone = dayComplete(liveLog(progress));
  useEffect(() => {
    if (!loaded) return;
    scheduleReminders(reminder, todayDone).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleReminders(reminder, todayDone).catch(() => {});
    });
    return () => sub.remove();
  }, [loaded, reminder, todayDone]);
  return null;
}

function ThemedShell() {
  const { progress } = useApp();
  const system = useColorScheme();
  const { scheme, accent } = progress.appearance;
  // La couleur du jour vient du calendrier calculé sur le téléphone : elle ne dépend pas du réseau.
  const liturgical = accent === 'liturgique' ? liturgicalDay(progress.day).color : null;
  const palette = useMemo(() => paletteFor(scheme, system, liturgical), [scheme, system, liturgical]);
  const theme = useMemo(() => navigationTheme(palette), [palette]);
  return (
    <PaletteProvider value={palette}>
      <ThemeProvider value={theme}>
        <StatusBar style={palette.statusBar} />
        <ReminderSync />
        <ProgressSync />
        <EchoHost />
        <Stack
          screenOptions={{
            headerTintColor: palette.text,
            headerStyle: { backgroundColor: palette.bg },
            headerShadowVisible: false,
            headerBackTitle: 'Retour',
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="office/[id]" options={{ title: '' }} />
          <Stack.Screen name="priere/[id]" options={{ title: '' }} />
          <Stack.Screen name="confession" options={{ title: 'Confession' }} />
          <Stack.Screen name="chapelet" options={{ title: 'Chapelet' }} />
          <Stack.Screen name="adoration" options={{ title: 'Adoration' }} />
          <Stack.Screen name="priere-edition" options={{ title: 'Ma prière', presentation: 'modal' }} />
          <Stack.Screen name="messe" options={{ title: 'Messe du jour' }} />
          <Stack.Screen name="suivre-messe" options={{ title: 'Suivre la messe' }} />
          <Stack.Screen name="genealogie" options={{ title: 'D’Adam à Jésus' }} />
          <Stack.Screen name="annee-liturgique" options={{ title: 'Année liturgique' }} />
          <Stack.Screen name="avent" options={{ title: 'Parcours de l’Avent' }} />
          <Stack.Screen name="careme" options={{ title: 'Parcours de Carême' }} />
          <Stack.Screen name="plan/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="plans" options={{ title: 'Plans de lecture', presentation: 'modal' }} />
          <Stack.Screen name="intentions" options={{ title: 'Intentions confiées' }} />
          <Stack.Screen name="rappel" options={{ title: 'Rappel quotidien', presentation: 'modal' }} />
          <Stack.Screen name="compte" options={{ title: 'Compte' }} />
          <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
          <Stack.Screen name="passages" options={{ title: 'Passages gardés' }} />
        </Stack>
      </ThemeProvider>
    </PaletteProvider>
  );
}

export default function RootLayout() {
  return (
    <ProgressProvider>
      <ThemedShell />
    </ProgressProvider>
  );
}
