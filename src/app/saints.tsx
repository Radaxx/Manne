import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { dayLabel, shiftDay } from '../dates';
import { haptic } from '../haptics';
import { RANKS, type Saint, saintOfDay } from '../saints';
import { today } from '../storage';
import { useThemed } from '../theme';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SaintText({ saint, first }: { saint: Saint; first?: boolean }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={{ gap: 4 }}>
      <Text style={first ? styles.heroName : styles.name}>{saint.name}</Text>
      {saint.title ? <Text style={styles.title}>{saint.title}</Text> : null}
      {RANKS[saint.rank] ? <Text style={styles.rank}>{RANKS[saint.rank]}</Text> : null}
      <Text style={styles.life}>{saint.life}</Text>
    </View>
  );
}

export default function SaintsScreen() {
  const { C, styles } = useThemed(stylesFor);
  const now = today();
  const { saints, note } = saintOfDay(now);
  const [open, setOpen] = useState<string | null>(null);
  const week = [1, 2, 3, 4, 5, 6, 7].map((n) => saintOfDay(shiftDay(now, n)));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.section}>{capitalize(dayLabel(now))}</Text>
      {saints.map((s, i) => (
        <View key={s.name} style={[styles.card, i === 0 && styles.hero]}>
          <SaintText saint={s} first={i === 0} />
          {i === 0 && note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      ))}

      <Text style={styles.section}>Les jours qui viennent</Text>
      <View style={styles.card}>
        {week.map(({ date, saints: list, note: why }, i) => {
          const expanded = open === date;
          return (
            <Pressable
              key={date}
              onPress={() => {
                haptic();
                setOpen(expanded ? null : date);
              }}
              style={({ pressed }) => [styles.dayRow, i > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.small}>{capitalize(dayLabel(date))}</Text>
                  <Text style={styles.dayName}>{list.map((s) => s.name).join(' · ')}</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
              </View>
              {expanded ? (
                <View style={{ gap: 14, marginTop: 8 }}>
                  {list.map((s) => (
                    <SaintText key={s.name} saint={s} />
                  ))}
                  {why ? <Text style={[styles.note, { marginTop: 0 }]}>{why}</Text> : null}
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.footnote}>
        Calendrier romain et propre de la France. Les jours sans célébration à la messe, un saint du martyrologe ou de la tradition.
      </Text>
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 12 },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 12 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 16 },
    hero: { backgroundColor: C.cardHi, padding: 20 },
    heroName: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 32, fontWeight: '700' },
    name: { color: C.text, fontFamily: SERIF, fontSize: 19, lineHeight: 25, fontWeight: '700' },
    title: { color: C.muted, fontSize: 15 },
    rank: { color: C.gold, fontSize: 12, letterSpacing: 1, fontWeight: '800', textTransform: 'uppercase', marginTop: 2 },
    life: { color: C.text, fontSize: 16, lineHeight: 24, marginTop: 6 },
    note: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 12, fontStyle: 'italic' },
    dayRow: { paddingVertical: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
    rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dayName: { color: C.text, fontSize: 15, fontWeight: '600' },
    small: { color: C.faint, fontSize: 12 },
    footnote: { color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 8 },
    pressed: { opacity: 0.7 },
  });
