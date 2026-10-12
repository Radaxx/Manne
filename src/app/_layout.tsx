import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '../liturgy';
import { ProgressProvider } from '../storage';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, primary: C.gold, text: C.text, border: C.line } };

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <ProgressProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerTintColor: C.text, headerStyle: { backgroundColor: C.bg }, headerShadowVisible: false, headerBackTitle: 'Retour' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="office/[id]" options={{ title: '' }} />
          <Stack.Screen name="messe" options={{ title: 'Messe du jour' }} />
          <Stack.Screen name="plans" options={{ title: 'Plans de lecture', presentation: 'modal' }} />
        </Stack>
      </ProgressProvider>
    </ThemeProvider>
  );
}
