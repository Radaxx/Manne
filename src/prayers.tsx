import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SERIF } from './cards';
import { BOOKS, loadBook } from './data/bible';
import { MYSTERIES, PRAYER_CATEGORIES, PRAYERS, ROSARY_STEPS, type Prayer, type PrayerCategory } from './data/prayers';
import { C } from './liturgy';
import { useApp } from './storage';

/** Pour la recherche : minuscules, sans accents ni apostrophes typographiques. */
const fold = (s: string) => {
  const lower = s.toLowerCase();
  return (typeof lower.normalize === 'function' ? lower.normalize('NFD') : lower).replace(/[̀-ͯ]/g, '').replace(/’/g, "'");
};

const scriptureRef = (p: Prayer) => {
  if (!p.scripture) return null;
  const [b, c, f, t] = p.scripture;
  return `${BOOKS[b - 1].name} ${c}:${f}${t > f ? `-${t}` : ''}`;
};

function PinButton({ id, size = 20 }: { id: string; size?: number }) {
  const { progress, togglePin } = useApp();
  const pinned = progress.pinnedPrayers.includes(id);
  return (
    <Pressable onPress={() => togglePin(id)} hitSlop={10} accessibilityLabel={pinned ? 'Désépingler' : 'Épingler'}>
      <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={size} color={pinned ? C.gold : C.muted} />
    </Pressable>
  );
}

function PrayerRow({ prayer }: { prayer: Prayer }) {
  const preview = prayer.text?.split('\n')[0] ?? scriptureRef(prayer) ?? (prayer.rosary ? 'Les mystères du jour et comment le prier' : '');
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

/** Onglet Prières : épinglées en haut, puis tout le recueil par thème, avec recherche. */
export function PrayersScreen() {
  const { progress } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PrayerCategory | null>(null);

  const pinned = progress.pinnedPrayers.map((id) => PRAYERS.find((p) => p.id === id)).filter((p): p is Prayer => !!p);
  const results = useMemo(() => {
    const q = fold(query.trim());
    return PRAYERS.filter((p) => (!category || p.category === category) && (!q || fold(`${p.title} ${p.text ?? ''} ${p.note ?? ''}`).includes(q)));
  }, [query, category]);
  const searching = query.trim().length > 0 || category !== null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Prières</Text>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Chercher une prière" placeholderTextColor={C.faint} style={styles.searchInput} autoCorrect={false} />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PRAYER_CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(category === c ? null : c)} style={[styles.chip, category === c && styles.chipActive]}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!searching && (
          <>
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
          </>
        )}

        {searching ? (
          <>
            <Text style={styles.section}>
              {results.length} prière{results.length > 1 ? 's' : ''}
            </Text>
            <View style={styles.group}>
              {results.map((p) => (
                <PrayerRow key={p.id} prayer={p} />
              ))}
            </View>
          </>
        ) : (
          PRAYER_CATEGORIES.map((c) => (
            <View key={c}>
              <Text style={styles.section}>{c}</Text>
              <View style={styles.group}>
                {PRAYERS.filter((p) => p.category === c).map((p) => (
                  <PrayerRow key={p.id} prayer={p} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Une ligne « — … » est la réponse de l'assemblée. */
function PrayerText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n\n').map((para, i) => (
        <Text key={i} style={styles.para}>
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

function ScriptureText({ scripture }: { scripture: [number, number, number, number] }) {
  const [b, c, f, t] = scripture;
  const verses = loadBook(b)[c - 1].slice(f - 1, t);
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
  const today = new Date().getDay();
  return (
    <>
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

export function PrayerScreen({ id }: { id: string }) {
  const prayer = PRAYERS.find((p) => p.id === id);
  if (!prayer) return <Text style={styles.empty}>Prière introuvable.</Text>;
  const ref = scriptureRef(prayer);
  return (
    <>
      <Stack.Screen options={{ title: '', headerRight: () => <PinButton id={prayer.id} size={22} /> }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.detail}>
        <Text style={styles.kicker}>{prayer.category}</Text>
        <Text style={styles.title}>{prayer.title}</Text>
        {ref ? <Text style={styles.ref}>{ref} · Louis Segond 1910</Text> : null}
        <View style={{ height: 18 }} />
        {prayer.text ? <PrayerText text={prayer.text} /> : null}
        {prayer.scripture ? <ScriptureText scripture={prayer.scripture} /> : null}
        {prayer.rosary ? <Rosary /> : null}
        {prayer.note ? <Text style={styles.note}>{prayer.note}</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  h1: { color: C.text, fontFamily: SERIF, fontSize: 34, lineHeight: 42, marginTop: 4, marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 16, padding: 0 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'transparent' },
  chipActive: { borderColor: C.gold, backgroundColor: 'rgba(255,209,102,0.12)' },
  chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: C.gold },
  section: { color: C.muted, fontSize: 12, letterSpacing: 1.8, fontWeight: '800', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  group: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
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
  note: { color: C.muted, fontStyle: 'italic', fontSize: 14, lineHeight: 21, marginTop: 10, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  subhead: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  step: { color: C.text, fontSize: 16, lineHeight: 24, marginBottom: 6 },
  mysteries: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'transparent' },
  mysteriesToday: { borderColor: 'rgba(255,209,102,0.5)' },
  mysteriesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  todayBadge: { color: C.bg, backgroundColor: C.gold, fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  mystery: { color: C.text, fontFamily: SERIF, fontSize: 16, lineHeight: 25 },
});
