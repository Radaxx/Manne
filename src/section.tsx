import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { Text } from './text';
import { useThemed } from './theme';

/** Le titre d'une section des onglets (Accueil, Communauté, Prières), avec une action à droite. */
export function SectionHead({ title, action, note }: { title: string; action?: { label: string; onPress: () => void }; note?: string }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.head}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12} accessibilityRole="button">
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : note ? (
        <Text style={styles.note}>{note}</Text>
      ) : null}
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 32, marginBottom: 12 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    action: { color: C.gold, fontSize: 14, fontWeight: '600' },
    note: { color: C.faint, fontSize: 14 },
  });
