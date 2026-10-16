import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../appearance';
import { bookMeta, chapterSource, loadPassage, passageLabel, translationName } from '../../bible';
import { SERIF } from '../../cards';
import { novenaTemplate, PASSAGE_SET_DATA, type Passage } from '../../data/novenas';
import { prayerById } from '../../data/prayers';
import { dayLabel } from '../../dates';
import { AllowNotifications, ExactAlarmNote, useReminderPermission } from '../../gathering-ui';
import { NeedProfile, openGroup, useGroupGate } from '../../group-ui';
import { firstParam } from '../../groups';
import { haptic } from '../../haptics';
import { closeExtract } from '../../journey-screen';
import { TimeSteppers } from '../../novena-ui';
import {
  cancelNovena,
  dayCountLabel,
  dayOfLabel,
  defaultDay,
  finishersLabel,
  getNovena,
  isDayOpen,
  lockedLabel,
  NOVENA_DAYS,
  type Novena,
  novenaDates,
  novenaDay,
  prayedTodayLabel,
  setDayPrayed,
  setNovenaReminder,
  statusLabel,
  withDayPrayed,
} from '../../novenas';
import { PrayerText } from '../../prayers';
import { Button } from '../../profile-ui';
import { formatTime, notificationsSupported } from '../../reminder';
import { ChapterSheet } from '../../sheets';
import { useApp } from '../../storage';
import { useThemed } from '../../theme';

