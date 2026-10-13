import { useState } from 'react';
import { PixelRatio, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SERIF } from './cards';
import type { Passage } from './data/content';
import { type Ancestor, type Branch, type Place, placeLabel, placePassage, type Stage, TREE } from './data/genealogy';
import { C } from './liturgy';
import { ChapterSheet } from './sheets';

/** Deux teintes : l'or pour la lignée royale et le tronc, un bleu doux pour la lignée de Luc. */
// Tout est opaque : un fond ou un trait translucide laisserait voir le tronc qui passe derrière les cartes.
const GOLD = { solid: C.gold, line: '#7a6638', border: '#62563c', fill: '#2a2418', pressed: '#3a301c' };
const BLUE = { solid: '#7cc4d6', line: '#3f606a', border: '#3b535e', fill: '#18272d', pressed: '#223740' };
/** Le fond d'une carte au toucher : un cran plus clair, sans jamais baisser l'opacité. */
const CARD_PRESSED = '#2b303b';
type Tone = typeof GOLD;

/**
 * La ligne verticale qui relie les personnages ; les en-têtes et les pastilles la recouvrent.
 * Elle est centrée par la mise en page (alignItems) comme les pastilles, jamais par une position en pourcentage :
 * Android ne les arrondit pas pareil et la ligne finissait décalée de quelques pixels.
 */
function Spine({ tone }: { tone: Tone }) {
  return (
    <View pointerEvents="none" style={styles.spineBox}>
      <View style={[styles.spine, { backgroundColor: tone.line }]} />
    </View>
  );
}

function Heading({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.headingTitle}>{title}</Text>
      {caption ? <Text style={styles.headingCaption}>{caption}</Text> : null}
    </View>
  );
}

function Person({ person, tone, onRead }: { person: Ancestor; tone: Tone; onRead: (place: Place) => void }) {
  const small = [person.alt, person.years ? `${person.years} ans` : null].filter(Boolean).join(' · ');
  const withLine = person.with ? <Text style={styles.with}>et {person.with}</Text> : null;
  const smallLine = small ? <Text style={styles.small}>{small}</Text> : null;
  const { read } = person;

  const card = (pressed: boolean) => (
    <View
      style={[
        styles.card,
        { borderColor: tone.border },
        pressed && { backgroundColor: CARD_PRESSED },
        person.final && { backgroundColor: pressed ? tone.pressed : tone.fill, borderColor: tone.solid },
      ]}
    >
      <Text style={[styles.cardName, person.final && styles.finalName]}>{person.name}</Text>
      {withLine}
      {smallLine}
      <Text style={styles.note}>{person.note}</Text>
      {read ? <Text style={[styles.read, { color: tone.solid }]}>Lire {placeLabel(read)}</Text> : null}
    </View>
  );

  const pill = (
    <View style={[styles.pill, { borderColor: tone.border }]}>
      <Text style={styles.pillName}>{person.name}</Text>
      {withLine}
      {smallLine}
    </View>
  );

  return (
    <View style={styles.person}>
      {!person.note ? (
        pill
      ) : read ? (
        <Pressable onPress={() => onRead(read)} style={styles.cardPress}>
          {({ pressed }) => card(pressed)}
        </Pressable>
      ) : (
        card(false)
      )}
      {person.aside ? <Text style={styles.aside}>{person.aside}</Text> : null}
    </View>
  );
}

function People({ people, tone, onRead }: { people: Ancestor[]; tone: Tone; onRead: (place: Place) => void }) {
  return (
    <View style={styles.people}>
      {people.map((p, i) => (
        <Person key={`${i}-${p.name}`} person={p} tone={tone} onRead={onRead} />
      ))}
    </View>
  );
}

/**
 * Là où la ligne se partage en deux colonnes, ou se rejoint.
 * Ses deux moitiés ont exactement la largeur et le centrage des colonnes : les traits tombent pile dessous.
 */
function Connector({ merge }: { merge?: boolean }) {
  const dropAt = merge ? styles.upper : styles.lower;
  const trunkAt = merge ? styles.lower : styles.upper;
  return (
    <View style={styles.connector}>
      <View style={styles.halves}>
        <View style={styles.half}>
          <View style={[styles.stroke, dropAt, { backgroundColor: GOLD.line }]} />
        </View>
        <View style={styles.half}>
          <View style={[styles.stroke, dropAt, { backgroundColor: BLUE.line }]} />
        </View>
      </View>
      <View style={styles.bars}>
        <View style={styles.quarter} />
        <View style={[styles.quarter, { backgroundColor: GOLD.line }]} />
        <View style={[styles.quarter, { backgroundColor: BLUE.line }]} />
        <View style={styles.quarter} />
      </View>
      <View style={styles.trunkBox}>
        <View style={[styles.stroke, trunkAt, { backgroundColor: GOLD.line }]} />
      </View>
    </View>
  );
}

