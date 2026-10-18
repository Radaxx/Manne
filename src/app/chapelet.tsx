import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../appearance';
import { rosaryMaterial } from '../appearance';
import { SERIF } from '../cards';
import { MYSTERIES, prayerById } from '../data/prayers';
import { firstParam } from '../groups';
import { haptic } from '../haptics';
import { chapeletTarget, setDecadePrayed } from '../living-rosary';
import { PrayerText } from '../prayers';
import { mysteryOrdinal, mysteryVerse, PRAYER_OF, RosaryBeads, type RosaryStep, rosarySteps, sessionLabel } from '../rosary';
import { Rosary3D } from '../rosary3d';
import { type RosarySession, today, useApp } from '../storage';
import { Text, TextInput } from '../text';
import { useThemed } from '../theme';
import { lastTimeLabel } from '../today';

// Prier le chapelet, guidé grain après grain : on choisit ses mystères, on touche le chapelet
// (ou le bouton) à chaque prière, et Manne compte à notre place. On peut quitter et reprendre.

const CLOSING =
  'Priez pour nous, sainte Mère de Dieu,\n— afin que nous soyons rendus dignes des promesses du Christ.\n\nAu nom du Père, et du Fils, et du Saint-Esprit. Amen.';

const todaySet = () => MYSTERIES.findIndex((s) => s.days.includes(new Date().getDay()));

function Kicker({ step, set }: { step: RosaryStep; set: number }) {
  const { styles } = useThemed(stylesFor);
  let text = 'Introduction';
  if (step.kind === 'mystery' && step.decade !== null) text = mysteryOrdinal(set, step.decade);
  else if (step.decade !== null) text = `Dizaine ${step.decade + 1} · ${MYSTERIES[set].mysteries[step.decade]}`;
  else if (step.kind === 'salve' || step.kind === 'closing') text = 'Conclusion';
  return <Text style={styles.kicker}>{text}</Text>;
}

function StepBody({ step, session, texts }: { step: RosaryStep; session: RosarySession; texts: boolean }) {
  const { C, styles } = useThemed(stylesFor);
  const { translation } = useApp().progress;
  if (step.kind === 'mystery' && step.decade !== null) {
    const set = MYSTERIES[session.set];
    const verse = mysteryVerse(session.set, step.decade, translation);
    return (
      <>
        <Text style={styles.title}>{set.mysteries[step.decade]}</Text>
        <Text style={styles.fruit}>
          <Text style={{ color: C.muted }}>Fruit du mystère : </Text>
          {set.fruits[step.decade]}
        </Text>
        <View style={styles.verse}>
          <Text style={styles.verseText}>« {verse.text} »</Text>
          <Text style={styles.verseRef}>{verse.ref}</Text>
        </View>
        <Text style={styles.hint}>Prends un instant pour contempler ce mystère, puis continue.</Text>
      </>
    );
  }

  const prayerId = PRAYER_OF[step.kind];
  const prayer = prayerId ? prayerById(prayerId) : undefined;
  const title = step.kind === 'closing' ? 'Pour conclure' : (prayer?.title ?? '');
  const text = step.kind === 'closing' ? CLOSING : (prayer?.text ?? '');
  const isFirst = step.kind === 'sign';
  return (
    <>
      <Text style={[styles.title, step.intent ? { marginBottom: 0 } : null]}>{title}</Text>
      {step.intent ? <Text style={styles.intent}>{step.intent}</Text> : null}
      {isFirst && session.intention ? (
        <View style={styles.intentionBox}>
          <Text style={styles.intentionLabel}>Je te confie ce chapelet</Text>
          <Text style={styles.intentionText}>{session.intention}</Text>
        </View>
      ) : null}
      {texts || isFirst || step.kind === 'closing' || step.kind === 'fatima' ? <PrayerText text={text} style={styles.prayer} /> : null}
    </>
  );
}

