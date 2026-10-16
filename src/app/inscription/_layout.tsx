import { Stack } from 'expo-router';
import { SignupProvider } from '../../signup';
import { usePalette } from '../../theme';

/** Les étapes de l'inscription partagent un brouillon : rien n'est créé avant la dernière. */
export default function InscriptionLayout() {
  const C = usePalette();
  return (
    <SignupProvider>
      <Stack
        screenOptions={{
          headerTintColor: C.text,
          headerStyle: { backgroundColor: C.bg },
          headerShadowVisible: false,
          headerBackTitle: 'Retour',
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Connexion' }} />
        <Stack.Screen name="pseudo" options={{ title: 'Ton pseudo' }} />
        <Stack.Screen name="details" options={{ title: 'À propos de toi' }} />
        <Stack.Screen name="charte" options={{ title: 'La charte' }} />
      </Stack>
    </SignupProvider>
  );
}
