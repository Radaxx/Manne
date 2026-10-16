import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, type StyleProp, StyleSheet, type TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sessionLabel as adorationLabel } from './adoration';
import type { Palette } from './appearance';
import { chapterSource, loadChapter, passageLabel, type TranslationId, translationName } from './bible';
import { SERIF } from './cards';
import { MYSTERIES, PRAYER_CATEGORIES, PRAYERS, type Prayer, type PrayerCategory, ROSARY_STEPS } from './data/prayers';
import { WEEKDAYS } from './dates';
import { biometricName, lockSupported } from './lock';
import { sessionLabel } from './rosary';
import { SectionHead } from './section';
import { dropPrayerCopy, setPrayerShown, useMyShowcase } from './showcase-store';
import { ShowcaseInvite, ShowSwitch } from './showcase-ui';
import { type CustomPrayer, useActions, useApp } from './storage';
import { Text, TextInput } from './text';
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

/** Les grains du chapelet (50 petits, 5 gros) posés sur un cercle de 38 de rayon centré en (52, 48), départ en bas. */
const BEADS = Array.from({ length: 5 }, (_, k) => {
  const start = 90 + 72 * k;
  return Array.from({ length: 11 }, (_, j) => {
    const angle = ((start + (72 * j) / 11) * Math.PI) / 180;
    return { x: 52 + 38 * Math.cos(angle), y: 48 + 38 * Math.sin(angle), r: j === 0 ? 3.4 : 1.9 };
  });
}).flat();

