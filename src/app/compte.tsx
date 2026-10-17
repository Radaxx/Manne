import { Ionicons } from '@expo/vector-icons';
import { type Href, router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../appearance';
import { TOTAL_CHAPTERS } from '../bible';
import { SERIF } from '../cards';
import { planById, planStatus } from '../plans';
import { SettingsButton } from '../profile-ui';
import { SectionHead } from '../section';
import { today, useApp } from '../storage';
import { Text } from '../text';
import { useThemed } from '../theme';
import { agoPhrase, bibleShare, bookShares, reachedSteps, todayTasks, weekStrip } from '../today';

/** Une ligne qui mène ailleurs : une icône, un titre et une précision. */
function NavRow({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navRow, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={20} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

/** Mon chemin : la progression, rien que la progression. Le prénom et le compte se règlent dans le profil. */
export default function CompteScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress, seeMilestone, selectBook } = useApp();
  const day = today();
  const tasks = todayTasks(progress);
  const week = weekStrip(progress);
  const share = bibleShare(progress.chaptersRead);
  const started = bookShares(progress.chaptersRead, progress.translation).filter((book) => book.read > 0);
  const plans = Object.entries(progress.plans).flatMap(([id, state]) => {
    const plan = planById(id);
    return plan ? [planStatus(plan, state, day, progress.translation)] : [];
  });
  const steps = reachedSteps(progress);
  const { streak, saved, customPrayers } = progress;

  const open = (href: string, book?: number) => {
    if (book) selectBook(book);
    if (href === '/lecture' || href === '/prieres') router.navigate(href as Href);
    else router.push(href as Href);
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SettingsButton /> }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mon chemin</Text>
        <Text style={styles.lead}>Ta progression, jour après jour.</Text>

        {/* La série et la semaine, en grand : c'est ce qui motive */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.flame}>
              <Ionicons name="flame" size={28} color={C.gold} />
            </View>
            <Text style={styles.streakValue}>
              {streak} <Text style={styles.streakLabel}>jour{streak > 1 ? 's' : ''} de suite</Text>
            </Text>
          </View>
          <View
            style={styles.week}
            accessibilityLabel={`Cette semaine : ${week.filter((cell) => cell.complete).length} jours complets sur 7`}
          >
            {week.map((cell) => (
              <View key={cell.date} style={styles.weekDay}>
                <View style={[styles.dot, cell.complete && styles.dotOn, cell.isToday && !cell.complete && styles.dotToday]} />
                <Text style={[styles.weekLetter, cell.isToday && styles.weekToday]}>{cell.letter}</Text>
              </View>
            ))}
          </View>
        </View>

        <SectionHead title="Aujourd’hui" />
        <View style={styles.group}>
          {tasks.map((task, i) => (
            <View key={task.id}>
              {i > 0 ? <View style={styles.separator} /> : null}
              <Pressable
                onPress={() => open(task.href)}
                style={({ pressed }) => [styles.task, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name={task.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={task.done ? C.gold : C.muted} />
                <Text style={[styles.taskLabel, task.done && styles.taskDone]}>{task.label}</Text>
                {task.done ? null : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
              </Pressable>
            </View>
          ))}
        </View>

        <SectionHead title="La Parole" />
        <View style={styles.card}>
          <View style={styles.shareRow}>
            <Text style={styles.shareValue}>{Math.round(share * 100)} %</Text>
            <Text style={styles.muted}>
              de la Bible lue · {progress.chaptersRead.length} chapitre{progress.chaptersRead.length > 1 ? 's' : ''} sur {TOTAL_CHAPTERS}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(Math.min(1, share) * 100)}%` }]} />
          </View>
          {started.length === 0 ? (
            <Text style={[styles.muted, { marginTop: 14 }]}>Aucun livre commencé. Marc t’attend.</Text>
          ) : (
            <View style={styles.books}>
              {started.map((book) => (
                <Pressable
                  key={book.n}
                  onPress={() => open('/lecture', book.n)}
                  style={({ pressed }) => [styles.book, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.bookName} numberOfLines={1}>
                    {book.name}
                  </Text>
                  <View style={[styles.track, styles.bookTrack]}>
                    <View style={[styles.fill, { width: `${Math.round((book.read / book.total) * 100)}%` }]} />
                  </View>
                  <Text style={styles.bookCount}>
                    {book.read}/{book.total}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {plans.map((status) => (
            <View key={status.plan.id}>
              <View style={styles.divider} />
              <Pressable
                onPress={() => open(status.finished ? '/plans' : `/plan/${status.plan.id}`)}
                style={({ pressed }) => [styles.plan, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planKicker}>PLAN DE LECTURE</Text>
                  <Text style={styles.cardTitle}>{status.plan.title}</Text>
                  <Text style={styles.muted}>
                    {status.finished
                      ? 'Plan terminé'
                      : status.behind > 0
                        ? `${status.behind} chapitre${status.behind > 1 ? 's' : ''} à rattraper`
                        : `Jour ${status.day + 1} sur ${status.plan.days}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </Pressable>
            </View>
          ))}
        </View>

        <SectionHead title="La prière" />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{progress.rosary.count}</Text>
            <Text style={styles.statLabel}>chapelet{progress.rosary.count > 1 ? 's' : ''}</Text>
            <Text style={styles.faint}>{agoPhrase(progress.rosary.last, day)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{progress.adoration.count}</Text>
            <Text style={styles.statLabel}>adoration{progress.adoration.count > 1 ? 's' : ''}</Text>
            <Text style={styles.faint}>{agoPhrase(progress.adoration.last, day)}</Text>
          </View>
        </View>
        <Text style={styles.lastOffice}>Dernier office : {agoPhrase(progress.lastOffice, day)}.</Text>

        <SectionHead title="Confession" />
        <View style={styles.group}>
          <NavRow
            icon="heart-outline"
            title="Confession"
            hint={`Dernière absolution : ${agoPhrase(progress.confession.lastConfession, day)}`}
            onPress={() => open('/confession')}
          />
        </View>

        {steps.length > 0 && (
          <>
            <SectionHead title="Étapes" />
            <View style={styles.list}>
              {steps.map((step) => (
                <Pressable
                  key={step.id}
                  onPress={() => {
                    seeMilestone(step.id);
                    open(step.href, step.book);
                  }}
                  style={({ pressed }) => [styles.step, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <View style={styles.stepIcon}>
                    <Ionicons name={step.id.startsWith('streak') ? 'flame' : 'book-outline'} size={22} color={C.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{step.title}</Text>
                    <Text style={styles.stepNext}>{step.next}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <SectionHead title="Ma bibliothèque" />
        <View style={styles.group}>
          <NavRow
            icon="bookmark-outline"
            title="Passages gardés"
            hint={saved.length === 0 ? 'Garde un verset pendant la lecture' : `${saved.length} verset${saved.length > 1 ? 's' : ''}`}
            onPress={() => open('/passages')}
          />
          <View style={styles.separator} />
          <NavRow
            icon="create-outline"
            title="Mes prières"
            hint={
              customPrayers.length === 0
                ? 'Écris tes propres mots'
                : `${customPrayers.length} prière${customPrayers.length > 1 ? 's' : ''} écrite${customPrayers.length > 1 ? 's' : ''}`
            }
            onPress={() => open('/prieres')}
          />
          <View style={styles.separator} />
          <NavRow icon="heart-circle-outline" title="Mes intentions" hint="Celles que tu as confiées" onPress={() => open('/intentions')} />
        </View>
      </ScrollView>
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    title: { color: C.text, fontFamily: SERIF, fontSize: 34, lineHeight: 40, fontWeight: '700' },
    lead: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 4 },
    hero: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, marginTop: 20, gap: 18 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    flame: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    streakValue: { color: C.text, fontFamily: SERIF, fontSize: 44, lineHeight: 48, fontWeight: '700', flexShrink: 1 },
    streakLabel: { color: C.muted, fontFamily: undefined, fontSize: 16, fontWeight: '700' },
    week: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: 6 },
    dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cardHi },
    dotOn: { backgroundColor: C.gold },
    dotToday: { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.gold },
    weekLetter: { color: C.muted, fontSize: 12, fontWeight: '700' },
    weekToday: { color: C.gold, fontWeight: '800' },
    group: { backgroundColor: C.card, borderRadius: 20 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginHorizontal: 16 },
    task: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10 },
    taskLabel: { color: C.text, fontSize: 16, fontWeight: '600', flex: 1 },
    taskDone: { color: C.muted, textDecorationLine: 'line-through' },
    card: { backgroundColor: C.card, borderRadius: 20, padding: 20 },
    shareRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
    shareValue: { color: C.gold, fontFamily: SERIF, fontSize: 40, lineHeight: 44, fontWeight: '700' },
    track: { height: 6, borderRadius: 3, backgroundColor: C.track, overflow: 'hidden', marginTop: 10 },
    fill: { height: '100%', minWidth: 6, borderRadius: 3, backgroundColor: C.gold },
    books: { marginTop: 8 },
    book: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
    bookName: { color: C.text, fontSize: 15, fontWeight: '700', width: 92 },
    bookTrack: { flex: 1, marginTop: 0 },
    bookCount: { color: C.muted, fontSize: 13, width: 48, textAlign: 'right' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginTop: 16, marginBottom: 4 },
    plan: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
    planKicker: { color: C.faint, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    cardTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    stats: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, backgroundColor: C.card, borderRadius: 20, padding: 16 },
    statValue: { color: C.text, fontFamily: SERIF, fontSize: 36, lineHeight: 40, fontWeight: '700' },
    statLabel: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
    faint: { color: C.muted, fontSize: 13, marginTop: 2 },
    lastOffice: { color: C.muted, fontSize: 14, marginTop: 12 },
    list: { gap: 10 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 20, padding: 16 },
    stepIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    stepNext: { color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 2 },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: 'transparent',
    },
    navIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    navTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    navHint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    pressed: { opacity: 0.75 },
  });
