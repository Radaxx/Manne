import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { SERIF } from '../../cards';
import { MYSTERIES } from '../../data/prayers';
import { AllowNotifications, ExactAlarmNote, useReminderPermission } from '../../gathering-ui';
import { deviceTimeZone } from '../../gatherings';
import { NeedProfile, openGroup, useGroupGate } from '../../group-ui';
import { firstParam } from '../../groups';
import { haptic } from '../../haptics';
import {
  cancelRosary,
  getRosary,
  holderLabel,
  joinRosary,
  type LivingRosary,
  leaveRosary,
  type MysteryCell,
  monthsElapsed,
  myMysteryLabel,
  mysteryName,
  mysteryOfMonth,
  mysteryOrdinalLabel,
  mysterySeries,
  nextMysteryLabel,
  participantsLabel,
  rosaryToday,
  setDecadePrayed,
  setRosaryReminder,
  teamLabel,
  teamProgressLabel,
  withDecadePrayed,
} from '../../living-rosary';
import { Crown } from '../../living-rosary-ui';
import { TimeSteppers } from '../../novena-ui';
import { Button } from '../../profile-ui';
import { formatTime, notificationsSupported } from '../../reminder';
import { Text } from '../../text';
import { useThemed } from '../../theme';

const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export default function RosaireScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const reminders = useReminderPermission();
  // `undefined` : pas encore lu ; `null` : introuvable.
  const [rosary, setRosary] = useState<LivingRosary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<{ team: number; mystery: number } | null>(null);
  const [time, setTime] = useState({ hour: 8, minute: 0 });
  const [savingReminder, setSavingReminder] = useState(false);

  const load = useCallback(async () => {
    const result = await getRosary(id);
    if (!result.ok) {
      setError(result.message);
      setRosary((previous) => previous ?? null);
      return;
    }
    setError(result.rosary ? null : 'Ce Rosaire vivant n’existe plus, ou tu n’as pas accès à ce groupe.');
    setRosary(result.rosary);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (gate.ready) void load();
    }, [gate.ready, load]),
  );

  // Le jour et le mois changent à minuit dans le fuseau du Rosaire : on relit l'heure chaque minute, et on recharge quand
  // l'un des deux a changé (la couronne et les pseudos sont ceux du mois et du jour lus).
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const stale = !!rosary && (rosaryToday(rosary, now) !== rosary.today || monthsElapsed(rosary, now) !== rosary.monthsElapsed);
  useEffect(() => {
    if (stale) void load();
  }, [stale, load]);

  // L'heure proposée suit le rappel réglé quand on le connaît.
  const savedReminder = rosary?.reminderTime ?? null;
  useEffect(() => {
    if (!savedReminder) return;
    const [hour, minute] = savedReminder.split(':').map(Number);
    setTime({ hour, minute });
  }, [savedReminder]);

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (rosary === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!rosary) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Ce Rosaire vivant n’existe plus, ou tu n’as pas accès à ce groupe.'}</Text>
      </ScrollView>
    );
  }

  const me = rosary.me;
  const myMystery = me ? mysteryOfMonth(rosary, me.slot, now) : null;
  const zone = rosary.timezone;

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const take = async (mystery: number | null) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    haptic();
    const result = await joinRosary(rosary.id, mystery);
    if (!result.ok) {
      setNotice(result.message);
      await load();
    } else {
      haptic('success');
      if (result.rosary) setRosary(result.rosary);
      else await load();
    }
    setBusy(false);
  };

  const toggle = async () => {
    if (busy || !me || (!me.prayedToday && rosary.groupEnded)) return;
    const on = !me.prayedToday;
    const before = rosary;
    setBusy(true);
    setNotice(null);
    haptic(on ? 'success' : 'light');
    setRosary(withDecadePrayed(before, on));
    const result = await setDecadePrayed(rosary.id, on);
    if (!result.ok) {
      setNotice(result.message);
      setRosary(before);
    }
    await load();
    setBusy(false);
  };

  const pray = () => {
    if (myMystery === null) return;
    const { serie, dizaine } = mysterySeries(myMystery);
    router.push({ pathname: '/chapelet', params: { serie: String(serie), dizaine: String(dizaine), rosaire: rosary.id } });
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
    const result = await setRosaryReminder(rosary.id, hhmm(time.hour, time.minute));
    if (!result.ok) setNotice(result.message);
    else haptic('success');
    await load();
    setSavingReminder(false);
  };

  const removeReminder = async () => {
    if (savingReminder) return;
    setSavingReminder(true);
    setNotice(null);
    const result = await setRosaryReminder(rosary.id, null);
    if (!result.ok) setNotice(result.message);
    await load();
    setSavingReminder(false);
  };

  const leave = () => {
    Alert.alert('Quitter le Rosaire vivant ?', 'Ta place est libérée, tes dizaines cochées et ton rappel disparaissent.', [
      { text: 'Rester', style: 'cancel' },
      {
        text: 'Quitter',
        style: 'destructive',
        onPress: () => {
          void leaveRosary(rosary.id).then(async (result) => {
            if (!result.ok) setNotice(result.message);
            await load();
          });
        },
      },
    ]);
  };

  const cancel = () => {
    Alert.alert('Annuler ce Rosaire vivant ?', 'Il disparaît pour tous les membres du groupe, et les rappels s’arrêtent.', [
      { text: 'Garder le Rosaire', style: 'cancel' },
      {
        text: 'Annuler le Rosaire',
        style: 'destructive',
        onPress: () => {
          void cancelRosary(rosary.id).then((result) => {
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            if (router.canGoBack()) router.back();
            else openGroup(rosary.groupId);
          });
        },
      },
    ]);
  };

  const savedLabel = rosary.reminderTime ? formatTime(...(rosary.reminderTime.split(':').map(Number) as [number, number])) : '';
  const canTake = !me && !rosary.groupEnded;
  const pickedCell = selected && rosary.teams.find((t) => t.team === selected.team)?.mysteries.find((c) => c.mystery === selected.mystery);

  const holder = (cell: MysteryCell) => holderLabel(cell) ?? 'Libre';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
    >
      <Stack.Screen options={{ title: 'Rosaire vivant' }} />
      <Pressable onPress={() => openGroup(rosary.groupId)} hitSlop={8} accessibilityRole="link">
        <Text style={styles.kicker}>{rosary.groupName.toUpperCase()}</Text>
      </Pressable>
      <Text style={styles.title}>Rosaire vivant</Text>
      <Text style={styles.status}>{participantsLabel(rosary.participantCount)}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Le principe</Text>
        <Text style={styles.body}>
          Le Rosaire vivant est né à Lyon en 1826, avec Pauline Jaricot : chacun s’engage à prier une seule dizaine du chapelet par jour, et
          change de mystère chaque mois. Ensemble, le chapelet entier est prié chaque jour. À l’origine, il y avait quinze mystères et
          quinze personnes par équipe ; avec les mystères lumineux, une équipe en compte ici vingt.
        </Text>
        <Text style={styles.hint}>
          Pas de rattrapage : c’est un engagement quotidien. Tu ne peux cocher que la dizaine d’aujourd’hui, et la décocher le jour même.
        </Text>
        <Text style={styles.hint}>
          Le jour et le mois changent à minuit dans le fuseau du Rosaire ({zone}
          {zone !== deviceTimeZone() ? ', différent de celui de ton téléphone' : ''}).
        </Text>
        <Text style={styles.hint}>Seuls les membres du groupe voient ce Rosaire vivant et les pseudos de ses participants.</Text>
      </View>

      {me && myMystery !== null ? (
        <View style={styles.card}>
          <Text style={styles.label}>Mon mystère</Text>
          <Text style={styles.mystery}>{myMysteryLabel(rosary, me.slot, now)}</Text>
          <Text style={styles.hint}>
            {mysteryOrdinalLabel(myMystery)} · {teamLabel(me.team)}
          </Text>
          <Text style={styles.body}>
            <Text style={styles.hint}>Fruit du mystère : </Text>
            {MYSTERIES[mysterySeries(myMystery).serie].fruits[mysterySeries(myMystery).dizaine - 1]}
          </Text>
          <Text style={styles.next}>{nextMysteryLabel(rosary, me.slot, now)}</Text>
          <Button label="Prier ma dizaine" onPress={pray} />
          <Pressable
            onPress={() => void toggle()}
            disabled={busy || (!me.prayedToday && rosary.groupEnded)}
            style={({ pressed }) => [
              styles.doneBtn,
              me.prayedToday && styles.doneBtnOn,
              (busy || (!me.prayedToday && rosary.groupEnded)) && styles.off,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ checked: me.prayedToday }}
            accessibilityLabel={me.prayedToday ? 'Dizaine priée aujourd’hui, toucher pour décocher' : 'J’ai prié ma dizaine'}
          >
            <Ionicons name={me.prayedToday ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={me.prayedToday ? C.onGold : C.gold} />
            <Text style={[styles.doneText, me.prayedToday && styles.doneTextOn]}>
              {me.prayedToday ? 'Priée ✓' : 'J’ai prié ma dizaine'}
            </Text>
          </Pressable>
          {me.prayedToday ? <Text style={styles.hintCenter}>Touche encore pour décocher.</Text> : null}
          {!me.prayedToday && rosary.groupEnded ? (
            <Text style={styles.hintCenter}>Ce groupe est terminé : on ne coche plus de dizaine.</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.label}>Prendre un mystère</Text>
          {rosary.groupEnded ? (
            <Text style={styles.body}>Ce groupe est terminé : on ne prend plus de mystère.</Text>
          ) : rosary.openTeam === null ? (
            <Text style={styles.body}>Ce Rosaire vivant est complet : les 5 équipes ont leurs 20 mystères.</Text>
          ) : (
            <>
              <Text style={styles.body}>
                Tu pries une dizaine par jour. Touche « Prendre un mystère » pour recevoir le premier mystère libre ce mois-ci, ou choisis
                un mystère libre dans la liste plus bas.
              </Text>
              <Button label="Prendre un mystère" busy={busy} onPress={() => void take(null)} />
            </>
          )}
        </View>
      )}

      {rosary.teams.map((team) => (
        <View key={team.team} style={styles.team}>
          <Text style={styles.section}>{teamLabel(team.team)}</Text>
          <Text style={styles.progress}>{teamProgressLabel(team.prayedCount)}</Text>
          <Crown
            cells={team.mysteries}
            size={280}
            selected={selected?.team === team.team ? selected.mystery : null}
            onSelect={(mystery) => setSelected({ team: team.team, mystery })}
          >
            <Text style={styles.crownCount}>{team.prayedCount}</Text>
            <Text style={styles.crownOf}>sur {team.mysteries.length}</Text>
          </Crown>
          <Text style={styles.hintCenter}>
            Plein : prié aujourd’hui. Contour : place prise, pas encore priée. Pointillé : mystère à prendre.
          </Text>

          {selected?.team === team.team && pickedCell ? (
            <View style={styles.picked}>
              <Text style={styles.pickedKicker}>{mysteryOrdinalLabel(pickedCell.mystery)}</Text>
              <Text style={styles.pickedTitle}>{mysteryName(pickedCell.mystery)}</Text>
              <Text style={styles.hint}>
                {holder(pickedCell)}
                {pickedCell.taken ? (pickedCell.prayed ? ' · a prié aujourd’hui' : ' · pas encore priée aujourd’hui') : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {team.mysteries.map((cell, i) => (
              <View key={cell.mystery} style={[styles.item, i === team.mysteries.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons
                  name={cell.prayed ? 'checkmark-circle' : cell.taken ? 'ellipse-outline' : 'remove-circle-outline'}
                  size={20}
                  color={cell.taken ? C.gold : C.faint}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {cell.mystery + 1}. {mysteryName(cell.mystery)}
                  </Text>
                  <Text style={cell.taken ? styles.itemSub : styles.itemFree}>{holder(cell)}</Text>
                </View>
                {!cell.taken && canTake && rosary.openTeam === team.team ? (
                  <Pressable
                    onPress={() => void take(cell.mystery)}
                    disabled={busy}
                    style={[styles.takeBtn, busy && styles.off]}
                    accessibilityRole="button"
                    accessibilityLabel={`Prendre ce mystère : ${mysteryName(cell.mystery)}`}
                  >
                    <Text style={styles.takeText}>Prendre ce mystère</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      {me && !rosary.groupEnded ? (
        <>
          <Text style={styles.section}>Rappel</Text>
          <View style={styles.card}>
            {notificationsSupported ? (
              <>
                <Text style={styles.body}>
                  {rosary.reminderTime ? `Rappel chaque jour à ${savedLabel}.` : 'Pas de rappel pour ce Rosaire vivant.'}
                </Text>
                <TimeSteppers hour={time.hour} minute={time.minute} onChange={(hour, minute) => setTime({ hour, minute })} />
                <Button
                  label={
                    rosary.reminderTime
                      ? `Régler le rappel à ${formatTime(time.hour, time.minute)}`
                      : `Me rappeler ma dizaine chaque jour à ${formatTime(time.hour, time.minute)}`
                  }
                  kind={rosary.reminderTime ? 'secondary' : 'primary'}
                  busy={savingReminder}
                  disabled={rosary.reminderTime === hhmm(time.hour, time.minute)}
                  onPress={() => void saveReminder()}
                />
                {rosary.reminderTime ? (
                  <Button label="Ne plus me le rappeler" kind="quiet" disabled={savingReminder} onPress={() => void removeReminder()} />
                ) : null}
                <Text style={styles.hint}>
                  Tu reçois une notification sur ce téléphone pour chacun des 3 prochains jours ; le jour où tu as déjà prié n’est pas
                  rappelé. L’heure est gardée avec ton compte : tes autres appareils reprennent le même rappel. Un seul Rosaire vivant
                  rappelé à la fois.
                </Text>
                <AllowNotifications granted={reminders.granted} ask={reminders.ask} />
                <ExactAlarmNote visible={reminders.granted === true && !!rosary.reminderTime} />
              </>
            ) : (
              <Text style={styles.muted}>Les rappels ne sont disponibles que dans l’app sur téléphone.</Text>
            )}
          </View>
        </>
      ) : null}

      {me ? <Button label="Quitter le Rosaire vivant" kind="quiet" onPress={leave} /> : null}
      {rosary.canManage ? (
        <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Annuler le Rosaire vivant">
          <Text style={styles.cancel}>Annuler le Rosaire vivant</Text>
        </Pressable>
      ) : null}

      {notice ? <Text style={styles.noticeError}>{notice}</Text> : null}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60, gap: 12 },
    kicker: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800' },
    title: { color: C.text, fontFamily: SERIF, fontSize: 28, lineHeight: 34, fontWeight: '700' },
    status: { color: C.gold, fontSize: 16, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    hintCenter: { color: C.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    label: { color: C.gold, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', textTransform: 'uppercase' },
    body: { color: C.text, fontSize: 16, lineHeight: 24 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
    mystery: { color: C.text, fontFamily: SERIF, fontSize: 22, lineHeight: 28, fontWeight: '700' },
    next: { color: C.gold, fontSize: 15, fontWeight: '700' },
    section: { color: C.gold, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', marginTop: 10 },
    team: { gap: 10 },
    progress: { color: C.text, fontSize: 16, fontWeight: '700' },
    crownCount: { color: C.text, fontFamily: SERIF, fontSize: 40, lineHeight: 46 },
    crownOf: { color: C.faint, fontSize: 13, fontWeight: '600' },
    picked: { backgroundColor: C.highlight, borderRadius: 14, padding: 14, gap: 2 },
    pickedKicker: { color: C.gold, fontSize: 12, letterSpacing: 1.2, fontWeight: '800', textTransform: 'uppercase' },
    pickedTitle: { color: C.text, fontFamily: SERIF, fontSize: 20, lineHeight: 26, fontWeight: '700' },
    list: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    itemTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
    itemSub: { color: C.muted, fontSize: 13, marginTop: 1 },
    itemFree: { color: C.faint, fontSize: 13, marginTop: 1 },
    takeBtn: { borderWidth: 1, borderColor: C.gold, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    takeText: { color: C.gold, fontSize: 13, fontWeight: '700' },
    doneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 2,
      borderColor: C.gold,
      borderRadius: 999,
      paddingVertical: 13,
    },
    doneBtnOn: { backgroundColor: C.gold },
    doneText: { color: C.gold, fontSize: 16, fontWeight: '700' },
    doneTextOn: { color: C.onGold },
    off: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
    cancel: { color: C.faint, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 16 },
    noticeError: { color: C.red, fontSize: 14, textAlign: 'center' },
  });
