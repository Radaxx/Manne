import { Ionicons } from '@expo/vector-icons';
import { type Href, router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Palette } from '../appearance';
import { useAccount } from '../auth';
import { TOTAL_CHAPTERS } from '../bible';
import { SERIF } from '../cards';
import { planById, planStatus } from '../plans';
import { today, useApp } from '../storage';
import { syncProgress } from '../sync';
import { usePalette, useThemed } from '../theme';
import { agoPhrase, bibleShare, bookShares, reachedSteps, resumeTarget, todayTasks, weekStrip } from '../today';

function SettingsButton() {
  const C = usePalette();
  return (
    <Pressable onPress={() => router.push('/reglages')} hitSlop={12} accessibilityLabel="Réglages" style={{ marginRight: 4 }}>
      <Ionicons name="settings-outline" size={22} color={C.text} />
    </Pressable>
  );
}

export default function CompteScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setDisplayName, seeMilestone, selectBook, goTo, hydrate, resetAccountData } = useApp();
  const account = useAccount();
  // Le texte en cours de frappe ; hors saisie, le champ suit toujours le prénom de la progression.
  const [draft, setDraft] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [keyboard, setKeyboard] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const accountY = useRef(0);
  const revealAccount = useRef(false);
  const day = today();
  const tasks = todayTasks(progress);
  const resume = resumeTarget(progress);
  const week = weekStrip(progress);
  const share = bibleShare(progress.chaptersRead);
  const started = bookShares(progress.chaptersRead, progress.translation).filter((book) => book.read > 0);
  const plans = Object.entries(progress.plans).flatMap(([id, state]) => {
    const plan = planById(id);
    return plan ? [planStatus(plan, state, day, progress.translation)] : [];
  });
  const steps = reachedSteps(progress);

  const showAccount = () => {
    revealAccount.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, accountY.current - 12), animated: true });
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboard(0);
      revealAccount.current = false;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!revealAccount.current || keyboard === 0) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, accountY.current - 12), animated: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [keyboard]);

  const open = (href: string, book?: number) => {
    if (book) selectBook(book);
    if (href === '/lecture' || href === '/prieres') router.navigate(href as Href);
    else router.push(href as Href);
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SettingsButton /> }} />
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={[styles.scroll, { paddingBottom: 48 + keyboard }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        nestedScrollEnabled
      >
        <Text style={styles.kicker}>Mon chemin</Text>
        <TextInput
          value={draft ?? progress.displayName}
          onChangeText={setDraft}
          onEndEditing={() => {
            if (draft !== null) setDisplayName(draft);
            setDraft(null);
          }}
          placeholder="Ton prénom"
          placeholderTextColor={C.faint}
          style={styles.name}
          maxLength={40}
          autoCorrect={false}
        />

        <Pressable onPress={() => open(resume.href, resume.book)} style={({ pressed }) => [styles.resume, pressed && styles.pressed]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeKicker}>Reprendre</Text>
            <Text style={styles.resumeLabel}>{resume.label}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={C.onGold} />
        </Pressable>

        <Text style={styles.section}>Aujourd’hui</Text>
        {tasks.map((task) => (
          <Pressable key={task.id} onPress={() => open(task.href)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={task.done ? '#5cc48a' : C.muted} />
            <Text style={[styles.rowLabel, task.done && styles.rowDone]}>{task.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        ))}

        <Text style={styles.section}>Cette semaine</Text>
        <View style={styles.week}>
          {week.map((cell) => (
            <View key={cell.date} style={styles.weekDay}>
              <View style={[styles.dot, cell.complete && styles.dotOn, cell.isToday && styles.dotToday]} />
              <Text style={[styles.weekLetter, cell.isToday && styles.weekToday]}>{cell.letter}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>La Parole</Text>
        <View style={styles.card}>
          <Text style={styles.statValue}>{Math.round(share * 100)} %</Text>
          <Text style={styles.muted}>
            {progress.chaptersRead.length} chapitres sur {TOTAL_CHAPTERS}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(Math.min(1, share) * 100)}%` }]} />
          </View>
        </View>
        {started.length === 0 ? (
          <Text style={styles.muted}>Aucun livre commencé. Marc t’attend.</Text>
        ) : (
          started.map((book) => (
            <Pressable
              key={book.n}
              onPress={() => open('/lecture', book.n)}
              style={({ pressed }) => [styles.book, pressed && styles.pressed]}
            >
              <Text style={styles.bookName}>{book.name}</Text>
              <View style={[styles.track, styles.bookTrack]}>
                <View style={[styles.fill, { width: `${Math.round((book.read / book.total) * 100)}%` }]} />
              </View>
              <Text style={styles.bookCount}>
                {book.read}/{book.total}
              </Text>
            </Pressable>
          ))
        )}
        {plans.map((status) => (
          <Pressable
            key={status.plan.id}
            onPress={() => open(status.finished ? '/plans' : `/plan/${status.plan.id}`)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.cardTitle}>{status.plan.title}</Text>
            <Text style={styles.muted}>
              {status.finished
                ? 'Plan terminé'
                : status.behind > 0
                  ? `${status.behind} chapitre${status.behind > 1 ? 's' : ''} à rattraper`
                  : `Jour ${status.day + 1}/${status.plan.days}`}
            </Text>
          </Pressable>
        ))}

        <Text style={styles.section}>La prière</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{progress.rosary.count}</Text>
            <Text style={styles.muted}>chapelet{progress.rosary.count > 1 ? 's' : ''}</Text>
            <Text style={styles.faint}>{agoPhrase(progress.rosary.last, day)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{progress.adoration.count}</Text>
            <Text style={styles.muted}>adoration{progress.adoration.count > 1 ? 's' : ''}</Text>
            <Text style={styles.faint}>{agoPhrase(progress.adoration.last, day)}</Text>
          </View>
        </View>
        <Text style={styles.muted}>Dernier office : {agoPhrase(progress.lastOffice, day)}.</Text>

        {steps.length > 0 && (
          <>
            <Text style={styles.section}>Étapes</Text>
            {steps.map((step) => (
              <Pressable
                key={step.id}
                onPress={() => {
                  seeMilestone(step.id);
                  open(step.href, step.book);
                }}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.cardTitle}>{step.title}</Text>
                <Text style={styles.link}>{step.next}</Text>
              </Pressable>
            ))}
          </>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Passages gardés</Text>
          {progress.saved.length > 3 && (
            <Pressable onPress={() => open('/passages')} hitSlop={8}>
              <Text style={styles.link}>Tout voir</Text>
            </Pressable>
          )}
        </View>
        {progress.saved.length === 0 ? (
          <Text style={styles.muted}>Garde un verset pendant la lecture : il reviendra ici.</Text>
        ) : (
          progress.saved.slice(0, 3).map((passage) => (
            <Pressable
              key={passage.id}
              onPress={() => {
                goTo(passage.book, passage.chapter);
                open('/lecture');
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.link}>{passage.reference}</Text>
              <Text style={styles.passage} numberOfLines={2}>
                {passage.text}
              </Text>
            </Pressable>
          ))
        )}

        <Text style={styles.section}>Confession</Text>
        <Pressable onPress={() => open('/confession')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Ionicons name="heart-outline" size={22} color={C.gold} />
          <Text style={styles.rowLabel}>Dernière absolution : {agoPhrase(progress.confession.lastConfession, day)}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.faint} />
        </Pressable>

        <View
          onLayout={(e) => {
            accountY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.section}>Compte</Text>
          {!account.configured ? (
            <Text style={styles.muted}>
              La synchro se réveille quand le projet Supabase est configuré. Ton chemin reste sur ce téléphone.
            </Text>
          ) : account.anonymous ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Retrouver ce chemin sur un autre téléphone</Text>
              <Text style={styles.muted}>Relie une adresse, Apple ou Google. Ce que tu as déjà lu et prié suit le compte.</Text>
              {account.phase.kind === 'link' ? (
                <Text style={styles.muted}>Un lien a été envoyé à {account.phase.email}. Ouvre-le depuis ce téléphone.</Text>
              ) : (
                <>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onFocus={showAccount}
                    placeholder="Adresse e-mail"
                    placeholderTextColor={C.faint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.input}
                  />
                  <Pressable onPress={() => account.sendEmail(email)} disabled={account.busy} style={styles.btn}>
                    <Text style={styles.btnText}>Recevoir un lien</Text>
                  </Pressable>
                </>
              )}
              {account.apple && (
                <Pressable
                  onPress={async () => {
                    const given = await account.linkApple();
                    if (given && !progress.displayName) setDisplayName(given);
                  }}
                  disabled={account.busy}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>Continuer avec Apple</Text>
                </Pressable>
              )}
              <Pressable onPress={() => account.linkGoogle()} disabled={account.busy} style={styles.secondary}>
                <Text style={styles.secondaryText}>Continuer avec Google</Text>
              </Pressable>
              {account.busy && <ActivityIndicator color={C.gold} />}
              {account.error ? <Text style={styles.error}>{account.error}</Text> : null}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{account.email ?? 'Compte relié'}</Text>
              <Text style={styles.muted}>Ton chemin est gardé avec ce compte.</Text>
              <Pressable
                onPress={() => account.signOut({ flush: () => syncProgress(() => progress, hydrate), reset: resetAccountData })}
                disabled={account.busy}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Se déconnecter</Text>
              </Pressable>
              {account.error ? <Text style={styles.error}>{account.error}</Text> : null}
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20 },
    kicker: { color: C.gold, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    name: { color: C.text, fontFamily: SERIF, fontSize: 34, lineHeight: 42, marginTop: 4, padding: 0 },
    resume: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.gold,
      borderRadius: 16,
      padding: 16,
      marginTop: 18,
    },
    resumeKicker: { color: C.onGold, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7 },
    resumeLabel: { color: C.onGold, fontSize: 18, fontWeight: '800', marginTop: 2 },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 28, marginBottom: 10 },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 28,
      marginBottom: 10,
    },
    sectionTitle: { color: C.text, fontSize: 19, fontWeight: '800', flexShrink: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8 },
    rowLabel: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
    rowDone: { color: C.muted },
    week: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: 6 },
    dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
    dotOn: { backgroundColor: C.gold, borderColor: C.gold },
    dotToday: { borderColor: C.gold, borderWidth: 2 },
    weekLetter: { color: C.muted, fontSize: 12, fontWeight: '700' },
    weekToday: { color: C.text },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    statValue: { color: C.text, fontSize: 28, fontWeight: '800' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    faint: { color: C.faint, fontSize: 12, marginTop: 2 },
    track: { height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden', marginTop: 8 },
    fill: { height: '100%', backgroundColor: C.gold },
    book: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    bookName: { color: C.text, fontSize: 14, fontWeight: '600', width: 118 },
    bookTrack: { flex: 1, marginTop: 0 },
    bookCount: { color: C.faint, fontSize: 12, width: 48, textAlign: 'right' },
    stats: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    stat: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14 },
    link: { color: C.gold, fontSize: 14, fontWeight: '700' },
    passage: { color: C.muted, fontFamily: SERIF, fontSize: 15, lineHeight: 22 },
    input: {
      color: C.text,
      backgroundColor: C.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginTop: 8,
    },
    btn: { backgroundColor: C.gold, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
    secondary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: C.line },
    secondaryText: { color: C.text, fontWeight: '700', fontSize: 15 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
    pressed: { opacity: 0.75 },
  });
