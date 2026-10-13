import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Fact, type Person, type Quiz, THEME_GRADIENTS, type Verse } from './data/content';

export const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });

type Gradient = [string, string, ...string[]];

function Shell({ colors, height, children }: { colors: Gradient; height: number; children: ReactNode }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[styles.card, { height }]}>
      {children}
    </LinearGradient>
  );
}

function Kicker({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.kicker}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.8)" />
      <Text style={styles.kickerText}>{label}</Text>
    </View>
  );
}

function RailButton({
  icon,
  label,
  count,
  active,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  active?: boolean;
  color?: string;
  onPress: () => void;
}) {
  const visible = count === undefined ? label : String(count);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.railBtn}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
    >
      <Ionicons name={icon} size={30} color={active && color ? color : '#fff'} />
      <Text style={styles.railLabel} numberOfLines={1}>
        {visible}
      </Text>
    </Pressable>
  );
}

type Actions = {
  liked: boolean;
  saved: boolean;
  onLike: (force?: boolean) => void;
  onSave: () => void;
  onShare: () => void;
  likeCount?: number;
  echoCount?: number;
  onEchoes?: () => void;
};

/** Zone de contenu : un double-tap aime le passage, avec le gros cœur des réels. */
function DoubleTapArea({ onLike, children }: { onLike: (force?: boolean) => void; children: ReactNode }) {
  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onLike(true);
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 300, useNativeDriver: true }),
      ]).start();
    }
    lastTap.current = now;
  };

  return (
    <Pressable style={[styles.center, styles.withRail]} onPress={handlePress}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bigHeart,
          { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}
      >
        <Ionicons name="heart" size={110} color="#ff4d6d" />
      </Animated.View>
    </Pressable>
  );
}

function Rail({ liked, saved, onLike, onSave, onShare, likeCount, echoCount, onEchoes, extra }: Actions & { extra?: ReactNode }) {
  return (
    <View style={styles.rail}>
      <RailButton
        icon={liked ? 'heart' : 'heart-outline'}
        label="J’aime"
        count={likeCount}
        active={liked}
        color="#ff4d6d"
        onPress={() => onLike()}
      />
      {onEchoes ? <RailButton icon="chatbubble-outline" label="Échos" count={echoCount} onPress={onEchoes} /> : null}
      <RailButton icon={saved ? 'bookmark' : 'bookmark-outline'} label="Garder" active={saved} color="#ffd166" onPress={onSave} />
      {extra}
      <RailButton icon="share-outline" label="Partager" onPress={onShare} />
    </View>
  );
}

export function VerseCard({ verse, height, onRead, ...actions }: Actions & { verse: Verse; height: number; onRead: () => void }) {
  const long = verse.text.length > 220;
  return (
    <Shell colors={THEME_GRADIENTS[verse.theme]} height={height}>
      <DoubleTapArea onLike={actions.onLike}>
        <Text selectable={false} style={[styles.verseText, long && styles.verseTextLong]}>
          {verse.text}
        </Text>
        <Text style={styles.reference}>{verse.reference}</Text>
      </DoubleTapArea>

      <View style={styles.footer} pointerEvents="box-none">
        <Text style={styles.tag}>#{verse.theme}</Text>
        <Text style={styles.footerHint}>Louis Segond 1910 · double-tap pour aimer</Text>
      </View>

      <Rail {...actions} extra={<RailButton icon="book-outline" label="Contexte" onPress={onRead} />} />
    </Shell>
  );
}

// ——— Lecture suivie ———

/** Une ambiance de couleur par grande partie de la Bible, stable pendant toute la lecture d'un livre. */
export function bookGradient(n: number): Gradient {
  if (n <= 5) return ['#140d06', '#3a2410', '#74471d']; // Pentateuque
  if (n <= 17) return ['#0e0f14', '#262b38', '#454d61']; // Livres historiques
  if (n <= 22) return ['#0b1424', '#1d3557', '#3d5a80']; // Livres poétiques
  if (n <= 39) return ['#1a0a0a', '#451414', '#76301f']; // Prophètes
  if (n <= 43) return ['#071a14', '#0f3d2e', '#29684b']; // Évangiles
  if (n <= 65) return ['#120c24', '#2c1e52', '#4f3c84']; // Actes et lettres
  return ['#0a0a0a', '#2b1d0e', '#80621d']; // Apocalypse
}

export function FactCard({ fact, height }: { fact: Fact; height: number }) {
  return (
    <Shell colors={['#0d0d12', '#1d1d2b', '#2c2c44']} height={height}>
      <View style={styles.center}>
        <Kicker icon="bulb-outline" label="LE SAVIEZ-VOUS ?" />
        <Text style={styles.title}>{fact.title}</Text>
        <Text style={styles.body}>{fact.text}</Text>
      </View>
    </Shell>
  );
}

export function QuizCard({ quiz, height }: { quiz: Quiz; height: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <Shell colors={['#100a2b', '#2a1a5e', '#4b3291']} height={height}>
      <View style={styles.center}>
        <Kicker icon="help-circle-outline" label="QUIZ" />
        <Text style={styles.title}>{quiz.question}</Text>
        <View style={styles.options}>
          {quiz.options.map((opt, i) => {
            const state = picked === null ? 'idle' : i === quiz.answer ? 'right' : i === picked ? 'wrong' : 'dim';
            return (
              <Pressable
                key={opt}
                disabled={picked !== null}
                onPress={() => setPicked(i)}
                style={[styles.option, styles[`option_${state}`]]}
              >
                <Text style={styles.optionText}>{opt}</Text>
                {state === 'right' && <Ionicons name="checkmark-circle" size={22} color="#fff" />}
                {state === 'wrong' && <Ionicons name="close-circle" size={22} color="#fff" />}
              </Pressable>
            );
          })}
        </View>
        {picked !== null && (
          <Text style={styles.explanation}>
            {picked === quiz.answer ? 'Bravo ! ' : 'Presque ! '}
            {quiz.explanation}
          </Text>
        )}
      </View>
    </Shell>
  );
}

