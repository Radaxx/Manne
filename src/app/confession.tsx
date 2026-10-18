import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { longDate } from '../dates';
import { authenticate, biometricName, lockAvailability, lockSupported } from '../lock';
import { today, useApp } from '../storage';
import { Text, TextInput } from '../text';
import { useThemed } from '../theme';
import { agoPhrase } from '../today';

// Préparer sa confession : noter ses péchés au fil des jours, s'aider d'un examen de conscience,
// puis tout effacer une fois l'absolution reçue. La liste ne quitte jamais le téléphone.

const EXAMEN: { title: string; questions: string[] }[] = [
  {
    title: 'Envers Dieu',
    questions: [
      'Ai-je pris du temps pour prier, ou ai-je oublié Dieu ?',
      'Ai-je manqué la messe du dimanche sans raison sérieuse ?',
      'Ai-je mal parlé de Dieu ou des choses saintes ?',
      'Ai-je mis ma confiance dans l’argent, la réussite ou la superstition plutôt qu’en Dieu ?',
    ],
  },
  {
    title: 'Envers les autres',
    questions: [
      'Ai-je respecté et aidé mes parents, ma famille ?',
      'Ai-je été en colère, dur ou blessant, en paroles ou en actes ?',
      'Ai-je refusé de pardonner ? Ai-je gardé de la rancune ?',
      'Ai-je menti, médit, calomnié, trahi un secret ?',
      'Ai-je volé, triché, abîmé le bien d’autrui ?',
      'Ai-je fermé les yeux sur ceux qui étaient dans le besoin ?',
      'Ai-je été jaloux ou envieux ?',
    ],
  },
  {
    title: 'Envers moi-même',
    questions: [
      'Ai-je respecté mon corps et celui des autres, dans mes regards, mes pensées, mes actes ?',
      'Ai-je abusé de la nourriture, de l’alcool, des écrans ?',
      'Ai-je été paresseux dans mon travail ou mes devoirs ?',
      'Ai-je été orgueilleux, en me croyant meilleur que les autres ?',
    ],
  },
];

const STEPS = [
  'Prépare-toi par un examen de conscience, en demandant à l’Esprit Saint sa lumière.',
  'Le prêtre t’accueille. Fais le signe de croix ; tu peux dire : « Bénissez-moi, mon Père, parce que j’ai péché. »',
  'Dis depuis quand tu ne t’es pas confessé, puis confesse tes péchés simplement.',
  'Écoute les conseils du prêtre et la pénitence qu’il te propose.',
  'Exprime ton regret par l’acte de contrition.',
  'Le prêtre te donne l’absolution : tes péchés sont pardonnés.',
  'Rends grâce, et accomplis ta pénitence.',
];

function lastConfessionLabel(day: string | null) {
  if (!day) return 'Aucune confession enregistrée dans Manne.';
  return `Dernière confession : le ${longDate(day)} (${agoPhrase(day, today())}).`;
}

function Fold({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const { C, styles } = useThemed(stylesFor);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fold}>
      <Pressable onPress={() => setOpen(!open)} style={styles.foldHead}>
        <Ionicons name={icon} size={18} color={C.gold} />
        <Text style={styles.foldTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} />
      </Pressable>
      {open && <View style={styles.foldBody}>{children}</View>}
    </View>
  );
}

