import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BOOKS, loadBook } from './data/bible';
import { MYSTERIES } from './data/prayers';
import type { RosarySession } from './storage';
import { usePalette } from './theme';

// Le chapelet guidé : la suite des prières, grain après grain, et le chapelet dessiné qui se remplit.
//
// Les grains sont numérotés dans l'ordre où on les prie : la croix (0), le gros grain (1), les trois
// petits (2 à 4), le gros grain de la première dizaine (5), puis chaque dizaine (6 + d × 11, dix grains)
// précédée de son gros grain (5 + d × 11), et enfin la médaille (60) pour le Salut, ô Reine.

export type StepKind = 'sign' | 'credo' | 'pater' | 'ave' | 'gloria' | 'fatima' | 'mystery' | 'salve' | 'closing';

export type RosaryStep = {
  kind: StepKind;
  bead: number | null; // null : prière dite sur la chaîne, sans grain
  decade: number | null;
  count?: number; // pour les Je vous salue Marie : 1, 2, 3…
  of?: number;
  intent?: string; // « pour la foi »…
};

const CROSS = 0;
const MEDAL = 60;
const bigBead = (d: number) => 5 + d * 11;
const smallBead = (d: number, i: number) => 6 + d * 11 + i;

export const PRAYER_OF: Partial<Record<StepKind, string>> = {
  sign: 'signe-de-croix',
  credo: 'je-crois-en-dieu',
  pater: 'notre-pere',
  ave: 'je-vous-salue-marie',
  gloria: 'gloire-au-pere',
  fatima: 'o-mon-jesus',
  salve: 'salve-regina',
};

function decadeSteps(d: number, fatima: boolean): RosaryStep[] {
  return [
    { kind: 'mystery', bead: bigBead(d), decade: d },
    { kind: 'pater', bead: bigBead(d), decade: d },
    ...Array.from({ length: 10 }, (_, i): RosaryStep => ({ kind: 'ave', bead: smallBead(d, i), decade: d, count: i + 1, of: 10 })),
    { kind: 'gloria', bead: null, decade: d },
    ...(fatima ? [{ kind: 'fatima', bead: null, decade: d } as RosaryStep] : []),
  ];
}

/** decade : null pour le chapelet entier, sinon l'indice de la seule dizaine à prier. */
export function rosarySteps(decade: number | null, fatima: boolean): RosaryStep[] {
  const sign: RosaryStep = { kind: 'sign', bead: null, decade: null };
  if (decade !== null) return [sign, ...decadeSteps(decade, fatima), { kind: 'closing', bead: null, decade: null }];
  const intents = ['pour la foi', 'pour l’espérance', 'pour la charité'];
  return [
    sign,
    { kind: 'credo', bead: CROSS, decade: null },
    { kind: 'pater', bead: 1, decade: null },
    ...intents.map((intent, i): RosaryStep => ({ kind: 'ave', bead: 2 + i, decade: null, count: i + 1, of: 3, intent })),
    { kind: 'gloria', bead: null, decade: null },
    ...[0, 1, 2, 3, 4].flatMap((d) => decadeSteps(d, fatima)),
    { kind: 'salve', bead: MEDAL, decade: null },
    { kind: 'closing', bead: null, decade: null },
  ];
}

/** « 3ᵉ mystère douloureux » */
export const mysteryOrdinal = (set: number, d: number) => `${d === 0 ? '1ᵉʳ' : `${d + 1}ᵉ`} mystère ${MYSTERIES[set].adjective}`;

/** Le verset d'Écriture associé au mystère, dans la Louis Segond embarquée. */
export function mysteryVerse(set: number, d: number) {
  const [b, c, f, t] = MYSTERIES[set].verses[d];
  const text = loadBook(b)
    [c - 1].slice(f - 1, t)
    .join(' ')
    .replace(/\s+([,.])/g, '$1')
    .trim()
    .replace(/[,;:]$/, '…');
  return { text, ref: `${BOOKS[b - 1].name} ${c}:${f}${t > f ? `-${t}` : ''}` };
}

/** Où on en est, en quelques mots : pour la carte « Reprendre » et l'onglet Prières. */
export function sessionLabel(s: RosarySession) {
  const set = MYSTERIES[s.set];
  if (s.decade !== null) return `${set.mysteries[s.decade]} · une dizaine`;
  const step = rosarySteps(null, s.fatima)[s.step];
  if (!step || step.decade === null)
    return `${set.name} · ${!step || step.kind === 'salve' || step.kind === 'closing' ? 'conclusion' : 'introduction'}`;
  return `${set.name} · dizaine ${step.decade + 1} sur 5`;
}

/** Le grain sur lequel on en est : celui de l'étape, ou le dernier grain passé si on prie sur la chaîne. */
export function litBead(steps: RosaryStep[], index: number): number | null {
  for (let i = index; i >= 0; i--) if (steps[i].bead !== null) return steps[i].bead;
  return null;
}

type Pos = { x: number; y: number; d: number; big?: boolean };

