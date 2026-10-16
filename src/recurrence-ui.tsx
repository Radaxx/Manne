import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { dayLabel, shiftDay, WEEKDAYS } from './dates';
import { WEEK_ORDER } from './gatherings';
import { haptic } from './haptics';
import { Chip } from './novena-ui';
import { Text } from './text';
import { useThemed } from './theme';

// Morceaux de formulaire partagés par les rendez-vous et les chaînes d'adoration récurrents : les jours de la semaine, la durée
// « Pendant » et un sélecteur de date. Rien n'est gardé : l'écran qui les pose garde l'état.

const capital = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** Anime le prochain changement de mise en page (un repli, un dépli) : sobre, 200 ms. */
export function animateNext() {
  LayoutAnimation.configureNext(LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

const COLLAPSE_MS = 260;

/**
 * Un bloc qui se replie et se déplie en douceur : la hauteur, l'opacité (et le chevron, voir `Chevron`) suivent la même
 * courbe. LayoutAnimation ne s'anime pas sur Android avec la nouvelle architecture : on mesure donc le contenu et on anime
 * sa hauteur avec Animated. Le contenu n'est rendu qu'à la première ouverture, puis reste en place (une longue chaîne a
 * beaucoup de créneaux). `spacing` annule l'écart (`gap`) du parent quand le bloc est replié.
 */
export function Collapsible({ open, spacing = 0, children }: { open: boolean; spacing?: number; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (open) setMounted(true);
    const run = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: COLLAPSE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [open, progress]);
  return (
    <Animated.View
      style={{
        height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        marginTop: progress.interpolate({ inputRange: [0, 1], outputRange: [-spacing, 0] }),
        opacity: progress,
        overflow: 'hidden',
      }}
      pointerEvents={open ? 'auto' : 'none'}
    >
      {mounted ? (
        <View style={collapseStyles.measure} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Le chevron d'un bloc repliable : il tourne en même temps que le bloc s'ouvre. */
export function Chevron({ open, color }: { open: boolean; color: string }) {
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    const run = Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: COLLAPSE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [open, turn]);
  return (
    <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
      <Ionicons name="chevron-down" size={20} color={color} />
    </Animated.View>
  );
}

const collapseStyles = StyleSheet.create({
  // Mesuré hors du flux : sa hauteur naturelle ne dépend pas de la hauteur animée du parent.
  measure: { position: 'absolute', top: 0, left: 0, right: 0 },
});

/**
 * Les jours de la semaine, du lundi au dimanche, à cocher (un au moins). Le dernier jour coché ne se décoche pas : un
 * rendez-vous a toujours un jour.
 */
export function WeekdayChips({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  const { styles } = useThemed(stylesFor);
  const toggle = (day: number) => {
    if (days.includes(day)) {
      if (days.length > 1) onChange(days.filter((d) => d !== day));
    } else {
      onChange([...days, day]);
    }
  };
  return (
    <View style={styles.chips}>
      {WEEK_ORDER.map((day) => (
        <Chip key={day} label={capital(WEEKDAYS[day])} on={days.includes(day)} onPress={() => toggle(day)} />
      ))}
      <Chip label="Tous les jours" on={days.length === 7} onPress={() => onChange([...WEEK_ORDER])} />
    </View>
  );
}

/**
 * Un jour (AAAA-MM-JJ) à choisir entre `min` et `max`, par pas d'un jour ou d'une semaine. `value` en toutes lettres :
 * « mardi 30 novembre ».
 */
export function DateStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (iso: string) => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const step = (days: number) => {
    const next = shiftDay(value, days);
    onChange(next < min ? min : next > max ? max : next);
  };
  const button = (icon: keyof typeof Ionicons.glyphMap, days: number, text: string, disabled: boolean) => (
    <Pressable
      onPress={() => {
        haptic('light');
        step(days);
      }}
      disabled={disabled}
      hitSlop={6}
      style={[styles.dateBtn, disabled && { opacity: 0.35 }]}
      accessibilityRole="button"
      accessibilityLabel={text}
    >
      <Ionicons name={icon} size={18} color={C.gold} />
      <Text style={styles.dateBtnText}>{Math.abs(days) === 7 ? '7 j' : '1 j'}</Text>
    </Pressable>
  );
  return (
    <View style={styles.dateBox}>
      <Text style={styles.dateLabel}>{label}</Text>
      <View style={styles.dateRow}>
        {button('play-back', -7, 'Une semaine plus tôt', value <= min)}
        {button('chevron-back', -1, 'Un jour plus tôt', value <= min)}
        <Text style={styles.dateValue}>{capital(dayLabel(value))}</Text>
        {button('chevron-forward', 1, 'Un jour plus tard', value >= max)}
        {button('play-forward', 7, 'Une semaine plus tard', value >= max)}
      </View>
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dateBox: { backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 8, marginTop: 12 },
    dateLabel: { color: C.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    dateValue: { flex: 1, color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    dateBtn: {
      minWidth: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.cardHi,
      paddingHorizontal: 6,
    },
    dateBtnText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  });
