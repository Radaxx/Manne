import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { LivingRosaryTiles, useMyRosaries } from './living-rosary-ui';
import {
  dayOfLabel,
  finishersLabel,
  type MyNovena,
  myNovenas,
  type Novena,
  novenaDay,
  prayDayLabel,
  prayedToday,
  prayedTodayLabel,
  runningNovenas,
  statusLabel,
} from './novenas';
import { Button } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

export function openNovena(id: string) {
  router.push({ pathname: '/neuvaine/[id]', params: { id } });
}

/** Une pastille de choix (modèle, début…). */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Le choix d'une heure (heure et minutes par pas de 5), comme dans le formulaire des rendez-vous. */
export function TimeSteppers({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const one = (label: string, value: number, minus: () => void, plus: () => void) => (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={minus} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`${label} en moins`}>
          <Ionicons name="remove" size={22} color={C.gold} />
        </Pressable>
        <Text style={styles.stepperValue}>{String(value).padStart(2, '0')}</Text>
        <Pressable onPress={plus} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`${label} en plus`}>
          <Ionicons name="add" size={22} color={C.gold} />
        </Pressable>
      </View>
    </View>
  );
  return (
    <View style={styles.steppers}>
      {one(
        'Heure',
        hour,
        () => onChange((hour + 23) % 24, minute),
        () => onChange((hour + 1) % 24, minute),
      )}
      {one(
        'Minutes',
        minute,
        () => onChange(hour, (minute + 55) % 60),
        () => onChange(hour, (minute + 5) % 60),
      )}
    </View>
  );
}

