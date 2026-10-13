import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from './appearance';
import { SERIF } from './cards';
import { BOOKS, loadBook } from './data/bible';
import type { Passage } from './data/content';
import { TOTAL_CHAPTERS } from './reading';
import { useThemed } from './theme';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} visible>
      <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

/** Le chapitre complet autour d'un verset : pour lire dans son contexte, pas seulement en extrait. */
export function ChapterSheet({ passage, onClose }: { passage: Passage; onClose: () => void }) {
  const { styles } = useThemed(stylesFor);
  const verses = loadBook(passage.book)[passage.chapter - 1];
  const scroll = useRef<ScrollView>(null);

  return (
    <Sheet title={`${passage.bookName} ${passage.chapter}`} onClose={onClose}>
      <ScrollView ref={scroll} contentContainerStyle={styles.chapter}>
        {verses.map((text, i) => {
          const n = i + 1;
          const highlighted = n >= passage.from && n <= passage.to;
          return (
            <Text
              key={n}
              style={[styles.chapterVerse, highlighted && styles.highlight]}
              onLayout={
                n === passage.from
                  ? (e) => scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 120), animated: true })
                  : undefined
              }
            >
              <Text style={styles.num}>{n} </Text>
              {text}
            </Text>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

export function SavedSheet({
  saved,
  onRemove,
  onOpen,
  onClose,
}: {
  saved: Passage[];
  onRemove: (p: Passage) => void;
  onOpen: (p: Passage) => void;
  onClose: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Sheet title="Mes versets" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        {saved.length === 0 && <Text style={styles.muted}>Touche le marque-page sur un passage pour le garder ici.</Text>}
        {saved.map((p) => (
          <Pressable key={p.id} style={styles.item} onPress={() => onOpen(p)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemText} numberOfLines={4}>
                {p.text}
              </Text>
              <Text style={styles.itemRef}>{p.reference}</Text>
            </View>
            <Pressable onPress={() => onRemove(p)} hitSlop={10} accessibilityLabel="Retirer">
              <Ionicons name="bookmark" size={22} color={C.gold} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** Choisir un livre puis un chapitre, avec la progression de chacun. */
export function BooksSheet({
  current,
  positions,
  chaptersRead,
  onPick,
  onClose,
}: {
  current: number;
  positions: Record<number, { chapter: number; verse: number }>;
  chaptersRead: string[];
  /** chapter absent : reprendre là où on en était dans ce livre. */
  onPick: (book: number, chapter?: number) => void;
  onClose: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const [selected, setSelected] = useState<number | null>(null);
  const read = useMemo(() => new Set(chaptersRead), [chaptersRead]);
  const readByBook = useMemo(() => {
    const m = new Map<number, number>();
    for (const k of chaptersRead) {
      const b = Number(k.split(':')[0]);
      m.set(b, (m.get(b) ?? 0) + 1);
    }
    return m;
  }, [chaptersRead]);

  if (selected !== null) {
    const b = BOOKS[selected - 1];
    const pos = positions[selected];
    return (
      <Sheet title={b.name} onClose={onClose}>
        <ScrollView contentContainerStyle={styles.list}>
          <Pressable onPress={() => setSelected(null)} hitSlop={8} style={styles.backRow}>
            <Ionicons name="chevron-back" size={18} color={C.gold} />
            <Text style={styles.backText}>Tous les livres</Text>
          </Pressable>
          {pos && (pos.chapter > 1 || pos.verse > 1) && (
            <Pressable onPress={() => onPick(selected)} style={styles.resume}>
              <Ionicons name="bookmark" size={16} color={C.onGold} />
              <Text style={styles.resumeText}>
                Reprendre : chapitre {pos.chapter}
                {pos.verse > 1 ? `, verset ${pos.verse}` : ''}
              </Text>
            </Pressable>
          )}
          <Text style={styles.section}>Chapitres</Text>
          <View style={styles.grid}>
            {b.verses.map((_, i) => {
              const n = i + 1;
              const isRead = read.has(`${selected}:${n}`);
              const isCurrent = pos?.chapter === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => onPick(selected, n)}
                  style={[styles.cell, isRead && styles.cellRead, isCurrent && styles.cellCurrent]}
                  accessibilityLabel={`Chapitre ${n}`}
                >
                  <Text style={[styles.cellText, isRead && styles.cellTextRead]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.legend}>En doré : chapitres déjà lus · encadré : ton marque-page</Text>
        </ScrollView>
      </Sheet>
    );
  }

  const section = (title: string, from: number, to: number) => (
    <View key={title}>
      <Text style={styles.section}>{title}</Text>
      {BOOKS.slice(from - 1, to).map((b) => {
        const count = readByBook.get(b.n) ?? 0;
        const total = b.verses.length;
        const active = b.n === current;
        return (
          <Pressable
            key={b.n}
            style={[styles.bookRow, active && styles.bookRowActive]}
            onPress={() => (total === 1 ? onPick(b.n, 1) : setSelected(b.n))}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bookName}>
                {b.name}
                {b.n === 41 && count === 0 ? <Text style={styles.badge}> conseillé pour commencer</Text> : null}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(count / total) * 100}%` }]} />
              </View>
            </View>
            <Text style={styles.bookCount}>
              {count}/{total}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={C.faint} />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Sheet title="Livres" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.overall}>
          {chaptersRead.length} chapitre{chaptersRead.length > 1 ? 's' : ''} lu{chaptersRead.length > 1 ? 's' : ''} sur {TOTAL_CHAPTERS}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(chaptersRead.length / TOTAL_CHAPTERS) * 100}%` }]} />
        </View>
        {section('Nouveau Testament', 40, 66)}
        {section('Ancien Testament', 1, 39)}
      </ScrollView>
    </Sheet>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    sheet: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    chapter: { padding: 22, paddingBottom: 80 },
    chapterVerse: { fontFamily: SERIF, fontSize: 18, lineHeight: 29, color: C.text, marginBottom: 6, padding: 4, borderRadius: 6 },
    highlight: { backgroundColor: C.highlight },
    num: { fontSize: 12, color: C.gold, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 15, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
    list: { padding: 16, gap: 12, paddingBottom: 60 },
    item: { flexDirection: 'row', gap: 12, backgroundColor: C.card, padding: 16, borderRadius: 14, alignItems: 'flex-start' },
    itemText: { fontFamily: SERIF, fontSize: 16, lineHeight: 23, color: C.text },
    itemRef: { marginTop: 8, fontSize: 12, letterSpacing: 1.5, color: C.muted, fontWeight: '600', textTransform: 'uppercase' },
    overall: { fontSize: 15, fontWeight: '700', color: C.text },
    section: {
      fontSize: 12,
      letterSpacing: 2,
      fontWeight: '800',
      color: C.gold,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
    },
    bookRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginBottom: 6,
    },
    bookRowActive: { borderWidth: 2, borderColor: C.gold },
    bookName: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 6 },
    badge: { fontSize: 12, fontWeight: '600', color: '#2a9d6a' },
    bookCount: { fontSize: 13, color: C.muted, fontVariant: ['tabular-nums'] },
    track: { height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: C.gold },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backText: { color: C.gold, fontSize: 15, fontWeight: '600' },
    resume: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: C.gold,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      marginTop: 6,
    },
    resumeText: { color: C.onGold, fontSize: 15, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    cellRead: { backgroundColor: C.highlight },
    cellCurrent: { borderColor: C.text },
    cellText: { fontSize: 17, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] },
    cellTextRead: { color: C.gold },
    legend: { color: C.faint, fontSize: 12, marginTop: 6 },
  });