function Column({ branch, tone, onRead }: { branch: Branch; tone: Tone; onRead: (place: Place) => void }) {
  return (
    <View style={styles.column}>
      <Spine tone={tone} />
      <View style={[styles.tag, { borderColor: tone.border }]}>
        <Text style={[styles.tagLabel, { color: tone.solid }]}>{branch.label}</Text>
        <Text style={styles.tagCaption}>{branch.caption}</Text>
      </View>
      <People people={branch.people} tone={tone} onRead={onRead} />
    </View>
  );
}

function StageView({ stage, onRead }: { stage: Stage; onRead: (place: Place) => void }) {
  if (stage.kind === 'trunk') {
    return (
      <View style={styles.stage}>
        <Spine tone={GOLD} />
        {stage.title ? <Heading title={stage.title} caption={stage.caption} /> : null}
        <People people={stage.people} tone={GOLD} onRead={onRead} />
      </View>
    );
  }
  return (
    <View>
      <View style={styles.stage}>
        <Spine tone={GOLD} />
        <Heading title={stage.title} caption={stage.caption} />
      </View>
      <Connector />
      <View style={styles.columns}>
        <Column branch={stage.left} tone={GOLD} onRead={onRead} />
        <Column branch={stage.right} tone={BLUE} onRead={onRead} />
      </View>
      <Connector merge />
    </View>
  );
}

/** L'arbre généalogique d'Adam et Ève jusqu'à Jésus, d'après la Genèse, Ruth, Matthieu et Luc. */
export function GenealogyScreen() {
  const [open, setOpen] = useState<Passage | null>(null);

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          De la création à Bethléem : la lignée qui mène d’Adam et Ève à Jésus. Matthieu et Luc ne la racontent pas de la même façon ;
          l’arbre se partage donc en deux là où ils divergent. Touche un personnage pour lire son passage.
        </Text>
        {TREE.map((stage, i) => (
          <StageView key={i} stage={stage} onRead={(place) => setOpen(placePassage(place))} />
        ))}
        <Text style={styles.credits}>Noms d’après la Bible Louis Segond 1910</Text>
      </ScrollView>
      {open && <ChapterSheet passage={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// Une épaisseur en pixels entiers : à 2 dp, certains écrans dessinaient des traits de 5 puis 6 px.
const LINE = PixelRatio.roundToNearestPixel(2);
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },
  intro: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  credits: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 30 },

  spineBox: { ...FILL, alignItems: 'center' },
  spine: { flex: 1, width: LINE },
  stage: { alignItems: 'center' },
  people: { alignSelf: 'stretch', alignItems: 'center', gap: 10 },
  person: { alignSelf: 'stretch', alignItems: 'center' },

  heading: { backgroundColor: C.bg, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, maxWidth: '100%' },
  headingTitle: { color: C.text, fontFamily: SERIF, fontSize: 22, textAlign: 'center' },
  headingCaption: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 4 },

  pill: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    alignItems: 'center',
    maxWidth: '100%',
  },
  pillName: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  card: {
    backgroundColor: C.cardHi,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    width: '100%',
    maxWidth: 420,
  },
  cardPress: { alignSelf: 'stretch', alignItems: 'center' },
  cardName: { color: C.text, fontFamily: SERIF, fontSize: 21, textAlign: 'center' },
  finalName: { fontSize: 26 },
  with: { color: C.muted, fontSize: 13, textAlign: 'center' },
  small: { color: C.faint, fontSize: 12, textAlign: 'center' },
  note: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  read: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  aside: {
    color: C.faint,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    textAlign: 'center',
    backgroundColor: C.bg,
    paddingTop: 6,
    paddingBottom: 3,
    paddingHorizontal: 8,
    maxWidth: '92%',
  },

  // Le connecteur fait 20 de haut ; la barre horizontale est à 9, et les traits verticaux la chevauchent d'un cran.
  connector: { height: 20 },
  halves: { ...FILL, flexDirection: 'row' },
  half: { width: '50%', alignItems: 'center' },
  bars: { position: 'absolute', top: 9, left: 0, right: 0, height: LINE, flexDirection: 'row' },
  quarter: { flex: 1 },
  trunkBox: { ...FILL, alignItems: 'center' },
  stroke: { width: LINE, height: 11 },
  upper: { marginTop: 0 },
  lower: { marginTop: 9 },

  columns: { flexDirection: 'row' },
  column: { width: '50%', alignItems: 'center', paddingHorizontal: 4 },
  tag: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  tagLabel: { fontSize: 13, fontWeight: '800' },
  tagCaption: { color: C.muted, fontSize: 12, textAlign: 'center' },
});
