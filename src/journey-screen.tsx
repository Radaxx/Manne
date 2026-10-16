import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { bookMeta, chapterSource, loadPassage, passageLabel, translationName } from './bible';
import { SERIF } from './cards';
import { dayLabel, daysSince } from './dates';
import { haptic } from './haptics';
import { currentJourney, JOURNEYS, type Journey, type JourneyKind, journeyDay, journeyPhase } from './journeys';
import { ChapterSheet } from './sheets';
import { today, useApp } from './storage';
import { Text } from './text';
import { useThemed } from './theme';

// Un parcours (Avent, Carême) : un jour à la fois, jusqu'à aujourd'hui. Les jours à venir restent fermés,
// pour garder le rythme ; on peut rattraper les jours passés.

export function JourneyScreen({ kind }: { kind: JourneyKind }) {
  const { styles } = useThemed(stylesFor);
  const now = today();
  const journey = currentJourney(kind, now);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {journeyPhase(journey, now) === 'avant' ? <Before journey={journey} now={now} /> : <Days journey={journey} now={now} />}
    </ScrollView>
  );
}

const kicker = (j: Journey) => `${JOURNEYS[j.kind].name} ${j.year}`.toUpperCase();

function Before({ journey, now }: { journey: Journey; now: string }) {
  const { styles } = useThemed(stylesFor);
  const { season, weeks } = JOURNEYS[journey.kind];
  const wait = daysSince(now, journey.start);
  return (
    <>
      <Text style={styles.kicker}>{kicker(journey)}</Text>
      <Text style={styles.title}>
        {season} commence {wait === 1 ? 'demain' : `dans ${wait} jours`}
      </Text>
      <Text style={styles.lead}>
        Le {dayLabel(journey.start)}, pour {journey.dates.length} jours jusqu’à {JOURNEYS[journey.kind].feast} : chaque jour un passage de
        la Bible, une courte méditation et un geste à vivre. Les jours s’ouvrent un à un.
      </Text>
      {weeks.map((w) => (
        <View key={w.theme} style={styles.weekRow}>
          <Text style={styles.weekWhen}>{w.when.toUpperCase()}</Text>
          <Text style={styles.weekTheme}>{w.theme}</Text>
          <Text style={styles.muted}>{w.blurb}</Text>
        </View>
      ))}
    </>
  );
}

/** Le dernier verset d'un extrait peut s'arrêter au milieu d'une phrase. */
export const closeExtract = (verses: string[]) => verses.map((v, i) => (i === verses.length - 1 ? v.replace(/\s*[,;:—–-]\s*$/, '…') : v));

