import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { SERIF } from './cards';
import {
  focusTeam,
  holderLabel,
  type LivingRosary,
  type MyRosary,
  type MysteryCell,
  myRosaries,
  mysteryName,
  mysteryOfMonth,
  participantsLabel,
  prayedLabel,
  ROSARY_SLOTS,
  teamProgressLabel,
} from './living-rosary';
import { Button } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

export function openRosary(id: string) {
  router.push({ pathname: '/rosaire/[id]', params: { id } });
}

/** Un grain de la couronne, posé à sa place sur le cercle ; touchable si `onSelect` est donné. */
function Bead({
  cell,
  size,
  bead,
  numbers,
  selected,
  onSelect,
}: {
  cell: MysteryCell;
  size: number;
  bead: number;
  numbers: boolean;
  selected: boolean;
  onSelect?: (mystery: number) => void;
}) {
  const { styles } = useThemed(stylesFor);
  const state = !cell.taken ? 'free' : cell.prayed ? 'prayed' : 'taken';
  const angle = ((cell.mystery * 360) / ROSARY_SLOTS - 90) * (Math.PI / 180);
  const radius = (size - bead) / 2;
  const place = {
    position: 'absolute' as const,
    left: size / 2 + radius * Math.cos(angle) - bead / 2,
    top: size / 2 + radius * Math.sin(angle) - bead / 2,
  };
  const label = `Mystère ${cell.mystery + 1}, ${mysteryName(cell.mystery)}, ${
    cell.taken ? (cell.prayed ? 'dizaine priée aujourd’hui' : 'pas encore priée aujourd’hui') : 'à prendre'
  }`;
  const dot = (
    <View
      style={[
        styles.bead,
        { width: bead, height: bead, borderRadius: bead / 2 },
        state === 'prayed' && styles.beadPrayed,
        state === 'taken' && styles.beadTaken,
        state === 'free' && styles.beadFree,
        cell.mine && styles.beadMine,
        selected && { transform: [{ scale: 1.3 }] },
      ]}
    >
      {numbers ? (
        <Text style={[styles.beadNum, state === 'prayed' && styles.beadNumPrayed, { fontSize: Math.max(9, bead * 0.4) }]}>
          {cell.mystery + 1}
        </Text>
      ) : null}
    </View>
  );
  return onSelect ? (
    <Pressable onPress={() => onSelect(cell.mystery)} hitSlop={4} style={place} accessibilityRole="button" accessibilityLabel={label}>
      {dot}
    </Pressable>
  ) : (
    <View style={place} accessibilityLabel={label}>
      {dot}
    </View>
  );
}

/**
 * La couronne de 20 grains d'une équipe, un grain par mystère (le 1ᵉʳ en haut, dans le sens des aiguilles d'une montre) :
 * plein = dizaine priée aujourd'hui, contour = place prise mais pas encore priée, pointillé = mystère à prendre. Mon grain a
 * un contour du texte. `onSelect` rend les grains touchables (l'écran du Rosaire).
 */
