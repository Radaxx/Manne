import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { dayLabel, localDate } from '../dates';
import { type NewsItem, publishedAgo, useNews } from '../news';
import { useThemed } from '../theme';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les articles regroupés par jour de publication (heure locale), du plus récent au plus ancien. */
function byDay(items: NewsItem[]): [string, NewsItem[]][] {
  const days = new Map<string, NewsItem[]>();
  for (const item of items) {
    const day = localDate(new Date(item.published));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days.entries()];
}

export default function NewsScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { items, loading, error, available } = useNews();
  const today = localDate();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        Les titres de Vatican News, de l’Église catholique en France et de cath.ch. Les articles s’ouvrent sur leur site.
      </Text>

      {!available ? (
        <Text style={styles.muted}>Les actualités ne sont pas disponibles dans cette version de l’app.</Text>
      ) : loading ? (
        <ActivityIndicator color={C.muted} style={{ paddingVertical: 32 }} />
      ) : error || items.length === 0 ? (
        <Text style={styles.muted}>Les actualités n’ont pas pu être chargées. Vérifie ta connexion.</Text>
      ) : (
        byDay(items).map(([day, list]) => (
          <View key={day} style={{ gap: 10 }}>
            <Text style={styles.section}>{day === today ? 'Aujourd’hui' : capitalize(dayLabel(day))}</Text>
            {list.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => WebBrowser.openBrowserAsync(item.link).catch(() => {})}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityHint={`Ouvre l’article sur ${item.sourceName}`}
              >
                <Text style={styles.source}>
                  {item.sourceName} · {publishedAgo(item.published)}
                </Text>
                <Text style={styles.title}>{item.title}</Text>
                {item.summary ? (
                  <Text style={styles.summary} numberOfLines={3}>
                    {item.summary}
                  </Text>
                ) : null}
                <View style={styles.open}>
                  <Text style={styles.openText}>Lire l’article</Text>
                  <Ionicons name="open-outline" size={14} color={C.gold} />
                </View>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 16 },
    intro: { color: C.muted, fontSize: 14, lineHeight: 20 },
    muted: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 32 },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 8 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 6 },
    source: { color: C.faint, fontSize: 12, fontWeight: '600' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 25, fontWeight: '700' },
    summary: { color: C.muted, fontSize: 14, lineHeight: 20 },
    open: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    openText: { color: C.gold, fontSize: 14, fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
