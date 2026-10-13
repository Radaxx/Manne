import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { EchoHost } from '../echoes';
import { C } from '../liturgy';
import { scheduleReminders } from '../reminder';
import { ProgressProvider, useApp } from '../storage';
import { supabase } from '../supabase';
import { syncProgress } from '../sync';
import { dayComplete, liveLog } from '../today';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.gold, text: C.text, border: C.line },
};

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

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <ReminderSync />
        <ProgressSync />
        <EchoHost />
        <Stack
          screenOptions={{
            headerTintColor: C.text,
            headerStyle: { backgroundColor: C.bg },
            headerShadowVisible: false,
            headerBackTitle: 'Retour',
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
          <Stack.Screen name="genealogie" options={{ title: 'D’Adam à Jésus' }} />
          <Stack.Screen name="plan/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="plans" options={{ title: 'Plans de lecture', presentation: 'modal' }} />
          <Stack.Screen name="intentions" options={{ title: 'Intentions confiées' }} />
          <Stack.Screen name="rappel" options={{ title: 'Rappel quotidien', presentation: 'modal' }} />
          <Stack.Screen name="compte" options={{ title: 'Compte' }} />
          <Stack.Screen name="passages" options={{ title: 'Passages gardés' }} />
        </Stack>
      </ProgressProvider>
    </ThemeProvider>
  );
}
