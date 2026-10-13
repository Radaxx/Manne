import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { type ReactNode, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentOffice, LITURGICAL_COLORS, OFFICES, plainText, useMass } from './aelf';
import type { Palette } from './appearance';
import { SERIF } from './cards';
import { BOOKS } from './data/bible';
import { formatRange, type PlanStatus, planById, planStatus } from './plans';
import { useAllPrayers } from './prayers';
import { today, useApp } from './storage';
import { useThemed } from './theme';
import { todayLine, unseenSteps } from './today';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function SectionTitle({ children, action }: { children: string; action?: { label: string; onPress: () => void } }) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: object }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

function Bar({ value, color }: { value: number; color?: string }) {
  const { C, styles } = useThemed(stylesFor);
  const fill = color ?? C.gold;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: fill }]} />
    </View>
  );
}

function PlanCard({ status, onRead }: { status: PlanStatus; onRead: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { plan, day, done, total, today: todays, todayDone, todayComplete, behind, ahead, finished, next, nextVerse } = status;
  return (
    <Card onPress={finished ? undefined : onRead}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{plan.title}</Text>
        <Text style={styles.muted}>
          Jour {day + 1}/{plan.days}
        </Text>
      </View>
      <Bar value={done / total} />
      {finished ? (
        <Text style={[styles.planToday, { color: C.gold }]}>Plan terminé — {total} chapitres lus. Bravo !</Text>
      ) : (
        <>
          <View style={styles.rowBetween}>
            {todayComplete ? (
              <Text style={styles.planToday}>
                <Text style={styles.ok}>Lecture du jour faite ✓</Text>
                {ahead > 0 ? ` · ${ahead} chapitre${ahead > 1 ? 's' : ''} d’avance` : ''}
              </Text>
            ) : (
              <>
                <Text style={styles.planToday}>
                  Aujourd’hui : <Text style={styles.strong}>{formatRange(todays)}</Text>
                </Text>
                <Text style={styles.muted}>
                  {todayDone}/{todays.length}
                </Text>
              </>
            )}
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.small}>
              {behind > 0
                ? `${behind} chapitre${behind > 1 ? 's' : ''} de retard, pas de panique`
                : next
                  ? `Reprendre : ${BOOKS[next.book - 1].name} ${next.chapter}${nextVerse > 1 ? `, v. ${nextVerse}` : ''}`
                  : ''}
            </Text>
            <View style={styles.readBtn}>
              <Text style={styles.readBtnText}>{todayComplete ? 'Continuer' : 'Lire'}</Text>
              <Ionicons name="arrow-forward" size={14} color={C.onGold} />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}

export function HomeScreen() {
  const { C, styles } = useThemed(stylesFor);
  const api = useApp();
  const { progress } = api;
  const { data: mass, error: massError } = useMass();
  const now = new Date();
  const hour = now.getHours();
  const office = currentOffice(now);
  const day = today();

  const info = mass?.informations;
  const gospel = mass?.messes[0]?.lectures.find((l) => l.type === 'evangile');

  const plans = useMemo(
    () =>
      Object.entries(progress.plans)
        .map(([id, state]) => {
          const plan = planById(id);
          return plan ? planStatus(plan, state, day) : null;
        })
        .filter((s): s is PlanStatus => !!s),
    [progress.plans, day],
  );

  const allPrayers = useAllPrayers();
  const pinnedPrayers = progress.pinnedPrayers.map((id) => allPrayers.find((p) => p.id === id)).filter((p) => !!p);

  const book = BOOKS[progress.currentBook - 1];
  const pos = progress.positions[progress.currentBook] ?? { chapter: 1, verse: 1 };
  const bookDone = (pos.chapter - 1 + (pos.verse - 1) / book.verses[pos.chapter - 1]) / book.verses.length;

  // Chaque plan a son propre fil de lecture : il n'interfère pas avec la lecture libre.
  const readPlan = (s: PlanStatus) => router.push(`/plan/${s.plan.id}`);
  const step = unseenSteps(progress)[0];
  const greet = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* En-tête : salutation, date et jour liturgique */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {greet}
            {progress.displayName ? `, ${progress.displayName}` : ''}
          </Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push('/rappel')} hitSlop={10} accessibilityLabel="Rappel quotidien" style={styles.bell}>
              <Ionicons
                name={progress.reminder.enabled ? 'notifications' : 'notifications-outline'}
                size={19}
                color={progress.reminder.enabled ? C.gold : C.muted}
              />
            </Pressable>
            <Pressable onPress={() => router.push('/compte')} hitSlop={10} accessibilityLabel="Mon compte" style={styles.streak}>
              <Ionicons name="flame" size={16} color="#ffb703" />
              <Text style={styles.streakText}>{progress.streak}</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.date}>
          {capitalize(DAYS[now.getDay()])} {now.getDate()} {MONTHS[now.getMonth()]}
        </Text>
        <Pressable onPress={() => router.push('/compte')} style={({ pressed }) => [styles.todayLine, pressed && styles.pressed]}>
          <Text style={styles.todayText}>{todayLine(progress)}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.gold} />
        </Pressable>
        {step ? (
          <Pressable
            onPress={() => {
              api.seeMilestone(step.id);
              if (step.book) api.selectBook(step.book);
              router.push(step.href as Href);
            }}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}
          >
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepNext}>{step.next}</Text>
          </Pressable>
        ) : null}
        {info && (
          <View style={styles.liturgy}>
            <View style={[styles.colorDot, { backgroundColor: LITURGICAL_COLORS[info.couleur] ?? C.muted }]} />
            <Text style={styles.liturgyText}>
              {capitalize(info.semaine || info.ligne1)}
              {info.fete && info.fete !== 'de la férie' ? ` · ${capitalize(plainText(info.fete))}` : ''}
            </Text>
          </View>
        )}

        {/* Prier maintenant : l'office de l'heure, et les autres à portée de main */}
        <SectionTitle>Prier maintenant</SectionTitle>
        <Card onPress={() => router.push(`/office/${office.id}`)} style={styles.officeCard}>
          <View style={styles.officeIcon}>
            <Ionicons name={office.icon as keyof typeof Ionicons.glyphMap} size={26} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.officeName}>{office.name}</Text>
            <Text style={styles.muted}>
              {office.hint} · environ {office.minutes} min
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {OFFICES.filter((o) => o.id !== office.id).map((o) => (
            <Pressable
              key={o.id}
              onPress={() => router.push(`/office/${o.id}`)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Ionicons name={o.icon as keyof typeof Ionicons.glyphMap} size={15} color={C.muted} />
              <Text style={styles.chipText}>{o.id === 'lectures' ? 'Lectures' : o.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Prières épinglées : accès en un geste */}
        <SectionTitle action={{ label: 'Toutes', onPress: () => router.navigate('/prieres') }}>Mes prières</SectionTitle>
        {pinnedPrayers.length === 0 ? (
          <Card onPress={() => router.navigate('/prieres')}>
            <Text style={styles.muted}>Épingle tes prières préférées pour les retrouver ici.</Text>
          </Card>
        ) : (
          <View style={styles.prayerGrid}>
            {pinnedPrayers.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/priere/${p.id}`)}
                style={({ pressed }) => [styles.prayerChip, pressed && styles.pressed]}
              >
                <Ionicons name="rose-outline" size={15} color={C.gold} />
                <Text style={styles.prayerChipText} numberOfLines={1}>
                  {p.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <SectionTitle>Intentions confiées</SectionTitle>
        <Card onPress={() => router.push('/intentions')} style={styles.officeCard}>
          <View style={styles.officeIcon}>
            <Ionicons name="people-outline" size={26} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.officeName}>Porter une prière</Text>
            <Text style={styles.muted}>Confie une intention, ou porte celle de quelqu’un.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Card>

        <SectionTitle>Messe du jour</SectionTitle>
        <Card onPress={() => router.push('/suivre-messe')} style={styles.officeCard}>
          <View style={styles.officeIcon}>
            <Ionicons name="walk-outline" size={26} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.officeName}>Suivre la messe</Text>
            <Text style={styles.muted}>Le déroulé, pour une première fois ou pour ne pas se perdre.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Card>

        {/* Parole du jour : l'Évangile de la messe */}
        <SectionTitle action={{ label: 'Toutes les lectures', onPress: () => router.push('/messe') }}>Évangile du jour</SectionTitle>
        <Card onPress={() => router.push('/messe')}>
          {gospel ? (
            <>
              <Text style={styles.kicker}>{gospel.ref}</Text>
              {gospel.titre ? <Text style={styles.gospelTitle}>{plainText(gospel.titre)}</Text> : null}
              <Text style={styles.gospelText} numberOfLines={4}>
                {plainText(gospel.contenu).replaceAll('\n', ' ')}
              </Text>
              <Text style={styles.link}>Lire la suite</Text>
            </>
          ) : massError ? (
            <Text style={styles.muted}>Les textes du jour n’ont pas pu être chargés. Vérifie ta connexion.</Text>
          ) : (
            <ActivityIndicator color={C.muted} style={{ paddingVertical: 24 }} />
          )}
        </Card>

        {/* Plans de lecture */}
        <SectionTitle action={{ label: plans.length ? 'Gérer' : 'Choisir', onPress: () => router.push('/plans') }}>
          Mes plans de lecture
        </SectionTitle>
        {plans.length === 0 ? (
          <Card onPress={() => router.push('/plans')}>
            <Text style={styles.cardTitle}>Commence un plan</Text>
            <Text style={styles.muted}>
              Les Évangiles en 30 jours, les Psaumes, toute la Bible en un an… Un peu chaque jour, à ton rythme.
            </Text>
            <Text style={styles.link}>Voir les plans</Text>
          </Card>
        ) : (
          plans.map((s) => <PlanCard key={s.plan.id} status={s} onRead={() => readPlan(s)} />)
        )}

        {/* Reprendre la lecture libre */}
        <SectionTitle>Continuer ma lecture</SectionTitle>
        <Card onPress={() => router.navigate('/lecture')}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>
              {book.name} {pos.chapter}
              <Text style={styles.muted}> · verset {pos.verse}</Text>
            </Text>
            <Ionicons name="chevron-forward" size={20} color={C.muted} />
          </View>
          <Bar value={bookDone} color="rgba(236,232,223,0.6)" />
          <Text style={styles.small}>{Math.round(bookDone * 100)} % du livre</Text>
        </Card>

        {/* L'arbre généalogique : d'Adam et Ève à Jésus */}
        <SectionTitle>Arbre généalogique</SectionTitle>
        <Card onPress={() => router.push('/genealogie')} style={styles.officeCard}>
          <View style={styles.officeIcon}>
            <Ionicons name="git-network-outline" size={26} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.officeName}>D’Adam à Jésus</Text>
            <Text style={styles.muted}>Les patriarches, les rois, les femmes que Matthieu nomme, jusqu’à Joseph et Marie.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </Card>

        <Text style={styles.credits}>Textes liturgiques © AELF · Bible Louis Segond 1910</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    greeting: { color: C.muted, fontSize: 15, fontWeight: '600' },
    date: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40 },
    todayLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    todayText: { color: C.gold, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    step: {
      backgroundColor: C.cardHi,
      borderRadius: 14,
      padding: 14,
      marginTop: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.25)',
    },
    stepTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
    stepNext: { color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bell: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    streakText: { color: C.text, fontWeight: '700', fontSize: 15 },
    liturgy: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    liturgyText: { color: C.muted, fontSize: 14, flexShrink: 1 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 30, marginBottom: 10 },
    sectionTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
    sectionAction: { color: C.gold, fontSize: 14, fontWeight: '600' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8, marginBottom: 10 },
    pressed: { opacity: 0.7 },
    officeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.cardHi,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.25)',
    },
    officeIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,209,102,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    officeName: { color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 2 },
    chips: { gap: 8, paddingVertical: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.card,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
    },
    chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
    prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    prayerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      maxWidth: '100%',
    },
    prayerChipText: { color: C.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase' },
    gospelTitle: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 19, lineHeight: 27 },
    gospelText: { color: C.muted, fontFamily: SERIF, fontSize: 16, lineHeight: 24 },
    link: { color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 2 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700', flexShrink: 1 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    small: { color: C.faint, fontSize: 13 },
    strong: { color: C.text, fontWeight: '700' },
    ok: { color: '#5cc48a', fontSize: 14, fontWeight: '700' },
    planToday: { color: C.muted, fontSize: 15, flexShrink: 1 },
    readBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.gold,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
    },
    readBtnText: { color: C.onGold, fontWeight: '800', fontSize: 14 },
    track: { height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' },
    fill: { height: '100%' },
    credits: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 30 },
  });
