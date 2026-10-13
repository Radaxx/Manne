import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChapterView, TopScrim } from './chapter';
import { formatRange, type Plan, planById, planChapters, planStatus } from './plans';
import { bookMeta } from './reading';
import { today, useApp } from './storage';

/** Le fil plein écran d'un plan de lecture : un chapitre entier à la fois, avec son propre marque-page. */
function PlanReader({ plan }: { plan: Plan }) {
  const api = useApp();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const state = api.progress.plans[plan.id];
  const status = planStatus(plan, state, today());
  const chapters = planChapters(plan);

  // On s'ouvre sur le prochain chapitre à lire (le dernier si le plan est terminé) ; on peut aller et venir
  // d'un chapitre à l'autre sans déplacer le marque-page du plan, sauf « Marquer ici » ou en finissant un chapitre.
  const [idx, setIdx] = useState(() => Math.min(status.done, status.total - 1));
  const current = chapters[idx];

  const [toast, setToast] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    toastOpacity.setValue(1);
    Animated.timing(toastOpacity, { toValue: 0, duration: 400, delay: 1800, useNativeDriver: true }).start(() => setToast(''));
  }, [toast, toastOpacity]);

  const markHere = () => {
    api.setPlanPosition(plan.id, idx, 1);
    setToast(`Plan placé à ${bookMeta(current.book).name} ${current.chapter}`);
  };

  const subtitle = status.finished
    ? 'Plan terminé ✓'
    : status.todayComplete
      ? `Lecture du jour faite ✓${status.ahead > 0 ? ` · +${status.ahead} d’avance` : ''}`
      : `Aujourd’hui : ${formatRange(status.today)} · ${status.todayDone}/${status.today.length}`;
  const todayProgress = status.today.length ? status.todayDone / status.today.length : 1;

  // En fin de chapitre : la portion du jour atteinte, ou le plan terminé.
  const isLast = idx === status.total - 1;
  const footer =
    isLast || idx + 1 === status.expected ? (
      <View style={styles.banner}>
        <Ionicons name={isLast ? 'trophy-outline' : 'checkmark-done-outline'} size={20} color="#5cc48a" />
        <Text style={styles.bannerTitle}>{isLast ? 'Plan terminé — bravo !' : 'Lecture du jour terminée ✓'}</Text>
        <Text style={styles.bannerBody}>
          {isLast
            ? `Tu as lu les ${status.total} chapitres de « ${plan.title} ». Rends grâce pour ce chemin parcouru avec la Parole.`
            : `Tu as lu la portion prévue aujourd’hui pour « ${plan.title} ». Tu peux t’arrêter là, ou continuer pour prendre de l’avance.`}
        </Text>
      </View>
    ) : null;

  return (
    <View style={styles.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && current && (
        <ChapterView
          key={current.key}
          loc={{ book: current.book, chapter: current.chapter }}
          api={api}
          height={height}
          topPad={insets.top + 84}
          onPrev={idx > 0 ? () => setIdx(idx - 1) : null}
          onNext={isLast ? null : () => setIdx(idx + 1)}
          // Ne recule jamais : relire un chapitre déjà lu ne change pas le marque-page du plan.
          onFinish={(whole) => api.advancePlan(plan.id, whole, true)}
          footer={footer}
        />
      )}

      <TopScrim extra={88} />
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
          <Pressable onPress={markHere} hitSlop={8} style={styles.mark} accessibilityLabel="Placer le marque-page du plan ici">
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
  banner: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(92,196,138,0.12)',
    borderColor: 'rgba(92,196,138,0.4)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  bannerTitle: { color: '#5cc48a', fontSize: 16, fontWeight: '800' },
  bannerBody: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
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
