import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type StyleProp, StyleSheet, Text, TextInput, type TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionLabel as adorationLabel } from './adoration';
import type { Palette } from './appearance';
import { loadChapter, passageLabel, type TranslationId, translationName } from './bible';
import { SERIF } from './cards';
import { MYSTERIES, PRAYER_CATEGORIES, PRAYERS, type Prayer, type PrayerCategory, ROSARY_STEPS } from './data/prayers';
import { biometricName, lockSupported } from './lock';
import { sessionLabel } from './rosary';
import { type CustomPrayer, useActions, useApp } from './storage';
import { usePalette, useThemed } from './theme';

const asPrayer = (c: CustomPrayer): Prayer => ({ id: c.id, title: c.title, text: c.text, category: 'Mes prières', custom: true });

/** Le recueil plus les prières écrites par l'utilisateur. */
export function useAllPrayers(): Prayer[] {
  const { progress } = useApp();
  return useMemo(() => [...progress.customPrayers.map(asPrayer), ...PRAYERS], [progress.customPrayers]);
}

/** Pour la recherche : minuscules, sans accents ni apostrophes typographiques. */
const fold = (s: string) => {
  const lower = s.toLowerCase();
  return (typeof lower.normalize === 'function' ? lower.normalize('NFD') : lower).replace(/[̀-ͯ]/g, '').replace(/’/g, "'");
};

const scriptureRef = (p: Prayer, translation: TranslationId) => {
  if (!p.scripture) return null;
  const [b, c, f, t] = p.scripture;
  return passageLabel(b, c, f, t, translation);
};

function PinButton({ id, size = 20 }: { id: string; size?: number }) {
  const C = usePalette();
  const { progress, togglePin } = useApp();
  const pinned = progress.pinnedPrayers.includes(id);
  return (
    <Pressable onPress={() => togglePin(id)} hitSlop={10} accessibilityLabel={pinned ? 'Désépingler' : 'Épingler'}>
      <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={size} color={pinned ? C.gold : C.muted} />
    </Pressable>
  );
}

