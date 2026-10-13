import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, Share, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FactCard, PauseCard, PersonCard, QuizCard, ReflectionCard, VerseCard } from './cards';
import { ChapterReader, TopScrim } from './chapter';
import { communityKey, useCommunity } from './community';
import type { Passage, Theme } from './data/content';
import { type Card, FeedGenerator } from './feed';
import { BooksSheet, ChapterSheet, SavedSheet } from './sheets';
import { DAILY_GOAL, type ProgressApi, useApp } from './storage';
import { goalCaption, goalToast } from './today';

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

const share = (p: Passage) => {
  Share.share({ message: `« ${p.text} »\n— ${p.reference} (Louis Segond 1910)\n\nLu sur Manne` }).catch(() => {});
};

/** Les actions communes à toute carte de texte biblique. */
export function actionsFor(p: Passage, api: ProgressApi, theme?: Theme) {
  return {
    liked: api.progress.liked.includes(p.id),
    saved: api.progress.saved.some((s) => s.id === p.id),
    onLike: (force?: boolean) => {
      haptic();
      api.toggleLike(p.id, theme, force, communityKey(p));
    },
    onSave: () => {
      haptic();
      api.toggleSave(p);
    },
    onShare: () => share(p),
  };
}

/** Le défilement plein écran, carte par carte, façon réels. */
export function Pager<T extends { key: string }>(props: {
  data: T[];
  height: number;
  extraData: unknown;
  renderItem: (item: T) => ReactElement;
  onEndReached: () => void;
  onViewed: (item: T, index: number) => void;
  /** Carte sur laquelle s'ouvrir ; celles d'avant restent accessibles en remontant. */
  initialIndex?: number;
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
      initialScrollIndex={props.initialIndex || undefined}
      onEndReached={props.onEndReached}
      onEndReachedThreshold={3}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 80, minimumViewTime: 600 }}
      windowSize={5}
    />
  );
}

/** Découvrir : versets choisis, anecdotes, quiz, personnages — selon tes goûts. */
function DiscoverPager({ api, height, onContext }: { api: ProgressApi; height: number; onContext: (p: Passage) => void }) {
  const community = useCommunity();
  const extraData = useMemo(() => ({ progress: api.progress, revision: community.revision }), [api.progress, community.revision]);
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
      extraData={extraData}
      onEndReached={() => {
        const more = generator.next(10);
        setCards((c) => [...c, ...more]);
      }}
      onViewed={(card) => {
        if (card.kind === 'verse') {
          community.watch(card.verse);
          api.markRead(card.verse);
        }
      }}
      renderItem={(card) => {
        switch (card.kind) {
          case 'verse':
            return (
              <VerseCard
                verse={card.verse}
                height={height}
                onRead={() => onContext(card.verse)}
                {...actionsFor(card.verse, api, card.verse.theme)}
                {...community.rail(card.verse)}
              />
            );
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

/** Écran plein de cartes avec, par-dessus, l'objectif du jour, la série et les favoris. */
function FeedScreen({
  title,
  left,
  scrim,
  children,
}: {
  title: string;
  left?: ReactNode;
  /** Voile sombre sous le bandeau du haut, pour un contenu qui défile dessous. */
  scrim?: boolean;
  children: (height: number, openContext: (p: Passage) => void) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const api = useApp();
  const { progress } = api;
  const [height, setHeight] = useState(0);
  const [chapter, setChapter] = useState<Passage | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const celebrate = useRef(new Animated.Value(0)).current;
  const readCount = progress.readToday.length;
  const prevCount = useRef(readCount);
  const toast = goalToast(progress);

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

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && api.loaded && children(height, setChapter)}

      {scrim && <TopScrim />}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={styles.side}>{left}</View>
          <Text style={styles.title}>{title}</Text>
          <View style={[styles.side, styles.topRight]}>
            <Pressable onPress={() => router.push('/compte')} hitSlop={8} accessibilityLabel="Mon compte" style={styles.streak}>
              <Ionicons name="flame" size={15} color="#ffb703" />
              <Text style={styles.streakText}>{progress.streak}</Text>
            </Pressable>
            <Pressable onPress={() => setShowSaved(true)} hitSlop={10} accessibilityLabel="Mes versets">
              <Ionicons name="bookmarks-outline" size={21} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.goalTrack}>
          <View style={[styles.goalFill, { width: `${Math.min(1, readCount / DAILY_GOAL) * 100}%` }]} />
        </View>
        <Text style={styles.goalText}>{goalCaption(progress)}</Text>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            top: insets.top + 96,
            opacity: celebrate,
            transform: [{ translateY: celebrate.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        <Text style={styles.toastTitle}>{toast.title}</Text>
        <Text style={styles.toastBody}>{toast.body}</Text>
      </Animated.View>

      {chapter && <ChapterSheet passage={chapter} onClose={() => setChapter(null)} />}
      {showSaved && (
        <SavedSheet
          saved={progress.saved}
          onRemove={api.toggleSave}
          onClose={() => setShowSaved(false)}
          onOpen={(p) => {
            setShowSaved(false);
            setTimeout(() => setChapter(p), 400);
          }}
        />
      )}
    </View>
  );
}

export function ReadingScreen() {
  const api = useApp();
  const [showBooks, setShowBooks] = useState(false);
  const { selectBook, goTo, restartReading } = api;
  return (
    <>
      <FeedScreen
        title="Lecture"
        scrim
        left={
          <Pressable onPress={() => setShowBooks(true)} hitSlop={10} accessibilityLabel="Choisir un livre" style={styles.booksBtn}>
            <Ionicons name="library-outline" size={21} color="#fff" />
          </Pressable>
        }
      >
        {(height) => <ChapterReader key={api.readingSession} api={api} height={height} />}
      </FeedScreen>
      {showBooks && (
        <BooksSheet
          current={api.progress.currentBook}
          positions={api.progress.positions}
          chaptersRead={api.progress.chaptersRead}
          onPick={(book, chapter) => {
            if (chapter) goTo(book, chapter);
            else selectBook(book);
            setShowBooks(false);
            restartReading();
          }}
          onClose={() => setShowBooks(false)}
        />
      )}
    </>
  );
}

export function DiscoverScreen() {
  const api = useApp();
  return (
    <FeedScreen title="Découvrir">
      {(height, openContext) => <DiscoverPager api={api} height={height} onContext={openContext} />}
    </FeedScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  side: { width: 84 },
  booksBtn: { alignSelf: 'flex-start' },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  streakText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  goalTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 10, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: '#ffd166' },
  goalText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 6, fontWeight: '600' },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.4)',
  },
  toastTitle: { color: '#ffd166', fontWeight: '800', fontSize: 16 },
  toastBody: { color: '#eee', fontSize: 14, marginTop: 4, lineHeight: 20 },
});
