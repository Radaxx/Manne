import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookIntroCard, ChapterEndCard, PassageCard, PlanEndCard, PlanGoalCard } from './cards';
import { INTROS } from './data/intros';
import { actionsFor, Pager } from './feeds';
import { formatRange, planById, planStatus, type Plan } from './plans';
import { cardsUntil, isResumeCard, PlanReadingGenerator, type PlanReadingCard } from './reading';
import { today, useApp } from './storage';

/** Le fil plein écran d'un plan de lecture, avec son propre marque-page. */
function PlanReader({ plan }: { plan: Plan }) {
  const api = useApp();
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
          extraData={api.progress}
          onEndReached={() => {
            const more = generator.next(8);
            if (more.length) setCards((c) => [...c, ...more]);
          }}
          onViewed={(card) => {
            if (card.kind === 'passage') {
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
                return <PassageCard passage={card.passage} book={card.book} height={height} {...actionsFor(card.passage, api)} />;
              case 'chapterEnd':
                return <ChapterEndCard book={card.book} chapter={card.chapter} prompt={card.prompt} chaptersToday={api.progress.chaptersToday.length} height={height} />;
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
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityLabel="Fermer" style={styles.close}>
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
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(todayProgress * 100)}%` }]} />
        </View>
      </View>
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
});
