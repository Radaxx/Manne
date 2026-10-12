import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { C } from '../liturgy';
import { scheduleReminders } from '../reminder';
import { ProgressProvider, useApp } from '../storage';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.gold, text: C.text, border: C.line } };

/** Chaque ouverture de l'app reporte le rappel quotidien à demain. */
function ReminderSync() {
  const { loaded, progress } = useApp();
  const { reminder } = progress;
  useEffect(() => {
    if (!loaded) return;
    scheduleReminders(reminder).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleReminders(reminder).catch(() => {});
    });
    return () => sub.remove();
  }, [loaded, reminder]);
  return null;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <ReminderSync />
        <Stack screenOptions={{ headerTintColor: C.text, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerBackTitle: 'Retour' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="office/[id]" options={{ title: '' }} />
          <Stack.Screen name="priere/[id]" options={{ title: '' }} />
          <Stack.Screen name="confession" options={{ title: 'Confession' }} />
          <Stack.Screen name="chapelet" options={{ title: 'Chapelet' }} />
          <Stack.Screen name="priere-edition" options={{ title: 'Ma prière', presentation: 'modal' }} />
          <Stack.Screen name="messe" options={{ title: 'Messe du jour' }} />
          <Stack.Screen name="plan/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="plans" options={{ title: 'Plans de lecture', presentation: 'modal' }} />
          <Stack.Screen name="rappel" options={{ title: 'Rappel quotidien', presentation: 'modal' }} />
        </Stack>
      </ProgressProvider>
    </ThemeProvider>
  );
}
