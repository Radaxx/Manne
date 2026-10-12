import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, FlatList, Platform, Pressable, Share, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIntroCard, ChapterEndCard, FactCard, PassageCard, PauseCard, PersonCard, QuizCard, ReflectionCard, VerseCard } from './src/cards';
import type { Passage, Theme } from './src/data/content';
import { INTROS } from './src/data/intros';
import { FeedGenerator, type Card } from './src/feed';
import { ReadingGenerator, type ReadingCard } from './src/reading';
import { BooksSheet, ChapterSheet, SavedSheet } from './src/sheets';
import { DAILY_GOAL, readingPosition, useProgress } from './src/storage';

type ProgressApi = ReturnType<typeof useProgress>;
type Tab = 'lecture' | 'decouvrir';

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

const share = (p: Passage) => {
  Share.share({ message: `« ${p.text} »\n— ${p.reference} (Louis Segond 1910)\n\nLu sur Manne` }).catch(() => {});
};

/** Les actions communes à toute carte de texte biblique. */
function actionsFor(p: Passage, api: ProgressApi, theme?: Theme) {
  return {
    liked: api.progress.liked.includes(p.id),
    saved: api.progress.saved.some((s) => s.id === p.id),
    onLike: (force?: boolean) => {
      haptic();
      api.toggleLike(p.id, theme, force);
    },
    onSave: () => {
      haptic();
      api.toggleSave(p);
    },
    onShare: () => share(p),
  };
}

/** Le défilement plein écran, carte par carte, façon réels. */
function Pager<T extends { key: string }>(props: {
  data: T[];
  height: number;
  extraData: unknown;
  renderItem: (item: T) => ReactElement;
  onEndReached: () => void;
  onViewed: (item: T, index: number) => void;
}) {
  const onViewed = useRef(props.onViewed);
  onViewed.current = props.onViewed;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<T>[] }) => {
    for (const v of viewableItems) if (v.item && v.index != null) onViewed.current(v.item, v.index);
  }).current;
  const { height } = props;

  return (
    <FlatList
      data={props.data}
      keyExtractor={(c) => c.key}
      renderItem={({ item }) => props.renderItem(item)}
      extraData={props.extraData}
      pagingEnabled
      snapToInterval={height}
      snapToAlignment="start"
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
      onEndReached={props.onEndReached}
      onEndReachedThreshold={3}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 80, minimumViewTime: 600 }}
      windowSize={5}
    />
  );
}

/** Lecture suivie : chaque glissement fait avancer dans le texte, et le marque-page suit. */
function ReadingFeed({ api, height }: { api: ProgressApi; height: number }) {
  // Générateur et premières cartes créés ensemble : sûr même si React rejoue l'initialiseur.
  const [{ generator, initial }] = useState(() => {
    const g = new ReadingGenerator(readingPosition(api.progress));
    return { generator: g, initial: g.next(8) };
  });
  const [cards, setCards] = useState<ReadingCard[]>(initial);
  const furthest = useRef(-1);

  return (
    <Pager
      data={cards}
      height={height}
      extraData={api.progress}
      onEndReached={() => {
        // Générer hors du updater : React peut l'appeler deux fois en dev.
        const more = generator.next(8);
        setCards((c) => [...c, ...more]);
      }}
      onViewed={(card, index) => {
        if (card.kind !== 'passage') return;
        api.markRead(card.passage);
        // Revenir en arrière ne recule pas le marque-page.
        if (index > furthest.current) {
          furthest.current = index;
          api.advanceReading(card.passage, card.chapterEnd);
        }
      }}
      renderItem={(card) => {
        switch (card.kind) {
          case 'intro':
            return <BookIntroCard book={card.book} intro={INTROS[card.book.n]} height={height} />;
          case 'passage':
            return <PassageCard passage={card.passage} book={card.book} height={height} {...actionsFor(card.passage, api)} />;
          case 'chapterEnd':
            return <ChapterEndCard book={card.book} chapter={card.chapter} prompt={card.prompt} chaptersToday={api.progress.chaptersToday.length} height={height} />;
        }
      }}
    />
  );
}