function Praying({ session, onDone, onExit }: { session: RosarySession; onDone: () => void; onExit: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setRosarySession, setRosaryPrefs } = useApp();
  const { texts } = progress.rosary;
  const material = rosaryMaterial(progress.appearance.rosary);
  // Si la 3D ne peut pas démarrer sur ce téléphone, on prie avec le chapelet à plat.
  const [glFailed, setGlFailed] = useState(false);
  const view3d = progress.rosary.view3d && !glFailed;
  const [peek, setPeek] = useState(false);
  const [gestured, setGestured] = useState(false);
  const steps = useMemo(() => rosarySteps(session.decade, session.fatima), [session.decade, session.fatima]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const index = Math.min(session.step, steps.length - 1);
  const step = steps[index];
  const last = index === steps.length - 1;
  // L'anneau prend environ un tiers de l'écran, sans déborder sur les petits téléphones.
  const diameter = Math.min(width - 120, height * 0.27, 260);

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      haptic('success');
      onDone();
      return;
    }
    haptic(steps[next].kind === 'mystery' ? 'medium' : 'light');
    setRosarySession({ ...session, step: next });
  };

  const center =
    step.kind === 'ave' ? (
      <>
        <Text style={styles.count}>{step.count}</Text>
        <Text style={styles.countOf}>sur {step.of}</Text>
      </>
    ) : step.kind === 'mystery' && step.decade !== null ? (
      <>
        <Text style={styles.centerSmall}>Mystère</Text>
        <Text style={styles.count}>{step.decade + 1}</Text>
      </>
    ) : (
      <Ionicons name={step.kind === 'sign' || step.kind === 'closing' ? 'add' : 'rose-outline'} size={26} color={C.faint} />
    );

  const buttonLabel = last
    ? 'Terminer'
    : step.kind === 'mystery'
      ? 'Prier la dizaine'
      : step.kind === 'sign' && index === 0
        ? 'Commencer'
        : 'Amen';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              {view3d && (
                <Pressable
                  onPress={() => setPeek(!peek)}
                  hitSlop={10}
                  accessibilityLabel={peek ? 'Revenir au grain' : 'Voir tout le chapelet'}
                >
                  <Ionicons name={peek ? 'contract-outline' : 'expand-outline'} size={22} color={peek ? C.gold : C.muted} />
                </Pressable>
              )}
              <Pressable
                onPress={() => setRosaryPrefs({ texts: !texts })}
                hitSlop={10}
                accessibilityLabel={texts ? 'Masquer le texte des prières' : 'Afficher le texte des prières'}
              >
                <Ionicons name={texts ? 'document-text' : 'document-text-outline'} size={22} color={texts ? C.gold : C.muted} />
              </Pressable>
              <Pressable onPress={onExit} hitSlop={10} accessibilityLabel="Mettre en pause">
                <Ionicons name="pause-circle-outline" size={24} color={C.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      {view3d ? (
        <>
          <Rosary3D
            style={StyleSheet.absoluteFill}
            steps={steps}
            index={index}
            peek={peek}
            material={material.id}
            onError={() => setGlFailed(true)}
            onStep={(delta) => {
              setGestured(true);
              go(delta);
            }}
          />
          {/* Laisse passer les gestes jusqu'au chapelet, au-dessus de la feuille de prière. */}
          <View style={{ flex: 1 }} pointerEvents="none" />
          {!gestured && (
            <View style={styles.hintPill} pointerEvents="none">
              <Ionicons name="arrow-down" size={15} color={C.gold} />
              <Text style={styles.hintText}>Glisse vers le bas pour égrener, ou touche le chapelet</Text>
            </View>
          )}
        </>
      ) : (
        <RosaryBeads steps={steps} index={index} diameter={diameter} bead={material.bead} prayed={material.lit} onPress={() => go(1)}>
          {center}
        </RosaryBeads>
      )}

      <ScrollView style={view3d ? [styles.card3d, { maxHeight: height * 0.42 }] : styles.card} contentContainerStyle={styles.cardBody}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Kicker step={step} set={session.set} />
          </View>
          {view3d && (step.kind === 'ave' || step.kind === 'mystery') && (
            <Text style={styles.cardCount}>
              {step.kind === 'ave' ? step.count : (step.decade ?? 0) + 1}
              <Text style={styles.countOf}> / {step.kind === 'ave' ? step.of : 5}</Text>
            </Text>
          )}
        </View>
        <StepBody step={step} session={session} texts={texts} />
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => go(-1)}
          disabled={index === 0}
          style={[styles.backBtn, index === 0 && { opacity: 0.3 }]}
          accessibilityLabel="Revenir à la prière précédente"
        >
          <Ionicons name="arrow-undo" size={20} color={C.text} />
        </Pressable>
        <Pressable onPress={() => go(1)} style={({ pressed }) => [styles.btn, styles.mainBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnText}>{buttonLabel}</Text>
          <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={20} color={C.onGold} />
        </Pressable>
      </View>
    </View>
  );
}