function Days({ journey, now }: { journey: Journey; now: string }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, toggleJourneyDay } = useApp();
  const done = new Set(progress.journeys[journey.id] ?? []);
  const open = journey.dates.filter((d) => d <= now);
  const [selected, setSelected] = useState(open[open.length - 1]);
  const [reading, setReading] = useState(false);
  const finished = journeyPhase(journey, now) === 'apres';
  const { day, week } = journeyDay(journey, selected);
  const [book, chapter, from, to] = day.passage;
  const t = progress.translation;
  const verses = closeExtract(loadPassage(book, chapter, from, to, t));
  const reference = passageLabel(book, chapter, from, to, t);
  const isDone = done.has(selected);
  const index = journey.dates.indexOf(selected);

  return (
    <>
      <Text style={styles.kicker}>{kicker(journey)}</Text>
      {finished ? (
        <View style={styles.arrival}>
          <Text style={styles.arrivalTitle}>{JOURNEYS[journey.kind].arrival}</Text>
          <Text style={styles.lead}>
            Tu as vécu {done.size} jour{done.size > 1 ? 's' : ''} sur {journey.dates.length}. Tu peux relire chaque jour du parcours.
          </Text>
        </View>
      ) : null}

      <View style={styles.days}>
        {journey.dates.map((d, i) => {
          const locked = d > now;
          const on = d === selected;
          return (
            <Pressable
              key={d}
              disabled={locked}
              onPress={() => setSelected(d)}
              style={[styles.day, done.has(d) && styles.dayDone, on && styles.daySelected, locked && styles.dayLocked]}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(d)}${done.has(d) ? ', vécu' : ''}${locked ? ', pas encore ouvert' : ''}`}
              accessibilityState={{ selected: on, disabled: locked }}
            >
              <Text style={[styles.dayText, done.has(d) && styles.dayTextDone]}>{i + 1}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.meta}>
        Jour {index + 1} sur {journey.dates.length} · {dayLabel(selected)}
      </Text>
      <Text style={styles.weekLabel}>{JOURNEYS[journey.kind].weeks[week].theme.toUpperCase()}</Text>
      <Text style={styles.title}>{day.title}</Text>

      {day.antiphon ? (
        <View style={styles.antiphon}>
          <Text style={styles.antiphonText}>{day.antiphon}</Text>
          <Text style={styles.small}>Antienne des Vêpres</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.scripture}>
          {verses.map((v, i) => (
            <Text key={i}>
              <Text style={styles.verseNum}>{from + i} </Text>
              {v}{' '}
            </Text>
          ))}
        </Text>
        <Text style={styles.ref}>
          {reference} · {translationName(chapterSource(book, chapter, t))}
        </Text>
        <Pressable onPress={() => setReading(true)} hitSlop={8}>
          <Text style={styles.link}>Lire tout le chapitre</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Méditer</Text>
      <Text style={styles.body}>{day.meditation}</Text>

      <Text style={styles.section}>Le geste du jour</Text>
      <View style={styles.gesture}>
        <Ionicons name="hand-left-outline" size={20} color={C.gold} />
        <Text style={[styles.body, { flex: 1 }]}>{day.gesture}</Text>
      </View>

      <Pressable
        onPress={() => {
          haptic();
          toggleJourneyDay(journey.id, selected);
        }}
        style={({ pressed }) => [styles.doneBtn, isDone && styles.doneBtnOn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ checked: isDone }}
      >
        <Ionicons name={isDone ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isDone ? C.onGold : C.gold} />
        <Text style={[styles.doneText, isDone && styles.doneTextOn]}>{isDone ? 'Jour vécu' : 'J’ai vécu ce jour'}</Text>
      </Pressable>
      {selected === now && !finished ? (
        <Pressable onPress={() => router.push('/messe')} hitSlop={8}>
          <Text style={[styles.link, { alignSelf: 'center' }]}>Les lectures de la messe du jour</Text>
        </Pressable>
      ) : null}

      {reading ? (
        <ChapterSheet
          passage={{
            id: `${journey.id}-${selected}`,
            book,
            bookName: bookMeta(book, t).name,
            chapter,
            from,
            to,
            reference,
            text: verses.join(' '),
          }}
          onClose={() => setReading(false)}
        />
      ) : null}
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 12 },
    kicker: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 28, lineHeight: 34, fontWeight: '700' },
    lead: { color: C.text, fontSize: 16, lineHeight: 24 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    small: { color: C.faint, fontSize: 12, marginTop: 8 },
    meta: { color: C.muted, fontSize: 13, marginTop: 4 },
    weekLabel: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
    weekRow: { backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 2 },
    weekWhen: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    weekTheme: { color: C.text, fontSize: 16, fontWeight: '700' },
    days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    day: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dayDone: { backgroundColor: C.gold },
    daySelected: { borderColor: C.text },
    dayLocked: { opacity: 0.35 },
    dayText: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    dayTextDone: { color: C.onGold },
    arrival: { backgroundColor: C.highlight, borderRadius: 16, padding: 16, gap: 6 },
    arrivalTitle: { color: C.gold, fontFamily: SERIF, fontSize: 24, fontWeight: '700' },
    antiphon: { borderLeftWidth: 3, borderLeftColor: C.gold, paddingLeft: 14, paddingVertical: 4 },
    antiphonText: { color: C.text, fontFamily: SERIF, fontSize: 17, lineHeight: 26, fontStyle: 'italic' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 18 },
    scripture: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 28 },
    verseNum: { color: C.gold, fontSize: 12, fontWeight: '700' },
    ref: { color: C.muted, fontSize: 12, letterSpacing: 1, fontWeight: '600', marginTop: 10, textTransform: 'uppercase' },
    link: { color: C.gold, fontSize: 15, fontWeight: '700', marginTop: 10 },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 10 },
    body: { color: C.text, fontSize: 16, lineHeight: 24 },
    gesture: { flexDirection: 'row', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
    doneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: C.gold,
      borderRadius: 999,
      paddingVertical: 13,
      marginTop: 16,
    },
    doneBtnOn: { backgroundColor: C.gold },
    doneText: { color: C.gold, fontSize: 16, fontWeight: '700' },
    doneTextOn: { color: C.onGold },
    pressed: { opacity: 0.7 },
  });