export function Crown({
  cells,
  size,
  selected,
  onSelect,
  children,
}: {
  cells: MysteryCell[];
  size: number;
  selected?: number | null;
  onSelect?: (mystery: number) => void;
  children?: ReactNode;
}) {
  const { styles } = useThemed(stylesFor);
  const bead = Math.round(size * 0.115);
  const numbers = size >= 200;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      {cells.map((cell) => (
        <Bead
          key={cell.mystery}
          cell={cell}
          size={size}
          bead={bead}
          numbers={numbers}
          selected={selected === cell.mystery}
          onSelect={onSelect}
        />
      ))}
      <View style={[styles.crownCenter, { padding: bead * 1.4 }]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

/** Une ligne de plus : « Rosaire vivant » dans la page d'un groupe. Un toucher ouvre le Rosaire. */
export function LivingRosaryCard({ rosary, now = new Date() }: { rosary: LivingRosary; now?: Date }) {
  const { C, styles } = useThemed(stylesFor);
  const team = focusTeam(rosary);
  const me = rosary.me;
  const mystery = me ? mysteryOfMonth(rosary, me.slot, now) : null;
  return (
    <Pressable
      onPress={() => openRosary(rosary.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`Rosaire vivant, ${participantsLabel(rosary.participantCount)}`}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Rosaire vivant</Text>
          <Text style={styles.sub}>{participantsLabel(rosary.participantCount)}</Text>
        </View>
        {team ? (
          <Crown cells={team.mysteries} size={92}>
            <Ionicons name="rose-outline" size={18} color={C.faint} />
          </Crown>
        ) : null}
      </View>
      {team ? <Text style={styles.hint}>{teamProgressLabel(team.prayedCount)}</Text> : null}
      {me && mystery !== null ? (
        <>
          <Text style={styles.mine}>Ta dizaine : {mysteryName(mystery)}</Text>
          {me.prayedToday ? (
            <View style={styles.prayedRow}>
              <Ionicons name="checkmark-circle" size={18} color={C.gold} />
              <Text style={styles.prayedText}>Tu as prié ta dizaine aujourd’hui</Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>
          {rosary.openTeam === null ? 'Ce Rosaire vivant est complet.' : 'Prends un mystère : une dizaine par jour, c’est tout.'}
        </Text>
      )}
      <Button
        label={me ? (me.prayedToday ? 'Voir le Rosaire vivant' : 'Prier ma dizaine') : 'Voir le Rosaire vivant'}
        kind={me && !me.prayedToday ? 'primary' : 'secondary'}
        onPress={() => openRosary(rosary.id)}
      />
    </Pressable>
  );
}

/**
 * Mes Rosaires vivants (ceux où j'ai une place), rafraîchis à chaque retour sur l'écran. Rien (liste vide) si `enabled` est
 * faux, si je n'en ai aucun ou si le serveur ne répond pas : aucune erreur n'est montrée.
 */
export function useMyRosaries(enabled: boolean): MyRosary[] {
  const [list, setList] = useState<MyRosary[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setList([]);
        return;
      }
      let live = true;
      void myRosaries()
        .then((result) => {
          if (live) setList(result.ok ? result.rosaries : []);
        })
        .catch(() => {
          if (live) setList([]);
        });
      return () => {
        live = false;
      };
    }, [enabled]),
  );
  return list;
}

/** Mes Rosaires vivants en cartes à faire défiler (l'accueil, via RunningNovenaCards) : un toucher ouvre le Rosaire. */
export function LivingRosaryTiles({ items }: { items: MyRosary[] }) {
  const { C, styles } = useThemed(stylesFor);
  const now = new Date();
  return (
    <>
      {items.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => openRosary(r.id)}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
        >
          <Text style={styles.tileKicker} numberOfLines={1}>
            ROSAIRE VIVANT
          </Text>
          <Text style={styles.tileTitle} numberOfLines={2}>
            {mysteryName(mysteryOfMonth(r, r.slot, now))}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {r.groupName}
          </Text>
          <View style={styles.tileFoot}>
            {r.prayedToday ? <Ionicons name="checkmark-circle" size={16} color={C.gold} /> : null}
            <Text style={r.prayedToday ? styles.sub : styles.todo}>{prayedLabel(r.prayedToday)}</Text>
          </View>
        </Pressable>
      ))}
    </>
  );
}

/** Les lignes « Rosaire vivant » de l'onglet Communauté, à poser dans une carte : un toucher ouvre le Rosaire. */
export function LivingRosaryRows({ items }: { items: MyRosary[] }) {
  const { C, styles } = useThemed(stylesFor);
  const now = new Date();
  return (
    <>
      {items.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => openRosary(r.id)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
        >
          <View style={styles.badge}>
            <Ionicons name="rose-outline" size={24} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {mysteryName(mysteryOfMonth(r, r.slot, now))}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              Rosaire vivant · {r.groupName}
            </Text>
            <Text style={r.prayedToday ? styles.sub : styles.todo}>{prayedLabel(r.prayedToday)}</Text>
          </View>
          {r.prayedToday ? <Ionicons name="checkmark-circle" size={20} color={C.gold} /> : null}
          <Ionicons name="chevron-forward" size={18} color={C.faint} />
        </Pressable>
      ))}
    </>
  );
}

/** « @marie », « Toi », « Un membre » ou « Libre » : qui prie ce mystère ce mois-ci. */
export const holderOrFree = (cell: MysteryCell) => holderLabel(cell) ?? 'Libre';

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    bead: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    beadPrayed: { backgroundColor: C.gold, borderColor: C.gold },
    beadTaken: { backgroundColor: 'transparent', borderColor: C.gold },
    beadFree: { backgroundColor: 'transparent', borderColor: C.faint, borderStyle: 'dashed' },
    beadMine: { borderColor: C.text },
    beadNum: { color: C.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
    beadNumPrayed: { color: C.onGold },
    crownCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { color: C.text, fontSize: 18, fontWeight: '800' },
    sub: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    mine: { color: C.gold, fontFamily: SERIF, fontSize: 17, fontWeight: '700' },
    prayedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    prayedText: { color: C.gold, fontSize: 14, fontWeight: '700' },
    todo: { color: C.gold, fontSize: 14, fontWeight: '800', lineHeight: 20 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    badge: { width: 52, height: 56, borderRadius: 14, backgroundColor: C.cardHi, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    tile: { width: 280, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 20, gap: 4 },
    tileKicker: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    tileTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
    tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  });
