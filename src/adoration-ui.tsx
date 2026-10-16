import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  type AdorationChain,
  coverage,
  coverageShort,
  coverageTag,
  currentOrNext,
  gapsLabel,
  hourLine,
  type MyAdorationSlot,
  myAdorationSlots,
  myCountLabel,
  myHourTitle,
  myUpcomingSlots,
  originMention,
  periodLabel,
  recurrenceLabel,
  slotDateLabel,
  slotPhase,
} from './adoration-chain';
import type { Palette } from './appearance';
import { openAdorationChain } from './group-ui';
import { Button } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

/** Ouvre l'adoration guidée avec la durée d'un créneau (30 ou 60 minutes). */
export function openAdoration(minutes: number) {
  router.push({ pathname: '/adoration', params: { minutes: String(minutes) } });
}

/** L'heure du téléphone, relue chaque minute : « bientôt ton heure » et « En ce moment » suivent sans recharger. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Mes prochains créneaux d'adoration, rafraîchis à chaque retour sur l'écran. Rien (liste vide) si `enabled` est faux, si je
 * n'en ai aucun ou si le serveur ne répond pas : aucune erreur n'est montrée.
 */
export function useMyAdorationSlots(enabled: boolean): MyAdorationSlot[] {
  const [slots, setSlots] = useState<MyAdorationSlot[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setSlots([]);
        return;
      }
      let live = true;
      void myAdorationSlots()
        .then((result) => {
          if (live) setSlots(result.ok ? result.slots : []);
        })
        .catch(() => {
          if (live) setSlots([]);
        });
      return () => {
        live = false;
      };
    }, [enabled]),
  );
  return slots;
}

/** Mon heure d'adoration en carte à faire défiler (l'accueil) : un toucher ouvre la chaîne. Rien s'il n'y a pas de créneau à venir. */
export function AdorationHourTile({ items }: { items: MyAdorationSlot[] }) {
  const { C, styles } = useThemed(stylesFor);
  const now = useNow();
  const next = currentOrNext(items, now);
  const line = hourLine(items, now);
  if (!next || !line) return null;
  return (
    <Pressable
      onPress={() => openAdorationChain(next.slot.chainId)}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
    >
      <View style={styles.tileKicker}>
        <Ionicons name={next.phase === 'live' ? 'radio-button-on' : 'sunny-outline'} size={14} color={C.gold} />
        <Text style={styles.tileKickerText} numberOfLines={1}>
          ADORATION
        </Text>
      </View>
      <Text style={styles.tileTitle} numberOfLines={3}>
        {line}
      </Text>
    </Pressable>
  );
}

/** Mon heure d'adoration en ligne (l'onglet Communauté), à poser dans une carte : un toucher ouvre la chaîne. */
export function AdorationHourRow({ items }: { items: MyAdorationSlot[] }) {
  const { C, styles } = useThemed(stylesFor);
  const now = useNow();
  const next = currentOrNext(items, now);
  const line = hourLine(items, now);
  if (!next || !line) return null;
  return (
    <Pressable
      onPress={() => openAdorationChain(next.slot.chainId)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
    >
      <View style={styles.badge}>
        <Ionicons name="sunny-outline" size={24} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={3}>
          {line}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {next.slot.title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

/** La barre de couverture : la part des créneaux qui ont au moins un adorateur. */
export function CoverageBar({ covered, total }: { covered: number; total: number }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.bar} accessibilityLabel={`${covered} créneaux couverts sur ${total}`}>
      <View style={[styles.barFill, { width: `${total > 0 ? Math.round((covered / total) * 100) : 0}%` }]} />
    </View>
  );
}

/** Une chaîne dans la page d'un groupe : l'occurrence en cours ou la prochaine. Un toucher, ou le bouton, ouvre la chaîne. */
export function AdorationChainCard({ chain }: { chain: AdorationChain }) {
  const { C, styles } = useThemed(stylesFor);
  const now = useNow();
  const occurrence = chain.occurrences[0];
  const slots = occurrence?.slots ?? [];
  const cover = coverage(slots);
  const finished = Date.parse(chain.endsAt) <= now.getTime();
  const live = !!occurrence && occurrence.start.getTime() <= now.getTime() && occurrence.end.getTime() > now.getTime();
  const weekly = chain.recurrence === 'weekly';
  const mine = myUpcomingSlots(chain, now);
  const next = mine[0];
  const phase = next ? slotPhase(next.start, next.end, now) : null;
  const hour = phase ? myHourTitle(phase) : null;
  const gaps = finished ? null : gapsLabel(slots, now);
  const mention = originMention(chain);
  const open = () => openAdorationChain(chain.id);
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${chain.title}, ${coverageShort(cover)}`}
    >
      <Text style={styles.title}>{chain.title}</Text>
      {weekly ? (
        <>
          <Text style={styles.when}>{recurrenceLabel(chain)}</Text>
          {occurrence ? (
            <Text style={styles.hint}>
              {finished ? 'Dernière : ' : live ? 'En cours : ' : 'Prochaine : '}
              {slotDateLabel(occurrence.start, occurrence.end)} · {coverageTag(cover)}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.when}>{periodLabel(chain)}</Text>
      )}
      {mention ? <Text style={styles.hint}>{mention}</Text> : null}
      <Text style={styles.hint}>{finished ? 'Chaîne terminée' : live ? 'En cours' : 'À venir'}</Text>
      {chain.place ? (
        <View style={styles.placeRow}>
          <Ionicons name="location-outline" size={14} color={C.muted} />
          <Text style={styles.hint}>{chain.place}</Text>
        </View>
      ) : null}
      <CoverageBar covered={cover.covered} total={cover.total} />
      {weekly ? null : <Text style={styles.coverage}>{coverageShort(cover)}</Text>}
      {gaps ? <Text style={styles.hint}>{gaps}</Text> : null}
      {hour ? (
        <Text style={styles.mine}>{hour}</Text>
      ) : next ? (
        <Text style={styles.mine}>Ton prochain créneau : {slotDateLabel(next.start, next.end)}</Text>
      ) : (
        <Text style={styles.hint}>{myCountLabel(0)}</Text>
      )}
      {phase === 'live' || phase === 'soon' ? (
        <Button label="Entrer en adoration" onPress={() => openAdoration(chain.slotMinutes)} />
      ) : null}
      <Button
        label={finished ? 'Voir la chaîne' : 'Réserver un créneau'}
        kind={phase === 'live' || phase === 'soon' || finished ? 'secondary' : 'primary'}
        onPress={open}
      />
    </Pressable>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 8 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    when: { color: C.gold, fontSize: 15, fontWeight: '700' },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    coverage: { color: C.text, fontSize: 14, fontWeight: '700' },
    mine: { color: C.gold, fontSize: 15, fontWeight: '700' },
    bar: { height: 6, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: C.gold },
    tile: { width: 280, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 4 },
    tileKicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tileKickerText: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800', flexShrink: 1 },
    tileTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    badge: { width: 52, height: 56, borderRadius: 14, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    rowSub: { color: C.muted, fontSize: 14, lineHeight: 20 },
  });
