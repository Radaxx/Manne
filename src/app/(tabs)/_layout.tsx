import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { C } from '../../liturgy';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName, focusedName: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />
  );

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: { backgroundColor: '#08090c', borderTopColor: C.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="lecture" options={{ title: 'Lecture', tabBarIcon: icon('book-outline', 'book') }} />
      <Tabs.Screen name="prieres" options={{ title: 'Prières', tabBarIcon: icon('rose-outline', 'rose') }} />
      <Tabs.Screen name="decouvrir" options={{ title: 'Découvrir', tabBarIcon: icon('compass-outline', 'compass') }} />
    </Tabs>
  );
}