const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export default function NeuvaineScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const { progress } = useApp();
  const reminders = useReminderPermission();
  // `undefined` : pas encore lue ; `null` : introuvable.
  const [novena, setNovena] = useState<Novena | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reading, setReading] = useState(false);
  const [time, setTime] = useState({ hour: 8, minute: 0 });
  const [savingReminder, setSavingReminder] = useState(false);

  const load = useCallback(async () => {
    const result = await getNovena(id);
    if (!result.ok) {
      setError(result.message);
      setNovena((previous) => previous ?? null);
      return;
    }
    setError(result.novena ? null : 'Cette neuvaine n’existe plus, ou tu n’as pas accès à ce groupe.');
    setNovena(result.novena);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (gate.ready) void load();
    }, [gate.ready, load]),
  );

  // Le jour change à minuit dans le fuseau de la neuvaine : on relit l'heure chaque minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // L'heure proposée suit le rappel réglé quand on le connaît.
  const savedReminder = novena?.reminderTime ?? null;
  useEffect(() => {
    if (!savedReminder) return;
    const [hour, minute] = savedReminder.split(':').map(Number);
    setTime({ hour, minute });
  }, [savedReminder]);

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (novena === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!novena) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Cette neuvaine n’existe plus, ou tu n’as pas accès à ce groupe.'}</Text>
      </ScrollView>
    );
  }

  const current = novenaDay(novena, now);
  const finished = current > NOVENA_DAYS;
  const day = selected ?? defaultDay(current);
  const dates = novenaDates(novena.startDate);
  const locked = !isDayOpen(novena, day, now);
  const prayed = novena.myDays.includes(day);
  const template = novenaTemplate(novena.model);
  const content = template?.days[day - 1];
  const passage: Passage | undefined =
    content?.passage ?? (novena.passageSet ? PASSAGE_SET_DATA[novena.passageSet].passages[day - 1] : undefined);
  const dayCount = novena.dayCounts[day - 1] ?? 0;

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = async () => {
    if (busy || locked || (!prayed && novena.groupEnded)) return;
    const on = !prayed;
    const before = novena;
    setBusy(true);
    setNotice(null);
    haptic(on ? 'success' : 'light');
    setNovena(withDayPrayed(before, day, on));
    const result = await setDayPrayed(novena.id, day, on);
    if (!result.ok) {
      setNotice(result.message);
      setNovena(before);
    }
    await load();
    setBusy(false);
  };

  const saveReminder = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    setNotice(null);
    if (reminders.granted !== true && !(await reminders.ask())) {
      setNotice('Autorise les notifications pour recevoir un rappel.');
      setSavingReminder(false);
      return;
    }
    const result = await setNovenaReminder(novena.id, hhmm(time.hour, time.minute));
    if (!result.ok) setNotice(result.message);
    else haptic('success');
    await load();
    setSavingReminder(false);
  };

  const removeReminder = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    setNotice(null);
    const result = await setNovenaReminder(novena.id, null);
    if (!result.ok) setNotice(result.message);
    await load();
    setSavingReminder(false);
  };

  const cancel = () => {
    Alert.alert('Annuler cette neuvaine ?', 'Elle disparaît pour tous les membres du groupe, et les rappels s’arrêtent.', [
      { text: 'Garder la neuvaine', style: 'cancel' },
      {
        text: 'Annuler la neuvaine',
        style: 'destructive',
        onPress: () => {
          void cancelNovena(novena.id).then((result) => {
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            if (router.canGoBack()) router.back();
            else openGroup(novena.groupId);
          });
        },
      },
    ]);
  };

  const t = progress.translation;
  const verses = passage ? closeExtract(loadPassage(passage[0], passage[1], passage[2], passage[3], t)) : [];
  const reference = passage ? passageLabel(passage[0], passage[1], passage[2], passage[3], t) : '';
  const myCount = novena.myDays.length;
  const savedLabel = novena.reminderTime ? formatTime(...(novena.reminderTime.split(':').map(Number) as [number, number])) : '';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
    >
      <Stack.Screen options={{ title: novena.title }} />
      <Pressable onPress={() => openGroup(novena.groupId)} hitSlop={8} accessibilityRole="link">
        <Text style={styles.kicker}>{novena.groupName.toUpperCase()}</Text>
      </Pressable>
      <Text style={styles.title}>{novena.title}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Pour quoi nous prions</Text>
        <Text style={styles.intention}>{novena.intention}</Text>
        <Text style={styles.hint}>Seuls les membres du groupe voient cette neuvaine et son intention.</Text>
      </View>

      {finished ? (
        <View style={styles.arrival}>
          <Text style={styles.arrivalTitle}>Neuvaine terminée</Text>
          <Text style={styles.lead}>
            {myCount === NOVENA_DAYS
              ? 'Tu l’as priée jusqu’au bout.'
              : `Tu l’as priée ${myCount} jour${myCount > 1 ? 's' : ''} sur ${NOVENA_DAYS}.`}{' '}
            {finishersLabel(novena.finisherCount)}.
          </Text>
          <Text style={styles.hint}>Merci d’avoir prié ensemble. Tu peux relire chaque jour.</Text>
        </View>
      ) : (
        <Text style={styles.status}>{statusLabel(novena, now)}</Text>
      )}

      <View style={styles.days}>
        {dates.map((date, i) => {
          const d = i + 1;
          const on = d === day;
          const done = novena.myDays.includes(d);
          const closed = d > current;
          return (
            <Pressable
              key={date}
              onPress={() => setSelected(d)}
              style={styles.dayCell}
              accessibilityRole="button"
              accessibilityLabel={`Jour ${d}, ${dayLabel(date)}${done ? ', prié' : ''}${closed ? ', pas encore ouvert' : ''}, ${dayCountLabel(novena.dayCounts[i] ?? 0)}`}
              accessibilityState={{ selected: on }}
            >
              <View
                style={[
                  styles.dayDot,
                  done && styles.dayDotDone,
                  d === current && !done && styles.dayDotToday,
                  on && styles.dayDotSelected,
                  closed && styles.dayDotLocked,
                ]}
              >
                <Text style={[styles.dayText, done && styles.dayTextDone]}>{d}</Text>
              </View>
              <Text style={styles.dayCount}>{novena.dayCounts[i] ?? 0}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>Ta case est pleine quand tu as prié le jour. Le petit nombre dessous : les membres qui l’ont prié.</Text>

      <Text style={styles.meta}>
        {dayOfLabel(day)} · {dayLabel(dates[day - 1])}
      </Text>
      <Text style={styles.dayTitle}>{content?.title ?? `Jour ${day}`}</Text>

      {locked ? (
        <View style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={20} color={C.muted} />
          <Text style={styles.lockedText}>{lockedLabel(novena, day)}</Text>
        </View>
      ) : (
        <>
          {passage ? (
            <View style={styles.card}>
              <Text style={styles.scripture}>
                {verses.map((v, i) => (
                  <Text key={i}>
                    <Text style={styles.verseNum}>{passage[2] + i} </Text>
                    {v}{' '}
                  </Text>
                ))}
              </Text>
              <Text style={styles.ref}>
                {reference} · {translationName(chapterSource(passage[0], passage[1], t))}
              </Text>
              <Pressable onPress={() => setReading(true)} hitSlop={8}>
                <Text style={styles.link}>Lire tout le chapitre</Text>
              </Pressable>
            </View>
          ) : null}

          {content ? (
            <>
              <Text style={styles.section}>Méditer</Text>
              <Text style={styles.body}>{content.meditation}</Text>
              <Text style={styles.section}>La prière du jour</Text>
              <View style={styles.card}>
                <PrayerText text={content.prayer} style={styles.prayer} />
              </View>
              {content.repeated.length > 0 ? <Text style={styles.section}>À réciter</Text> : null}
              {content.repeated.map((ref) => {
                const prayer = prayerById(ref.id);
                if (!prayer?.text) return null;
                return (
                  <View key={ref.id} style={styles.card}>
                    <Text style={styles.repeatedTitle}>
                      {prayer.title}
                      {ref.times > 1 ? ` · ${ref.times} fois` : ''}
                    </Text>
                    <PrayerText text={prayer.text} style={styles.prayer} />
                  </View>
                );
              })}
            </>
          ) : novena.customPrayer ? (
            <>
              <Text style={styles.section}>La prière du groupe</Text>
              <View style={styles.card}>
                <PrayerText text={novena.customPrayer} style={styles.prayer} />
              </View>
            </>
          ) : null}

          <Text style={styles.hint}>{day === current ? prayedTodayLabel(dayCount) : dayCountLabel(dayCount)}</Text>
          <Pressable
            onPress={() => void toggle()}
            disabled={busy || (!prayed && novena.groupEnded)}
            style={({ pressed }) => [
              styles.doneBtn,
              prayed && styles.doneBtnOn,
              (busy || (!prayed && novena.groupEnded)) && styles.off,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ checked: prayed }}
            accessibilityLabel={prayed ? `Prié le jour ${day}, toucher pour décocher` : `J’ai prié le jour ${day}`}
          >
            <Ionicons name={prayed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={prayed ? C.onGold : C.gold} />
            <Text style={[styles.doneText, prayed && styles.doneTextOn]}>{prayed ? 'Prié ✓' : `J’ai prié le jour ${day}`}</Text>
          </Pressable>
          {prayed ? <Text style={styles.hintCenter}>Touche encore pour décocher.</Text> : null}
          {!prayed && day < current ? <Text style={styles.hintCenter}>Ce jour est passé : tu peux le rattraper.</Text> : null}
          {!prayed && novena.groupEnded ? <Text style={styles.hintCenter}>Ce groupe est terminé : on ne coche plus de jour.</Text> : null}
        </>
      )}

      {finished ? null : (
        <>
          <Text style={styles.section}>Rappel</Text>
          <View style={styles.card}>
            {notificationsSupported ? (
              <>
                <Text style={styles.body}>
                  {novena.reminderTime ? `Rappel chaque jour à ${savedLabel}.` : 'Pas de rappel pour cette neuvaine.'}
                </Text>
                <TimeSteppers hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} />
                <Button
                  label={
                    novena.reminderTime
                      ? `Régler le rappel à ${formatTime(time.hour, time.minute)}`
                      : `Me le rappeler chaque jour à ${formatTime(time.hour, time.minute)}`
                  }
                  kind={novena.reminderTime ? 'secondary' : 'primary'}
                  busy={savingReminder}
                  disabled={novena.reminderTime === hhmm(time.hour, time.minute)}
                  onPress={() => void saveReminder()}
                />
                {novena.reminderTime ? (
                  <Button label="Ne plus me le rappeler" kind="quiet" disabled={savingReminder} onPress={() => void removeReminder()} />
                ) : null}
                <Text style={styles.hint}>
                  Tu reçois une notification sur ce téléphone pour chacun des 3 prochains jours que tu n’as pas encore priés. L’heure est
                  gardée avec ton compte : tes autres appareils reprennent le même rappel. Trois neuvaines rappelées au plus.
                </Text>
                <AllowNotifications granted={reminders.granted} ask={reminders.ask} />
                <ExactAlarmNote visible={reminders.granted === true && !!novena.reminderTime} />
              </>
            ) : (
              <Text style={styles.muted}>Les rappels ne sont disponibles que dans l’app sur téléphone.</Text>
            )}
          </View>
        </>
      )}

      {novena.canManage ? (
        <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annuler la neuvaine">
          <Text style={styles.cancel}>Annuler la neuvaine</Text>
        </Pressable>
      ) : null}

      {notice ? <Text style={styles.noticeError}>{notice}</Text> : null}

      {reading && passage ? (
        <ChapterSheet
          passage={{
            id: `${novena.id}-${day}`,
            book: passage[0],
            bookName: bookMeta(passage[0], t).name,
            chapter: passage[1],
            from: passage[2],
            to: passage[3],
            reference,
            text: verses.join(' '),
          }}
          onClose={() => setReading(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 12 },
    kicker: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 28, lineHeight: 34, fontWeight: '700' },
    lead: { color: C.text, fontSize: 16, lineHeight: 24 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    hintCenter: { color: C.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    label: { color: C.gold, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase' },
    intention: { color: C.text, fontSize: 17, lineHeight: 25 },
    status: { color: C.gold, fontSize: 16, fontWeight: '700' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
    arrival: { backgroundColor: C.highlight, borderRadius: 16, padding: 16, gap: 6 },
    arrivalTitle: { color: C.gold, fontFamily: SERIF, fontSize: 24, fontWeight: '700' },
    days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    dayCell: { alignItems: 'center', gap: 4, flex: 1 },
    dayDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.card,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    dayDotDone: { backgroundColor: C.gold },
    dayDotToday: { borderColor: C.gold },
    dayDotSelected: { borderColor: C.text },
    dayDotLocked: { opacity: 0.4 },
    dayText: { color: C.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
    dayTextDone: { color: C.onGold },
    dayCount: { color: C.faint, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    meta: { color: C.muted, fontSize: 13, marginTop: 8 },
    dayTitle: { color: C.text, fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700' },
    locked: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 14, padding: 16 },
    lockedText: { flex: 1, color: C.muted, fontSize: 15, lineHeight: 21 },
    scripture: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 28 },
    verseNum: { color: C.gold, fontSize: 12, fontWeight: '700' },
    ref: { color: C.muted, fontSize: 12, letterSpacing: 1, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
    link: { color: C.gold, fontSize: 15, fontWeight: '700', marginTop: 4 },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 10 },
    body: { color: C.text, fontSize: 16, lineHeight: 24 },
    prayer: { color: C.text, fontSize: 16, lineHeight: 25, marginBottom: 8 },
    repeatedTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
    doneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: C.gold,
      borderRadius: 999,
      paddingVertical: 13,
      marginTop: 8,
    },
    doneBtnOn: { backgroundColor: C.gold },
    doneText: { color: C.gold, fontSize: 16, fontWeight: '700' },
    doneTextOn: { color: C.onGold },
    off: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
    cancel: { color: C.faint, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 16 },
    noticeError: { color: C.red, fontSize: 14, textAlign: 'center' },
  });
