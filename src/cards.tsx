import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookMeta } from './data/bible';
import { THEME_GRADIENTS, type Fact, type Person, type Quiz, type Verse } from './data/content';
import type { ReadingPassage } from './reading';

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

function RailButton({ icon, label, active, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.railBtn} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={30} color={active && color ? color : '#fff'} />
      <Text style={styles.railLabel}>{label}</Text>
    </Pressable>
  );
}

type Actions = {
  liked: boolean;
  saved: boolean;
  onLike: (force?: boolean) => void;
  onSave: () => void;
  onShare: () => void;
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
      <Animated.View pointerEvents="none" style={[styles.bigHeart, { opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
        <Ionicons name="heart" size={110} color="#ff4d6d" />
      </Animated.View>
    </Pressable>
  );
}

function Rail({ liked, saved, onLike, onSave, onShare, extra }: Actions & { extra?: ReactNode }) {
  return (
    <View style={styles.rail}>
      <RailButton icon={liked ? 'heart' : 'heart-outline'} label="J’aime" active={liked} color="#ff4d6d" onPress={() => onLike()} />
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

export function BookIntroCard({ book, intro, height }: { book: BookMeta; intro: string; height: number }) {
  return (
    <Shell colors={bookGradient(book.n)} height={height}>
      <View style={styles.center}>
        <Kicker icon="library-outline" label={book.n >= 40 ? 'NOUVEAU TESTAMENT' : 'ANCIEN TESTAMENT'} />
        <Text style={styles.bookTitle}>{book.name}</Text>
        <Text style={styles.bookMeta}>
          {book.verses.length} chapitre{book.verses.length > 1 ? 's' : ''} · environ {Math.max(1, Math.round(book.verses.reduce((a, b) => a + b, 0) / 25))} min de lecture
        </Text>
        <Text style={styles.body}>{intro}</Text>
        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.footerHint}>Glisse pour commencer la lecture</Text>
        </View>
      </View>
    </Shell>
  );
}

export function PassageCard({ passage, book, height, ...actions }: Actions & { passage: ReadingPassage; book: BookMeta; height: number }) {
  const size = passage.text.length < 260 ? styles.passageL : passage.text.length < 400 ? styles.passageM : styles.passageS;
  const chapters = book.verses.length;
  const done = (passage.chapter - 1 + passage.to / book.verses[passage.chapter - 1]) / chapters;
  return (
    <Shell colors={bookGradient(book.n)} height={height}>
      <DoubleTapArea onLike={actions.onLike}>
        <Text style={styles.passageRef}>
          {book.name} {passage.chapter} · v. {passage.from}
          {passage.to > passage.from ? `–${passage.to}` : ''}
        </Text>
        <Text selectable={false} style={[styles.passageText, size]}>
          {passage.verses.map(([n, t]) => (
            <Text key={n}>
              <Text style={styles.verseNum}>{n} </Text>
              {t}{' '}
            </Text>
          ))}
        </Text>
      </DoubleTapArea>

      <View style={styles.footer} pointerEvents="box-none">
        <Text style={styles.footerHint}>
          {book.name} · chapitre {passage.chapter}/{chapters}
        </Text>
        <View style={styles.bookTrack}>
          <View style={[styles.bookFill, { width: `${Math.round(done * 100)}%` }]} />
        </View>
      </View>

      <Rail {...actions} />
    </Shell>
  );
}

export function ChapterEndCard({ book, chapter, prompt, chaptersToday, height }: { book: BookMeta; chapter: number; prompt: string; chaptersToday: number; height: number }) {
  const last = chapter === book.verses.length;
  return (
    <Shell colors={['#050507', '#0e1016', '#171a24']} height={height}>
      <View style={styles.center}>
        <Kicker icon="checkmark-circle-outline" label={last ? 'LIVRE TERMINÉ' : 'FIN DU CHAPITRE'} />
        <Text style={styles.title}>
          {book.name} {chapter} ✓
        </Text>
        <Text style={[styles.verseText, styles.verseTextLong, { fontStyle: 'italic', marginBottom: 28 }]}>{prompt}</Text>
        <Text style={styles.footerHint}>
          {chaptersToday} chapitre{chaptersToday > 1 ? 's' : ''} lu{chaptersToday > 1 ? 's' : ''} aujourd’hui.
          {last ? ` Tu as lu tout le livre de ${book.name} !` : ' Prends un instant avant de continuer.'}
        </Text>
      </View>
    </Shell>
  );
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
              <Pressable key={opt} disabled={picked !== null} onPress={() => setPicked(i)} style={[styles.option, styles[`option_${state}`]]}>
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

export function PlanGoalCard({ planTitle, height }: { planTitle: string; height: number }) {
  return (
    <Shell colors={['#06140e', '#0f2a1f', '#1f4a36']} height={height}>
      <View style={styles.center}>
        <Kicker icon="checkmark-done-outline" label="PLAN DE LECTURE" />
        <Text style={styles.title}>Lecture du jour terminée ✓</Text>
        <Text style={styles.body}>Tu as lu la portion prévue aujourd’hui pour « {planTitle} ». Tu peux t’arrêter là, ou continuer pour prendre de l’avance.</Text>
        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.footerHint}>Glisse pour continuer</Text>
        </View>
      </View>
    </Shell>
  );
}

export function PlanEndCard({ planTitle, total, height }: { planTitle: string; total: number; height: number }) {
  return (
    <Shell colors={['#1f1205', '#6b4310', '#c4882c']} height={height}>
      <View style={styles.center}>
        <Kicker icon="trophy-outline" label="PLAN TERMINÉ" />
        <Text style={styles.title}>Bravo !</Text>
        <Text style={styles.body}>
          Tu as lu les {total} chapitres de « {planTitle} ». Rends grâce pour ce chemin parcouru avec la Parole.
        </Text>
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
    const id = scale.addListener(({ value }) => setPhase((p) => (p === 'Amen.' ? p : value > 0.95 ? 'Expire…' : value < 0.65 ? 'Inspire…' : p)));
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
        <Text style={styles.body}>« Arrêtez, et sachez que je suis Dieu. » — Psaumes 46:11{'\n\n'}Et si tu respirais 30 secondes avant de continuer ?</Text>
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
  reference: { color: 'rgba(255,255,255,0.75)', fontSize: 13, letterSpacing: 2.5, marginTop: 24, textTransform: 'uppercase', fontWeight: '600' },
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
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  option_idle: { backgroundColor: 'rgba(255,255,255,0.08)' },
  option_right: { backgroundColor: '#2a9d6a', borderColor: '#2a9d6a' },
  option_wrong: { backgroundColor: '#c8445a', borderColor: '#c8445a' },
  option_dim: { opacity: 0.4 },
  optionText: { color: '#fff', fontSize: 17, fontWeight: '600', flexShrink: 1 },
  explanation: { color: 'rgba(255,255,255,0.85)', fontSize: 16, marginTop: 18, lineHeight: 24 },
  clue: { color: '#fff', fontFamily: SERIF, fontSize: 21, lineHeight: 30, marginBottom: 12 },
  reveal: { marginTop: 18 },
  revealName: { color: '#ffd166', fontSize: 34, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  pillText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  breathWrap: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginVertical: 28 },
  breathCircle: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(140,170,255,0.18)', borderWidth: 1, borderColor: 'rgba(160,190,255,0.5)' },
  breathText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  bookTitle: { color: '#fff', fontFamily: SERIF, fontSize: 44, lineHeight: 52, marginBottom: 6 },
  bookMeta: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '600', marginBottom: 22 },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 36 },
  passageRef: { color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 2.5, fontWeight: '700', textTransform: 'uppercase', marginBottom: 18 },
  passageText: { color: '#fff', fontFamily: SERIF },
  passageL: { fontSize: 24, lineHeight: 36 },
  passageM: { fontSize: 21, lineHeight: 31 },
  passageS: { fontSize: 18, lineHeight: 27 },
  verseNum: { fontSize: 12, color: 'rgba(255,209,102,0.85)', fontWeight: '700', fontFamily: undefined },
  bookTrack: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8, overflow: 'hidden' },
  bookFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.75)' },
});