function Finished({
  decade,
  intention,
  rosaryId,
  onAgain,
}: {
  decade: boolean;
  intention: string;
  /** Une dizaine priée pour le Rosaire vivant de ce groupe : on propose de la cocher. */
  rosaryId: string | null;
  onAgain: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const { progress } = useApp();
  const [ticking, setTicking] = useState<'idle' | 'busy' | 'done'>('idle');
  const [tickError, setTickError] = useState<string | null>(null);
  const living = decade && rosaryId !== null;
  const tick = async () => {
    if (!rosaryId || ticking !== 'idle') return;
    setTicking('busy');
    setTickError(null);
    const result = await setDecadePrayed(rosaryId, true);
    if (!result.ok) {
      setTickError(result.message);
      setTicking('idle');
      return;
    }
    haptic('success');
    setTicking('done');
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/prieres'));
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.scroll, { alignItems: 'center', paddingTop: 50 }]}>
      <View style={styles.doneIcon}>
        <Ionicons name="rose" size={38} color={C.gold} />
      </View>
      <Text style={styles.doneTitle}>{decade ? 'Dizaine terminée' : 'Chapelet terminé'}</Text>
      <Text style={styles.doneText}>Que la Vierge Marie te garde dans la paix de son Fils.</Text>
      {intention ? <Text style={styles.doneIntention}>Ton intention lui est confiée : {intention}</Text> : null}
      <Text style={styles.doneCount}>
        {progress.rosary.count === 1
          ? 'C’est la première fois que tu pries le chapelet avec Manne.'
          : `${progress.rosary.count} chapelets et dizaines priés avec Manne.`}
      </Text>
      {living ? (
        <Pressable
          onPress={() => void tick()}
          disabled={ticking !== 'idle'}
          style={[styles.btn, { marginTop: 28, alignSelf: 'stretch' }, ticking !== 'idle' && { opacity: 0.6 }]}
        >
          <Ionicons name={ticking === 'done' ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={C.onGold} />
          <Text style={styles.btnText}>
            {ticking === 'done' ? 'Dizaine cochée dans le Rosaire vivant' : 'J’ai prié ma dizaine du Rosaire vivant'}
          </Text>
        </Pressable>
      ) : null}
      {tickError ? <Text style={[styles.warn, { color: C.red }]}>{tickError}</Text> : null}
      <Pressable onPress={back} style={[styles.btn, living && styles.btnGhost, { marginTop: living ? 10 : 28, alignSelf: 'stretch' }]}>
        <Text style={living ? styles.btnGhostText : styles.btnText}>{living ? 'Revenir au Rosaire vivant' : 'Revenir aux prières'}</Text>
      </Pressable>
      <Pressable onPress={onAgain} style={[styles.btn, styles.btnGhost, { marginTop: 10, alignSelf: 'stretch' }]}>
        <Text style={styles.btnGhostText}>Prier encore</Text>
      </Pressable>
    </ScrollView>
  );
}