/** Positions des 61 grains autour d'un cercle de rayon r, la médaille en bas et le pendentif dessous. */
function layout(r: number) {
  const loop = 55; // médaille + 5 × 10 petits grains + 4 gros grains
  const u = (2 * Math.PI * r) / loop;
  const small = Math.max(5, u * 0.62);
  const big = small * 1.65;
  const pos: Pos[] = [];
  const at = (k: number) => {
    const a = Math.PI / 2 + (k * 2 * Math.PI) / loop;
    return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) };
  };
  for (let b = 5 + 1; b < MEDAL; b++) {
    const isBig = (b - 5) % 11 === 0;
    pos[b] = { ...at(b - 5), d: isBig ? big : small, big: isBig };
  }
  pos[MEDAL] = { ...at(0), d: big * 1.35, big: true };
  // Le pendentif, de la médaille vers la croix.
  const x = r;
  let y = 2 * r + u * 1.7;
  pos[5] = { x, y, d: big, big: true };
  for (const b of [4, 3, 2]) {
    y += b === 4 ? u * 1.3 : u;
    pos[b] = { x, y, d: small };
  }
  y += u * 1.3;
  pos[1] = { x, y, d: big, big: true };
  y += u * 2;
  pos[CROSS] = { x, y, d: big * 1.8 };
  return { pos, height: y + big * 1.8 * 0.6, u };
}

function Halo({ size, color }: { size: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1400, useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: size,
          backgroundColor: color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        },
      ]}
    />
  );
}

/**
 * Le chapelet dessiné : les grains déjà priés sont dorés, le grain courant pulse.
 * Toucher le chapelet fait avancer d'un grain ; children s'affiche au centre de l'anneau.
 */
export function RosaryBeads({
  steps,
  index,
  diameter,
  onPress,
  bead,
  prayed,
  children,
}: {
  steps: RosaryStep[];
  index: number;
  diameter: number;
  onPress?: () => void;
  /** Couleur des grains encore à prier, et des grains déjà priés. */
  bead?: string;
  prayed?: string;
  children?: ReactNode;
}) {
  const C = usePalette();
  const beadColor = bead ?? '#c4a46a';
  const litColor = prayed ?? C.gold;
  const r = diameter / 2;
  const { pos, height } = useMemo(() => layout(r), [r]);
  const lit = litBead(steps, index);
  const onBead = steps[index]?.bead !== null && steps[index]?.bead !== undefined;
  // Grains priés : ceux des étapes passées (une dizaine seule ne dore que ses propres grains).
  const done = useMemo(
    () =>
      new Set(
        steps
          .slice(0, index)
          .map((s) => s.bead)
          .filter((b): b is number => b !== null),
      ),
    [steps, index],
  );
  const used = useMemo(() => new Set(steps.map((s) => s.bead)), [steps]);
  const pad = 14;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Grain suivant"
      style={{ width: diameter + pad * 2, height: height + pad * 2, alignSelf: 'center' }}
    >
      <View
        style={{
          position: 'absolute',
          left: pad,
          top: pad,
          width: diameter,
          height: diameter,
          borderRadius: r,
          borderWidth: 1,
          borderColor: C.line,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: pad + r - 0.5,
          top: pad + diameter,
          width: 1,
          height: height - diameter - 10,
          backgroundColor: C.line,
        }}
      />
      {pos.map((p, b) => {
        if (!p) return null;
        const isLit = b === lit;
        const isDone = done.has(b) || isLit;
        const inSession = used.has(b);
        const color = isDone ? litColor : beadColor;
        const opacity = inSession ? 1 : 0.28;
        if (b === CROSS) {
          const s = p.d;
          return (
            <View
              key={b}
              pointerEvents="none"
              style={{ position: 'absolute', left: pad + p.x - s / 2, top: pad + p.y - s / 2, width: s, height: s }}
            >
              {isLit && onBead && <Halo size={s} color={litColor} />}
              <View
                style={{
                  position: 'absolute',
                  left: s / 2 - s * 0.09,
                  top: 0,
                  width: s * 0.18,
                  height: s,
                  borderRadius: 2,
                  backgroundColor: color,
                  opacity,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  left: s * 0.15,
                  top: s * 0.26,
                  width: s * 0.7,
                  height: s * 0.18,
                  borderRadius: 2,
                  backgroundColor: color,
                  opacity,
                }}
              />
            </View>
          );
        }
        return (
          <View
            key={b}
            pointerEvents="none"
            style={{ position: 'absolute', left: pad + p.x - p.d / 2, top: pad + p.y - p.d / 2, width: p.d, height: p.d }}
          >
            {isLit && onBead && <Halo size={p.d} color={litColor} />}
            <View
              style={{
                flex: 1,
                borderRadius: b === MEDAL ? p.d * 0.3 : p.d,
                backgroundColor: color,
                opacity,
                transform: b === MEDAL ? [{ rotate: '45deg' }, { scale: 0.75 }] : undefined,
                borderWidth: isLit ? 2 : 0,
                borderColor: '#fff6dc',
              }}
            />
          </View>
        );
      })}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: pad,
          top: pad,
          width: diameter,
          height: diameter,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}
