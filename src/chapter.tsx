import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookGradient, SERIF } from './cards';
import { communityKey } from './community';
import { loadBook } from './data/bible';
import type { Passage } from './data/content';
import { INTROS } from './data/intros';
import { bookMeta, chapterPrompt, normalize } from './reading';
import { type ProgressApi, readingPosition } from './storage';

type Loc = { book: number; chapter: number };

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Vrai si a est strictement après b dans l'ordre de la Bible. */
const isAfter = (a: Loc, b: Loc) => a.book > b.book || (a.book === b.book && a.chapter > b.chapter);

const nextLoc = ({ book, chapter }: Loc): Loc => {
  const { book: b, chapter: c } = normalize({ book, chapter: chapter + 1, verse: 1 });
  return { book: b, chapter: c };
};

const prevLoc = ({ book, chapter }: Loc): Loc | null => {
  if (chapter > 1) return { book, chapter: chapter - 1 };
  return book > 1 ? { book: book - 1, chapter: bookMeta(book - 1).verses.length } : null;
};

type Run = { from: number; to: number };

/** Regroupe des numéros de versets en suites consécutives : [3,4,5,8] → 3-5 et 8. */
function toRuns(verses: number[]): Run[] {
  const runs: Run[] = [];
  for (const n of [...verses].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1];
    if (last && n === last.to + 1) last.to = n;
    else runs.push({ from: n, to: n });
  }
  return runs;
}

const rangeLabel = (r: Run) => (r.to > r.from ? `${r.from}-${r.to}` : `${r.from}`);

/** Un verset seul garde l'identifiant des versets du fil Découvrir (« livre-chapitre-verset »). */
const passageId = (loc: Loc, r: Run) => `${loc.book}-${loc.chapter}-${r.from}${r.to > r.from ? `-${r.to}` : ''}`;

function makePassage(loc: Loc, texts: string[], r: Run): Passage {
  const name = bookMeta(loc.book).name;
  return {
    id: passageId(loc, r),
    book: loc.book,
    bookName: name,
    chapter: loc.chapter,
    from: r.from,
    to: r.to,
    reference: `${name} ${loc.chapter}:${rangeLabel(r)}`,
    text: texts.slice(r.from - 1, r.to).join(' '),
  };
}

/** Les versets du chapitre couverts par un identifiant « livre-chapitre-verset[-fin] ». */
function likedRange(id: string, loc: Loc): Run | null {
  const [b, c, from, to] = id.split('-').map(Number);
  if (b !== loc.book || c !== loc.chapter || !Number.isFinite(from)) return null;
  return { from, to: Number.isFinite(to) ? to : from };
}

const covered = (rs: Run[]) => {
  const set = new Set<number>();
  for (const r of rs) for (let n = r.from; n <= r.to; n++) set.add(n);
  return set;
};

const overlaps = (a: Run, verses: Set<number>) => {
  for (let n = a.from; n <= a.to; n++) if (verses.has(n)) return true;
  return false;
};

/**
 * Lecture libre : un chapitre entier d'un coup, qu'on fait défiler. On touche des versets pour les
 * sélectionner (appui long : jusqu'à ce verset), puis on les aime, on les garde ou on les partage.
 */
export function ChapterReader({ api, height }: { api: ProgressApi; height: number }) {
  const [loc, setLoc] = useState<Loc>(() => {
    const { book, chapter } = normalize(readingPosition(api.progress));
    return { book, chapter };
  });
  const bookmark = readingPosition(api.progress);
  const prev = prevLoc(loc);

  const open = (target: Loc) => {
    // Relire ce qui précède ne fait pas reculer le marque-page ; aller plus loin l'avance.
    if (isAfter(target, bookmark)) api.goTo(target.book, target.chapter);
    setLoc(target);
  };

  return (
    <ChapterView
      key={`${loc.book}-${loc.chapter}`}
      loc={loc}
      api={api}
      height={height}
      onPrev={prev ? () => open(prev) : null}
      onNext={() => open(nextLoc(loc))}
    />
  );
}

