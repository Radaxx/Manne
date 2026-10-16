import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentOffice, LITURGICAL_COLORS, OFFICES, plainText, useMass } from './aelf';
import type { Palette } from './appearance';
import { useAuth } from './auth';
import { Avatar } from './avatar';
import { bookMeta, type TranslationId } from './bible';
import { SERIF } from './cards';
import { dayLabel, daysSince, MONTHS, WEEKDAYS } from './dates';
import { UpcomingGatheringCards, useUpcomingGatherings } from './gathering-ui';
import { featuredJourney, JOURNEYS, journeyDay, journeyPhase } from './journeys';
import { liturgicalDay } from './liturgical-year';
import { RunningNovenaCards, useRunningNovenas } from './novena-ui';
import { formatRange, type PlanStatus, planById, planStatus } from './plans';
import { useAllPrayers } from './prayers';
import { saintKicker, saintOfDay } from './saints';
import { SectionHead } from './section';
import { readingPosition, today, useApp } from './storage';
import { Text } from './text';
import { useThemed } from './theme';
import { todayLine, unseenSteps } from './today';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les initiales du nom d'un saint (« Marguerite-Marie Alacoque » → « MM »). */
const monogram = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

function Bar({ value, color }: { value: number; color?: string }) {
  const { C, styles } = useThemed(stylesFor);
  const fill = color ?? C.gold;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: fill }]} />
    </View>
  );
}

