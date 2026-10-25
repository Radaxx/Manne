import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../appearance';
import {
  type Feedback,
  feedbackAuthor,
  feedbackDevice,
  feedbackKindLabel,
  modFeedback,
  modResolveFeedback,
  openFeedbackLabel,
} from '../feedback';
import { haptic } from '../haptics';
import { reasonSummary } from '../moderation';
import { openProfile } from '../profile-ui';
import {
  actionLabel,
  amIModerator,
  authorLabel,
  durationLabel,
  groupNote,
  kindLabel,
  type LogEntry,
  logSubject,
  type ModItem,
  modDismiss,
  modLog,
  modQueue,
  modRemove,
  modRestore,
  modSuspend,
  modSuspensions,
  modUnsuspend,
  removeCopy,
  reportsLabel,
  type Suspension,
  stamp,
  stateLabel,
  untilPhrase,
} from '../publisher-moderation';
import { type SuspendRequest, SuspendSheet } from '../publisher-moderation-ui';
import { Text } from '../text';
import { useThemed } from '../theme';

type Tab = 'traiter' | 'retours' | 'suspensions' | 'journal';
type Gate = 'checking' | 'denied' | 'ok';

const TABS: { id: Tab; label: string }[] = [
  { id: 'traiter', label: 'À traiter' },
  { id: 'retours', label: 'Retours' },
  { id: 'suspensions', label: 'Suspensions' },
  { id: 'journal', label: 'Journal' },
];

type Outcome = { ok: boolean; message?: string };