function ChapterView({
  loc,
  api,
  height,
  onPrev,
  onNext,
}: {
  loc: Loc;
  api: ProgressApi;
  height: number;
  onPrev: (() => void) | null;
  onNext: () => void;
}) {
  const insets = useSafeAreaInsets();
  const book = bookMeta(loc.book);
  const texts = useMemo(() => loadBook(loc.book)[loc.chapter - 1], [loc.book, loc.chapter]);
  const total = texts.length;
  const { liked, saved } = api.progress;

  const apiRef = useRef(api);
  apiRef.current = api;

  // ——— Sélection ———
  const [selected, setSelected] = useState<number[]>([]);
  const anchor = useRef<number | null>(null);

  const tap = (n: number) => {
    haptic();
    anchor.current = n;
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  };

  const longPress = (n: number) => {
    haptic();
    const from = Math.min(anchor.current ?? n, n);
    const to = Math.max(anchor.current ?? n, n);
    anchor.current = n;
    setSelected((s) => [...new Set([...s, ...Array.from({ length: to - from + 1 }, (_, i) => from + i)])]);
  };

  const runs = useMemo(() => toRuns(selected), [selected]);
  const passages = useMemo(() => runs.map((r) => makePassage(loc, texts, r)), [runs, loc, texts]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Les versets de ce chapitre déjà aimés / gardés (quelle que soit l'étendue du passage enregistré).
  const likedRuns = useMemo(() => liked.flatMap((id) => likedRange(id, loc) ?? []), [liked, loc]);
  const savedRuns = useMemo(
    () => saved.filter((p) => p.book === loc.book && p.chapter === loc.chapter).map((p) => ({ from: p.from, to: p.to })),
    [saved, loc],
  );
  const likedVerses = useMemo(() => covered(likedRuns), [likedRuns]);
  const savedVerses = useMemo(() => covered(savedRuns), [savedRuns]);

  const allIn = (set: Set<number>) => selected.length > 0 && selected.every((n) => set.has(n));
  const selLiked = allIn(likedVerses);
  const selSaved = allIn(savedVerses);

  const onLike = () => {
    haptic();
    if (selLiked) {
      // Retire tous les « j'aime » qui touchent la sélection.
      for (const id of liked) {
        const r = likedRange(id, loc);
        if (r && overlaps(r, selectedSet))
          api.toggleLike(id, undefined, undefined, communityKey({ book: loc.book, chapter: loc.chapter, ...r }));
      }
    } else {
      for (const p of passages) if (!liked.includes(p.id)) api.toggleLike(p.id, undefined, undefined, communityKey(p));
    }
  };

  const onSave = () => {
    haptic();
    if (selSaved) {
      for (const p of saved) if (p.book === loc.book && p.chapter === loc.chapter && overlaps(p, selectedSet)) api.toggleSave(p);
    } else {
      for (const p of passages) if (!saved.some((s) => s.id === p.id)) api.toggleSave(p);
    }
  };

  const onShare = () => {
    const message = passages.map((p) => `« ${p.text} »\n— ${p.reference} (Louis Segond 1910)`).join('\n\n');
    Share.share({ message: `${message}\n\nLu sur Manne` }).catch(() => {});
  };

  const reference = `${book.name} ${loc.chapter}:${runs.map(rangeLabel).join(', ')}`;

  // ——— Lecture : les versets vus comptent comme lus, la fin du chapitre fait avancer le marque-page ———
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const wrapY = useRef(0);
  const verseBox = useRef<Record<number, { y: number; h: number }>>({});
  const readTo = useRef(0);
  const finished = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = () => {
    if (viewH.current === 0) return;
    const bottom = scrollY.current + viewH.current;
    let furthest = 0;
    for (let n = 1; n <= total; n++) {
      const box = verseBox.current[n];
      if (!box || wrapY.current + box.y + box.h > bottom + 4) break;
      furthest = n;
    }
    if (furthest <= readTo.current) return;
    const a = apiRef.current;
    a.markRead(makePassage(loc, texts, { from: readTo.current + 1, to: furthest }));
    readTo.current = furthest;
    if (furthest === total && !finished.current) {
      finished.current = true;
      const whole = makePassage(loc, texts, { from: 1, to: total });
      // Relire un chapitre déjà dépassé ne déplace pas le marque-page.
      if (isAfter(readingPosition(a.progress), loc)) a.markChapterRead(loc.book, loc.chapter);
      else a.advanceReading(whole, true);
    }
  };

  // On attend un court instant sans mouvement : traverser le texte en défilant très vite ne compte pas.
  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(check, 600);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    schedule();
  };

  const last = loc.chapter === book.verses.length;
  const [bg0, bg1, bg2] = bookGradient(book.n);

  return (
    <View style={{ height }}>
      <LinearGradient colors={[bg0, bg1, bg2]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={100}
        onLayout={(e) => {
          viewH.current = e.nativeEvent.layout.height;
          schedule();
        }}
        onContentSizeChange={schedule}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 100, paddingBottom: 160, paddingHorizontal: 20 }}
      >
        <View style={styles.nav}>
          {onPrev ? (
            <Pressable onPress={onPrev} hitSlop={10} style={styles.navBtn} accessibilityLabel="Chapitre précédent">
              <Ionicons name="chevron-back" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.navText}>Précédent</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable onPress={onNext} hitSlop={10} style={styles.navBtn} accessibilityLabel="Chapitre suivant">
            <Text style={styles.navText}>Suivant</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.75)" />
          </Pressable>
        </View>

        <Text style={styles.kicker}>{book.n >= 40 ? 'NOUVEAU TESTAMENT' : 'ANCIEN TESTAMENT'}</Text>
        <Text style={styles.bookName}>{book.name}</Text>
        <Text style={styles.chapterNum}>Chapitre {loc.chapter}</Text>
        {loc.chapter === 1 && <Text style={styles.intro}>{INTROS[book.n]}</Text>}
        <Text style={styles.hint}>Touche des versets pour les aimer, les garder ou les partager. Appui long : jusqu’à ce verset.</Text>

        <View onLayout={(e: LayoutChangeEvent) => (wrapY.current = e.nativeEvent.layout.y)}>
          {texts.map((text, i) => {
            const n = i + 1;
            const isSel = selectedSet.has(n);
            return (
              <Pressable
                key={n}
                onPress={() => tap(n)}
                onLongPress={() => longPress(n)}
                onLayout={(e) => {
                  verseBox.current[n] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height };
                }}
                accessibilityRole="button"
                accessibilityLabel={`Verset ${n}`}
                accessibilityState={{ selected: isSel }}
                style={[styles.verse, isSel && styles.verseSelected]}
              >
                <View style={styles.numCol}>
                  <Text style={styles.num}>{n}</Text>
                  {likedVerses.has(n) && <Ionicons name="heart" size={12} color="#ff4d6d" />}
                  {savedVerses.has(n) && <Ionicons name="bookmark" size={12} color="#ffd166" />}
                </View>
                <Text selectable={false} style={styles.verseText}>
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.end}>
          <Ionicons name="checkmark-circle-outline" size={22} color="rgba(255,255,255,0.8)" />
          <Text style={styles.endKicker}>{last ? 'LIVRE TERMINÉ' : 'FIN DU CHAPITRE'}</Text>
          <Text style={styles.endPrompt}>{chapterPrompt(loc.book, loc.chapter)}</Text>
          <Text style={styles.hint}>
            {api.progress.chaptersToday.length} chapitre{api.progress.chaptersToday.length > 1 ? 's' : ''} lu
            {api.progress.chaptersToday.length > 1 ? 's' : ''} aujourd’hui.
            {last ? ` Tu as lu tout le livre de ${book.name} !` : ' Prends un instant avant de continuer.'}
          </Text>
          <Pressable onPress={onNext} style={styles.nextBtn} accessibilityRole="button">
            <Text style={styles.nextText}>{last ? 'Livre suivant' : 'Chapitre suivant'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#1a1306" />
          </Pressable>
        </View>
      </ScrollView>

      {selected.length > 0 && (
        <View style={styles.bar}>
          <View style={styles.barInfo}>
            <Text style={styles.barCount}>
              {selected.length} verset{selected.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.barRef} numberOfLines={1}>
              {reference}
            </Text>
          </View>
          <BarButton icon={selLiked ? 'heart' : 'heart-outline'} label="J’aime" color={selLiked ? '#ff4d6d' : '#fff'} onPress={onLike} />
          <BarButton
            icon={selSaved ? 'bookmark' : 'bookmark-outline'}
            label="Garder"
            color={selSaved ? '#ffd166' : '#fff'}
            onPress={onSave}
          />
          <BarButton icon="share-outline" label="Partager" onPress={onShare} />
          <BarButton
            icon="close"
            label="Désélectionner"
            onPress={() => {
              anchor.current = null;
              setSelected([]);
            }}
          />
        </View>
      )}
    </View>
  );
}

function BarButton({
  icon,
  label,
  color = '#fff',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.barBtn} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  navText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 2.5, fontWeight: '700' },
  bookName: { color: '#fff', fontSize: 34, lineHeight: 42, fontWeight: '700', marginTop: 6 },
  chapterNum: { color: '#ffd166', fontSize: 18, fontWeight: '700', marginTop: 2 },
  intro: { color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 25, marginTop: 18 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17, marginTop: 14, marginBottom: 14 },
  verse: { flexDirection: 'row', gap: 10, paddingVertical: 7, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10 },
  verseSelected: { backgroundColor: 'rgba(255,209,102,0.2)' },
  numCol: { width: 26, alignItems: 'flex-end', gap: 3, paddingTop: 4 },
  num: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  verseText: { flex: 1, color: '#fff', fontFamily: SERIF, fontSize: 20, lineHeight: 31 },
  end: {
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  endKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: 2.5, fontWeight: '700', marginTop: 6 },
  endPrompt: { color: '#fff', fontFamily: SERIF, fontSize: 20, lineHeight: 29, fontStyle: 'italic', textAlign: 'center', marginTop: 14 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffd166',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 999,
    marginTop: 8,
  },
  nextText: { color: '#1a1306', fontSize: 16, fontWeight: '700' },
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12,13,18,0.94)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  barInfo: { flex: 1, marginRight: 4 },
  barCount: { color: '#fff', fontSize: 14, fontWeight: '700' },
  barRef: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  barBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
});
