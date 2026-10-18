import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  type AdorationChain,
  adorationChanged,
  adorersLabel,
  cancelChain,
  canReserve,
  chainSections,
  coverage,
  coverageLong,
  coverageTag,
  defaultOpenKey,
  gapsLabel,
  getChain,
  MAX_PER_SLOT,
  MAX_SLOTS_PER_PERSON,
  myHourTitle,
  myUpcomingSlots,
  nowLine,
  originMention,
  periodLabel,
  rangeLabel,
  recurrenceLabel,
  releaseSlot,
  removeReservation,
  reserveSlot,
  type Section,
  type Slot,
  type Span,
  slotDateLabel,
  slotKey,
  slotLabel,
  slotPhase,
  slotState,
  slotSummary,
  withOccurrence,
  withRefresh,
  withWindow,
} from '../../adoration-chain';
import { CoverageBar, openAdoration, useNow } from '../../adoration-ui';
import type { Palette } from '../../appearance';
import { AllowNotifications, ExactAlarmNote, useReminderPermission } from '../../gathering-ui';
import { NeedProfile, openGroup, useGroupGate } from '../../group-ui';
import { firstParam, isGoneMessage } from '../../groups';
import { haptic } from '../../haptics';
import { Button } from '../../profile-ui';
import { animateNext, Chevron, Collapsible } from '../../recurrence-ui';
import { notificationsSupported } from '../../reminder';
import { Text } from '../../text';
import { useThemed } from '../../theme';

type ChainResult = Awaited<ReturnType<typeof reserveSlot>>;