/** Un petit chapelet : cinq dizaines, le gros grain entre chacune, puis la chaînette et la croix. */
function RosaryMark() {
  const { styles } = useThemed(stylesFor);
  const bead = (key: string, x: number, y: number, r: number) => (
    <View key={key} style={[styles.bead, { left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r }]} />
  );
  return (
    <View style={styles.rosary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.rosaryRing} />
      <View style={styles.rosaryChain} />
      {BEADS.map((b, i) => bead(`r${i}`, b.x, b.y, b.r))}
      {[92, 98, 104].map((y) => bead(`p${y}`, 52, y, 1.9))}
      {bead('pg', 52, 111, 2.8)}
      <View style={styles.crossV} />
      <View style={styles.crossH} />
    </View>
  );
}

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
            <SectionHead title={prayerCount(results.length)} />
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
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroKicker}>AUJOURD’HUI · {WEEKDAYS[new Date().getDay()].toUpperCase()}</Text>
                <Text style={styles.heroTitle}>{progress.rosary.session ? 'Reprendre mon chapelet' : 'Prier le chapelet'}</Text>
                <Text style={styles.rowPreview}>
                  {progress.rosary.session
                    ? sessionLabel(progress.rosary.session)
                    : `${MYSTERIES.find((m) => m.days.includes(new Date().getDay()))?.name}, guidé grain après grain.`}
                </Text>
                <Pressable
                  onPress={() => router.push('/chapelet')}
                  style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.heroBtnText}>{progress.rosary.session ? 'Reprendre' : 'Commencer'}</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.onGold} />
                </Pressable>
              </View>
              <RosaryMark />
            </View>

            <View style={styles.tiles}>
              <Pressable onPress={() => router.push('/adoration')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
                <View style={styles.tileIcon}>
                  <Ionicons name="sunny-outline" size={22} color={C.gold} />
                </View>
                <View>
                  <Text style={styles.tileTitle}>
                    {progress.adoration.session ? 'Reprendre mon adoration' : 'Adorer le Saint-Sacrement'}
                  </Text>
                  <Text style={styles.tileSub}>
                    {progress.adoration.session ? adorationLabel(progress.adoration.session) : 'Contemplatif ou guidé'}
                  </Text>
                </View>
              </Pressable>
              <Pressable onPress={() => router.push('/confession')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
                <View style={styles.tileIcon}>
                  <Ionicons
                    name={progress.confessionLock && lockSupported ? 'lock-closed-outline' : 'key-outline'}
                    size={22}
                    color={C.gold}
                  />
                </View>
                <View>
                  <Text style={styles.tileTitle}>Préparer ma confession</Text>
                  <Text style={styles.tileSub}>
                    {progress.confessionLock && lockSupported
                      ? `Protégé par ${biometricName}`
                      : progress.confession.items.length > 0
                        ? `${progress.confession.items.length} élément${progress.confession.items.length > 1 ? 's' : ''} noté${progress.confession.items.length > 1 ? 's' : ''}`
                        : 'Examen de conscience et liste personnelle'}
                  </Text>
                </View>
              </Pressable>
            </View>

            <SectionHead title="Épinglées" />
            {pinned.length === 0 ? (
              <Text style={styles.empty}>Touche l’épingle d’une prière pour la retrouver ici et sur l’accueil.</Text>
            ) : (
              <View style={styles.pins}>
                {pinned.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/priere/${p.id}`)}
                    style={({ pressed }) => [styles.pin, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <PinButton id={p.id} size={14} />
                    <Text style={styles.pinText} numberOfLines={1}>
                      {p.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <SectionHead title="Mes prières" />
            <View style={styles.group}>
              {mine.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
              <Pressable onPress={() => router.push('/priere-edition')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.writeIcon}>
                  <Ionicons name="add" size={18} color={C.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: C.gold }]}>Écrire une prière</Text>
                  {mine.length === 0 && <Text style={styles.rowPreview}>Une intention, une prière qui te touche, tes propres mots…</Text>}
                </View>
              </Pressable>
            </View>

            <SectionHead title="Essentielles" />
            <View style={styles.group}>
              {essentielles.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
            </View>

            <SectionHead title="Recueil" />
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
                    <View style={styles.catalogRow}>
                      <Text style={styles.catalogTitle} numberOfLines={2}>
                        {c}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={C.gold} />
                    </View>
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
            <SectionHead title={category ?? ''} />
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

function CustomActions({ id, title, text }: { id: string; title: string; text: string }) {
  const { C, styles } = useThemed(stylesFor);
  const { deleteCustomPrayer } = useActions();
  const mine = useMyShowcase();
  // Supprimer est définitif : on demande une seconde confirmation.
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={styles.actions}>
      <View style={styles.showcase}>
        <ShowcaseInvite />
        {mine.ready ? (
          <ShowSwitch
            on={mine.isPrayerShown(id)}
            change={(next) => setPrayerShown({ id, title, text }, next)}
            hint="Les personnes que tu suis et les membres de tes groupes voient une copie du titre et du texte. Elle suit tes modifications et disparaît si tu supprimes la prière."
          />
        ) : null}
      </View>
      <Pressable onPress={() => router.push({ pathname: '/priere-edition', params: { id } })} style={styles.actionBtn}>
        <Ionicons name="create-outline" size={17} color={C.text} />
        <Text style={styles.actionText}>Modifier</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          if (!confirm) return setConfirm(true);
          deleteCustomPrayer(id);
          void dropPrayerCopy(id).then((result) => {
            if (result && !result.ok) {
              Alert.alert(
                'Ton profil n’est pas à jour',
                'Ta prière est supprimée de ce téléphone, mais sa copie est encore affichée sur ton profil. Retire-la depuis ton profil quand tu as du réseau.',
              );
            }
          });
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
            {ref} · {translationName(prayer.scripture ? chapterSource(prayer.scripture[0], prayer.scripture[1], translation) : translation)}
          </Text>
        ) : null}
        <View style={{ height: 18 }} />
        {prayer.text ? <PrayerText text={prayer.text} /> : null}
        {prayer.scripture ? <ScriptureText scripture={prayer.scripture} translation={translation} /> : null}
        {prayer.rosary ? <Rosary /> : null}
        {prayer.note ? <Text style={styles.note}>{prayer.note}</Text> : null}
        {prayer.custom ? <CustomActions id={prayer.id} title={prayer.title} text={prayer.text ?? ''} /> : null}
      </ScrollView>
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    h1: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40, marginTop: 4, marginBottom: 14 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
      paddingHorizontal: 16,
    },
    searchInput: { flex: 1, color: C.text, fontSize: 16, padding: 0 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 16, alignSelf: 'flex-start' },
    backText: { color: C.gold, fontSize: 15, fontWeight: '700' },
    catalog: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    catalogCard: {
      width: '48.5%',
      minHeight: 76,
      justifyContent: 'space-between',
      backgroundColor: C.card,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    catalogRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    catalogTitle: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 20, flexShrink: 1 },
    catalogCount: { color: C.faint, fontSize: 13, marginTop: 8 },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: C.line,
      padding: 20,
      marginTop: 20,
    },
    heroKicker: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    heroTitle: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: 4 },
    heroBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      height: 48,
      paddingHorizontal: 22,
      borderRadius: 24,
      backgroundColor: C.gold,
      marginTop: 16,
    },
    heroBtnText: { color: C.onGold, fontSize: 15, fontWeight: '800' },
    rosary: { width: 104, height: 132 },
    rosaryRing: {
      position: 'absolute',
      left: 14,
      top: 10,
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1,
      borderColor: C.gold,
      opacity: 0.45,
    },
    rosaryChain: { position: 'absolute', left: 51.5, top: 86, width: 1, height: 26, backgroundColor: C.gold, opacity: 0.45 },
    bead: { position: 'absolute', backgroundColor: C.gold },
    crossV: { position: 'absolute', left: 50.5, top: 115, width: 3, height: 16, borderRadius: 1.5, backgroundColor: C.gold },
    crossH: { position: 'absolute', left: 45.5, top: 120, width: 13, height: 3, borderRadius: 1.5, backgroundColor: C.gold },
    tiles: { flexDirection: 'row', gap: 12, marginTop: 12 },
    tile: { flex: 1, minHeight: 132, justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 20, padding: 16 },
    tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    tileTitle: { color: C.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
    tileSub: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    pins: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pin: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      backgroundColor: C.card,
      paddingHorizontal: 16,
      borderRadius: 22,
      maxWidth: '100%',
    },
    pinText: { color: C.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    writeIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    group: { backgroundColor: C.card, borderRadius: 20, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 64,
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
    mysteriesToday: { borderColor: C.gold },
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
    showcase: { width: '100%' },
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
