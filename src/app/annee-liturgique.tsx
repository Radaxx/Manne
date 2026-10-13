import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { adventDay, adventPhase, currentAdvent } from '../advent';
import { LITURGICAL_COLORS, plainText, useMass } from '../aelf';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { dayLabel, daysSince, shortDate } from '../dates';
import { liturgicalDay, liturgicalYear, SEASONS, upcomingFeasts } from '../liturgical-year';
import { today, useApp } from '../storage';
import { useThemed } from '../theme';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const inDays = (n: number) => (n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : `dans ${n} jours`);

export default function LiturgicalYearScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress } = useApp();
  const now = today();
  const day = liturgicalDay(now);
  const year = liturgicalYear(now);
  const feasts = upcomingFeasts(now, 8);
  // L'AELF connaît aussi les saints du jour : sa ligne est plus précise quand on est en ligne.
  const info = useMass(now).data?.informations;
  const color = LITURGICAL_COLORS[info?.couleur ?? day.color] ?? C.muted;
  const advent = currentAdvent(now);
  const phase = adventPhase(advent, now);
  const adventDone = progress.journeys[advent.id]?.length ?? 0;
  const elapsed = daysSince(year.start, now);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.season}>{SEASONS[day.season].name}</Text>
          <Text style={styles.label}>{capitalize(info?.semaine || day.label)}</Text>
          {info?.fete && info.fete !== 'de la férie' ? (
            <Text style={styles.feast}>{capitalize(plainText(info.fete))}</Text>
          ) : day.feast ? (
            <Text style={styles.feast}>{day.feast.name}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.muted}>{SEASONS[day.season].blurb}</Text>
      <Text style={styles.cycle}>
        Lectures du dimanche : année {day.sundayCycle} · de semaine : année {day.weekdayCycle}
      </Text>

      {/* L'année, de l'Avent à l'Avent, avec la couleur de chaque temps */}
      <View style={styles.bar}>
        {year.spans.map((s, i) => (
          <View
            key={`${s.season}-${i}`}
            style={{ flex: daysSince(s.from, s.to) + 1, backgroundColor: LITURGICAL_COLORS[SEASONS[s.season].color] }}
          />
        ))}
        <View style={[styles.cursor, { left: `${(elapsed / year.length) * 100}%` }]} />
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.small}>Avent {year.start.slice(0, 4)}</Text>
        <Text style={styles.small}>
          Jour {elapsed + 1} sur {year.length}
        </Text>
      </View>

      <Text style={styles.section}>Parcours</Text>
      <Pressable onPress={() => router.push('/avent')} style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
        <Ionicons name="flame-outline" size={24} color={LITURGICAL_COLORS.violet} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Parcours de l’Avent {advent.year}</Text>
          <Text style={styles.muted}>
            {phase === 'avant'
              ? `Commence le ${dayLabel(advent.start)}, ${inDays(daysSince(now, advent.start))}.`
              : phase === 'pendant'
                ? `Jour ${advent.dates.indexOf(now) + 1} sur ${advent.dates.length} · ${adventDay(advent, now).day.title}`
                : `${adventDone} jour${adventDone > 1 ? 's' : ''} vécu${adventDone > 1 ? 's' : ''} sur ${advent.dates.length}.`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Pressable>

      <Text style={styles.section}>Prochaines fêtes</Text>
      <View style={styles.card}>
        {feasts.map((f, i) => (
          <View key={`${f.date}-${f.name}`} style={[styles.feastRow, i > 0 && styles.divider]}>
            <View style={[styles.dot, { backgroundColor: LITURGICAL_COLORS[f.color] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.feastName, f.rank === 'solennite' && styles.solemn]}>{f.name}</Text>
              <Text style={styles.small}>
                {capitalize(dayLabel(f.date))} · {inDays(daysSince(now, f.date))}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Les temps de l’année</Text>
      {year.spans.map((s, i) => {
        const current = now >= s.from && now <= s.to;
        return (
          <View key={`${s.season}-${i}`} style={[styles.card, styles.row, current && styles.current]}>
            <View style={[styles.dot, { backgroundColor: LITURGICAL_COLORS[SEASONS[s.season].color] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{SEASONS[s.season].name}</Text>
              <Text style={styles.small}>
                {s.from === s.to ? shortDate(s.from) : `Du ${shortDate(s.from)} au ${shortDate(s.to)}`}
                {current ? ' · en ce moment' : ''}
              </Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.note}>
        Calendrier romain pour la France. Les saints du jour viennent de l’AELF quand le téléphone est connecté.
      </Text>
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 12 },
    hero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    swatch: { width: 14, alignSelf: 'stretch', borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
    season: { color: C.text, fontFamily: SERIF, fontSize: 30, lineHeight: 36, fontWeight: '700' },
    label: { color: C.text, fontSize: 16, marginTop: 2 },
    feast: { color: C.gold, fontSize: 15, fontWeight: '700', marginTop: 4 },
    cycle: { color: C.muted, fontSize: 13 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    small: { color: C.faint, fontSize: 12, marginTop: 2 },
    note: { color: C.faint, fontSize: 12, lineHeight: 17, marginTop: 8 },
    bar: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 7,
      overflow: 'hidden',
      marginTop: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    cursor: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1, backgroundColor: C.text },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 12 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    current: { borderWidth: 2, borderColor: C.gold },
    cardTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    dot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
    feastRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
    feastName: { color: C.text, fontSize: 15 },
    solemn: { fontWeight: '700' },
    pressed: { opacity: 0.7 },
  });