export default function AdorationChaineScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const reminders = useReminderPermission();
  const now = useNow();
  // `undefined` : pas encore lue ; `null` : introuvable.
  const [chain, setChain] = useState<AdorationChain | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // La clé (instant de début) du créneau dont une action est en cours.
  const [busy, setBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moderating, setModerating] = useState(false);
  // Les sections que la personne a repliées ou dépliées à la main ; les autres suivent le défaut (celle en cours ou la prochaine
  // dépliée, les autres repliées). Rien n'est gardé.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // Relit la première fenêtre. `reset` : repart de là (on ferme les semaines suivantes déjà chargées) ; sinon la fusionne dans ce qui est affiché.
  const load = useCallback(
    async (reset: boolean) => {
      const result = await getChain(id);
      if (!result.ok) {
        setError(result.message);
        // Supprimée ou accès retiré : on n'affiche plus l'ancien contenu. Échec passager : on le garde.
        setChain((previous) => (isGoneMessage(result.message) ? null : (previous ?? null)));
        return;
      }
      setError(result.chain ? null : 'Cette chaîne d’adoration n’existe plus, ou tu n’as pas accès à ce groupe.');
      const fresh = result.chain;
      setChain((previous) => (!fresh ? null : reset || !previous ? fresh : withRefresh(previous, fresh)));
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      if (!gate.ready) return;
      void load(true);
      // Les rappels suivent ce que le serveur dit de mes créneaux à l'ouverture de l'écran.
      adorationChanged();
    }, [gate.ready, load]),
  );

  // Les adorateurs des autres bougent : on relit la chaîne chaque minute tant que l'écran est ouvert.
  useEffect(() => {
    if (!gate.ready) return;
    const timer = setInterval(() => void load(false), 60_000);
    return () => clearInterval(timer);
  }, [gate.ready, load]);

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (chain === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!chain) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Cette chaîne d’adoration n’existe plus, ou tu n’as pas accès à ce groupe.'}</Text>
      </ScrollView>
    );
  }

  const weekly = chain.recurrence === 'weekly';
  const sections = chainSections(chain);
  const defaultKey = defaultOpenKey(sections, now);
  const finished = Date.parse(chain.endsAt) <= now.getTime();
  const mine = myUpcomingSlots(chain, now);
  const hourSlot = mine.find((span) => ['live', 'soon'].includes(slotPhase(span.start, span.end, now)));
  const hourTitle = hourSlot ? myHourTitle(slotPhase(hourSlot.start, hourSlot.end, now)) : null;
  const live = nowLine(chain, now);
  // Couverture et trous : ceux de l'occurrence en cours ou de la prochaine.
  const focus = chain.occurrences.find((occurrence) => occurrence.end.getTime() > now.getTime()) ?? null;
  const focusCover = focus ? coverage(focus.slots) : null;
  const gaps = finished || !focus ? null : gapsLabel(focus.slots, now);
  const mention = originMention(chain);
  const readOnly = chain.groupEnded || finished;
  const when = (span: Span) => (weekly ? slotDateLabel(span.start, span.end) : slotLabel(span.start, span.end));

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const more = async () => {
    if (loadingMore || !chain.windowTo) return;
    setLoadingMore(true);
    setNotice(null);
    const result = await getChain(id, { from: chain.windowTo });
    if (!result.ok) setNotice(result.message);
    else if (result.chain) {
      const next = result.chain;
      animateNext();
      setChain((previous) => (previous ? withWindow(previous, next) : next));
    }
    setLoadingMore(false);
  };

  const toggle = (section: Section, isOpen: boolean) => {
    haptic('light');
    setOpened((previous) => ({ ...previous, [section.key]: !isOpen }));
  };

  // Une action sur UN créneau : le serveur renvoie la chaîne avec la seule occurrence touchée, qui prend sa place à l'écran.
  const act = async (slotStart: Date, run: () => Promise<ChainResult>, success: boolean) => {
    if (busy !== null) return;
    setBusy(slotStart.getTime());
    setNotice(null);
    haptic(success ? 'success' : 'light');
    const result = await run();
    if (!result.ok) setNotice(result.message);
    else if (result.chain) {
      const update = result.chain;
      setChain((previous) => (previous ? withOccurrence(previous, update) : update));
    } else await load(false);
    setBusy(null);
  };

  const askReserve = (slot: Slot) => {
    Alert.alert('Réserver ce créneau ?', `${when(slot)}. Tu pourras le libérer tant qu’il n’est pas terminé.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réserver', onPress: () => void act(slot.start, () => reserveSlot(chain.id, slot.start), true) },
    ]);
  };

  const askRelease = (slot: Span) => {
    Alert.alert('Libérer ce créneau ?', `${when(slot)}. D’autres pourront le prendre.`, [
      { text: 'Garder', style: 'cancel' },
      { text: 'Libérer', style: 'destructive', onPress: () => void act(slot.start, () => releaseSlot(chain.id, slot.start), false) },
    ]);
  };

  const askRemove = (slot: Slot, handle: string) => {
    Alert.alert(`Retirer @${handle} ?`, `Sa réservation du créneau ${when(slot)} est retirée.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => void act(slot.start, () => removeReservation(chain.id, slot.start, handle), false),
      },
    ]);
  };

  const onSlot = (slot: Slot) => {
    if (readOnly || busy !== null) return;
    const state = slotState(slot, now);
    if (state === 'past') return;
    if (state === 'mine') {
      askRelease(slot);
      return;
    }
    if (slot.count >= MAX_PER_SLOT) {
      setNotice('Ce créneau est complet.');
      return;
    }
    if (!canReserve(chain, slot, now)) {
      setNotice(`Tu as déjà ${MAX_SLOTS_PER_PERSON} créneaux à venir sur cette chaîne.`);
      return;
    }
    askReserve(slot);
  };

  const askCancel = () => {
    Alert.alert('Annuler cette chaîne ?', 'Elle disparaît pour tous les membres, et les rappels s’arrêtent.', [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: () =>
          void cancelChain(chain.id).then((result) => {
            if (!result.ok) {
              setNotice(result.message);
              return;
            }
            haptic('success');
            if (router.canGoBack()) router.back();
            else router.replace({ pathname: '/groupe/[id]', params: { id: chain.groupId } });
          }),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
    >
      <Stack.Screen options={{ title: chain.title }} />
      <View style={styles.header}>
        <Text style={styles.name}>{chain.title}</Text>
        <Pressable onPress={() => openGroup(chain.groupId)} hitSlop={6} accessibilityRole="link">
          <Text style={styles.group}>{chain.groupName}</Text>
        </Pressable>
        <Text style={styles.when}>{weekly ? recurrenceLabel(chain) : periodLabel(chain)}</Text>
        {mention ? <Text style={styles.hint}>{mention}</Text> : null}
        <Text style={styles.hint}>{slotSummary(chain)}</Text>
        <View style={styles.placeRow}>
          <Ionicons name="location-outline" size={16} color={C.muted} />
          <Text style={styles.place}>{chain.place ? chain.place : 'Pas de lieu commun : chacun adore là où il est.'}</Text>
        </View>
        {chain.intention ? <Text style={styles.intention}>{chain.intention}</Text> : null}
      </View>

      {chain.groupEnded ? <Text style={styles.banner}>Ce groupe est terminé : la chaîne reste en lecture seule.</Text> : null}
      {finished ? <Text style={styles.banner}>Cette chaîne est terminée.</Text> : null}

      {hourSlot && hourTitle ? (
        <View style={styles.hour}>
          <Text style={styles.hourTitle}>{hourTitle}</Text>
          <Text style={styles.hourSub}>{when(hourSlot)}</Text>
          <Button label="Entrer en adoration" onPress={() => openAdoration(chain.slotMinutes)} />
        </View>
      ) : null}

      {live ? (
        <View style={styles.live}>
          <Ionicons name="radio-button-on" size={16} color={C.gold} />
          <Text style={styles.liveText}>{live}</Text>
        </View>
      ) : null}

      {focus && focusCover ? (
        <View style={styles.card}>
          {weekly ? (
            <Text
              style={styles.focusTitle}
            >{`${focus.start.getTime() <= now.getTime() ? 'En cours' : 'Prochaine plage'} : ${slotDateLabel(focus.start, focus.end)}`}</Text>
          ) : null}
          <CoverageBar covered={focusCover.covered} total={focusCover.total} />
          <Text style={styles.coverage}>{coverageLong(focusCover)}</Text>
          {gaps ? <Text style={styles.hint}>{gaps}</Text> : null}
        </View>
      ) : null}

      {mine.length > 0 ? (
        <>
          <Text style={styles.section}>Mes créneaux</Text>
          <View style={styles.card}>
            {mine.map((span) => (
              <View key={span.start.getTime()} style={styles.mineRow}>
                <Text style={styles.mineText}>{when(span)}</Text>
                {readOnly ? null : (
                  <Pressable
                    onPress={() => askRelease(span)}
                    disabled={busy !== null}
                    hitSlop={8}
                    accessibilityLabel={`Libérer le créneau ${when(span)}`}
                  >
                    <Text style={styles.link}>Libérer</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {notificationsSupported && reminders.granted === true ? (
              <Text style={styles.hint}>Tu recevras un rappel 10 minutes avant chacun de tes 3 prochains créneaux.</Text>
            ) : null}
            <AllowNotifications granted={reminders.granted} ask={reminders.ask} />
            <ExactAlarmNote visible={reminders.granted === true} />
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Les créneaux</Text>
      {readOnly ? null : (
        <Text style={styles.hint}>
          Touche un créneau pour le réserver ou le libérer. Plusieurs personnes peuvent adorer en même temps. Tu peux avoir{' '}
          {MAX_SLOTS_PER_PERSON} créneaux à venir au plus{weekly ? ', toutes semaines confondues' : ''}.
        </Text>
      )}
      {sections.length === 0 ? <Text style={styles.hint}>{weekly ? 'Aucune plage à afficher.' : 'Aucun créneau.'}</Text> : null}
      {sections.map((section) => {
        const isOpen = opened[section.key] ?? section.key === defaultKey;
        const past = section.end.getTime() <= now.getTime();
        return (
          <View key={section.key} style={[styles.card, past && styles.past]}>
            <Pressable
              onPress={() => toggle(section, isOpen)}
              style={({ pressed }) => [styles.sectionHead, pressed && { opacity: 0.75 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${section.title}, ${section.range}, ${coverageTag(section.coverage)}`}
              accessibilityHint={isOpen ? 'Replie les créneaux de cette journée' : 'Déplie les créneaux de cette journée'}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dayLabel}>{section.title}</Text>
                <Text style={styles.dayRange}>{section.range}</Text>
              </View>
              <Text style={styles.dayCover}>{coverageTag(section.coverage)}</Text>
              <Chevron open={isOpen} color={C.muted} />
            </Pressable>
            <Collapsible open={isOpen} spacing={8}>
              <View style={styles.slots}>
                {section.slots.map((slot) => {
                  const state = slotState(slot, now);
                  const phase = slotPhase(slot.start, slot.end, now);
                  const who = adorersLabel(slot);
                  const removable = moderating && !readOnly && state !== 'past' ? slot.handles : [];
                  return (
                    <View key={slotKey(slot)}>
                      <Pressable
                        onPress={() => onSlot(slot)}
                        disabled={readOnly || state === 'past' || busy !== null}
                        style={({ pressed }) => [styles.slot, state === 'mine' && styles.slotMine, pressed && { opacity: 0.75 }]}
                        accessibilityRole="button"
                        accessibilityLabel={`${when(slot)}, ${
                          state === 'past' ? 'terminé' : state === 'mine' ? 'à toi' : state === 'covered' ? 'couvert' : 'libre'
                        }`}
                      >
                        <Text style={[styles.slotTime, state === 'past' && styles.past]}>{rangeLabel(slot.start, slot.end)}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.slotWho, state === 'free' && styles.slotFree, state === 'past' && styles.past]}
                            numberOfLines={2}
                          >
                            {who || (state === 'past' ? 'Personne' : 'Libre')}
                          </Text>
                          {phase === 'live' ? <Text style={styles.slotLive}>En cours</Text> : null}
                        </View>
                        {busy === slotKey(slot) ? (
                          <ActivityIndicator color={C.gold} />
                        ) : (
                          <Ionicons
                            name={
                              state === 'mine'
                                ? 'checkmark-circle'
                                : state === 'covered'
                                  ? 'people'
                                  : state === 'past'
                                    ? 'time-outline'
                                    : 'ellipse-outline'
                            }
                            size={22}
                            color={state === 'mine' ? C.gold : state === 'past' ? C.faint : state === 'covered' ? C.muted : C.faint}
                          />
                        )}
                      </Pressable>
                      {removable.length > 0 ? (
                        <View style={styles.removeRow}>
                          {removable.map((handle) => (
                            <Pressable key={handle} onPress={() => askRemove(slot, handle)} style={styles.removeChip} hitSlop={4}>
                              <Text style={styles.removeText}>Retirer @{handle}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Collapsible>
          </View>
        );
      })}

      {chain.hasMore && chain.windowTo ? (
        <Button label="Voir les semaines suivantes" kind="secondary" busy={loadingMore} onPress={() => void more()} />
      ) : null}

      {error ? <Text style={styles.noticeError}>{error}</Text> : null}
      {notice ? <Text style={styles.noticeError}>{notice}</Text> : null}

      {chain.canManage ? (
        <View style={styles.manage}>
          {readOnly ? null : (
            <Button
              label={moderating ? 'Terminer la modération' : 'Retirer une réservation'}
              kind="secondary"
              onPress={() => setModerating((on) => !on)}
            />
          )}
          {finished || chain.groupEnded ? null : (
            <Button
              label="Modifier la chaîne"
              kind="secondary"
              onPress={() => router.push({ pathname: '/groupe/adoration-nouvelle', params: { id: chain.groupId, chain: chain.id } })}
            />
          )}
          <Button label="Annuler la chaîne" kind="quiet" onPress={askCancel} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 10 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    header: { gap: 4, marginBottom: 4 },
    name: { color: C.text, fontSize: 26, fontWeight: '800' },
    group: { color: C.gold, fontSize: 15, fontWeight: '700' },
    when: { color: C.text, fontSize: 15, fontWeight: '600', marginTop: 6 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    place: { color: C.text, fontSize: 14, flex: 1 },
    intention: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 6 },
    banner: { color: C.text, backgroundColor: C.highlight, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20 },
    hour: { backgroundColor: C.highlight, borderRadius: 16, padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: C.gold },
    hourTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
    hourSub: { color: C.muted, fontSize: 14 },
    live: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 14, padding: 14 },
    liveText: { color: C.text, fontSize: 15, fontWeight: '700', flex: 1 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 12, gap: 8 },
    coverage: { color: C.text, fontSize: 15, fontWeight: '700' },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 14 },
    mineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
    mineText: { color: C.gold, fontSize: 15, fontWeight: '700', flex: 1 },
    link: { color: C.faint, fontSize: 13, fontWeight: '700' },
    focusTitle: { color: C.gold, fontSize: 14, fontWeight: '800' },
    slots: { gap: 8 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 6 },
    dayLabel: { color: C.text, fontSize: 15, fontWeight: '800' },
    dayRange: { color: C.muted, fontSize: 13, marginTop: 2 },
    dayCover: { color: C.muted, fontSize: 13, fontWeight: '700' },
    slot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12 },
    slotMine: { backgroundColor: C.highlight },
    slotTime: { color: C.text, fontSize: 15, fontWeight: '800', minWidth: 84, fontVariant: ['tabular-nums'] },
    slotWho: { color: C.text, fontSize: 14, lineHeight: 20 },
    slotFree: { color: C.faint },
    slotLive: { color: C.gold, fontSize: 12, fontWeight: '800', marginTop: 2 },
    past: { opacity: 0.5 },
    removeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10, paddingBottom: 8 },
    removeChip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    removeText: { color: C.red, fontSize: 13, fontWeight: '700' },
    noticeError: { color: C.red, fontSize: 14, textAlign: 'center' },
    manage: { gap: 10, marginTop: 10 },
  });