export default function ModerationScreen() {
  const { C, styles } = useThemed(stylesFor);
  const [gate, setGate] = useState<Gate>('checking');
  const [tab, setTab] = useState<Tab>('traiter');
  const [items, setItems] = useState<ModItem[] | null>(null);
  const [suspensions, setSuspensions] = useState<Suspension[] | null>(null);
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [suspend, setSuspend] = useState<SuspendRequest | null>(null);

  const load = useCallback(async () => {
    if (!(await amIModerator())) {
      setGate('denied');
      return;
    }
    setGate('ok');
    const [queue, list, log, notes] = await Promise.all([modQueue(), modSuspensions(), modLog(100), modFeedback(100)]);
    const failure = [queue, list, log, notes].find((result) => !result.ok);
    setError(failure && !failure.ok ? failure.message : null);
    if (queue.ok) setItems(queue.items);
    if (list.ok) setSuspensions(list.suspensions);
    if (log.ok) setEntries(log.entries);
    if (notes.ok) setFeedback(notes.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const run = async (key: string, task: () => Promise<Outcome>, success: string) => {
    if (busy) return;
    setBusy(key);
    setNotice(null);
    const result = await task();
    if (result.ok) {
      haptic('success');
      setNotice(success);
    } else {
      setNotice(result.message ?? 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.');
    }
    await load();
    setBusy(null);
  };

  const confirm = (title: string, message: string, label: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: label, style: 'destructive', onPress: onConfirm },
    ]);
  };

  const remove = (item: ModItem) => {
    const copy = removeCopy(item.kind);
    confirm(copy.title, copy.message, copy.label, () => void run(`${item.kind}:${item.id}`, () => modRemove(item), 'Élément retiré.'));
  };

  const askSuspend = (item: ModItem) => {
    setSuspend({
      who: item.handle ? `@${item.handle}` : 'ce compte',
      send: (days, reason) =>
        void run(
          `${item.kind}:${item.id}`,
          () => modSuspend(item, days, reason),
          `Compte suspendu (${durationLabel(days).toLowerCase()}).`,
        ),
    });
  };

  const lift = (suspension: Suspension) => {
    const who = suspension.handle ? `@${suspension.handle}` : 'ce compte';
    confirm(
      `Lever la suspension de ${who} ?`,
      'Cette personne pourra de nouveau publier.',
      'Lever la suspension',
      () => void run(`s:${suspension.id}`, () => modUnsuspend(suspension.id), 'Suspension levée.'),
    );
  };

  if (gate === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }
  if (gate === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Cet écran est réservé aux modérateurs de l’éditeur.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={C.gold} />}
      >
        <View style={styles.segment}>
          {TABS.map((entry) => {
            const on = tab === entry.id;
            return (
              <Pressable
                key={entry.id}
                onPress={() => setTab(entry.id)}
                style={[styles.segmentItem, on && styles.segmentOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                  {entry.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {tab === 'traiter' ? (
          <>
            <Text style={styles.muted}>
              {items === null
                ? ''
                : items.length === 0
                  ? 'Rien à traiter.'
                  : `${items.length === 1 ? '1 élément signalé' : `${items.length} éléments signalés`}, les masqués d’abord. Tu vois l’auteur de chaque élément.`}
            </Text>
            {items === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} /> : null}
            {items?.map((item) => {
              const key = `${item.kind}:${item.id}`;
              return (
                <View key={key} style={styles.card}>
                  <View style={styles.head}>
                    <Text style={styles.kind}>{kindLabel(item.kind)}</Text>
                    {item.suspended ? <Text style={styles.flag}>Auteur suspendu</Text> : null}
                  </View>
                  {item.groupName ? <Text style={styles.meta}>{groupNote(item.groupName)}</Text> : null}
                  {item.body ? <Text style={styles.body}>{item.body}</Text> : <Text style={styles.meta}>Bio et paroisse vides.</Text>}
                  {item.handle ? (
                    <Pressable onPress={() => openProfile(item.handle as string)} accessibilityRole="button" hitSlop={6}>
                      <Text style={styles.author}>{authorLabel(item.handle)}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.meta}>{authorLabel(null)}</Text>
                  )}
                  <Text style={styles.meta}>
                    {reportsLabel(item.reports)}
                    {reasonSummary(item.reasons) ? ` · ${reasonSummary(item.reasons)}` : ''}
                  </Text>
                  <Text style={styles.meta}>{stateLabel(item)}</Text>
                  {item.firstReportedAt && item.lastReportedAt ? (
                    <Text style={styles.meta}>
                      {item.firstReportedAt === item.lastReportedAt
                        ? `Signalé le ${stamp(item.firstReportedAt)}`
                        : `Premier signalement le ${stamp(item.firstReportedAt)}, dernier le ${stamp(item.lastReportedAt)}`}
                    </Text>
                  ) : null}
                  <View style={styles.actions}>
                    {item.hidden ? (
                      <Pressable
                        onPress={() => void run(key, () => modRestore(item), 'Élément rétabli.')}
                        disabled={!!busy}
                        hitSlop={6}
                        accessibilityRole="button"
                      >
                        <Text style={styles.action}>Rétablir</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => void run(key, () => modDismiss(item), 'Signalements classés.')}
                        disabled={!!busy}
                        hitSlop={6}
                        accessibilityRole="button"
                      >
                        <Text style={styles.action}>Laisser visible</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => remove(item)} disabled={!!busy} hitSlop={6} accessibilityRole="button">
                      <Text style={[styles.action, styles.danger]}>Retirer</Text>
                    </Pressable>
                    <Pressable onPress={() => askSuspend(item)} disabled={!!busy} hitSlop={6} accessibilityRole="button">
                      <Text style={[styles.action, styles.danger]}>Suspendre l’auteur</Text>
                    </Pressable>
                  </View>
                  {busy === key ? <ActivityIndicator color={C.gold} /> : null}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'retours' ? (
          <>
            <Text style={styles.muted}>
              {feedback === null
                ? ''
                : `${openFeedbackLabel(feedback.filter((item) => !item.resolvedAt).length)}. Les 100 derniers retours des testeurs, les non lus d’abord.`}
            </Text>
            {feedback === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} /> : null}
            {feedback?.map((item) => {
              const key = `retour:${item.id}`;
              const device = feedbackDevice(item);
              return (
                <View key={item.id} style={[styles.card, item.resolvedAt ? styles.read : null]}>
                  <View style={styles.head}>
                    <Text style={styles.kind}>{feedbackKindLabel(item.kind)}</Text>
                    <Text style={styles.meta}>{stamp(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.body} selectable>
                    {item.body}
                  </Text>
                  {item.handle ? (
                    <Pressable onPress={() => openProfile(item.handle as string)} accessibilityRole="button" hitSlop={6}>
                      <Text style={styles.author}>{feedbackAuthor(item)}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.meta}>{feedbackAuthor(item)}</Text>
                  )}
                  {item.contact ? (
                    <Text style={styles.meta} selectable>
                      Répondre à : {item.contact}
                    </Text>
                  ) : null}
                  {device ? <Text style={styles.meta}>{device}</Text> : null}
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() =>
                        void run(
                          key,
                          () => modResolveFeedback(item.id, !item.resolvedAt),
                          item.resolvedAt ? 'Retour remis à lire.' : 'Retour marqué comme lu.',
                        )
                      }
                      disabled={!!busy}
                      hitSlop={6}
                      accessibilityRole="button"
                    >
                      <Text style={styles.action}>{item.resolvedAt ? 'Remettre à lire' : 'Marquer comme lu'}</Text>
                    </Pressable>
                  </View>
                  {busy === key ? <ActivityIndicator color={C.gold} /> : null}
                </View>
              );
            })}
          </>
        ) : null}

        {tab === 'suspensions' ? (
          <>
            <Text style={styles.muted}>
              {suspensions === null
                ? ''
                : suspensions.length === 0
                  ? 'Aucune suspension en cours.'
                  : 'Ces comptes ne peuvent plus rien publier.'}
            </Text>
            {suspensions === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} /> : null}
            {suspensions?.map((suspension) => (
              <View key={suspension.id} style={styles.card}>
                <Text style={styles.author}>{authorLabel(suspension.handle)}</Text>
                <Text style={styles.body}>{suspension.reason}</Text>
                <Text style={styles.meta}>
                  Suspendu {untilPhrase(suspension.until)}
                  {` · depuis le ${stamp(suspension.createdAt)}`}
                  {suspension.suspendedBy ? ` par @${suspension.suspendedBy}` : ''}
                </Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => lift(suspension)} disabled={!!busy} hitSlop={6} accessibilityRole="button">
                    <Text style={styles.action}>Lever la suspension</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {tab === 'journal' ? (
          <>
            <Text style={styles.muted}>
              {entries === null
                ? ''
                : entries.length === 0
                  ? 'Le journal est vide.'
                  : 'Les 100 dernières actions, y compris celles des modérateurs de groupe.'}
            </Text>
            {entries === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} /> : null}
            {entries?.map((entry) => (
              <View key={entry.id} style={styles.card}>
                <Text style={styles.kind}>{actionLabel(entry.action)}</Text>
                <Text style={styles.body}>{logSubject(entry)}</Text>
                {entry.note ? <Text style={styles.meta}>{entry.note}</Text> : null}
                <Text style={styles.meta}>
                  {stamp(entry.createdAt)} · {entry.moderator ? `@${entry.moderator}` : 'compte supprimé'}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      {suspend ? <SuspendSheet request={suspend} onClose={() => setSuspend(null)} /> : null}
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 10 },
    center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
    segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, gap: 4 },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 11 },
    segmentOn: { backgroundColor: C.gold },
    segmentText: { color: C.text, fontSize: 13, fontWeight: '700' },
    segmentTextOn: { color: C.onGold },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    error: { color: C.red, fontSize: 14, lineHeight: 20 },
    notice: { color: C.text, fontSize: 14, lineHeight: 20, backgroundColor: C.card, borderRadius: 12, padding: 12 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 6 },
    read: { opacity: 0.6 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    kind: { color: C.gold, fontSize: 13, fontWeight: '800' },
    flag: { color: C.red, fontSize: 12, fontWeight: '700' },
    body: { color: C.text, fontSize: 16, lineHeight: 23 },
    author: { color: C.text, fontSize: 15, fontWeight: '700' },
    meta: { color: C.muted, fontSize: 13, lineHeight: 18 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 4 },
    action: { color: C.gold, fontSize: 14, fontWeight: '700' },
    danger: { color: C.red },
  });
