import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIntroCard, ChapterEndCard, PassageCard, PlanEndCard, PlanGoalCard } from './cards';
import { useCommunity } from './community';
import { INTROS } from './data/intros';
import { actionsFor, Pager } from './feeds';
import { formatRange, type Plan, planById, planIndex, planStatus } from './plans';
import { cardsUntil, isResumeCard, type PlanReadingCard, PlanReadingGenerator } from './reading';
import { today, useApp } from './storage';

/** Le fil plein écran d'un plan de lecture, avec son propre marque-page. */
function PlanReader({ plan }: { plan: Plan }) {
  const api = useApp();
  const community = useCommunity();
  const extraData = useMemo(() => ({ progress: api.progress, revision: community.revision }), [api.progress, community.revision]);
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const state = api.progress.plans[plan.id];
  const status = planStatus(plan, state, today());

  // Le fil commence un peu avant le marque-page du plan (début de la portion du jour, au moins le
  // chapitre précédent, 5 chapitres au plus) et s'ouvre sur le marque-page : on peut remonter pour relire.
  const [{ generator, initial, initialIndex }] = useState(() => {
    const pos = Math.min(status.done, status.total - 1);
    const todayStart = status.expected - status.today.length;
    const startIdx = Math.max(0, pos - 5, Math.min(todayStart, pos - 1));
    const g = new PlanReadingGenerator(plan, startIdx, 1, status.expected);
    const target = status.next;
    const { cards, index } = cardsUntil(g, (c) =>
      target ? isResumeCard(c, { book: target.book, chapter: target.chapter, verse: status.nextVerse }) : c.kind === 'planEnd',
    );
    return { generator: g, initial: cards, initialIndex: index };
  });
  const [cards, setCards] = useState<PlanReadingCard[]>(initial);

  // La carte affichée, traduite en position dans le plan, pour « Marquer ici ».
  const [here, setHere] = useState<{ pos: number; verse: number; label: string } | null>(null);
  const [toast, setToast] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    toastOpacity.setValue(1);
    Animated.timing(toastOpacity, { toValue: 0, duration: 400, delay: 1800, useNativeDriver: true }).start(() => setToast(''));
  }, [toast, toastOpacity]);

  const locate = (card: PlanReadingCard) => {
    if (card.kind === 'passage') {
      const { book, chapter, from, bookName } = card.passage;
      return { pos: planIndex(plan, book, chapter), verse: from, label: `${bookName} ${chapter}${from > 1 ? `, v. ${from}` : ''}` };
    }
    if (card.kind === 'chapterEnd') {
      // Sur la fin d'un chapitre : ce chapitre est terminé, on reprendra au suivant.
      return { pos: planIndex(plan, card.book.n, card.chapter) + 1, verse: 1, label: `la fin de ${card.book.name} ${card.chapter}` };
    }
    if (card.kind === 'intro') return { pos: planIndex(plan, card.book.n, 1), verse: 1, label: `${card.book.name} 1` };
    return null;
  };

  const markHere = () => {
    if (!here || here.pos < 0) return;
    api.setPlanPosition(plan.id, here.pos, here.verse);
    setToast(`Plan placé à ${here.label}`);
  };

  const subtitle = status.finished
    ? 'Plan terminé ✓'
    : status.todayComplete
      ? `Lecture du jour faite ✓${status.ahead > 0 ? ` · +${status.ahead} d’avance` : ''}`
      : `Aujourd’hui : ${formatRange(status.today)} · ${status.todayDone}/${status.today.length}`;
  const todayProgress = status.today.length ? status.todayDone / status.today.length : 1;

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <Pager
          data={cards}
          height={height}
          initialIndex={initialIndex}
          extraData={extraData}
          onEndReached={() => {
            const more = generator.next(8);
            if (more.length) setCards((c) => [...c, ...more]);
          }}
          onViewed={(card) => {
            setHere(locate(card));
            if (card.kind === 'passage') {
              community.watch(card.passage);
              api.markRead(card.passage);
              api.advancePlan(plan.id, card.passage, card.chapterEnd);
            } else if (card.kind === 'chapterEnd') {
              // Filet de sécurité si on a glissé trop vite sur le dernier passage du chapitre.
              api.advancePlan(plan.id, { book: card.book.n, chapter: card.chapter, to: 0 }, true);
            }
          }}
          renderItem={(card) => {
            switch (card.kind) {
              case 'intro':
                return <BookIntroCard book={card.book} intro={INTROS[card.book.n]} height={height} />;
              case 'passage':
                return (
                  <PassageCard
                    passage={card.passage}
                    book={card.book}
                    height={height}
                    {...actionsFor(card.passage, api)}
                    {...community.rail(card.passage)}
                  />
                );
              case 'chapterEnd':
                return (
                  <ChapterEndCard
                    book={card.book}
                    chapter={card.chapter}
                    prompt={card.prompt}
                    chaptersToday={api.progress.chaptersToday.length}
                    height={height}
                  />
                );
              case 'planGoal':
                return <PlanGoalCard planTitle={plan.title} height={height} />;
              case 'planEnd':
                return <PlanEndCard planTitle={plan.title} total={status.total} height={height} />;
            }
          }}
        />
      )}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={12}
            accessibilityLabel="Fermer"
            style={styles.close}
          >
            <Ionicons name="chevron-down" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {plan.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Jour {status.day + 1}/{plan.days} · {subtitle}
            </Text>
          </View>
          <Pressable
            onPress={markHere}
            disabled={!here || here.pos < 0}
            hitSlop={8}
            style={[styles.mark, (!here || here.pos < 0) && { opacity: 0.4 }]}
            accessibilityLabel="Placer le marque-page du plan ici"
          >
            <Ionicons name="bookmark" size={14} color="#fff" />
            <Text style={styles.markText}>Marquer ici</Text>
          </Pressable>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(todayProgress * 100)}%` }]} />
        </View>
      </View>

      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + 74, opacity: toastOpacity }]}>
          <Ionicons name="bookmark" size={15} color="#5cc48a" />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function PlanReadingScreen({ id }: { id: string }) {
  const { progress, loaded } = useApp();
  const plan = planById(id);
  if (!loaded) return <View style={styles.root} />;
  if (!plan || !progress.plans[id]) {
    return (
      <View style={[styles.root, { justifyContent: 'center', padding: 32 }]}>
        <Text style={styles.subtitle}>Ce plan n’est pas en cours.</Text>
      </View>
    );
  }
  return <PlanReader plan={plan} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#5cc48a' },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  markText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15,16,20,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
