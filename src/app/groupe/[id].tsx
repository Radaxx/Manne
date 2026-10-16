import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Palette } from '../../appearance';
import { NeedProfile, useGroupGate } from '../../group-ui';
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
import { Button, openProfile } from '../../profile-ui';
import { useThemed } from '../../theme';

const carried = (n: number) => (n === 0 ? 'Personne ne la porte encore' : n === 1 ? '1 personne la porte' : `${n} personnes la portent`);

export default function GroupeScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [intentions, setIntentions] = useState<GroupIntention[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
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
      const listed = await listGroupIntentions(id);
      if (listed.ok) setIntentions(listed.intentions);
      else setNotice(listed.message);
    } else {
      setIntentions([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (gate.ready) void load();
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

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <Stack.Screen options={{ title: group.name }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
      >
        <View style={styles.header}>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.meta}>
            {kindLabel(group.kind)} · {memberCountLabel(group.memberCount)}
            {isMember && group.myRole ? ` · ${roleLabel(group.myRole)}` : ''}
          </Text>
          {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
          {end ? <Text style={styles.meta}>{end}</Text> : null}
        </View>

        {group.ended ? (
          <Text style={styles.notice}>Ce groupe est terminé : il reste en lecture seule, sans nouvelle intention ni nouveau membre.</Text>
        ) : null}

        {!isMember ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Seuls les membres voient les pseudos et les intentions du groupe.</Text>
            {group.ended ? null : group.kind === 'communaute' ? (
              group.myStatus === 'requested' ? (
                <>
                  <Text style={styles.cardTitle}>Demande envoyée</Text>
                  <Text style={styles.muted}>Le propriétaire ou un modérateur peut l’accepter ou la refuser.</Text>
                  <Button
                    label="Demande envoyée — Annuler"
                    kind="secondary"
                    busy={busy}
                    onPress={() => void act(() => cancelRequest(group.id))}
                  />
                </>
              ) : (
                <Button label="Demander à rejoindre" busy={busy} onPress={() => void act(() => requestJoin(group.id))} />
              )
            ) : (
              <Button label="Rejoindre" busy={busy} onPress={() => void act(() => joinGroup(group.id))} />
            )}
          </View>
        ) : (
          <>
            {group.ended ? null : (
              <View style={styles.card}>
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

            <Text style={styles.section}>Intentions du groupe</Text>
            {intentions.length === 0 ? <Text style={styles.muted}>Aucune intention pour l’instant.</Text> : null}
            {intentions.map((item) => (
              <View key={item.id} style={styles.card}>
                <Pressable onPress={() => item.handle && openProfile(item.handle)} accessibilityRole="button">
                  <Text style={styles.author}>{item.mine ? 'Toi' : `@${item.handle}`}</Text>
                </Pressable>
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
                {item.hidden ? <Text style={styles.hint}>Plusieurs membres l’ont signalée : les autres ne la voient plus.</Text> : null}
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
                      <Pressable onPress={() => void saveThanks()} style={styles.carry} accessibilityLabel="Enregistrer l’action de grâce">
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
                          <Ionicons name={item.carrying ? 'heart' : 'heart-outline'} size={16} color={item.carrying ? C.onGold : C.gold} />
                          <Text style={[styles.carryText, item.carrying && styles.carryTextOn]}>Je la porte</Text>
                        </Pressable>
                        <View style={styles.links}>
                          {moderator ? (
                            <Pressable
                              onPress={() =>
                                confirm('Retirer cette intention ?', 'Elle disparaît pour tous les membres du groupe.', 'Retirer', () =>
                                  removeGroupIntention(item.id),
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
                              confirm('Signaler cette intention ?', 'Trois signalements la masquent.', 'Signaler', () =>
                                reportGroupIntention(item.id),
                              )
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

            <Text style={styles.section}>Le groupe</Text>
            <Entry
              icon="people-outline"
              label="Membres"
              onPress={() => router.push({ pathname: '/groupe/membres', params: { id: group.id } })}
            />
            {group.ended ? null : <Entry icon="share-outline" label="Inviter" onPress={() => setShowInvite((on) => !on)} />}
            {showInvite && !group.ended && group.inviteCode ? (
              <View style={styles.card}>
                <Text style={styles.code} selectable>
                  {formatInviteCode(group.inviteCode)}
                </Text>
                <Text style={styles.muted}>
                  Toute personne qui a ce code ou ce lien entre directement dans le groupe, sans validation. Ne le partage qu’avec des
                  personnes de confiance. Le propriétaire peut le changer dans les réglages.
                </Text>
                <Button label="Partager le lien et le code" onPress={() => void share()} />
              </View>
            ) : null}
            {moderator ? (
              <Entry
                icon="settings-outline"
                label="Réglages du groupe"
                badge={group.pendingRequests}
                onPress={() => router.push({ pathname: '/groupe/reglages', params: { id: group.id } })}
              />
            ) : null}
            <Button label="Quitter le groupe" kind="quiet" onPress={leave} />
          </>
        )}

        {notice ? <Text style={styles.noticeError}>{notice}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Entry({
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.entry, pressed && { opacity: 0.75 }]} accessibilityRole="button">
      <Ionicons name={icon} size={22} color={C.gold} />
      <Text style={styles.entryLabel}>{label}</Text>
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
    scroll: { padding: 20, paddingBottom: 48, gap: 10 },
    header: { gap: 4, marginBottom: 4 },
    name: { color: C.text, fontSize: 26, fontWeight: '800' },
    meta: { color: C.muted, fontSize: 14, fontWeight: '600' },
    description: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 4 },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 14 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18 },
    notice: { color: C.text, backgroundColor: C.highlight, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20 },
    noticeError: { color: C.red, fontSize: 14, textAlign: 'center' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    author: { color: C.gold, fontSize: 13, fontWeight: '700' },
    body: { color: C.text, fontSize: 17, lineHeight: 24 },
    count: { color: C.faint, fontSize: 13, fontWeight: '600' },
    answered: { backgroundColor: C.highlight, borderRadius: 12, padding: 12, gap: 6, borderLeftWidth: 3, borderLeftColor: C.gold },
    answeredHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    answeredTitle: { color: C.gold, fontSize: 14, fontWeight: '800' },
    thanks: { color: C.text, fontSize: 15, lineHeight: 22 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    links: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    carry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: C.gold,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    carryOn: { backgroundColor: C.gold },
    carryText: { color: C.gold, fontWeight: '700', fontSize: 14 },
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
    code: { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
    entry: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
    entryLabel: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
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