function PrayerRow({ prayer }: { prayer: Prayer }) {
  const { styles } = useThemed(stylesFor);
  const { translation } = useApp().progress;
  const preview =
    prayer.text?.split('\n')[0] ?? scriptureRef(prayer, translation) ?? (prayer.rosary ? 'Les mystères du jour et comment le prier' : '');
  return (
    <Pressable onPress={() => router.push(`/priere/${prayer.id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{prayer.title}</Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <PinButton id={prayer.id} />
    </Pressable>
  );
}

const prayerCount = (n: number) => `${n} ${n === 1 ? 'prière' : 'prières'}`;

/** Thèmes du recueil, hors essentielles : celles-ci restent dépliées sur l'index. */
const CATALOG_CATEGORIES = PRAYER_CATEGORIES.filter((c) => c !== 'Essentielles');

/** Onglet Prières : pratiques et raccourcis, essentielles dépliées, puis le recueil par thème. */
export function PrayersScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress } = useApp();
  const all = useAllPrayers();
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PrayerCategory | null>(null);

  const pinned = progress.pinnedPrayers.map((id) => all.find((p) => p.id === id)).filter((p): p is Prayer => !!p);
  const mine = all.filter((p) => p.custom);
  const essentielles = PRAYERS.filter((p) => p.category === 'Essentielles');
  const trimmed = query.trim();
  const results = useMemo(() => {
    const q = fold(trimmed);
    if (!q) return [];
    return all.filter((p) => fold(`${p.title} ${p.text ?? ''} ${p.note ?? ''}`).includes(q));
  }, [all, trimmed]);
  const categoryPrayers = category ? PRAYERS.filter((p) => p.category === category) : [];
  const mode = trimmed ? 'search' : (category ?? 'index');

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: mode === 'index' });
  }, [mode]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Prières</Text>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher une prière"
            placeholderTextColor={C.faint}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          ) : null}
        </View>

        {mode === 'search' ? (
          <>
            <Text style={styles.section}>{prayerCount(results.length)}</Text>
            {results.length === 0 ? (
              <Text style={styles.empty}>Aucune prière ne correspond.</Text>
            ) : (
              <View style={styles.group}>
                {results.map((p) => (
                  <PrayerRow key={p.id} prayer={p} />
                ))}
              </View>
            )}
          </>
        ) : mode === 'index' ? (
          <>
            <Pressable onPress={() => router.push('/confession')} style={({ pressed }) => [styles.confession, pressed && styles.pressed]}>
              <View style={styles.confessionIcon}>
                <Ionicons
                  name={progress.confessionLock && lockSupported ? 'lock-closed-outline' : 'key-outline'}
                  size={20}
                  color={C.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Préparer ma confession</Text>
                <Text style={styles.rowPreview}>
                  {progress.confessionLock && lockSupported
                    ? `Protégé par ${biometricName}`
                    : progress.confession.items.length > 0
                      ? `${progress.confession.items.length} élément${progress.confession.items.length > 1 ? 's' : ''} noté${progress.confession.items.length > 1 ? 's' : ''}`
                      : 'Examen de conscience et liste personnelle'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/chapelet')}
              style={({ pressed }) => [styles.confession, { marginTop: 10 }, pressed && styles.pressed]}
            >
              <View style={styles.confessionIcon}>
                <Ionicons name="rose-outline" size={20} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{progress.rosary.session ? 'Reprendre mon chapelet' : 'Prier le chapelet'}</Text>
                <Text style={styles.rowPreview}>
                  {progress.rosary.session
                    ? sessionLabel(progress.rosary.session)
                    : `Guidé grain après grain · ${MYSTERIES.find((m) => m.days.includes(new Date().getDay()))?.name.toLowerCase()}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/adoration')}
              style={({ pressed }) => [styles.confession, { marginTop: 10 }, pressed && styles.pressed]}
            >
              <View style={styles.confessionIcon}>
                <Ionicons name="sunny-outline" size={20} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{progress.adoration.session ? 'Reprendre mon adoration' : 'Adorer le Saint-Sacrement'}</Text>
                <Text style={styles.rowPreview}>
                  {progress.adoration.session
                    ? adorationLabel(progress.adoration.session)
                    : 'Contemplatif ou guidé, au rythme que tu choisis'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </Pressable>

            <Text style={styles.section}>Épinglées</Text>
            {pinned.length === 0 ? (
              <Text style={styles.empty}>Touche l’épingle d’une prière pour la retrouver ici et sur l’accueil.</Text>
            ) : (
              <View style={styles.group}>
                {pinned.map((p) => (
                  <PrayerRow key={p.id} prayer={p} />
                ))}
              </View>
            )}

            <Text style={styles.section}>Mes prières</Text>
            <View style={styles.group}>
              {mine.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
              <Pressable onPress={() => router.push('/priere-edition')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <Ionicons name="create-outline" size={20} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: C.gold }]}>Écrire une prière</Text>
                  {mine.length === 0 && <Text style={styles.rowPreview}>Une intention, une prière qui te touche, tes propres mots…</Text>}
                </View>
              </Pressable>
            </View>

            <Text style={styles.section}>Essentielles</Text>
            <View style={styles.group}>
              {essentielles.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
            </View>

            <Text style={styles.section}>Recueil</Text>
            <View style={styles.catalog}>
              {CATALOG_CATEGORIES.map((c) => {
                const n = PRAYERS.filter((p) => p.category === c).length;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    accessibilityLabel={`${c}, ${prayerCount(n)}`}
                    style={({ pressed }) => [styles.catalogCard, pressed && styles.pressed]}
                  >
                    <Text style={styles.catalogTitle} numberOfLines={2}>
                      {c}
                    </Text>
                    <Text style={styles.catalogCount}>{prayerCount(n)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Pressable onPress={() => setCategory(null)} style={styles.backRow} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color={C.gold} />
              <Text style={styles.backText}>Recueil</Text>
            </Pressable>
            <Text style={styles.section}>{category}</Text>
            <View style={styles.group}>
              {categoryPrayers.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Le texte d'une prière, par paragraphes. Une ligne « — … » est la réponse de l'assemblée, en doré. */
export function PrayerText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const { styles } = useThemed(stylesFor);
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <Text key={i} style={style ?? styles.para}>
          {para.split('\n').map((line, j, lines) => (
            <Text key={j} style={line.startsWith('—') ? styles.response : undefined}>
              {line}
              {j < lines.length - 1 ? '\n' : ''}
            </Text>
          ))}
        </Text>
      ))}
    </>
  );
}

function ScriptureText({ scripture, translation }: { scripture: [number, number, number, number]; translation: TranslationId }) {
  const { styles } = useThemed(stylesFor);
  const [b, c, f, t] = scripture;
  const verses = loadChapter(b, c, translation).slice(f - 1, t);
  return (
    <Text style={styles.para}>
      {verses.map((v, i) => (
        <Text key={i}>
          <Text style={styles.verseNum}>{f + i} </Text>
          {v}{' '}
        </Text>
      ))}
    </Text>
  );
}

function Rosary() {
  const { C, styles } = useThemed(stylesFor);
  const today = new Date().getDay();
  return (
    <>
      <Pressable onPress={() => router.push('/chapelet')} style={styles.guided}>
        <Ionicons name="rose" size={20} color={C.onGold} />
        <Text style={styles.guidedText}>Prier le chapelet guidé</Text>
      </Pressable>
      <Text style={styles.subhead}>Comment le prier</Text>
      {ROSARY_STEPS.map((s, i) => (
        <Text key={i} style={styles.step}>
          {i + 1}. {s}
        </Text>
      ))}
      {MYSTERIES.map((set) => {
        const isToday = set.days.includes(today);
        return (
          <View key={set.name} style={[styles.mysteries, isToday && styles.mysteriesToday]}>
            <View style={styles.mysteriesHead}>
              <Text style={[styles.subhead, { marginTop: 0 }]}>{set.name}</Text>
              {isToday && <Text style={styles.todayBadge}>Aujourd’hui</Text>}
            </View>
            {set.mysteries.map((m, i) => (
              <Text key={m} style={styles.mystery}>
                {i + 1}. {m}
              </Text>
            ))}
          </View>
        );
      })}
    </>
  );
}

function CustomActions({ id }: { id: string }) {
  const { C, styles } = useThemed(stylesFor);
  const { deleteCustomPrayer } = useActions();
  // Supprimer est définitif : on demande une seconde confirmation.
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={styles.actions}>
      <Pressable onPress={() => router.push({ pathname: '/priere-edition', params: { id } })} style={styles.actionBtn}>
        <Ionicons name="create-outline" size={17} color={C.text} />
        <Text style={styles.actionText}>Modifier</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (!confirm) return setConfirm(true);
          deleteCustomPrayer(id);
          if (router.canGoBack()) router.back();
          else router.replace('/prieres');
        }}
        style={[styles.actionBtn, confirm && styles.actionDanger]}
      >
        <Ionicons name="trash-outline" size={17} color={C.red} />
        <Text style={[styles.actionText, { color: C.red }]}>{confirm ? 'Confirmer la suppression' : 'Supprimer'}</Text>
      </Pressable>
    </View>
  );
}

export function PrayerScreen({ id }: { id: string }) {
  const { styles } = useThemed(stylesFor);
  const prayer = useAllPrayers().find((p) => p.id === id);
  const { translation } = useApp().progress;
  if (!prayer) return <Text style={[styles.empty, { padding: 24 }]}>Cette prière n’existe plus.</Text>;
  const ref = scriptureRef(prayer, translation);
  return (
    <>
      <Stack.Screen options={{ title: '', headerRight: () => <PinButton id={prayer.id} size={22} /> }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.detail}>
        <Text style={styles.kicker}>{prayer.category}</Text>
        <Text style={styles.title}>{prayer.title}</Text>
        {ref ? (
          <Text style={styles.ref}>
            {ref} · {translationName(translation)}
          </Text>
        ) : null}
        <View style={{ height: 18 }} />
        {prayer.text ? <PrayerText text={prayer.text} /> : null}
        {prayer.scripture ? <ScriptureText scripture={prayer.scripture} translation={translation} /> : null}
        {prayer.rosary ? <Rosary /> : null}
        {prayer.note ? <Text style={styles.note}>{prayer.note}</Text> : null}
        {prayer.custom ? <CustomActions id={prayer.id} /> : null}
      </ScrollView>
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    h1: { color: C.text, fontFamily: SERIF, fontSize: 34, lineHeight: 42, marginTop: 4, marginBottom: 14 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, color: C.text, fontSize: 16, padding: 0 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 16, alignSelf: 'flex-start' },
    backText: { color: C.gold, fontSize: 15, fontWeight: '700' },
    catalog: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    catalogCard: {
      width: '48%',
      minHeight: 88,
      justifyContent: 'space-between',
      backgroundColor: C.card,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    catalogTitle: { color: C.text, fontSize: 16, fontWeight: '600', lineHeight: 21 },
    catalogCount: { color: C.faint, fontSize: 13, marginTop: 10 },
    section: {
      color: C.muted,
      fontSize: 12,
      letterSpacing: 1.8,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
    },
    group: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    pressed: { backgroundColor: C.cardHi },
    rowTitle: { color: C.text, fontSize: 16, fontWeight: '600' },
    rowPreview: { color: C.faint, fontSize: 13, marginTop: 2 },
    empty: { color: C.muted, fontSize: 14, lineHeight: 20 },
    detail: { paddingHorizontal: 24, paddingBottom: 60 },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 8 },
    title: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40, marginTop: 6 },
    ref: { color: C.muted, fontSize: 13, marginTop: 6 },
    para: { color: C.text, fontFamily: SERIF, fontSize: 20, lineHeight: 32, marginBottom: 18 },
    response: { color: C.gold },
    verseNum: { color: C.gold, fontSize: 12, fontWeight: '700', fontFamily: undefined },
    note: {
      color: C.muted,
      fontStyle: 'italic',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 10,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    subhead: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 8 },
    step: { color: C.text, fontSize: 16, lineHeight: 24, marginBottom: 6 },
    mysteries: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'transparent' },
    mysteriesToday: { borderColor: 'rgba(255,209,102,0.5)' },
    mysteriesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    todayBadge: {
      color: C.onGold,
      backgroundColor: C.gold,
      fontSize: 12,
      fontWeight: '800',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    mystery: { color: C.text, fontFamily: SERIF, fontSize: 16, lineHeight: 25 },
    confession: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 14,
      marginTop: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.2)',
    },
    confessionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,209,102,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    guided: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      paddingVertical: 13,
      borderRadius: 999,
      marginBottom: 18,
    },
    guidedText: { color: C.onGold, fontWeight: '800', fontSize: 16 },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.card,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    actionDanger: { borderColor: C.red },
    actionText: { color: C.text, fontSize: 14, fontWeight: '600' },
  });