/** Un plan de lecture dans la carte « Ma lecture » : sa progression, la lecture du jour et le bouton pour la lire. */
function PlanBlock({ status, t, onRead }: { status: PlanStatus; t: TranslationId; onRead: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const { plan, day, done, total, today: todays, todayComplete, behind, ahead, finished, next, nextVerse } = status;
  const percent = Math.round((done / total) * 100);
  return (
    <View style={styles.block}>
      <View style={styles.planHead}>
        <View style={styles.percent}>
          <Text style={styles.percentText}>{percent} %</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{plan.title}</Text>
          <Text style={styles.muted}>
            Jour {day + 1} sur {plan.days}
            {finished ? '' : behind > 0 ? ` · ${behind} chapitre${behind > 1 ? 's' : ''} de retard, pas de panique` : ' · à jour'}
          </Text>
        </View>
      </View>
      {finished ? (
        <Text style={[styles.planToday, { color: C.gold }]}>Plan terminé — {total} chapitres lus. Bravo !</Text>
      ) : (
        <>
          <View style={styles.planRow}>
            {todayComplete ? (
              <Text style={styles.planToday}>
                <Text style={styles.ok}>Lecture du jour faite ✓</Text>
                {ahead > 0 ? ` · ${ahead} chapitre${ahead > 1 ? 's' : ''} d’avance` : ''}
              </Text>
            ) : (
              <Text style={styles.planToday}>
                Aujourd’hui : <Text style={styles.strong}>{formatRange(todays, t)}</Text>
              </Text>
            )}
            <Pressable onPress={onRead} style={({ pressed }) => [styles.readBtn, pressed && styles.pressed]} accessibilityRole="button">
              <Text style={styles.readBtnText}>{todayComplete ? 'Continuer' : 'Lire'}</Text>
              <Ionicons name="arrow-forward" size={14} color={C.onGold} />
            </Pressable>
          </View>
          {next ? (
            <Text
              style={styles.small}
            >{`Reprendre : ${bookMeta(next.book, t).name} ${next.chapter}${nextVerse > 1 ? `, v. ${nextVerse}` : ''}`}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

export function HomeScreen() {
  const { C, styles } = useThemed(stylesFor);
  const api = useApp();
  const { status, profile } = useAuth();
  const { progress } = api;
  // Mes prochains rendez-vous de prière : rien à l'écran sans compte relié ni profil, hors ligne ou sans inscription.
  const meetings = useUpcomingGatherings(status === 'signedIn' && !!profile);
  // Mes neuvaines de groupe en cours aujourd'hui : même règle, masqué s'il n'y en a pas.
  const novenas = useRunningNovenas(status === 'signedIn' && !!profile);
  const { data: mass, error: massError } = useMass();
  const now = new Date();
  const hour = now.getHours();
  const office = currentOffice(now);
  const day = today();

  const info = mass?.informations;
  const liturgy = liturgicalDay(day);
  const saint = saintOfDay(day).saints[0];
  const journey = useMemo(() => {
    const j = featuredJourney(day);
    if (!j) return null;
    const phase = journeyPhase(j, day);
    const current = phase === 'pendant' ? journeyDay(j, day) : null;
    const { short, season, feast, weeks } = JOURNEYS[j.kind];
    return {
      href: `/${j.kind}` as const,
      phase,
      short,
      season,
      feast,
      start: dayLabel(j.start),
      wait: daysSince(day, j.start),
      index: j.dates.indexOf(day),
      total: j.dates.length,
      theme: current ? weeks[current.week].theme : '',
      title: current?.day.title ?? '',
      done: (progress.journeys[j.id] ?? []).includes(day),
    };
  }, [day, progress.journeys]);
  const gospel = mass?.messes[0]?.lectures.find((l) => l.type === 'evangile');

  const plans = useMemo(
    () =>
      Object.entries(progress.plans)
        .map(([id, state]) => {
          const plan = planById(id);
          return plan ? planStatus(plan, state, day, progress.translation) : null;
        })
        .filter((s): s is PlanStatus => !!s),
    [progress.plans, day, progress.translation],
  );

  const allPrayers = useAllPrayers();
  const pinnedPrayers = progress.pinnedPrayers.map((id) => allPrayers.find((p) => p.id === id)).filter((p) => !!p);

  const book = bookMeta(progress.currentBook, progress.translation);
  const pos = readingPosition(progress);
  const bookDone = (pos.chapter - 1 + (pos.verse - 1) / book.verses[pos.chapter - 1]) / book.verses.length;

  // Chaque plan a son propre fil de lecture : il n'interfère pas avec la lecture libre.
  const readPlan = (s: PlanStatus) => router.push(`/plan/${s.plan.id}`);
  const step = unseenSteps(progress)[0];
  const greet = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';
  const inGroups = meetings.length > 0 || novenas.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* En-tête : salutation, date, jour liturgique et série de jours */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {greet}
            {progress.displayName ? `, ${progress.displayName}` : ''}
          </Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => router.push('/rappel')} hitSlop={6} accessibilityLabel="Rappel quotidien" style={styles.bell}>
              <Ionicons
                name={progress.reminder.enabled ? 'notifications' : 'notifications-outline'}
                size={20}
                color={progress.reminder.enabled ? C.gold : C.muted}
              />
            </Pressable>
            <Pressable onPress={() => router.push('/profil')} hitSlop={6} accessibilityLabel="Mon profil" style={styles.avatar}>
              <Avatar handle={profile?.handle} size={36} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.date}>
          {capitalize(WEEKDAYS[now.getDay()])} {now.getDate()} {MONTHS[now.getMonth()]}
        </Text>
        {/* Le jour liturgique : celui de l'AELF (avec les saints) en ligne, sinon le calendrier calculé ici */}
        <Pressable
          onPress={() => router.push('/annee-liturgique')}
          style={({ pressed }) => [styles.liturgy, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityHint="Ouvre l’année liturgique"
        >
          <View style={[styles.colorDot, { backgroundColor: LITURGICAL_COLORS[info?.couleur ?? liturgy.color] ?? C.muted }]} />
          <Text style={styles.liturgyText}>
            {capitalize(info?.semaine || liturgy.label)}
            {info?.fete && info.fete !== 'de la férie'
              ? ` · ${capitalize(plainText(info.fete))}`
              : !info && liturgy.feast
                ? ` · ${liturgy.feast.name}`
                : ''}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.muted} />
        </Pressable>
        <Pressable onPress={() => router.push('/compte')} style={({ pressed }) => [styles.todayLine, pressed && styles.pressed]}>
          <Ionicons name="flame-outline" size={16} color={C.gold} />
          <Text style={styles.todayText}>{todayLine(progress)}</Text>
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

        {/* Prier maintenant : l'office de l'heure, en grand, et les autres à portée de main */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.officeIcon}>
              <Ionicons name={office.icon as keyof typeof Ionicons.glyphMap} size={28} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kickerAccent}>MAINTENANT</Text>
              <Text style={styles.officeName}>{office.name}</Text>
              <Text style={styles.muted}>
                {office.hint} · environ {office.minutes} min
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push(`/office/${office.id}`)}
            style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.heroBtnText}>Commencer la prière</Text>
            <Ionicons name="arrow-forward" size={18} color={C.onGold} />
          </Pressable>
          <Text style={styles.heroLabel}>AUTRES OFFICES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
            {OFFICES.filter((o) => o.id !== office.id).map((o) => (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/office/${o.id}`)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Ionicons name={o.icon as keyof typeof Ionicons.glyphMap} size={16} color={C.gold} />
                <Text style={styles.chipText}>{o.id === 'lectures' ? 'Lectures' : o.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Le parcours de l'Avent ou du Carême : annoncé trois semaines avant, puis un jour à la fois */}
        {journey?.phase === 'pendant' ? (
          <Pressable
            onPress={() => router.push(journey.href)}
            style={({ pressed }) => [styles.card, styles.journeyCard, pressed && styles.pressed]}
          >
            <Text style={styles.journeyKicker}>
              {journey.short.toUpperCase()} · JOUR {journey.index + 1} SUR {journey.total} · {journey.theme.toUpperCase()}
            </Text>
            <Text style={styles.officeName}>{journey.title}</Text>
            <Text style={styles.muted}>{journey.done ? 'Jour vécu ✓' : 'Un passage, une méditation, un geste pour aujourd’hui.'}</Text>
          </Pressable>
        ) : journey?.phase === 'avant' ? (
          <Pressable
            onPress={() => router.push(journey.href)}
            style={({ pressed }) => [styles.card, styles.journeyCard, pressed && styles.pressed]}
          >
            <Text style={styles.journeyKicker}>PARCOURS · {journey.short.toUpperCase()}</Text>
            <Text style={styles.officeName}>
              {journey.wait === 1
                ? `Demain, ${journey.season.charAt(0).toLowerCase()}${journey.season.slice(1)} commence`
                : `${journey.season} commence dans ${journey.wait} jours`}
            </Text>
            <Text style={styles.muted}>
              Le {journey.start} : chaque jour jusqu’à {journey.feast}, un passage, une méditation et un geste.
            </Text>
          </Pressable>
        ) : null}

        {/* Aujourd'hui : l'Évangile de la messe, puis le saint du jour */}
        <SectionHead title="Aujourd’hui" />
        <Pressable onPress={() => router.push('/messe')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          {gospel ? (
            <>
              <Text style={styles.kicker}>Évangile · {gospel.ref}</Text>
              {gospel.titre ? <Text style={styles.gospelTitle}>{plainText(gospel.titre)}</Text> : null}
              <Text style={styles.gospelText} numberOfLines={4}>
                {plainText(gospel.contenu).replaceAll('\n', ' ')}
              </Text>
              <View style={styles.linkRow}>
                <Text style={styles.link}>Lire la suite</Text>
                <Ionicons name="arrow-forward" size={16} color={C.gold} />
              </View>
            </>
          ) : massError ? (
            <Text style={styles.muted}>Les textes du jour n’ont pas pu être chargés. Vérifie ta connexion.</Text>
          ) : (
            <ActivityIndicator color={C.muted} style={{ paddingVertical: 24 }} />
          )}
        </Pressable>
        {saint ? (
          <Pressable onPress={() => router.push('/saints')} style={({ pressed }) => [styles.saint, pressed && styles.pressed]}>
            <View style={styles.monogram}>
              <Text style={styles.monogramText}>{monogram(saint.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.journeyKicker}>{saintKicker(saint).toUpperCase()}</Text>
              <Text style={styles.saintName}>{saint.name}</Text>
              {saint.title ? <Text style={styles.muted}>{saint.title}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        ) : null}

        {/* Ma lecture : les plans en cours, puis la lecture libre */}
        <SectionHead title="Ma lecture" action={{ label: plans.length ? 'Gérer' : 'Choisir', onPress: () => router.push('/plans') }} />
        <View style={styles.reading}>
          {plans.length === 0 ? (
            <Pressable onPress={() => router.push('/plans')} style={({ pressed }) => [styles.block, pressed && styles.pressed]}>
              <Text style={styles.cardTitle}>Commence un plan</Text>
              <Text style={styles.muted}>
                Les Évangiles en 30 jours, les Psaumes, toute la Bible en un an… Un peu chaque jour, à ton rythme.
              </Text>
              <Text style={styles.link}>Voir les plans</Text>
            </Pressable>
          ) : (
            plans.map((s) => <PlanBlock key={s.plan.id} status={s} t={progress.translation} onRead={() => readPlan(s)} />)
          )}
          <View style={styles.divider} />
          <Pressable onPress={() => router.navigate('/lecture')} style={({ pressed }) => [styles.free, pressed && styles.pressed]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.freeKicker}>LECTURE LIBRE</Text>
              <Text style={styles.cardTitle}>
                {book.name} {pos.chapter}
                <Text style={styles.freeVerse}> · verset {pos.verse}</Text>
              </Text>
              <Bar value={bookDone} color={C.muted} />
              <Text style={styles.small}>{Math.round(bookDone * 100)} % du livre</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        </View>

        {/* Mes prochains rendez-vous et mes neuvaines de groupe (masqué s'il n'y en a pas) */}
        {inGroups ? (
          <>
            <SectionHead title="Avec ton groupe" action={{ label: 'Communauté', onPress: () => router.navigate('/communaute') }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.cards}>
              <UpcomingGatheringCards items={meetings} />
              <RunningNovenaCards items={novenas} />
            </ScrollView>
          </>
        ) : null}

        {/* À portée de main */}
        <SectionHead title="À portée de main" />
        <View style={styles.tiles}>
          <Pressable onPress={() => router.push('/suivre-messe')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <Ionicons name="walk-outline" size={24} color={C.gold} />
            <View>
              <Text style={styles.tileTitle}>Suivre la messe</Text>
              <Text style={styles.tileSub}>Le déroulé pas à pas</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/intentions')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <Ionicons name="heart-outline" size={24} color={C.gold} />
            <View>
              <Text style={styles.tileTitle}>Intentions confiées</Text>
              <Text style={styles.tileSub}>Porter une prière</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/genealogie')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <Ionicons name="git-network-outline" size={24} color={C.gold} />
            <View>
              <Text style={styles.tileTitle}>D’Adam à Jésus</Text>
              <Text style={styles.tileSub}>L’arbre généalogique</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/annee-liturgique')} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" size={24} color={C.gold} />
            <View>
              <Text style={styles.tileTitle}>Année liturgique</Text>
              <Text style={styles.tileSub}>Temps, fêtes et couleurs</Text>
            </View>
          </Pressable>
        </View>

        {/* Prières épinglées : accès en un geste */}
        <SectionHead title="Mes prières" action={{ label: 'Toutes', onPress: () => router.navigate('/prieres') }} />
        {pinnedPrayers.length === 0 ? (
          <Pressable onPress={() => router.navigate('/prieres')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.muted}>Épingle tes prières préférées pour les retrouver ici.</Text>
          </Pressable>
        ) : (
          <View style={styles.prayerGrid}>
            {pinnedPrayers.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/priere/${p.id}`)}
                style={({ pressed }) => [styles.prayerChip, pressed && styles.pressed]}
              >
                <Ionicons name="pin" size={14} color={C.gold} />
                <Text style={styles.prayerChipText} numberOfLines={1}>
                  {p.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.credits}>Textes liturgiques © AELF · Bibles Louis Segond 1910 et Crampon 1923</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    greeting: { color: C.muted, fontSize: 15, fontWeight: '600' },
    date: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40, marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    liturgy: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    liturgyText: { color: C.muted, fontSize: 14, lineHeight: 20, flex: 1 },
    todayLine: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: C.highlight,
      marginTop: 14,
    },
    todayText: { color: C.gold, fontSize: 14, fontWeight: '700', flexShrink: 1 },
    step: { backgroundColor: C.cardHi, borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: C.line },
    stepTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
    stepNext: { color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 4 },
    hero: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 20 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    officeIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    kickerAccent: { color: C.gold, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    officeName: { color: C.text, fontFamily: SERIF, fontSize: 28, lineHeight: 34, fontWeight: '700' },
    heroBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 16,
      backgroundColor: C.gold,
      marginTop: 18,
    },
    heroBtnText: { color: C.onGold, fontSize: 16, fontWeight: '800' },
    heroLabel: { color: C.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 18, marginBottom: 8 },
    bleed: { marginHorizontal: -20 },
    chips: { gap: 8, paddingHorizontal: 20 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      backgroundColor: C.cardHi,
      paddingHorizontal: 16,
      borderRadius: 22,
    },
    chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
    card: { backgroundColor: C.card, borderRadius: 20, padding: 20, gap: 8, marginBottom: 10 },
    journeyCard: { borderLeftWidth: 4, borderLeftColor: LITURGICAL_COLORS.violet, marginTop: 12 },
    journeyKicker: { color: C.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    kicker: { color: C.red, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase' },
    gospelTitle: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, lineHeight: 28 },
    gospelText: { color: C.muted, fontFamily: SERIF, fontSize: 16, lineHeight: 25 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    link: { color: C.gold, fontSize: 14, fontWeight: '700' },
    saint: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 20, padding: 16 },
    monogram: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    monogramText: { color: C.gold, fontFamily: SERIF, fontSize: 18, fontWeight: '700' },
    saintName: { color: C.text, fontFamily: SERIF, fontSize: 19, lineHeight: 25, fontWeight: '700' },
    reading: { backgroundColor: C.card, borderRadius: 20, padding: 18 },
    block: { gap: 8 },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    percent: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    percentText: { color: C.gold, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
    planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 16 },
    free: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    freeKicker: { color: C.faint, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    freeVerse: { color: C.muted, fontWeight: '400' },
    cards: { gap: 12, paddingHorizontal: 20 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    tile: { width: '48.5%', minHeight: 100, justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 18, padding: 14 },
    tileTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
    tileSub: { color: C.muted, fontSize: 13, lineHeight: 18 },
    prayerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    prayerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      backgroundColor: C.card,
      paddingHorizontal: 16,
      borderRadius: 22,
      maxWidth: '100%',
    },
    prayerChipText: { color: C.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    pressed: { opacity: 0.7 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700', flexShrink: 1 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    small: { color: C.faint, fontSize: 13 },
    strong: { color: C.text, fontWeight: '700' },
    ok: { color: C.gold, fontSize: 14, fontWeight: '700' },
    planToday: { color: C.muted, fontSize: 15, flexShrink: 1 },
    readBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      backgroundColor: C.gold,
      paddingHorizontal: 20,
      borderRadius: 22,
    },
    readBtnText: { color: C.onGold, fontWeight: '800', fontSize: 14 },
    track: { height: 4, borderRadius: 2, backgroundColor: C.track, overflow: 'hidden' },
    fill: { height: '100%' },
    credits: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 32 },
  });