/** Découvrir : versets choisis, anecdotes, quiz, personnages — selon tes goûts. */
function DiscoverFeed({ api, height, onContext }: { api: ProgressApi; height: number; onContext: (p: Passage) => void }) {
  const [{ generator, initial }] = useState(() => {
    const g = new FeedGenerator(api.getScores);
    return { generator: g, initial: g.next(12) };
  });
  const [cards, setCards] = useState<Card[]>(initial);
  const sessionStart = useRef(Date.now()).current;

  return (
    <Pager
      data={cards}
      height={height}
      extraData={api.progress}
      onEndReached={() => {
        const more = generator.next(10);
        setCards((c) => [...c, ...more]);
      }}
      onViewed={(card) => {
        if (card.kind === 'verse') api.markRead(card.verse);
      }}
      renderItem={(card) => {
        switch (card.kind) {
          case 'verse':
            return <VerseCard verse={card.verse} height={height} onRead={() => onContext(card.verse)} {...actionsFor(card.verse, api, card.verse.theme)} />;
          case 'fact':
            return <FactCard fact={card.fact} height={height} />;
          case 'quiz':
            return <QuizCard quiz={card.quiz} height={height} />;
          case 'person':
            return <PersonCard person={card.person} height={height} />;
          case 'reflection':
            return <ReflectionCard prompt={card.prompt} height={height} />;
          case 'pause':
            return <PauseCard count={card.count} minutes={Math.round((Date.now() - sessionStart) / 60000)} height={height} />;
        }
      }}
    />
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const api = useProgress();
  const { progress } = api;
  const [tab, setTab] = useState<Tab>('lecture');
  const [height, setHeight] = useState(0);
  const [chapter, setChapter] = useState<Passage | null>(null);
  const [sheet, setSheet] = useState<'saved' | 'books' | null>(null);
  // Change uniquement quand on choisit un livre : relance la lecture à la bonne position.
  const [readingSession, setReadingSession] = useState(0);

  const celebrate = useRef(new Animated.Value(0)).current;
  const readCount = progress.readToday.length;
  const prevCount = useRef(readCount);

  // On ne célèbre que le passage de l'objectif en direct, pas au rechargement.
  useEffect(() => {
    if (prevCount.current > 0 && prevCount.current < DAILY_GOAL && readCount >= DAILY_GOAL) {
      Animated.sequence([
        Animated.spring(celebrate, { toValue: 1, useNativeDriver: true }),
        Animated.timing(celebrate, { toValue: 0, duration: 400, delay: 3200, useNativeDriver: true }),
      ]).start();
    }
    prevCount.current = readCount;
  }, [readCount, celebrate]);

  const { selectBook } = api;
  const pickBook = useCallback(
    (book: number, restart: boolean) => {
      selectBook(book, restart);
      setSheet(null);
      setTab('lecture');
      setReadingSession((n) => n + 1);
    },
    [selectBook],
  );

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <StatusBar style="light" />
      {height > 0 &&
        api.loaded &&
        (tab === 'lecture' ? <ReadingFeed key={readingSession} api={api} height={height} /> : <DiscoverFeed api={api} height={height} onContext={setChapter} />)}

      {/* Barre du haut : livres, onglets, série, objectif du jour */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.side}>
            <Pressable onPress={() => setSheet('books')} hitSlop={10} accessibilityLabel="Livres">
              <Ionicons name="library-outline" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.tabs}>
            {(['lecture', 'decouvrir'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} hitSlop={8}>
                <Text style={[styles.tab, tab === t && styles.tabActive]}>{t === 'lecture' ? 'Lecture' : 'Découvrir'}</Text>
                <View style={[styles.tabUnderline, tab !== t && { opacity: 0 }]} />
              </Pressable>
            ))}
          </View>
          <View style={[styles.side, styles.topRight]}>
            <View style={styles.streak}>
              <Ionicons name="flame" size={15} color="#ffb703" />
              <Text style={styles.streakText}>{progress.streak}</Text>
            </View>
            <Pressable onPress={() => setSheet('saved')} hitSlop={10} accessibilityLabel="Mes versets">
              <Ionicons name="bookmarks-outline" size={21} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.min(1, readCount / DAILY_GOAL) * 100}%` }]} />
        </View>
        <Text style={styles.goalText}>
          {readCount >= DAILY_GOAL ? `Objectif atteint · ${readCount} versets aujourd’hui` : `${readCount}/${DAILY_GOAL} versets aujourd’hui`}
        </Text>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.toast, { top: insets.top + 96, opacity: celebrate, transform: [{ translateY: celebrate.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}
      >
        <Text style={styles.toastTitle}>Ta manne du jour est récoltée ✨</Text>
        <Text style={styles.toastBody}>{DAILY_GOAL} versets lus. Tu peux continuer… ou garder une parole en tête pour la journée.</Text>
      </Animated.View>

      {chapter && <ChapterSheet passage={chapter} onClose={() => setChapter(null)} />}
      {sheet === 'books' && <BooksSheet current={progress.currentBook} chaptersRead={progress.chaptersRead} onPick={pickBook} onClose={() => setSheet(null)} />}
      {sheet === 'saved' && (
        <SavedSheet
          saved={progress.saved}
          onRemove={api.toggleSave}
          onClose={() => setSheet(null)}
          onOpen={(p) => {
            setSheet(null);
            setTimeout(() => setChapter(p), 400);
          }}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  side: { width: 84 },
  topRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  tabs: { flexDirection: 'row', gap: 20 },
  tab: { color: 'rgba(255,255,255,0.6)', fontSize: 17, fontWeight: '700' },
  tabActive: { color: '#fff' },
  tabUnderline: { height: 2, backgroundColor: '#fff', borderRadius: 1, marginTop: 4, width: 22, alignSelf: 'center' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  streakText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  goalTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 10, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: '#ffd166' },
  goalText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6, fontWeight: '600' },
  toast: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,209,102,0.4)' },
  toastTitle: { color: '#ffd166', fontWeight: '800', fontSize: 16 },
  toastBody: { color: '#eee', fontSize: 14, marginTop: 4, lineHeight: 20 },
});
