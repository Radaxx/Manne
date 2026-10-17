import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { type AdorationChain, adorationChanged, listChains, MAX_ACTIVE_CHAINS } from '../../adoration-chain';
import { AdorationChainCard } from '../../adoration-ui';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { SERIF } from '../../cards';
import { AllowNotifications, ExactAlarmNote, GatheringCard, useReminderPermission } from '../../gathering-ui';
import {
  cancelGathering,
  deviceTimeZone,
  type Gathering,
  gatheringsChanged,
  listGatherings,
  markPresent,
  mergeServer,
  restoreGathering,
  setParticipation,
  withParticipation,
  withPresence,
} from '../../gatherings';
import { GroupNotificationsEntry } from '../../group-mute';
import { KIND_ICONS, NeedProfile, openRoom, useGroupGate } from '../../group-ui';
import {
  cancelRequest,
  canModerate,
  endLabel,
  firstParam,
  formatInviteCode,
  type GroupDetail,
  type GroupIntention,
  getGroup,
  INTENTION_MAX,
  inviteMessage,
  joinGroup,
  kindLabel,
  leaveGroup,
  listGroupIntentions,
  markAnswered,
  memberCountLabel,
  postGroupIntention,
  removeGroupIntention,
  reportGroupIntention,
  requestJoin,
  roleLabel,
  setGroupCarry,
  THANKS_MAX,
  withdrawGroupIntention,
} from '../../groups';
import { haptic } from '../../haptics';
import { getGroupRosary, type LivingRosary, startRosary } from '../../living-rosary';
import { LivingRosaryCard, openRosary } from '../../living-rosary-ui';
import { useReportSheet } from '../../moderation-ui';
import { NovenaCard } from '../../novena-ui';
import { listNovenas, MAX_ACTIVE_NOVENAS, type Novena, novenaDay, novenasChanged } from '../../novenas';
import { Button, openProfile } from '../../profile-ui';
import { SectionHead } from '../../section';
import { Text, TextInput } from '../../text';
import { useThemed } from '../../theme';

type Tab = 'prier' | 'intentions' | 'groupe';

const carried = (n: number) => (n === 0 ? 'Personne ne la porte encore' : n === 1 ? '1 personne la porte' : `${n} personnes la portent`);

