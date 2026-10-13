import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Mass, type MassReading, plainText, useMass } from './aelf';
import type { Palette } from './appearance';
import { SERIF } from './cards';
import {
  type ChantLang,
  type CreedId,
  FIRST_TIME,
  linesForCreed,
  linesForLang,
  MASS_PARTS,
  type MassLine,
  type MassMoment,
  type MassPart,
  type MassVoice,
  momentCopy,
  POSTURE_LABEL,
  VOICE_LABEL,
  VOICE_ORDER,
  visibleMoments,
} from './data/mass-guide';
import { prayerById } from './data/prayers';
import { LiturgyText } from './liturgy';
import { useThemed } from './theme';

type Phase = 'choice' | 'intro' | 'live';

const READING_MISS = 'Le texte du jour n’a pas pu être chargé.';

function partIndex(part: MassPart) {
  return MASS_PARTS.findIndex((p) => p.id === part);
}

export function MassGuideScreen() {
  const { styles } = useThemed(stylesFor);
  const { data, error } = useMass();
  const [phase, setPhase] = useState<Phase>('choice');
  const [sunday, setSunday] = useState(() => new Date().getDay() === 0);
  const [massIndex, setMassIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [lost, setLost] = useState(false);
  const [chantLang, setChantLang] = useState<ChantLang>('fr');
  const [creed, setCreed] = useState<CreedId>('nicee');

  const masses = data?.messes ?? [];
  const mass = masses[Math.min(massIndex, Math.max(0, masses.length - 1))];
  const violet = data?.informations.couleur === 'violet';
  const second = mass ? mass.lectures.some((l) => l.type === 'lecture_2') : null;
  const moments = useMemo(() => visibleMoments(sunday, violet, second), [sunday, violet, second]);
  const index = Math.min(step, Math.max(0, moments.length - 1));
  const moment = moments[index];

  const goLive = () => {
    setStep(0);
    setPhase('live');
  };

  return (
    <View style={styles.root}>
      {phase === 'choice' && (
        <Choice
          sunday={sunday}
          onSunday={setSunday}
          masses={masses}
          massIndex={mass ? masses.indexOf(mass) : 0}
          onMass={setMassIndex}
          onIntro={() => setPhase('intro')}
          onLive={goLive}
        />
      )}
      {phase === 'intro' && <Intro onStart={goLive} />}
      {phase === 'live' && moment && (
        <Live
          moment={moment}
          index={index}
          total={moments.length}
          violet={violet}
          mass={mass}
          loading={!data && !error}
          error={error}
          chantLang={chantLang}
          onChantLang={setChantLang}
          creed={creed}
          onCreed={setCreed}
          onPrev={() => setStep(Math.max(0, index - 1))}
          onNext={() => {
            if (index >= moments.length - 1) router.back();
            else setStep(index + 1);
          }}
          onLost={() => setLost(true)}
        />
      )}
      <Modal animationType="slide" presentationStyle="pageSheet" visible={lost} onRequestClose={() => setLost(false)}>
        <Lost
          moments={moments}
          current={moment?.id}
          onPick={(i) => {
            setStep(i);
            setLost(false);
          }}
          onClose={() => setLost(false)}
        />
      </Modal>
    </View>
  );
}

function Choice({
  sunday,
  onSunday,
  masses,
  massIndex,
  onMass,
  onIntro,
  onLive,
}: {
  sunday: boolean;
  onSunday: (sunday: boolean) => void;
  masses: Mass[];
  massIndex: number;
  onMass: (index: number) => void;
  onIntro: () => void;
  onLive: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>À la messe</Text>
      <Text style={styles.title}>Suivre le déroulé</Text>
      <Text style={styles.lead}>Un moment à la fois : ce qui se passe, ce que tu peux répondre, et quand te lever.</Text>

      <View style={styles.toggle}>
        <Pressable onPress={() => onSunday(true)} style={[styles.toggleBtn, sunday && styles.toggleOn]}>
          <Text style={[styles.toggleText, sunday && { color: C.onGold }]}>Messe du dimanche</Text>
        </Pressable>
        <Pressable onPress={() => onSunday(false)} style={[styles.toggleBtn, !sunday && styles.toggleOn]}>
          <Text style={[styles.toggleText, !sunday && { color: C.onGold }]}>Messe de semaine</Text>
        </Pressable>
      </View>
      <Text style={styles.note}>Le dimanche ajoute le Gloire à Dieu, la deuxième lecture et le Je crois en Dieu.</Text>

      {masses.length > 1 && (
        <View style={styles.massPicker}>
          <Text style={styles.blockLabel}>Quelle messe ?</Text>
          {masses.map((m, i) => (
            <Pressable key={`${i}-${m.nom}`} onPress={() => onMass(i)} style={[styles.massChip, i === massIndex && styles.massChipOn]}>
              <Text style={[styles.massChipText, i === massIndex && { color: C.gold }]}>{m.nom}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={onIntro} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <Text style={styles.cardTitle}>C’est la première fois</Text>
        <Text style={styles.muted}>Quelques repères avant d’entrer, puis le déroulé.</Text>
      </Pressable>
      <Pressable onPress={onLive} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>Je suis à la messe</Text>
        <Ionicons name="arrow-forward" size={18} color={C.onGold} />
      </Pressable>
    </ScrollView>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>Avant d’y aller</Text>
        <Text style={styles.title}>C’est la première fois</Text>
        {FIRST_TIME.map((item) => (
          <View key={item.title} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.body}>{item.text}</Text>
          </View>
        ))}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable onPress={onStart} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Suivre le déroulé</Text>
          <Ionicons name="arrow-forward" size={18} color={C.onGold} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Live({
  moment,
  index,
  total,
  violet,
  mass,
  loading,
  error,
  chantLang,
  onChantLang,
  creed,
  onCreed,
  onPrev,
  onNext,
  onLost,
}: {
  moment: MassMoment;
  index: number;
  total: number;
  violet: boolean;
  mass: Mass | undefined;
  loading: boolean;
  error: boolean;
  chantLang: ChantLang;
  onChantLang: (lang: ChantLang) => void;
  creed: CreedId;
  onCreed: (creed: CreedId) => void;
  onPrev: () => void;
  onNext: () => void;
  onLost: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const copy = momentCopy(moment, violet);
  const lines = linesForCreed(linesForLang(copy.lines, chantLang), creed);
  const bilingual = copy.lines.some((line) => line.lang);
  const hasCreed = copy.lines.some((line) => line.creed);
  const prayer = moment.prayerId ? prayerById(moment.prayerId) : undefined;
  const here = partIndex(moment.part);
  const last = index >= total - 1;
  const go = useRef({ prev: onPrev, next: onNext, index, last });
  go.current = { prev: onPrev, next: onNext, index, last };
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -48 && !go.current.last) go.current.next();
        else if (g.dx >= 48 && go.current.index > 0) go.current.prev();
      },
    }),
  ).current;

  return (
    <View style={styles.root}>
      <View style={styles.progressWrap}>
        <View style={styles.progress}>
          {MASS_PARTS.map((part, i) => (
            <View key={part.id} style={[styles.progressSeg, i <= here && { backgroundColor: C.gold }]} />
          ))}
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.partLabel}>{MASS_PARTS[here]?.label}</Text>
          <Text style={styles.count}>
            {index + 1} / {total}
          </Text>
        </View>
      </View>
      <View style={styles.live} {...pan.panHandlers}>
        <ScrollView contentContainerStyle={styles.liveScroll}>
          <View style={styles.posture}>
            <Ionicons name="body-outline" size={14} color={C.gold} />
            <Text style={styles.postureText}>{POSTURE_LABEL[moment.posture]}</Text>
          </View>
          <Text style={styles.momentTitle}>{moment.title}</Text>
          <Text style={styles.blockLabel}>Ce qui se passe</Text>
          <Text style={styles.body}>{copy.what}</Text>
          <Text style={styles.blockLabel}>Toi</Text>
          <Text style={styles.body}>{copy.you}</Text>
          {bilingual ? <ChantSwitch lang={chantLang} onChange={onChantLang} /> : null}
          {hasCreed ? <CreedSwitch creed={creed} onChange={onCreed} /> : null}
          <Dialogue lines={lines} />
          {prayer?.text ? (
            <View style={styles.prayer}>
              <Text style={styles.prayerTitle}>{prayer.title}</Text>
              <Text style={styles.prayerText}>{prayer.text}</Text>
            </View>
          ) : null}
          <Reading moment={moment} mass={mass} loading={loading} error={error} />
        </ScrollView>
      </View>
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Pressable onPress={onLost} hitSlop={8} style={styles.lostBtn}>
          <Text style={styles.lost}>Je me suis perdu</Text>
        </Pressable>
        <View style={styles.nav}>
          <Pressable onPress={onPrev} disabled={index === 0} hitSlop={8} style={[styles.navSide, index === 0 && styles.navOff]}>
            <Ionicons name="chevron-back" size={18} color={C.text} />
            <Text style={styles.navText}>Précédent</Text>
          </Pressable>
          <Pressable onPress={onNext} hitSlop={8} style={[styles.navSide, styles.navNext]}>
            <Text style={styles.navText}>{last ? 'Terminer' : 'Suivant'}</Text>
            <Ionicons name={last ? 'checkmark' : 'chevron-forward'} size={18} color={C.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ChantSwitch({ lang, onChange }: { lang: ChantLang; onChange: (lang: ChantLang) => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <View style={[styles.toggle, styles.chantSwitch]}>
      <Pressable onPress={() => onChange('fr')} style={[styles.toggleBtn, lang === 'fr' && styles.toggleOn]}>
        <Text style={[styles.toggleText, lang === 'fr' && { color: C.onGold }]}>Français</Text>
      </Pressable>
      <Pressable onPress={() => onChange('la')} style={[styles.toggleBtn, lang === 'la' && styles.toggleOn]}>
        <Text style={[styles.toggleText, lang === 'la' && { color: C.onGold }]}>Latin</Text>
      </Pressable>
    </View>
  );
}

function CreedSwitch({ creed, onChange }: { creed: CreedId; onChange: (creed: CreedId) => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <View style={[styles.toggle, styles.chantSwitch]}>
      <Pressable onPress={() => onChange('nicee')} style={[styles.toggleBtn, creed === 'nicee' && styles.toggleOn]}>
        <Text style={[styles.toggleText, creed === 'nicee' && { color: C.onGold }]}>Nicée</Text>
      </Pressable>
      <Pressable onPress={() => onChange('apotres')} style={[styles.toggleBtn, creed === 'apotres' && styles.toggleOn]}>
        <Text style={[styles.toggleText, creed === 'apotres' && { color: C.onGold }]}>Apôtres</Text>
      </Pressable>
    </View>
  );
}

function voiceColor(C: Palette, who: MassVoice): string {
  if (who === 'pretre') return C.red;
  if (who === 'assemblee') return C.gold;
  return C.statusBar === 'light' ? '#79b8ff' : '#1d4f91';
}

function voiceTint(who: MassVoice): string {
  if (who === 'pretre') return 'rgba(224,122,107,0.12)';
  if (who === 'assemblee') return 'rgba(255,209,102,0.12)';
  return 'rgba(121,184,255,0.12)';
}

function Dialogue({ lines }: { lines: MassLine[] }) {
  const { C, styles } = useThemed(stylesFor);
  if (lines.length === 0) return null;
  const present = new Set(lines.map((line) => line.who));
  return (
    <View style={styles.dialogue}>
      <View style={styles.legend}>
        {VOICE_ORDER.filter((who) => present.has(who)).map((who) => (
          <View key={who} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: voiceColor(C, who) }]} />
            <Text style={[styles.legendText, { color: voiceColor(C, who) }]}>{VOICE_LABEL[who]}</Text>
          </View>
        ))}
      </View>
      {lines.map((line, i) => (
        <View
          key={`${line.who}-${i}`}
          style={[styles.line, { borderLeftColor: voiceColor(C, line.who), backgroundColor: voiceTint(line.who) }]}
        >
          <Text style={[styles.lineWho, { color: voiceColor(C, line.who) }]}>{line.caption ?? VOICE_LABEL[line.who]}</Text>
          <Text style={styles.lineText}>{line.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Reading({ moment, mass, loading, error }: { moment: MassMoment; mass: Mass | undefined; loading: boolean; error: boolean }) {
  const { C, styles } = useThemed(stylesFor);
  const acclamation = moment.id === 'acclamation';
  if (!moment.readingType && !acclamation) return null;

  if (loading) return <ActivityIndicator color={C.muted} style={{ marginTop: 12 }} />;

  if (acclamation) {
    const gospel = mass?.lectures.find((l) => l.type === 'evangile');
    if (gospel?.verset_evangile) {
      return (
        <View style={styles.reading}>
          <LiturgyText html={gospel.verset_evangile} />
        </View>
      );
    }
    if (error) return <Text style={styles.miss}>{READING_MISS}</Text>;
    return null;
  }

  const reading = mass?.lectures.find((l) => l.type === moment.readingType);
  if (!reading) return <Text style={styles.miss}>{READING_MISS}</Text>;
  return (
    <View style={styles.reading}>
      <DayReading reading={reading} />
    </View>
  );
}

function DayReading({ reading }: { reading: MassReading }) {
  const { styles } = useThemed(stylesFor);
  return (
    <>
      {reading.ref ? <Text style={styles.ref}>{reading.ref}</Text> : null}
      {reading.titre ? <Text style={styles.readingTitle}>{plainText(reading.titre)}</Text> : null}
      {reading.refrain_psalmique ? (
        <View style={styles.refrain}>
          <Text style={styles.rubric}>R/</Text>
          <LiturgyText html={reading.refrain_psalmique} />
        </View>
      ) : null}
      <LiturgyText html={reading.contenu} />
    </>
  );
}

function Lost({
  moments,
  current,
  onPick,
  onClose,
}: {
  moments: MassMoment[];
  current: string | undefined;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
      <View style={styles.sheetHead}>
        <Text style={styles.sheetTitle}>Où en est-on ?</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
          <Ionicons name="close" size={26} color={C.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.sheetScroll}>
        {MASS_PARTS.map((part) => {
          const items = moments.flatMap((moment, i) => (moment.part === part.id ? [{ moment, i }] : []));
          if (items.length === 0) return null;
          return (
            <View key={part.id}>
              <Text style={styles.sheetPart}>{part.label}</Text>
              {items.map(({ moment, i }) => (
                <Pressable key={moment.id} onPress={() => onPick(i)} style={styles.sheetRow}>
                  <Text style={[styles.sheetRowText, moment.id === current && { color: C.gold }]}>{moment.title}</Text>
                  {moment.id === current ? <Ionicons name="ellipse" size={8} color={C.gold} /> : null}
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40 },
    live: { flex: 1 },
    liveScroll: { paddingHorizontal: 22, paddingBottom: 24 },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40, marginTop: 6, marginBottom: 8 },
    lead: { color: C.muted, fontSize: 16, lineHeight: 23, marginBottom: 18 },
    note: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 8, marginBottom: 18 },
    toggle: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4, gap: 4 },
    toggleBtn: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
    toggleOn: { backgroundColor: C.gold },
    toggleText: { color: C.text, fontSize: 14, fontWeight: '700' },
    chantSwitch: { marginBottom: 16 },
    massPicker: { gap: 8, marginBottom: 16 },
    massChip: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
    massChipOn: { borderWidth: 1, borderColor: 'rgba(255,209,102,0.45)' },
    massChipText: { color: C.text, fontSize: 15, fontWeight: '600' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    body: { color: C.text, fontSize: 16, lineHeight: 24, marginBottom: 16 },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      borderRadius: 999,
      paddingVertical: 14,
      marginTop: 6,
    },
    primaryText: { color: C.onGold, fontWeight: '800', fontSize: 16 },
    pressed: { opacity: 0.7 },
    progressWrap: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 8 },
    progress: { flexDirection: 'row', gap: 6 },
    progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.track },
    progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    partLabel: { color: C.gold, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
    count: { color: C.faint, fontSize: 13, fontWeight: '600' },
    posture: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,209,102,0.12)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 12,
    },
    postureText: { color: C.gold, fontSize: 13, fontWeight: '800' },
    momentTitle: { color: C.text, fontFamily: SERIF, fontSize: 30, lineHeight: 36, marginBottom: 16 },
    blockLabel: { color: C.red, fontSize: 12, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
    prayer: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 8 },
    prayerTitle: { color: C.gold, fontSize: 13, fontWeight: '800', marginBottom: 8 },
    prayerText: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 28 },
    dialogue: { gap: 8, marginBottom: 16 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
    line: { borderLeftWidth: 3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    lineWho: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
    lineText: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 26 },
    reading: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
    ref: { color: C.muted, fontSize: 13, fontWeight: '700', marginBottom: 8 },
    readingTitle: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 26, marginBottom: 10 },
    refrain: { backgroundColor: 'rgba(224,122,107,0.08)', borderRadius: 10, padding: 12, paddingBottom: 0, marginBottom: 8 },
    rubric: { color: C.red, fontWeight: '700', fontSize: 13, marginBottom: 4 },
    miss: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
    footer: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.bg },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
    navSide: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    navNext: { justifyContent: 'flex-end' },
    navOff: { opacity: 0.3 },
    navText: { color: C.text, fontSize: 15, fontWeight: '700' },
    lostBtn: { alignItems: 'center', paddingBottom: 8 },
    lost: { color: C.gold, fontSize: 14, fontWeight: '700' },
    sheet: { flex: 1, backgroundColor: C.bg },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    sheetTitle: { color: C.text, fontFamily: SERIF, fontSize: 24 },
    sheetScroll: { paddingHorizontal: 22, paddingBottom: 32 },
    sheetPart: {
      color: C.red,
      fontSize: 12,
      letterSpacing: 1.2,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 6,
    },
    sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    sheetRowText: { color: C.text, fontSize: 17, fontWeight: '600' },
  });
