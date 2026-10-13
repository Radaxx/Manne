import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type AdorationStep, adorationSteps, DURATIONS, MODES, sessionLabel, wordOfTheDay } from '../adoration';
import { useMass } from '../aelf';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { prayerById } from '../data/prayers';
import { haptic } from '../haptics';
import { LiturgyText } from '../liturgy';
import { PrayerText } from '../prayers';
import { type AdorationMode, type AdorationSession, today, useActions, useApp } from '../storage';
import { useThemed } from '../theme';
import { lastTimeLabel } from '../today';

// Adorer devant le Saint-Sacrement, guidé : on choisit un parcours contemplatif ou guidé et une durée,
// Manne propose les temps un à un (présence, adoration, Parole, silence, merci, pardon, intentions).
// On peut quitter et reprendre là où on s'était arrêté.

function PrayerLines({ id }: { id: string }) {
  const { styles } = useThemed(stylesFor);
  return <PrayerText text={prayerById(id)?.text ?? ''} style={styles.prayer} />;
}

/** Les intentions qu'on confie à chaque adoration : on les ajoute ici, on les retire quand on veut. */
function Intentions({ empty }: { empty?: string }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, addAdorationIntention, removeAdorationIntention } = useApp();
  const { intentions } = progress.adoration;
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    addAdorationIntention(text);
    setDraft('');
  };
  return (
    <View>
      {intentions.length === 0 && empty ? <Text style={styles.hint}>{empty}</Text> : null}
      {intentions.map((item) => (
        <View key={item.id} style={styles.intention}>
          <Ionicons name="flame-outline" size={16} color={C.gold} style={{ marginTop: 3 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.intentionText}>{item.text}</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/intentions', params: { draft: item.text } })}
              hitSlop={6}
              accessibilityLabel="Confier cette intention à la communauté"
            >
              <Text style={styles.confide}>Confier à la communauté</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => removeAdorationIntention(item.id)} hitSlop={10} accessibilityLabel="Retirer cette intention">
            <Ionicons name="close" size={18} color={C.faint} />
          </Pressable>
        </View>
      ))}
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Une personne, une situation…"
          placeholderTextColor={C.faint}
          style={styles.input}
          returnKeyType="done"
          multiline
          blurOnSubmit
          maxLength={200}
        />
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]}
          accessibilityLabel="Ajouter cette intention"
        >
          <Ionicons name="add" size={22} color={C.onGold} />
        </Pressable>
      </View>
    </View>
  );
}