export function PersonCard({ person, height }: { person: Person; height: number }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Shell colors={['#1a120b', '#3b2a1a', '#6b4e2e']} height={height}>
      <View style={styles.center}>
        <Kicker icon="person-outline" label="QUI SUIS-JE ?" />
        {person.clues.map((c, i) => (
          <Text key={c} style={styles.clue}>
            {i + 1}. {c}
          </Text>
        ))}
        {revealed ? (
          <View style={styles.reveal}>
            <Text style={styles.revealName}>{person.name}</Text>
            <Text style={styles.reference}>{person.reference}</Text>
          </View>
        ) : (
          <Pressable style={styles.pill} onPress={() => setRevealed(true)}>
            <Text style={styles.pillText}>Révéler</Text>
          </Pressable>
        )}
      </View>
    </Shell>
  );
}

export function ReflectionCard({ prompt, height }: { prompt: string; height: number }) {
  return (
    <Shell colors={['#0a1414', '#12262a', '#1f3d3f']} height={height}>
      <View style={styles.center}>
        <Kicker icon="leaf-outline" label="UN INSTANT POUR TOI" />
        <Text style={[styles.verseText, { fontStyle: 'italic' }]}>{prompt}</Text>
      </View>
    </Shell>
  );
}

const BREATH_CYCLES = 4;

export function PauseCard({ count, minutes, height }: { count: number; minutes: number; height: number }) {
  const [breathing, setBreathing] = useState(false);
  const [phase, setPhase] = useState<'Inspire…' | 'Expire…' | 'Amen.'>('Inspire…');
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!breathing) return;
    const easing = Easing.inOut(Easing.quad);
    const steps: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < BREATH_CYCLES; i++) {
      steps.push(
        Animated.timing(scale, { toValue: 1, duration: 4000, easing, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.6, duration: 4000, easing, useNativeDriver: true }),
      );
    }
    const id = scale.addListener(({ value }) =>
      setPhase((p) => (p === 'Amen.' ? p : value > 0.95 ? 'Expire…' : value < 0.65 ? 'Inspire…' : p)),
    );
    Animated.sequence(steps).start(({ finished }) => finished && setPhase('Amen.'));
    return () => {
      scale.removeListener(id);
      scale.stopAnimation();
    };
  }, [breathing, scale]);

  return (
    <Shell colors={['#050507', '#0e1016', '#171a24']} height={height}>
      <View style={styles.center}>
        <Kicker icon="pause-circle-outline" label="PAUSE" />
        <Text style={styles.title}>
          {count} cartes{minutes > 0 ? ` en ${minutes} min` : ''}.
        </Text>
        <Text style={styles.body}>
          « Arrêtez, et sachez que je suis Dieu. » — Psaumes 46:11{'\n\n'}Et si tu respirais 30 secondes avant de continuer ?
        </Text>
        <Pressable onPress={() => setBreathing(true)} disabled={breathing} style={styles.breathWrap}>
          <Animated.View style={[styles.breathCircle, { transform: [{ scale }] }]} />
          <Text style={styles.breathText}>{breathing ? phase : 'Respirer'}</Text>
        </Pressable>
        <Text style={styles.footerHint}>Ou glisse pour continuer.</Text>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  withRail: { paddingRight: 80 },
  verseText: { color: '#fff', fontFamily: SERIF, fontSize: 30, lineHeight: 42, textAlign: 'left' },
  verseTextLong: { fontSize: 22, lineHeight: 32 },
  reference: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    letterSpacing: 2.5,
    marginTop: 24,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  bigHeart: { position: 'absolute', alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  footer: { position: 'absolute', left: 24, right: 90, bottom: 36 },
  tag: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footerHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 6 },
  rail: { position: 'absolute', right: 10, bottom: 40, alignItems: 'center', gap: 20 },
  railBtn: { alignItems: 'center', width: 64 },
  railLabel: { color: '#fff', fontSize: 11, marginTop: 3, fontWeight: '600' },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  kickerText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: 2.5, fontWeight: '700' },
  title: { color: '#fff', fontSize: 28, lineHeight: 36, fontWeight: '700', marginBottom: 16 },
  body: { color: 'rgba(255,255,255,0.88)', fontSize: 18, lineHeight: 28 },
  options: { gap: 12, marginTop: 8 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  option_idle: { backgroundColor: 'rgba(255,255,255,0.08)' },
  option_right: { backgroundColor: '#2a9d6a', borderColor: '#2a9d6a' },
  option_wrong: { backgroundColor: '#c8445a', borderColor: '#c8445a' },
  option_dim: { opacity: 0.4 },
  optionText: { color: '#fff', fontSize: 17, fontWeight: '600', flexShrink: 1 },
  explanation: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 18, lineHeight: 24 },
  clue: { color: '#fff', fontFamily: SERIF, fontSize: 21, lineHeight: 30, marginBottom: 12 },
  reveal: { marginTop: 18 },
  revealName: { color: '#ffd166', fontSize: 34, fontWeight: '800' },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  breathWrap: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginVertical: 28 },
  breathCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(140,170,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(160,190,255,0.5)',
  },
  breathText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
