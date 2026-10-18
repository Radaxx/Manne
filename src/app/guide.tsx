import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../appearance';
import { GUIDE_SECTIONS } from '../guide';
import { haptic } from '../haptics';
import { Chevron, Collapsible } from '../recurrence-ui';
import { Text } from '../text';
import { useThemed } from '../theme';

/** Le guide de l'app : une section par onglet, qui se déplie sur de courtes explications. */
export default function GuideScreen() {
  const { C, styles } = useThemed(stylesFor);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>Comment utiliser chaque onglet, et ce qui reste sur ton téléphone ou part en ligne.</Text>

      <Pressable
        onPress={() => router.push('/bienvenue')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Ionicons name="play-circle-outline" size={22} color={C.gold} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Revoir la visite</Text>
          <Text style={styles.rowHint}>Les pages de bienvenue, en quelques secondes</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Pressable>

      <View style={styles.sections}>
        {GUIDE_SECTIONS.map((section) => {
          const open = openId === section.id;
          return (
            <View key={section.id} style={styles.section}>
              <Pressable
                onPress={() => {
                  haptic();
                  setOpenId(open ? null : section.id);
                }}
                style={({ pressed }) => [styles.head, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Ionicons name={section.icon as keyof typeof Ionicons.glyphMap} size={22} color={C.gold} />
                <Text style={styles.headTitle}>{section.title}</Text>
                <Chevron open={open} color={C.muted} />
              </Pressable>
              <Collapsible open={open}>
                <View style={styles.entries}>
                  {section.entries.map((entry) => (
                    <View key={entry.title} style={styles.entry}>
                      <Text style={styles.entryTitle}>{entry.title}</Text>
                      <Text style={styles.entryBody}>{entry.body}</Text>
                      {entry.route ? (
                        <Pressable
                          onPress={() => router.push(entry.route as Href)}
                          hitSlop={8}
                          style={styles.open}
                          accessibilityRole="link"
                          accessibilityLabel={`Ouvrir : ${entry.title}`}
                        >
                          <Text style={styles.openText}>Ouvrir</Text>
                          <Ionicons name="arrow-forward" size={14} color={C.gold} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </Collapsible>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
    rowBody: { flex: 1 },
    rowLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
    rowHint: { color: C.muted, fontSize: 13, marginTop: 2 },
    sections: { gap: 10, marginTop: 16 },
    section: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    headTitle: { flex: 1, color: C.text, fontSize: 17, fontWeight: '700' },
    entries: { paddingHorizontal: 14, paddingBottom: 6, gap: 14 },
    entry: { gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 12 },
    entryTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
    entryBody: { color: C.muted, fontSize: 14, lineHeight: 21 },
    open: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingVertical: 2 },
    openText: { color: C.gold, fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.75 },
  });