/** Un cercle qui respire doucement et le temps qui reste ; le décompte suit l'horloge, pas les ticks. */
function Countdown({ minutes, size }: { minutes: number; size: number }) {
  const { C, styles } = useThemed(stylesFor);
  const total = minutes * 60;
  const [startedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  const ended = useRef(false);
  const [breath] = useState(() => new Animated.Value(0));
  const [still, setStill] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setStill)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(breath, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, still]);

  const left = Math.max(0, total - Math.floor((now - startedAt) / 1000));
  useEffect(() => {
    if (left === 0 && !ended.current) {
      ended.current = true;
      haptic('success');
    }
  }, [left]);

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <View style={{ alignItems: 'center', marginVertical: 18 }}>
      <Animated.View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.93, 1] }) }] },
        ]}
      >
        {left > 0 ? (
          <>
            <Text style={[styles.time, size < 150 && { fontSize: 30, lineHeight: 36 }]}>
              {mm}:{ss}
            </Text>
            <Text style={styles.timeHint}>de silence</Text>
          </>
        ) : (
          <>
            <Ionicons name="checkmark" size={26} color={C.gold} />
            <Text style={styles.timeHint}>Le temps est écoulé</Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

/** L'Évangile du jour (AELF), avec de quoi l'accueillir ; un verset si l'on est hors ligne. */
function Gospel() {
  const { C, styles } = useThemed(stylesFor);
  const { data, error } = useMass();
  const reading = data?.messes[0]?.lectures.find((l) => l.type === 'evangile');
  const fallback = wordOfTheDay(today());
  return (
    <>
      <Text style={styles.body}>
        Lis lentement, comme une lettre qui t’est adressée. Arrête-toi dès qu’un mot te touche : une seule phrase suffit.
      </Text>
      {reading ? (
        <View style={styles.gospel}>
          <Text style={styles.gospelRef}>Évangile · {reading.ref}</Text>
          {reading.titre ? <Text style={styles.gospelTitle}>{reading.titre}</Text> : null}
          <LiturgyText html={reading.contenu} />
          <Text style={styles.credits}>Texte liturgique © AELF — aelf.org</Text>
        </View>
      ) : error ? (
        <View style={styles.verse}>
          <Text style={styles.hint}>L’Évangile du jour n’a pas pu être chargé. Voici un verset à la place.</Text>
          <Text style={styles.verseText}>« {fallback.text} »</Text>
          <Text style={styles.verseRef}>{fallback.reference}</Text>
        </View>
      ) : (
        <ActivityIndicator color={C.muted} style={{ marginVertical: 30 }} />
      )}
      <View style={styles.questions}>
        <Text style={styles.questionsTitle}>Pour t’aider</Text>
        <Text style={styles.question}>Quel mot ou quelle phrase me retient ?</Text>
        <Text style={styles.question}>Que me dit Jésus, à moi, aujourd’hui ?</Text>
        <Text style={styles.question}>Que veux-je lui répondre ?</Text>
      </View>
    </>
  );
}

function StepBody({ step, mode, size }: { step: AdorationStep; mode: AdorationMode; size: number }) {
  const { C, styles } = useThemed(stylesFor);
  const word = useMemo(() => wordOfTheDay(today()), []);
  switch (step.kind) {
    case 'presence':
      return (
        <>
          <Text style={styles.title}>Mets-toi en présence</Text>
          <Text style={styles.body}>Installe-toi, pose ce que tu portes. Fais lentement le signe de croix.</Text>
          <PrayerLines id="signe-de-croix" />
          <Text style={styles.body}>
            Jésus est là, réellement présent dans l’hostie. Tu n’as rien à réussir : tu es venu pour être avec lui, et pour te laisser
            regarder.
          </Text>
          <Text style={styles.note}>Un paysan disait au saint curé d’Ars, devant le tabernacle : « Je l’avise, et il m’avise. »</Text>
        </>
      );
    case 'adore':
      return (
        <>
          <Text style={styles.title}>Adore-le</Text>
          <Text style={styles.body}>
            {mode === 'contemplative'
              ? 'Redis ces mots doucement, jusqu’à ce que le silence vienne.'
              : 'Adorer, c’est reconnaître qui il est — ton Créateur, ton Sauveur — et le lui dire. Prie ces mots lentement, une ou plusieurs fois.'}
          </Text>
          <PrayerLines id="nous-t-adorons" />
        </>
      );
    case 'ecoute':
      return (
        <>
          <Text style={styles.title}>Écoute-le</Text>
          <Gospel />
        </>
      );
    case 'silence': {
      const tone = step.tone ?? 'open';
      return (
        <>
          <Text style={styles.title}>
            {tone === 'word' ? 'Laisse la Parole descendre' : tone === 'rest' ? 'Demeure auprès de lui' : 'Reste là'}
          </Text>
          <Countdown minutes={step.minutes} size={size} />
          <Text style={styles.body}>
            {tone === 'word'
              ? 'Reviens à la phrase qui t’a touché, et reste avec elle sans chercher à la comprendre.'
              : tone === 'rest'
                ? 'Si tu n’as plus rien à dire, reste simplement. Être là est déjà une prière.'
                : 'Tu n’as rien à dire, rien à faire. Il est là, tu es là. C’est tout.'}
          </Text>
          <Text style={styles.note}>
            Quand les pensées s’agitent, ramène doucement ton attention vers lui avec ces mots : « Seigneur Jésus, prends pitié de moi. »
          </Text>
        </>
      );
    }
    case 'parole':
      return (
        <>
          <Text style={styles.title}>Un mot pour toi</Text>
          <View style={styles.verse}>
            <Text style={styles.verseText}>« {word.text} »</Text>
            <Text style={styles.verseRef}>{word.reference}</Text>
          </View>
          <Text style={styles.body}>Relis-le lentement, puis laisse-le te parcourir. Ne cherche pas à le comprendre : accueille-le.</Text>
          <Countdown minutes={step.minutes} size={Math.min(size, 140)} />
        </>
      );
    case 'merci':
      return (
        <>
          <Text style={styles.title}>Dis-lui merci</Text>
          <Text style={styles.body}>
            Qu’as-tu reçu depuis ta dernière visite ? Une personne, un moment, une grâce, une épreuve traversée…
          </Text>
          <Text style={styles.body}>Trouve trois choses, même toutes petites, et remercie-le pour chacune avec tes propres mots.</Text>
        </>
      );
    case 'pardon':
      return (
        <>
          <Text style={styles.title}>Demande pardon</Text>
          <Text style={styles.body}>
            Laisse-le regarder ta vie telle qu’elle est. Qu’est-ce qui pèse ? Une parole, un geste, un oubli. Il ne te juge pas : il te
            regarde avec miséricorde.
          </Text>
          <PrayerLines id="acte-de-contrition" />
          <Pressable onPress={() => router.push('/confession')} style={({ pressed }) => [styles.link, pressed && { opacity: 0.8 }]}>
            <Ionicons name="key-outline" size={18} color={C.gold} />
            <Text style={styles.linkText}>Préparer ma confession</Text>
          </Pressable>
        </>
      );
    case 'confie':
      return (
        <>
          <Text style={styles.title}>Confie-lui ceux que tu portes</Text>
          <Text style={styles.body}>Nomme-les un à un devant lui. Tu n’as pas besoin de savoir quoi demander : il les connaît.</Text>
          <Intentions empty="Ta famille, tes amis, ceux qui souffrent, ceux qui n’ont personne pour prier pour eux, ceux que tu as du mal à aimer… Note-les ici, ils reviendront à ta prochaine adoration." />
        </>
      );
    case 'conclusion':
      return (
        <>
          <Text style={styles.title}>Rends grâce</Text>
          <Text style={styles.body}>Remercie-le d’avoir été là. Termine par le Notre Père, puis fais le signe de croix.</Text>
          <PrayerLines id="notre-pere" />
          <Text style={styles.note}>Avant de partir, emporte un mot, une phrase, une paix.</Text>
        </>
      );
  }
}

function Praying({ session, onDone, onExit }: { session: AdorationSession; onDone: () => void; onExit: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { setAdorationSession } = useActions();
  const steps = useMemo(() => adorationSteps(session.mode, session.minutes), [session.mode, session.minutes]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const index = Math.min(session.step, steps.length - 1);
  const step = steps[index];
  const last = index === steps.length - 1;
  const size = Math.min(width - 140, height * 0.26, 230);

  // L'écran reste allumé : un silence de vingt minutes ne doit pas s'éteindre. On relâche le verrou
  // seulement une fois activé, sinon le web lève une erreur quand on quitte tout de suite.
  useEffect(() => {
    const active = activateKeepAwakeAsync('adoration').catch(() => {});
    return () => {
      active.then(() => deactivateKeepAwake('adoration')).catch(() => {});
    };
  }, []);

  const go = (delta: number) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      haptic('success');
      onDone();
      return;
    }
    haptic();
    setAdorationSession({ ...session, step: next });
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={onExit} hitSlop={10} accessibilityLabel="Mettre en pause">
              <Ionicons name="pause-circle-outline" size={24} color={C.text} />
            </Pressable>
          ),
        }}
      />
      <View style={styles.stepper}>
        {steps.map((_s, i) => (
          <View key={i} style={[styles.seg, i <= index && styles.segOn]} />
        ))}
      </View>

      <ScrollView style={styles.card} contentContainerStyle={styles.cardBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>
          {step.title} · {index + 1}/{steps.length}
        </Text>
        <StepBody key={index} step={step} mode={session.mode} size={size} />
        <Text style={styles.suggested}>≈ {step.minutes} min</Text>
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => go(-1)}
          disabled={index === 0}
          style={[styles.backBtn, index === 0 && { opacity: 0.3 }]}
          accessibilityLabel="Revenir au temps précédent"
        >
          <Ionicons name="arrow-undo" size={20} color={C.text} />
        </Pressable>
        <Pressable onPress={() => go(1)} style={({ pressed }) => [styles.btn, styles.mainBtn, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnText}>{last ? 'Terminer' : 'Continuer'}</Text>
          <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={20} color={C.onGold} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Finished({ onAgain }: { onAgain: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress } = useApp();
  const { count } = progress.adoration;
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.scroll, { alignItems: 'center', paddingTop: 50 }]}>
      <View style={styles.doneIcon}>
        <Ionicons name="sunny" size={38} color={C.gold} />
      </View>
      <Text style={styles.doneTitle}>Adoration terminée</Text>
      <Text style={styles.doneText}>Merci d’être resté auprès de lui. Que sa paix t’accompagne.</Text>
      <Text style={styles.doneCount}>
        {count === 1 ? 'C’est ta première adoration avec Manne.' : `${count} adorations vécues avec Manne.`}
      </Text>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/prieres'))}
        style={[styles.btn, { marginTop: 28, alignSelf: 'stretch' }]}
      >
        <Text style={styles.btnText}>Revenir aux prières</Text>
      </Pressable>
      <Pressable onPress={onAgain} style={[styles.btn, styles.btnGhost, { marginTop: 10, alignSelf: 'stretch' }]}>
        <Text style={styles.btnGhostText}>Une autre adoration</Text>
      </Pressable>
    </ScrollView>
  );
}