/** Mes 9 pastilles : une par jour, pleine si je l'ai priée. */
export function MyDays({ myDays, current }: { myDays: number[]; current: number }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.dots} accessibilityLabel={`Jours priés : ${myDays.length} sur 9`}>
      {Array.from({ length: 9 }, (_, i) => {
        const day = i + 1;
        const on = myDays.includes(day);
        return (
          <View key={day} style={[styles.dot, on && styles.dotOn, day === current && !on && styles.dotCurrent]}>
            <Text style={[styles.dotText, on && styles.dotTextOn]}>{day}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Une neuvaine dans la page d'un groupe. Un toucher, ou le bouton, ouvre la neuvaine. */
export function NovenaCard({ novena, now = new Date() }: { novena: Novena; now?: Date }) {
  const { C, styles } = useThemed(stylesFor);
  const day = novenaDay(novena, now);
  const running = day >= 1 && day <= 9;
  const finished = day > 9;
  const prayed = running && novena.myDays.includes(day);
  return (
    <Pressable
      onPress={() => openNovena(novena.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${novena.title}, ${statusLabel(novena, now)}`}
    >
      <Text style={styles.title}>{novena.title}</Text>
      <Text style={styles.status}>{statusLabel(novena, now)}</Text>
      <Text style={styles.intention} numberOfLines={3}>
        {novena.intention}
      </Text>
      <MyDays myDays={novena.myDays} current={running ? day : 0} />
      {running ? (
        <Text style={styles.hint}>{prayedTodayLabel(novena.dayCounts[day - 1] ?? 0)}</Text>
      ) : finished ? (
        <Text style={styles.hint}>{finishersLabel(novena.finisherCount)}</Text>
      ) : null}
      {prayed ? (
        <View style={styles.prayedRow}>
          <Ionicons name="checkmark-circle" size={18} color={C.gold} />
          <Text style={styles.prayedText}>Tu as prié le jour {day}</Text>
        </View>
      ) : null}
      <Button
        label={running && !prayed ? prayDayLabel(day) : 'Voir la neuvaine'}
        kind={running && !prayed ? 'primary' : 'secondary'}
        onPress={() => openNovena(novena.id)}
      />
    </Pressable>
  );
}

/**
 * Mes neuvaines en cours aujourd'hui (jours 1 à 9), rafraîchies à chaque retour sur l'écran. Rien (liste vide) si
 * `enabled` est faux, si je n'en ai aucune ou si le serveur ne répond pas : aucune erreur n'est montrée.
 */
export function useRunningNovenas(enabled: boolean): MyNovena[] {
  const [running, setRunning] = useState<MyNovena[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setRunning([]);
        return;
      }
      let live = true;
      void myNovenas()
        .then((result) => {
          if (live) setRunning(result.ok ? runningNovenas(result.novenas, new Date()) : []);
        })
        .catch(() => {
          if (live) setRunning([]);
        });
      return () => {
        live = false;
      };
    }, [enabled]),
  );
  return running;
}

/** Une barre de 9 segments, un par jour de la neuvaine, pleins pour les jours que j'ai priés. */
function DaySegments({ myDays }: { myDays: number[] }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.segments} accessibilityLabel={`Jours priés : ${myDays.length} sur 9`}>
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[styles.segment, myDays.includes(i + 1) && styles.segmentOn]} />
      ))}
    </View>
  );
}

/**
 * Mes neuvaines en cours en cartes à faire défiler (l'accueil) : un toucher ouvre la neuvaine. Suivies de mes Rosaires vivants
 * (une carte chacun) : l'accueil n'a pas à les connaître, ce bloc partagé les lit lui-même.
 */
export function RunningNovenaCards({ items }: { items: MyNovena[] }) {
  const { C, styles } = useThemed(stylesFor);
  const rosaries = useMyRosaries(true);
  const now = new Date();
  return (
    <>
      {items.map((novena) => {
        const day = novenaDay(novena, now);
        const prayed = prayedToday(novena, now) === true;
        return (
          <Pressable
            key={novena.id}
            onPress={() => openNovena(novena.id)}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <Text style={styles.tileKicker} numberOfLines={1}>
              {`NEUVAINE · ${dayOfLabel(day)}`.toUpperCase()}
            </Text>
            <Text style={styles.tileTitle} numberOfLines={2}>
              {novena.title}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {novena.groupName}
            </Text>
            <DaySegments myDays={novena.myDays} />
            <View style={styles.tileFoot}>
              {prayed ? <Ionicons name="checkmark-circle" size={16} color={C.gold} /> : null}
              <Text style={prayed ? styles.rowSub : styles.rowTodo}>{prayed ? 'Prié aujourd’hui' : 'À prier aujourd’hui'}</Text>
            </View>
          </Pressable>
        );
      })}
      <LivingRosaryTiles items={rosaries} />
    </>
  );
}

/** Les lignes de « Neuvaines en cours », à poser dans une carte : un toucher ouvre la neuvaine. */
export function RunningNovenaRows({ items }: { items: MyNovena[] }) {
  const { C, styles } = useThemed(stylesFor);
  const now = new Date();
  return (
    <>
      {items.map((novena) => {
        const prayed = prayedToday(novena, now) === true;
        return (
          <Pressable
            key={novena.id}
            onPress={() => openNovena(novena.id)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <View style={styles.dayBadge}>
              <Text style={styles.dayBadgeKicker}>JOUR</Text>
              <Text style={styles.dayBadgeNum}>
                {novenaDay(novena, now)}
                <Text style={styles.dayBadgeOf}>/9</Text>
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {novena.title}
              </Text>
              <Text style={styles.rowSub} numberOfLines={2}>
                {dayOfLabel(novenaDay(novena, now))} · {novena.groupName}
              </Text>
              <Text style={prayed ? styles.rowSub : styles.rowTodo}>{prayed ? 'Prié aujourd’hui' : 'À prier aujourd’hui'}</Text>
            </View>
            {prayed ? <Ionicons name="checkmark-circle" size={20} color={C.gold} /> : null}
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        );
      })}
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.line },
    chipOn: { backgroundColor: C.gold, borderColor: C.gold },
    chipText: { color: C.text, fontWeight: '700', fontSize: 14 },
    chipTextOn: { color: C.onGold },
    steppers: { flexDirection: 'row', gap: 12 },
    stepper: { flex: 1, backgroundColor: C.cardHi, borderRadius: 14, padding: 12, gap: 6, alignItems: 'center' },
    stepperLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    stepperValue: { color: C.text, fontSize: 28, fontWeight: '800', minWidth: 44, textAlign: 'center' },
    stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.cardHi,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dotOn: { backgroundColor: C.gold },
    dotCurrent: { borderColor: C.gold },
    dotText: { color: C.text, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
    dotTextOn: { color: C.onGold },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    status: { color: C.gold, fontSize: 15, fontWeight: '700' },
    intention: { color: C.text, fontSize: 15, lineHeight: 22 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    prayedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    prayedText: { color: C.gold, fontSize: 14, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    dayBadge: { width: 52, height: 56, borderRadius: 14, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
    dayBadgeKicker: { color: C.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
    dayBadgeNum: { color: C.text, fontSize: 20, lineHeight: 24, fontWeight: '800' },
    dayBadgeOf: { color: C.muted, fontSize: 13, fontWeight: '700' },
    rowTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    rowSub: { color: C.muted, fontSize: 14, lineHeight: 20 },
    rowTodo: { color: C.gold, fontSize: 14, fontWeight: '800', lineHeight: 20 },
    tile: { width: 280, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 4 },
    tileKicker: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    tileTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
    tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    segments: { flexDirection: 'row', gap: 5, marginVertical: 12 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.track },
    segmentOn: { backgroundColor: C.gold },
  });