function Setup({ onStart, initial }: { onStart: (s: RosarySession) => void; initial: { set: number; decade: number } | null }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setRosaryPrefs, setRosarySession } = useApp();
  const { session, fatima, texts, last, count } = progress.rosary;
  // Venu du Rosaire vivant avec un chapelet déjà commencé : la dizaine du mois est préparée, rien ne démarre sans toucher.
  const [set, setSet] = useState(initial?.set ?? todaySet());
  const [single, setSingle] = useState(initial !== null);
  const [decade, setDecade] = useState(initial?.decade ?? 0);
  const [intention, setIntention] = useState('');
  const weekday = new Date().getDay();

  const start = () => onStart({ set, decade: single ? decade : null, fatima, step: 0, intention: intention.trim(), day: today() });

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Laisse-toi guider grain après grain. Touche le chapelet ou le bouton à chaque prière : Manne compte pour toi, et tu peux faire une
          pause à tout moment.
        </Text>
        <Text style={styles.last}>{lastTimeLabel(last, count, today(), 'Aucun chapelet prié avec Manne pour l’instant.')}</Text>

        {session && (
          <Pressable onPress={() => onStart(session)} style={({ pressed }) => [styles.resume, pressed && { opacity: 0.85 }]}>
            <View style={styles.resumeIcon}>
              <Ionicons name="play" size={18} color={C.onGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>Reprendre mon chapelet</Text>
              <Text style={styles.resumeText}>{sessionLabel(session)}</Text>
            </View>
            <Pressable onPress={() => setRosarySession(null)} hitSlop={10} accessibilityLabel="Abandonner ce chapelet">
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>
          </Pressable>
        )}

        <Text style={styles.section}>Les mystères</Text>
        <View style={styles.group}>
          {MYSTERIES.map((m, i) => (
            <Pressable key={m.name} onPress={() => setSet(i)} style={[styles.row, i === MYSTERIES.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name={set === i ? 'radio-button-on' : 'radio-button-off'} size={20} color={set === i ? C.gold : C.faint} />
              <Text style={[styles.rowTitle, { flex: 1 }]}>{m.name}</Text>
              {m.days.includes(weekday) && <Text style={styles.badge}>Aujourd’hui</Text>}
            </Pressable>
          ))}
        </View>

        <View style={styles.segment}>
          {[false, true].map((one) => (
            <Pressable
              key={String(one)}
              onPress={() => setSingle(one)}
              style={[styles.segmentItem, single === one && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, single === one && { color: C.onGold }]}>{one ? 'Une dizaine' : 'Chapelet entier'}</Text>
              <Text style={[styles.segmentHint, single === one && { color: C.onGold, opacity: 0.65 }]}>
                {one ? '≈ 4 min' : '5 dizaines · ≈ 20 min'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.group, { marginTop: 10 }]}>
          {MYSTERIES[set].mysteries.map((name, d) => {
            const chosen = single && decade === d;
            return (
              <Pressable
                key={name}
                disabled={!single}
                onPress={() => setDecade(d)}
                style={[styles.mysteryRow, d === 4 && { borderBottomWidth: 0 }]}
              >
                {single ? (
                  <Ionicons name={chosen ? 'radio-button-on' : 'radio-button-off'} size={18} color={chosen ? C.gold : C.faint} />
                ) : (
                  <Text style={styles.mysteryNum}>{d + 1}</Text>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mysteryName, single && !chosen && { color: C.muted }]}>{name}</Text>
                  <Text style={styles.mysteryFruit}>{MYSTERIES[set].fruits[d]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Mon intention</Text>
        <TextInput
          value={intention}
          onChangeText={setIntention}
          placeholder="Pour qui, pour quoi veux-tu prier ? (facultatif)"
          placeholderTextColor={C.faint}
          style={styles.input}
          multiline
          maxLength={200}
        />

        <View style={[styles.group, { marginTop: 18 }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Prière de Fatima</Text>
              <Text style={styles.rowHint}>« Ô mon Jésus… » après chaque dizaine</Text>
            </View>
            <Switch
              value={fatima}
              onValueChange={(v) => setRosaryPrefs({ fatima: v })}
              trackColor={{ true: C.gold, false: C.switchOff }}
              thumbColor={C.switchThumb}
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Chapelet en 3D</Text>
              <Text style={styles.rowHint}>En bois d’olivier, à égrener du pouce</Text>
            </View>
            <Switch
              value={progress.rosary.view3d}
              onValueChange={(v) => setRosaryPrefs({ view3d: v })}
              trackColor={{ true: C.gold, false: C.switchOff }}
              thumbColor={C.switchThumb}
            />
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Afficher le texte des prières</Text>
              <Text style={styles.rowHint}>À désactiver quand on les connaît par cœur</Text>
            </View>
            <Switch
              value={texts}
              onValueChange={(v) => setRosaryPrefs({ texts: v })}
              trackColor={{ true: C.gold, false: C.switchOff }}
              thumbColor={C.switchThumb}
            />
          </View>
        </View>

        <Pressable onPress={start} style={({ pressed }) => [styles.btn, { marginTop: 24 }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="rose" size={20} color={C.onGold} />
          <Text style={styles.btnText}>{single ? 'Commencer la dizaine' : 'Commencer le chapelet'}</Text>
        </Pressable>
        {session && <Text style={styles.warn}>Commencer remplacera le chapelet en cours.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function ChapeletScreen() {
  const { progress, setRosarySession, completeRosary } = useApp();
  // `/chapelet?serie=<0 à 3>&dizaine=<1 à 5>` (&rosaire=<id>) : une dizaine précise, ouverte depuis le Rosaire vivant. Sans
  // ces paramètres, ou s'ils sont invalides, l'écran se comporte comme avant.
  const params = useLocalSearchParams<{ serie?: string | string[]; dizaine?: string | string[]; rosaire?: string | string[] }>();
  const target = chapeletTarget(firstParam(params.serie), firstParam(params.dizaine));
  const rosaryId = target ? (/^[0-9a-fA-F-]{8,40}$/.test(firstParam(params.rosaire)) ? firstParam(params.rosaire) : null) : null;
  const session = progress.rosary.session;
  // Sans chapelet en cours, la dizaine démarre toute seule ; sinon on prépare l'écran de départ (il avertit qu'il remplacera le chapelet en cours).
  const [mode, setMode] = useState<'setup' | 'praying' | 'done'>(target && !session ? 'praying' : 'setup');
  const [finished, setFinished] = useState<RosarySession | null>(null);
  const launched = useRef(false);
  const { fatima } = progress.rosary;
  useEffect(() => {
    if (!target || launched.current || session) return;
    launched.current = true;
    setRosarySession({ set: target.set, decade: target.decade, fatima, step: 0, intention: '', day: today() });
  }, [target, session, fatima, setRosarySession]);
  // Les boutons d'en-tête n'existent que pendant la prière.
  const noHeaderActions = <Stack.Screen options={{ headerRight: () => null }} />;

  if (mode === 'done' && finished) {
    return (
      <>
        {noHeaderActions}
        <Finished decade={finished.decade !== null} intention={finished.intention} rosaryId={rosaryId} onAgain={() => setMode('setup')} />
      </>
    );
  }
  if (mode === 'praying' && session) {
    return (
      <Praying
        session={session}
        onExit={() => setMode('setup')}
        onDone={() => {
          setFinished(session);
          completeRosary();
          setMode('done');
        }}
      />
    );
  }
  return (
    <>
      {noHeaderActions}
      <Setup
        initial={target && session && mode === 'setup' && !launched.current ? { set: target.set, decade: target.decade } : null}
        onStart={(s) => {
          setRosarySession(s);
          setMode('praying');
        }}
      />
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22 },
    last: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 10 },
    section: {
      color: C.muted,
      fontSize: 12,
      letterSpacing: 1.8,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 22,
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
    rowTitle: { color: C.text, fontSize: 16, fontWeight: '600' },
    rowHint: { color: C.faint, fontSize: 13, marginTop: 2 },
    badge: {
      color: C.onGold,
      backgroundColor: C.gold,
      fontSize: 12,
      fontWeight: '800',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    segment: { flexDirection: 'row', gap: 8, marginTop: 14 },
    segmentItem: { flex: 1, backgroundColor: C.card, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
    segmentActive: { backgroundColor: C.gold },
    segmentText: { color: C.text, fontSize: 15, fontWeight: '700' },
    segmentHint: { color: C.faint, fontSize: 12, marginTop: 2 },
    mysteryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    mysteryNum: { color: C.gold, fontWeight: '800', fontSize: 15, width: 18, textAlign: 'center' },
    mysteryName: { color: C.text, fontFamily: SERIF, fontSize: 16 },
    mysteryFruit: { color: C.faint, fontSize: 12, marginTop: 1 },
    input: {
      color: C.text,
      fontSize: 16,
      backgroundColor: C.card,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 52,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 999,
    },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 16 },
    btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
    btnGhostText: { color: C.text, fontWeight: '700', fontSize: 15 },
    warn: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 8 },
    resume: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(255,209,102,0.1)',
      borderRadius: 16,
      padding: 14,
      marginTop: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.35)',
    },
    resumeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    resumeTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    resumeText: { color: C.muted, fontSize: 13, marginTop: 2 },
    // Pendant la prière
    card: { flex: 1, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 20 },
    // Par-dessus le chapelet 3D : la feuille prend la hauteur de son texte, jusqu'à 42 % de l'écran.
    card3d: {
      flexGrow: 0,
      flexShrink: 1,
      marginHorizontal: 16,
      borderRadius: 20,
      backgroundColor: C.overlay,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cardCount: { color: C.gold, fontFamily: SERIF, fontSize: 26, lineHeight: 28, fontVariant: ['tabular-nums'] },
    hintPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 6,
      backgroundColor: C.overlay,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 10,
    },
    hintText: { color: C.text, fontSize: 13 },
    cardBody: { padding: 20, paddingBottom: 28 },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 1.6, fontWeight: '800', textTransform: 'uppercase' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 33, marginTop: 6, marginBottom: 12 },
    intent: { color: C.gold, fontFamily: SERIF, fontSize: 17, fontStyle: 'italic', marginTop: 2, marginBottom: 12 },
    prayer: { color: C.text, fontFamily: SERIF, fontSize: 19, lineHeight: 29, marginBottom: 14 },
    fruit: { color: C.text, fontSize: 15, fontWeight: '600', marginBottom: 14 },
    verse: { borderLeftWidth: 2, borderColor: C.gold, paddingLeft: 14, marginBottom: 14 },
    verseText: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 28 },
    verseRef: { color: C.muted, fontSize: 13, marginTop: 6 },
    hint: { color: C.faint, fontSize: 14, lineHeight: 20 },
    intentionBox: { backgroundColor: 'rgba(255,209,102,0.08)', borderRadius: 12, padding: 12, marginBottom: 14 },
    intentionLabel: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    intentionText: { color: C.text, fontSize: 16, lineHeight: 22, marginTop: 4 },
    count: { color: C.text, fontFamily: SERIF, fontSize: 40, lineHeight: 46 },
    countOf: { color: C.faint, fontSize: 13, fontWeight: '600' },
    centerSmall: { color: C.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
    backBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    mainBtn: { flex: 1, paddingVertical: 16 },
    doneIcon: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: 'rgba(255,209,102,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    doneTitle: { color: C.text, fontFamily: SERIF, fontSize: 30 },
    doneText: { color: C.muted, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 10 },
    doneIntention: { color: C.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
    doneCount: { color: C.gold, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 18 },
  });