function Setup({ onStart }: { onStart: (s: AdorationSession) => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setAdorationPrefs, setAdorationSession } = useApp();
  const { session, last, count } = progress.adoration;
  const [mode, setMode] = useState<AdorationMode>(progress.adoration.mode);
  const [minutes, setMinutes] = useState(progress.adoration.minutes);
  const steps = useMemo(() => adorationSteps(mode, minutes), [mode, minutes]);

  const start = () => {
    setAdorationPrefs({ mode, minutes });
    onStart({ mode, minutes, step: 0, day: today() });
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Tu es devant le Saint-Sacrement : tu n’as rien à réussir. Manne te propose un chemin, tu le suis à ton rythme, et tu peux
          t’arrêter à tout moment.
        </Text>
        <Text style={styles.last}>{lastTimeLabel(last, count, today(), 'Aucune adoration vécue avec Manne pour l’instant.')}</Text>

        {session && (
          <Pressable onPress={() => onStart(session)} style={({ pressed }) => [styles.resume, pressed && { opacity: 0.85 }]}>
            <View style={styles.resumeIcon}>
              <Ionicons name="play" size={18} color={C.onGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>Reprendre mon adoration</Text>
              <Text style={styles.resumeText}>{sessionLabel(session)}</Text>
            </View>
            <Pressable onPress={() => setAdorationSession(null)} hitSlop={10} accessibilityLabel="Abandonner cette adoration">
              <Ionicons name="close" size={20} color={C.muted} />
            </Pressable>
          </Pressable>
        )}

        <Text style={styles.section}>Comment veux-tu adorer ?</Text>
        {MODES.map((m) => (
          <Pressable key={m.id} onPress={() => setMode(m.id)} style={[styles.mode, mode === m.id && styles.modeOn]}>
            <Ionicons name={m.icon} size={24} color={mode === m.id ? C.gold : C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.modeName}>{m.name}</Text>
              <Text style={styles.modeHint}>{m.hint}</Text>
            </View>
            <Ionicons name={mode === m.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={mode === m.id ? C.gold : C.faint} />
          </Pressable>
        ))}

        <Text style={styles.section}>Combien de temps ?</Text>
        <View style={styles.segment}>
          {DURATIONS.map((d) => (
            <Pressable key={d} onPress={() => setMinutes(d)} style={[styles.segmentItem, minutes === d && styles.segmentActive]}>
              <Text style={[styles.segmentText, minutes === d && { color: C.onGold }]}>{d}</Text>
              <Text style={[styles.segmentHint, minutes === d && { color: C.onGold, opacity: 0.65 }]}>min</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Le chemin</Text>
        <View style={styles.group}>
          {steps.map((s, i) => (
            <View key={i} style={[styles.pathRow, i === steps.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.pathNum}>{i + 1}</Text>
              <Text style={styles.pathTitle}>{s.title}</Text>
              <Text style={styles.pathMin}>≈ {s.minutes} min</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Ceux que je porte</Text>
        <View style={styles.group}>
          <View style={{ padding: 14 }}>
            <Intentions empty="Écris ici les personnes et les situations que tu veux confier : elles te seront proposées à chaque adoration." />
          </View>
        </View>

        <Pressable onPress={start} style={({ pressed }) => [styles.btn, { marginTop: 24 }, pressed && { opacity: 0.85 }]}>
          <Ionicons name="sunny" size={20} color={C.onGold} />
          <Text style={styles.btnText}>Commencer l’adoration</Text>
        </Pressable>
        {session && <Text style={styles.warn}>Commencer remplacera l’adoration en cours.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function AdorationScreen() {
  const { progress, setAdorationSession, completeAdoration } = useApp();
  const [phase, setPhase] = useState<'setup' | 'praying' | 'done'>('setup');
  const session = progress.adoration.session;
  // Le bouton de pause n'existe que pendant l'adoration.
  const noHeaderActions = <Stack.Screen options={{ headerRight: () => null }} />;

  if (phase === 'done') {
    return (
      <>
        {noHeaderActions}
        <Finished onAgain={() => setPhase('setup')} />
      </>
    );
  }
  if (phase === 'praying' && session) {
    return (
      <Praying
        session={session}
        onExit={() => setPhase('setup')}
        onDone={() => {
          completeAdoration();
          setPhase('done');
        }}
      />
    );
  }
  return (
    <>
      {noHeaderActions}
      <Setup
        onStart={(s) => {
          setAdorationSession(s);
          setPhase('praying');
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
    mode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    modeOn: { borderColor: 'rgba(255,209,102,0.5)', backgroundColor: 'rgba(255,209,102,0.06)' },
    modeName: { color: C.text, fontSize: 17, fontWeight: '700' },
    modeHint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    segment: { flexDirection: 'row', gap: 8 },
    segmentItem: { flex: 1, backgroundColor: C.card, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
    segmentActive: { backgroundColor: C.gold },
    segmentText: { color: C.text, fontSize: 18, fontWeight: '700' },
    segmentHint: { color: C.faint, fontSize: 12, marginTop: 1 },
    pathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    pathNum: { color: C.gold, fontWeight: '800', fontSize: 14, width: 18, textAlign: 'center' },
    pathTitle: { color: C.text, fontFamily: SERIF, fontSize: 16, flex: 1 },
    pathMin: { color: C.faint, fontSize: 13 },
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
    // Intentions
    intention: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    intentionText: { color: C.text, fontSize: 16, lineHeight: 22 },
    confide: { color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 4 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 },
    input: {
      flex: 1,
      color: C.text,
      fontSize: 16,
      backgroundColor: C.cardHi,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 46,
    },
    addBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    // Pendant l'adoration
    stepper: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
    seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.line },
    segOn: { backgroundColor: C.gold },
    card: { flex: 1, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 20 },
    cardBody: { padding: 20, paddingBottom: 28 },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 1.6, fontWeight: '800', textTransform: 'uppercase' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 33, marginTop: 6, marginBottom: 12 },
    body: { color: C.muted, fontSize: 16, lineHeight: 24, marginBottom: 14 },
    prayer: { color: C.text, fontFamily: SERIF, fontSize: 19, lineHeight: 29, marginBottom: 14 },
    note: { color: C.faint, fontSize: 14, lineHeight: 21, fontStyle: 'italic', marginTop: 4 },
    hint: { color: C.faint, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    suggested: { color: C.faint, fontSize: 12, marginTop: 22 },
    verse: { borderLeftWidth: 2, borderColor: C.gold, paddingLeft: 14, marginBottom: 16 },
    verseText: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, lineHeight: 30 },
    verseRef: { color: C.muted, fontSize: 13, marginTop: 6 },
    gospel: { marginBottom: 6 },
    gospelRef: { color: C.gold, fontSize: 13, fontWeight: '700', marginBottom: 4 },
    gospelTitle: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 26, marginBottom: 10 },
    credits: { color: C.faint, fontSize: 11, marginTop: 4 },
    questions: { backgroundColor: 'rgba(255,209,102,0.07)', borderRadius: 14, padding: 14, marginTop: 14 },
    questionsTitle: { color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
    question: { color: C.text, fontFamily: SERIF, fontSize: 17, lineHeight: 26, marginTop: 4 },
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.45)',
      backgroundColor: 'rgba(255,209,102,0.05)',
    },
    time: { color: C.text, fontFamily: SERIF, fontSize: 44, lineHeight: 52 },
    timeHint: { color: C.faint, fontSize: 13, fontWeight: '600', marginTop: 2 },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.35)',
      marginTop: 4,
    },
    linkText: { color: C.gold, fontWeight: '700', fontSize: 14 },
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
    doneCount: { color: C.gold, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 18 },
  });