export default function ConfessionScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress, addConfessionItem, removeConfessionItem, completeConfession, setConfessionLock } = useApp();
  const { items, lastConfession } = progress.confession;
  const [draft, setDraft] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [absolved, setAbsolved] = useState(false);

  // Verrou : null tant qu'on ne sait pas ce que le téléphone permet.
  const [availability, setAvailability] = useState<'biometric' | 'passcode' | 'none' | null>(lockSupported ? null : 'none');
  const [unlocked, setUnlocked] = useState(false);
  const locked = progress.confessionLock && availability !== 'none';

  const tryUnlock = useCallback(async () => {
    if (await authenticate('Ouvre ta préparation à la confession')) setUnlocked(true);
  }, []);

  useEffect(() => {
    lockAvailability().then(setAvailability);
  }, []);

  // Demande l'empreinte dès l'ouverture.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ne se relance qu'à l'arrivée de la disponibilité, pas quand le verrou est (dés)activé.
  useEffect(() => {
    if (availability && availability !== 'none' && progress.confessionLock) tryUnlock();
  }, [availability]);

  // Se reverrouille dès que l'app passe en arrière-plan (« inactive » arrive aussi pendant Face ID : on l'ignore).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const toggleLock = async (enabled: boolean) => {
    // Activer comme désactiver la protection demande d'être le propriétaire du téléphone.
    if (await authenticate(enabled ? 'Active la protection de la confession' : 'Désactive la protection de la confession')) {
      setUnlocked(true);
      setConfessionLock(enabled);
    }
  };

  if (availability === null) return <View style={styles.root} />;

  if (locked && !unlocked) {
    return (
      <View style={[styles.root, styles.lockedWrap]}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={34} color={C.gold} />
        </View>
        <Text style={styles.lockedTitle}>Espace protégé</Text>
        <Text style={styles.lockedText}>
          Ta préparation à la confession est protégée par {availability === 'biometric' ? biometricName : 'le code de ton téléphone'}.
        </Text>
        <Pressable onPress={tryUnlock} style={[styles.btn, { marginTop: 24 }]}>
          <Ionicons name={Platform.OS === 'ios' ? 'scan-outline' : 'finger-print'} size={20} color={C.onGold} />
          <Text style={styles.btnText}>Déverrouiller</Text>
        </Pressable>
      </View>
    );
  }

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    addConfessionItem(text);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>
          Note tes péchés au fil des jours, pour ne rien oublier au moment de te confesser. Après l’absolution, efface tout : Dieu a
          pardonné.
        </Text>
        <Text style={styles.last}>{lastConfessionLabel(lastConfession)}</Text>

        {absolved && (
          <View style={styles.peace}>
            <Text style={styles.peaceTitle}>Tes péchés sont pardonnés. Va en paix !</Text>
            <Text style={styles.peaceText}>N’oublie pas d’accomplir ta pénitence, et rends grâce pour la miséricorde de Dieu.</Text>
          </View>
        )}

        <Text style={styles.section}>Ma liste {items.length > 0 ? `(${items.length})` : ''}</Text>
        <View style={styles.card}>
          {items.length === 0 && <Text style={styles.empty}>Rien de noté pour l’instant.</Text>}
          {items.map((item, i) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemNum}>{i + 1}.</Text>
              <Text style={styles.itemText}>{item.text}</Text>
              <Pressable onPress={() => removeConfessionItem(item.id)} hitSlop={10} accessibilityLabel="Retirer">
                <Ionicons name="close" size={18} color={C.faint} />
              </Pressable>
            </View>
          ))}
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={add}
              placeholder="Ajouter un péché…"
              placeholderTextColor={C.faint}
              style={styles.input}
              returnKeyType="done"
              multiline
              blurOnSubmit
            />
            <Pressable
              onPress={add}
              disabled={!draft.trim()}
              style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]}
              accessibilityLabel="Ajouter"
            >
              <Ionicons name="add" size={22} color={C.onGold} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.privacy}>
          <Ionicons name="lock-closed" size={12} color={C.faint} /> Cette liste reste uniquement sur ce téléphone
          {locked ? `, protégée par ${biometricName}` : ''}.
        </Text>

        {items.length > 0 &&
          (confirmReset ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>Effacer définitivement toute la liste ?</Text>
              <View style={styles.confirmRow}>
                <Pressable onPress={() => setConfirmReset(false)} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    completeConfession();
                    setConfirmReset(false);
                    setAbsolved(true);
                  }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Oui, tout effacer</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmReset(true)} style={[styles.btn, styles.absolve]}>
              <Ionicons name="checkmark-circle" size={20} color={C.onGold} />
              <Text style={styles.btnText}>J’ai reçu l’absolution</Text>
            </Pressable>
          ))}

        <View style={{ height: 24 }} />
        <Fold title="Examen de conscience" icon="search-outline">
          {EXAMEN.map((g) => (
            <View key={g.title} style={{ marginBottom: 12 }}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              {g.questions.map((q) => (
                <Text key={q} style={styles.question}>
                  • {q}
                </Text>
              ))}
            </View>
          ))}
        </Fold>
        <Fold title="Comment se confesser" icon="footsteps-outline">
          {STEPS.map((s, i) => (
            <Text key={s} style={styles.step}>
              {i + 1}. {s}
            </Text>
          ))}
          <Pressable onPress={() => router.push('/priere/acte-de-contrition')} style={styles.link}>
            <Text style={styles.linkText}>Lire l’acte de contrition</Text>
            <Ionicons name="arrow-forward" size={15} color={C.gold} />
          </Pressable>
        </Fold>

        {lockSupported && (
          <View style={styles.lockRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lockLabel}>Protéger par {biometricName}</Text>
              <Text style={styles.lockHint}>
                {availability === 'none'
                  ? 'Configure un code ou une empreinte dans les réglages du téléphone pour pouvoir protéger cet espace.'
                  : 'Demandé à chaque ouverture de cet espace. Le code du téléphone reste possible en secours.'}
              </Text>
            </View>
            <Switch
              value={progress.confessionLock && availability !== 'none'}
              onValueChange={toggleLock}
              disabled={availability === 'none'}
              trackColor={{ true: C.gold, false: C.switchOff }}
              thumbColor={C.switchThumb}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22 },
    last: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 10 },
    peace: { backgroundColor: 'rgba(92,196,138,0.12)', borderRadius: 14, padding: 14, marginTop: 16, gap: 4 },
    peaceTitle: { color: '#7fd6a4', fontFamily: SERIF, fontSize: 19 },
    peaceText: { color: C.text, fontSize: 14, lineHeight: 20 },
    section: {
      color: C.muted,
      fontSize: 12,
      letterSpacing: 1.8,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginTop: 22,
      marginBottom: 8,
    },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 10 },
    empty: { color: C.faint, fontSize: 14 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    itemNum: { color: C.gold, fontWeight: '700', fontSize: 15, width: 22 },
    itemText: { color: C.text, fontSize: 16, lineHeight: 22, flex: 1 },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: {
      flex: 1,
      color: C.text,
      fontSize: 16,
      backgroundColor: C.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxHeight: 120,
    },
    addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    privacy: { color: C.faint, fontSize: 12, marginTop: 8 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.gold,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
    },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
    btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
    btnGhostText: { color: C.text, fontWeight: '700', fontSize: 15 },
    absolve: { marginTop: 18 },
    confirm: { marginTop: 18, backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 12 },
    confirmText: { color: C.text, fontSize: 15, fontWeight: '600' },
    confirmRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
    fold: { backgroundColor: C.card, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
    foldHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
    foldTitle: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
    foldBody: { paddingHorizontal: 14, paddingBottom: 14 },
    groupTitle: { color: C.red, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
    question: { color: C.text, fontSize: 15, lineHeight: 23 },
    step: { color: C.text, fontSize: 15, lineHeight: 23, marginBottom: 6 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    linkText: { color: C.gold, fontSize: 15, fontWeight: '600' },
    lockedWrap: { alignItems: 'center', justifyContent: 'center', padding: 32 },
    lockIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: 'rgba(255,209,102,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    lockedTitle: { color: C.text, fontFamily: SERIF, fontSize: 26 },
    lockedText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
    lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 10 },
    lockLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
    lockHint: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 2 },
  });