export default function GroupeScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const { profile } = useAuth();
  const { ask, sheet } = useReportSheet();
  const [tab, setTab] = useState<Tab>('prier');
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [intentions, setIntentions] = useState<GroupIntention[]>([]);
  const [gatherings, setGatherings] = useState<Gathering[]>([]);
  const [novenas, setNovenas] = useState<Novena[]>([]);
  const [rosary, setRosary] = useState<LivingRosary | null>(null);
  const [chains, setChains] = useState<AdorationChain[]>([]);
  const reminders = useReminderPermission();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  // Chargement PAR rendez-vous (« Je participe », « Je suis là ») : les autres cartes ne bougent pas.
  const [busyGatherings, setBusyGatherings] = useState<Record<string, 'participate' | 'present'>>({});
  const inflight = useRef(new Set<string>());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // L'intention dont on écrit l'action de grâce, et le mot en cours de frappe.
  const [answering, setAnswering] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const result = await getGroup(id);
    if (!result.ok) {
      setError(result.message);
      setGroup(null);
      return;
    }
    setError(null);
    setGroup(result.group);
    if (result.group?.myStatus === 'member') {
      const [listed, meetings, nine, living, adoration] = await Promise.all([
        listGroupIntentions(id),
        listGatherings(id),
        listNovenas(id),
        getGroupRosary(id),
        listChains(id),
      ]);
      if (listed.ok) setIntentions(listed.intentions);
      else setNotice(listed.message);
      if (meetings.ok) setGatherings((local) => mergeServer(local, meetings.gatherings, inflight.current));
      else setNotice(meetings.message);
      if (nine.ok) setNovenas(nine.novenas);
      else setNotice(nine.message);
      if (living.ok) setRosary(living.rosary);
      else setNotice(living.message);
      if (adoration.ok) setChains(adoration.chains);
      else setNotice(adoration.message);
    } else {
      setIntentions([]);
      setGatherings([]);
      setNovenas([]);
      setRosary(null);
      setChains([]);
    }
  }, [id]);

  // Quand un rendez-vous est proche ou en cours, on relit la liste chaque minute : « En cours » et les présents suivent.
  const soon = gatherings.some((g) => {
    const start = Date.parse(g.currentStart ?? g.nextStart ?? '');
    return Number.isFinite(start) && start - Date.now() < 30 * 60_000;
  });
  useEffect(() => {
    if (!soon) return;
    const timer = setInterval(() => {
      void listGatherings(id).then((result) => {
        if (result.ok) setGatherings((local) => mergeServer(local, result.gatherings, inflight.current));
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, [soon, id]);

  useFocusEffect(
    useCallback(() => {
      if (!gate.ready) return;
      void load();
      // Les rappels des rendez-vous suivent ce que le serveur dit de mes inscriptions à l'ouverture de la page.
      gatheringsChanged();
      novenasChanged();
      adorationChanged();
    }, [gate.ready, load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (group === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!group) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Ce groupe n’existe pas, ou tu n’en fais pas partie.'}</Text>
      </ScrollView>
    );
  }

  const isMember = group.myStatus === 'member';
  const moderator = canModerate(group.myRole);
  const end = endLabel(group.endsAt);
  const activeNovenas = novenas.filter((n) => novenaDay(n, new Date()) <= 9).length;
  const activeChains = chains.filter((chain) => Date.parse(chain.endsAt) > Date.now()).length;

  const act = async (run: () => Promise<{ ok: boolean; message?: string }>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    haptic();
    const result = await run();
    if (!result.ok) setNotice(result.message ?? null);
    await load();
    setBusy(false);
  };

  // Une action sur UN rendez-vous : la carte change tout de suite (inscription, présence), puis se réconcilie avec le serveur
  // sans toucher aux autres cartes ; en cas d'échec, elle revient à son état d'avant avec un message.
  const gatheringAction = async (
    item: Gathering,
    kind: 'participate' | 'present',
    optimistic: (list: Gathering[]) => Gathering[],
    run: () => Promise<{ ok: boolean; message?: string }>,
    onDone?: () => void,
  ) => {
    if (inflight.current.has(item.id)) return;
    inflight.current.add(item.id);
    setBusyGatherings((state) => ({ ...state, [item.id]: kind }));
    setNotice(null);
    haptic();
    setGatherings(optimistic);
    const result = await run();
    if (!result.ok) {
      setNotice(result.message ?? null);
      setGatherings((list) => restoreGathering(list, item));
    }
    inflight.current.delete(item.id);
    const fresh = await listGatherings(id);
    if (fresh.ok) setGatherings((list) => mergeServer(list, fresh.gatherings, inflight.current));
    setBusyGatherings(({ [item.id]: _done, ...rest }) => rest);
    // Les rappels du téléphone suivent l'inscription, qu'elle ait réussi ou non.
    if (kind === 'participate') gatheringsChanged();
    if (result.ok) onDone?.();
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    const result = await postGroupIntention(group.id, body);
    setSending(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setDraft('');
    await load();
  };

  const toggleCarry = (item: GroupIntention) => {
    haptic();
    const next = !item.carrying;
    setIntentions((list) =>
      list.map((row) => (row.id === item.id ? { ...row, carrying: next, carries: Math.max(0, row.carries + (next ? 1 : -1)) } : row)),
    );
    void setGroupCarry(item.id, next).then((result) => {
      if (!result.ok) {
        setNotice(result.message);
        void load();
      }
    });
  };

  const confirm = (title: string, message: string, label: string, run: () => Promise<{ ok: boolean; message?: string }>) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => void act(run) },
    ]);
  };

  const saveThanks = async () => {
    if (!answering || busy) return;
    const { id: intentionId, text } = answering;
    setBusy(true);
    setNotice(null);
    const result = await markAnswered(intentionId, text);
    if (!result.ok) setNotice(result.message);
    else {
      haptic('success');
      setAnswering(null);
    }
    await load();
    setBusy(false);
  };

  const share = async () => {
    if (!group.inviteCode) return;
    try {
      await Share.share({ message: inviteMessage(group.name, group.inviteCode) });
    } catch {
      setNotice('Le partage n’a pas pu s’ouvrir.');
    }
  };

  const launchRosary = () => {
    Alert.alert(
      'Lancer un Rosaire vivant ?',
      `Chaque participant prie une dizaine par jour, et son mystère change chaque mois. Le Rosaire commence ce mois-ci ; le jour et le mois changent à minuit dans le fuseau de ton téléphone (${deviceTimeZone()}). Tous les membres du groupe pourront y prendre un mystère.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lancer',
          onPress: () => {
            if (busy) return;
            setBusy(true);
            setNotice(null);
            void startRosary(group.id).then(async (result) => {
              if (!result.ok) {
                setNotice(result.message);
                setBusy(false);
                return;
              }
              haptic('success');
              await load();
              setBusy(false);
              if (typeof result.data === 'string') openRosary(result.data);
            });
          },
        },
      ],
    );
  };

  const leave = () => {
    if (group.myRole === 'owner') {
      Alert.alert(
        'Tu es le propriétaire',
        'Pour quitter le groupe, transfère-le d’abord à un autre membre depuis « Membres », ou supprime-le dans les réglages du groupe.',
      );
      return;
    }
    Alert.alert(
      `Quitter « ${group.name} » ?`,
      'Tes intentions dans ce groupe sont retirées, et tu ne vois plus ses membres ni ses intentions.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => {
            void leaveGroup(group.id).then((result) => {
              if (!result.ok) {
                setNotice(result.message);
                return;
              }
              if (router.canGoBack()) router.back();
              else router.replace('/communaute');
            });
          },
        },
      ],
    );
  };

  const kindIcon = KIND_ICONS[group.kind];
  const canInvite = !group.ended;
  const sections: { id: Tab; label: string; count?: number }[] = [
    { id: 'prier', label: 'Prier' },
    { id: 'intentions', label: 'Intentions', count: intentions.length || undefined },
    { id: 'groupe', label: 'Le groupe' },
  ];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
      >
        {/* L'en-tête : le type de groupe, son nom, ce qu'il est et ce qu'il devient */}
        <View style={styles.header}>
          <View style={styles.kindIcon}>
            <Ionicons name={kindIcon} size={30} color={C.gold} />
          </View>
          <Text style={styles.name}>{group.name}</Text>
          <View style={styles.pills}>
            <Text style={[styles.pill, styles.pillKind]}>{kindLabel(group.kind)}</Text>
            <Text style={styles.pill}>{memberCountLabel(group.memberCount)}</Text>
            {isMember && group.myRole ? <Text style={styles.pill}>{roleLabel(group.myRole)}</Text> : null}
          </View>
          {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
          {end ? <Text style={styles.meta}>{end}</Text> : null}
        </View>

        {group.ended ? (
          <Text style={styles.notice}>Ce groupe est terminé : il reste en lecture seule, sans nouvelle intention ni nouveau membre.</Text>
        ) : null}

        {!isMember ? (
          group.myStatus === 'requested' && group.kind === 'communaute' && !group.ended ? (
            <View style={styles.welcome}>
              <View style={styles.welcomeIcon}>
                <Ionicons name="paper-plane-outline" size={26} color={C.gold} />
              </View>
              <Text style={styles.welcomeTitle}>Demande envoyée</Text>
              <Text style={styles.welcomeText}>
                Le propriétaire ou un modérateur peut l’accepter ou la refuser. Tu verras le groupe apparaître dans « Mes groupes » dès
                qu’elle est acceptée.
              </Text>
              <Button label="Annuler ma demande" kind="secondary" busy={busy} onPress={() => void act(() => cancelRequest(group.id))} />
            </View>
          ) : (
            <View style={styles.welcome}>
              <Text style={styles.welcomeHead}>En rejoignant le groupe</Text>
              <View style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="calendar-outline" size={18} color={C.gold} />
                </View>
                <Text style={styles.benefitText}>Tu retrouves les rendez-vous de prière et les neuvaines</Text>
              </View>
              <View style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="heart-outline" size={18} color={C.gold} />
                </View>
                <Text style={styles.benefitText}>Tu confies des intentions et tu portes celles des autres</Text>
              </View>
              <View style={styles.privacy}>
                <Ionicons name="lock-closed-outline" size={18} color={C.muted} />
                <Text style={styles.privacyText}>Seuls les membres voient les pseudos et les intentions du groupe.</Text>
              </View>
              {group.ended ? null : group.kind === 'communaute' ? (
                <>
                  <Button label="Demander à rejoindre" busy={busy} onPress={() => void act(() => requestJoin(group.id))} />
                  <Text style={styles.hintCenter}>Le propriétaire ou un modérateur peut accepter ou refuser ta demande.</Text>
                </>
              ) : (
                <Button label="Rejoindre" busy={busy} onPress={() => void act(() => joinGroup(group.id))} />
              )}
            </View>
          )
        ) : (
          <>
            <View style={styles.actions}>
              {canInvite ? <HeaderAction icon="share-social-outline" label="Inviter" onPress={() => setTab('groupe')} /> : null}
              <HeaderAction
                icon="people-outline"
                label="Membres"
                onPress={() => router.push({ pathname: '/groupe/membres', params: { id: group.id } })}
              />
              {moderator ? (
                <HeaderAction
                  icon="options-outline"
                  label="Réglages"
                  badge={group.pendingRequests + group.pendingReports}
                  onPress={() => router.push({ pathname: '/groupe/reglages', params: { id: group.id } })}
                />
              ) : null}
            </View>

            <View style={styles.tabs} accessibilityRole="tablist">
              {sections.map((section) => (
                <Pressable
                  key={section.id}
                  onPress={() => setTab(section.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === section.id }}
                  style={[styles.tab, tab === section.id && styles.tabOn]}
                >
                  <Text style={[styles.tabText, tab === section.id && styles.tabTextOn]}>
                    {section.label}
                    {section.count ? <Text style={styles.tabCount}> {section.count}</Text> : null}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'prier' ? (
              <>
                <SectionHead
                  title="Rendez-vous"
                  action={
                    moderator && !group.ended
                      ? { label: '+ Nouveau', onPress: () => router.push({ pathname: '/groupe/rendez-vous', params: { id: group.id } }) }
                      : undefined
                  }
                />
                {gatherings.length === 0 ? <Text style={styles.muted}>Aucun rendez-vous de prière pour l’instant.</Text> : null}
                <AllowNotifications granted={reminders.granted} ask={reminders.ask} />
                <ExactAlarmNote visible={reminders.granted === true && gatherings.some((g) => g.participating)} />
                <View style={styles.list}>
                  {gatherings.map((item) => (
                    <GatheringCard
                      key={item.id}
                      gathering={item}
                      granted={reminders.granted}
                      ended={group.ended}
                      canManage={moderator}
                      busy={busyGatherings[item.id] ?? null}
                      onParticipate={(on) =>
                        void gatheringAction(
                          item,
                          'participate',
                          (list) => withParticipation(list, item.id, on),
                          () => setParticipation(item.id, on),
                        )
                      }
                      onPresent={() =>
                        void gatheringAction(
                          item,
                          'present',
                          (list) => withPresence(list, item.id),
                          () => markPresent(item.id),
                          // Après « Je suis là », on entre directement dans la salle.
                          () => openRoom(item.id),
                        )
                      }
                      onEnterRoom={() => openRoom(item.id)}
                      onEdit={() => router.push({ pathname: '/groupe/rendez-vous', params: { id: group.id, gathering: item.id } })}
                      onCancel={() =>
                        confirm(
                          'Annuler ce rendez-vous ?',
                          'Il disparaît pour tous les membres, et les rappels s’arrêtent.',
                          'Oui, annuler',
                          () => cancelGathering(item.id),
                        )
                      }
                    />
                  ))}
                </View>

                <SectionHead
                  title="Neuvaines"
                  action={
                    moderator && !group.ended && activeNovenas < MAX_ACTIVE_NOVENAS
                      ? {
                          label: '+ Lancer',
                          onPress: () => router.push({ pathname: '/groupe/neuvaine-nouvelle', params: { id: group.id } }),
                        }
                      : undefined
                  }
                />
                {novenas.length === 0 ? <Text style={styles.muted}>Aucune neuvaine pour l’instant.</Text> : null}
                <View style={styles.list}>
                  {novenas.map((item) => (
                    <NovenaCard key={item.id} novena={item} />
                  ))}
                </View>
                {moderator && !group.ended && activeNovenas >= MAX_ACTIVE_NOVENAS ? (
                  <Text style={styles.hint}>Ce groupe a déjà {MAX_ACTIVE_NOVENAS} neuvaines en cours.</Text>
                ) : null}

                <SectionHead
                  title="Rosaire vivant"
                  action={moderator && !group.ended && !rosary ? { label: '+ Lancer', onPress: launchRosary } : undefined}
                />
                {rosary ? <LivingRosaryCard rosary={rosary} /> : <Text style={styles.muted}>Pas de Rosaire vivant pour l’instant.</Text>}

                <SectionHead
                  title="Chaîne d’adoration"
                  action={
                    moderator && !group.ended && activeChains < MAX_ACTIVE_CHAINS
                      ? {
                          label: '+ Organiser',
                          onPress: () => router.push({ pathname: '/groupe/adoration-nouvelle', params: { id: group.id } }),
                        }
                      : undefined
                  }
                />
                {chains.length === 0 ? <Text style={styles.muted}>Aucune chaîne d’adoration pour l’instant.</Text> : null}
                <View style={styles.list}>
                  {chains.map((item) => (
                    <AdorationChainCard key={item.id} chain={item} />
                  ))}
                </View>
                {moderator && !group.ended && activeChains >= MAX_ACTIVE_CHAINS ? (
                  <Text style={styles.hint}>Ce groupe a déjà {MAX_ACTIVE_CHAINS} chaînes d’adoration à venir ou en cours.</Text>
                ) : null}
              </>
            ) : null}

            {tab === 'intentions' ? (
              <>
                {group.ended ? null : (
                  <View style={[styles.card, styles.composer]}>
                    <Text style={styles.cardTitle}>Confier une intention</Text>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Une intention pour le groupe…"
                      placeholderTextColor={C.faint}
                      style={styles.input}
                      multiline
                      maxLength={INTENTION_MAX}
                    />
                    <Text style={styles.hint}>Seuls les membres du groupe la voient, avec ton pseudo.</Text>
                    <Button label="Confier au groupe" onPress={() => void send()} disabled={!draft.trim()} busy={sending} />
                  </View>
                )}

                <SectionHead title="Intentions du groupe" />
                {intentions.length === 0 ? <Text style={styles.muted}>Aucune intention pour l’instant.</Text> : null}
                <View style={styles.list}>
                  {intentions.map((item) => (
                    <View key={item.id} style={styles.card}>
                      <Pressable
                        onPress={() => item.handle && openProfile(item.handle)}
                        style={styles.authorRow}
                        accessibilityRole="button"
                        accessibilityLabel={item.mine ? 'Ton profil' : `Profil de @${item.handle}`}
                      >
                        <Avatar handle={item.mine ? profile?.handle : item.handle} size={36} />
                        <Text style={styles.author}>{item.mine ? 'Toi' : `@${item.handle}`}</Text>
                      </Pressable>
                      {item.gatheringTitle ? <Text style={styles.hint}>Pendant « {item.gatheringTitle} »</Text> : null}
                      <Text style={styles.body}>{item.body}</Text>
                      {item.answeredAt ? (
                        <View style={styles.answered}>
                          <View style={styles.answeredHead}>
                            <Ionicons name="checkmark-circle" size={18} color={C.gold} />
                            <Text style={styles.answeredTitle}>Prière exaucée</Text>
                          </View>
                          {item.thanks ? <Text style={styles.thanks}>{item.thanks}</Text> : null}
                        </View>
                      ) : null}
                      {item.hidden ? (
                        <Text style={styles.hint}>Plusieurs membres l’ont signalée : les autres ne la voient plus.</Text>
                      ) : null}
                      <Text style={styles.count}>{carried(item.carries)}</Text>

                      {answering?.id === item.id ? (
                        <View style={{ gap: 8 }}>
                          <TextInput
                            value={answering.text}
                            onChangeText={(text) => setAnswering({ id: item.id, text })}
                            placeholder="Un mot d’action de grâce (facultatif)"
                            placeholderTextColor={C.faint}
                            style={styles.input}
                            multiline
                            maxLength={THANKS_MAX}
                          />
                          <View style={styles.row}>
                            <Pressable onPress={() => setAnswering(null)} hitSlop={8}>
                              <Text style={styles.link}>Annuler</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => void saveThanks()}
                              style={styles.carry}
                              accessibilityLabel="Enregistrer l’action de grâce"
                            >
                              <Text style={styles.carryText}>Enregistrer</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.row}>
                          {item.mine ? (
                            <>
                              <Pressable
                                onPress={() => setAnswering({ id: item.id, text: item.thanks ?? '' })}
                                style={styles.carry}
                                accessibilityLabel={item.answeredAt ? 'Modifier l’action de grâce' : 'Prière exaucée'}
                              >
                                <Ionicons name="checkmark-circle-outline" size={16} color={C.gold} />
                                <Text style={styles.carryText}>{item.answeredAt ? 'Action de grâce' : 'Prière exaucée'}</Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  confirm('Retirer cette intention ?', 'Elle disparaît pour les membres du groupe.', 'Retirer', () =>
                                    withdrawGroupIntention(item.id),
                                  )
                                }
                                hitSlop={8}
                                accessibilityLabel="Retirer ton intention"
                              >
                                <Text style={styles.link}>Retirer</Text>
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <Pressable
                                onPress={() => toggleCarry(item)}
                                style={[styles.carry, item.carrying && styles.carryOn]}
                                accessibilityLabel={item.carrying ? 'Ne plus porter cette intention' : 'Je la porte'}
                              >
                                <Ionicons
                                  name={item.carrying ? 'heart' : 'heart-outline'}
                                  size={16}
                                  color={item.carrying ? C.onGold : C.gold}
                                />
                                <Text style={[styles.carryText, item.carrying && styles.carryTextOn]}>Je la porte</Text>
                              </Pressable>
                              <View style={styles.links}>
                                {moderator ? (
                                  <Pressable
                                    onPress={() =>
                                      confirm(
                                        'Retirer cette intention ?',
                                        'Elle disparaît pour tous les membres du groupe.',
                                        'Retirer',
                                        () => removeGroupIntention(item.id),
                                      )
                                    }
                                    hitSlop={8}
                                    accessibilityLabel="Retirer cette intention en tant que modérateur"
                                  >
                                    <Text style={styles.link}>Retirer</Text>
                                  </Pressable>
                                ) : null}
                                <Pressable
                                  onPress={() =>
                                    ask({
                                      title: 'Signaler cette intention ?',
                                      message: 'Trois signalements la masquent.',
                                      send: (reason) => void act(() => reportGroupIntention(item.id, reason)),
                                    })
                                  }
                                  hitSlop={8}
                                  accessibilityLabel="Signaler cette intention"
                                >
                                  <Text style={styles.link}>Signaler</Text>
                                </Pressable>
                              </View>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {tab === 'groupe' ? (
              <>
                {canInvite && group.inviteCode ? (
                  <>
                    <SectionHead title="Inviter" />
                    <View style={styles.inviteCard}>
                      <Text style={styles.inviteKicker}>CODE D’INVITATION</Text>
                      <Text style={styles.code} selectable>
                        {formatInviteCode(group.inviteCode)}
                      </Text>
                      <Text style={styles.muted}>
                        Toute personne qui a ce code ou ce lien entre directement dans le groupe, sans validation. Ne le partage qu’avec des
                        personnes de confiance. Le propriétaire peut le changer dans les réglages.
                      </Text>
                      <Button label="Partager le lien et le code" onPress={() => void share()} />
                    </View>
                  </>
                ) : null}

                <SectionHead title="Gérer" />
                <View style={styles.entries}>
                  <Entry
                    icon="people-outline"
                    label="Membres"
                    hint={memberCountLabel(group.memberCount)}
                    onPress={() => router.push({ pathname: '/groupe/membres', params: { id: group.id } })}
                  />
                  {moderator ? (
                    <Entry
                      icon="options-outline"
                      label="Réglages du groupe"
                      hint={
                        group.myRole === 'owner'
                          ? 'Nom, description, code d’invitation, signalements'
                          : 'Demandes, signalements, personnes bannies'
                      }
                      badge={group.pendingRequests + group.pendingReports}
                      onPress={() => router.push({ pathname: '/groupe/reglages', params: { id: group.id } })}
                    />
                  ) : null}
                  <GroupNotificationsEntry groupId={group.id} />
                </View>
                <Pressable onPress={leave} style={styles.leave} accessibilityRole="button">
                  <Text style={styles.leaveText}>Quitter le groupe</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}

        {notice ? <Text style={styles.noticeError}>{notice}</Text> : null}
      </ScrollView>
      {sheet}
    </KeyboardAvoidingView>
  );
}

/** Un des boutons sous l'en-tête : Inviter, Membres, Réglages (avec la pastille des demandes et des signalements à traiter). */
function HeaderAction({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} à traiter` : label}
    >
      <Ionicons name={icon} size={20} color={C.gold} />
      <Text style={styles.actionLabel}>{label}</Text>
      {badge ? (
        <View style={styles.actionBadge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Entry({
  icon,
  label,
  hint,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  badge?: number;
  onPress: () => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entry, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      <View style={styles.entryIcon}>
        <Ionicons name={icon} size={20} color={C.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryLabel}>{label}</Text>
        {hint ? <Text style={styles.entryHint}>{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    header: { gap: 4 },
    kindIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: C.highlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    name: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 38, fontWeight: '700' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    pill: {
      color: C.muted,
      fontSize: 13,
      fontWeight: '600',
      borderWidth: 1,
      borderColor: C.line,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    pillKind: { color: C.gold, fontWeight: '700', backgroundColor: C.highlight, borderColor: 'transparent' },
    meta: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },
    description: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18, paddingTop: 15 },
    hintCenter: { color: C.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    notice: { color: C.text, backgroundColor: C.highlight, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, marginTop: 16 },
    noticeError: { color: C.red, fontSize: 14, textAlign: 'center', marginTop: 16 },
    welcome: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 12, marginTop: 24 },
    welcomeIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: C.highlight,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    welcomeTitle: { color: C.text, fontFamily: SERIF, fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
    welcomeText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    welcomeHead: { color: C.text, fontSize: 18, fontWeight: '800' },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    benefitText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 },
    privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.cardHi, borderRadius: 14, padding: 14 },
    privacyText: { color: C.muted, fontSize: 14, lineHeight: 20, flex: 1 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    action: { flex: 1, height: 64, backgroundColor: C.card, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
    actionLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
    actionBadge: {
      position: 'absolute',
      top: 8,
      right: 10,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.gold,
    },
    tabs: { flexDirection: 'row', gap: 4, backgroundColor: C.cardHi, borderRadius: 16, padding: 4, marginTop: 18 },
    tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    tabOn: { backgroundColor: C.card },
    tabText: { color: C.muted, fontSize: 15, fontWeight: '600' },
    tabTextOn: { color: C.gold, fontWeight: '800' },
    tabCount: { color: C.faint, fontSize: 12, fontWeight: '600' },
    list: { gap: 10 },
    card: { backgroundColor: C.card, borderRadius: 20, padding: 18, gap: 10 },
    composer: { marginTop: 24 },
    cardTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
    author: { color: C.text, fontSize: 15, fontWeight: '700' },
    body: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 27 },
    count: { color: C.muted, fontSize: 13, fontWeight: '600' },
    answered: { backgroundColor: C.highlight, borderRadius: 14, padding: 14, gap: 6 },
    answeredHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    answeredTitle: { color: C.gold, fontSize: 14, fontWeight: '800' },
    thanks: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, lineHeight: 24 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    links: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    carry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      borderWidth: 1,
      borderColor: C.gold,
      borderRadius: 22,
      paddingHorizontal: 18,
    },
    carryOn: { backgroundColor: C.gold },
    carryText: { color: C.gold, fontWeight: '800', fontSize: 14 },
    carryTextOn: { color: C.onGold },
    link: { color: C.faint, fontSize: 13, fontWeight: '700' },
    input: {
      minHeight: 46,
      maxHeight: 140,
      color: C.text,
      fontSize: 16,
      backgroundColor: C.cardHi,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    inviteCard: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8 },
    inviteKicker: { color: C.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
    code: { color: C.gold, fontFamily: SERIF, fontSize: 34, lineHeight: 42, fontWeight: '700', letterSpacing: 3 },
    entries: { backgroundColor: C.card, borderRadius: 20, overflow: 'hidden' },
    entry: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
    entryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    entryLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
    entryHint: { color: C.muted, fontSize: 13, lineHeight: 18 },
    leave: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 24 },
    leaveText: { color: C.red, fontSize: 15, fontWeight: '700' },
    badge: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.gold,
    },
    badgeText: { color: C.onGold, fontSize: 13, fontWeight: '800' },
  });
