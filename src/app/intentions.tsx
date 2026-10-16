import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '../appearance';
import { listIntentions, postIntention, reportIntention, type SharedIntention, setCarry, withdrawIntention } from '../community';
import { haptic } from '../haptics';
import { useKeyboardOverlap } from '../keyboard';
import { setIntentionShown, useMyShowcase } from '../showcase-store';
import { ShowSwitch } from '../showcase-ui';
import { Text, TextInput } from '../text';
import { useThemed } from '../theme';

const carried = (n: number) => (n === 0 ? 'Personne ne la porte encore' : n === 1 ? '1 personne la porte' : `${n} personnes la portent`);

export default function IntentionsScreen() {
  const { C, styles } = useThemed(stylesFor);
  const params = useLocalSearchParams<{ draft?: string | string[] }>();
  const prefill = (Array.isArray(params.draft) ? params.draft[0] : params.draft)?.trim().slice(0, 280) ?? '';
  const [intentions, setIntentions] = useState<SharedIntention[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [draft, setDraft] = useState(prefill);
  const [sending, setSending] = useState(false);
  const keyboard = useKeyboardOverlap();
  const [notice, setNotice] = useState<string | null>(null);
  const [onProfile, setOnProfile] = useState(false);
  const mine = useMyShowcase();

  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);

  const load = useCallback(async () => {
    const result = await listIntentions();
    if (!result.ok) {
      setIntentions([]);
      setOffline(result.message);
      return;
    }
    setOffline(null);
    setIntentions(result.intentions);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    const result = await postIntention(body);
    setSending(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setDraft('');
    const wantsProfile = onProfile;
    setOnProfile(false);
    if (wantsProfile && typeof result.data === 'string') {
      const shown = await setIntentionShown(result.data, true);
      if (!shown.ok) setNotice(`Ton intention est confiée, mais elle n’est pas affichée sur ton profil. ${shown.message}`);
    }
    await load();
  };

  const toggleCarry = (item: SharedIntention) => {
    haptic();
    const next = !item.carrying;
    setIntentions(
      (list) =>
        list?.map((row) => (row.id === item.id ? { ...row, carrying: next, carries: Math.max(0, row.carries + (next ? 1 : -1)) } : row)) ??
        list,
    );
    void setCarry(item.id, next).then((result) => {
      if (!result.ok) {
        setNotice(result.message);
        void load();
      }
    });
  };

  const withdraw = (id: string) => {
    Alert.alert('Retirer cette intention ?', 'Elle disparaît pour les autres. La tienne, sur cet appareil, reste.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          void withdrawIntention(id).then((result) => {
            if (!result.ok) setNotice(result.message);
            else {
              void mine.refresh();
              void load();
            }
          });
        },
      },
    ]);
  };

  const report = (id: string) => {
    Alert.alert('Signaler cette intention ?', 'Trois signalements la retirent.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Signaler',
        style: 'destructive',
        onPress: () => {
          void reportIntention(id).then((result) => {
            if (!result.ok) setNotice(result.message);
            else void load();
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View ref={keyboard.ref} style={{ flex: 1, paddingBottom: keyboard.overlap }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            <Text style={styles.lead}>Une intention confiée, pour que quelqu’un la porte avec toi. Rien ne part sans ton geste.</Text>
            {intentions === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} /> : null}
            {offline ? <Text style={styles.muted}>{offline}</Text> : null}
            {intentions && intentions.length === 0 && !offline ? (
              <Text style={styles.muted}>Aucune intention confiée pour l’instant. La première peut être la tienne.</Text>
            ) : null}
            {intentions?.map((item) => (
              <View key={item.id} style={styles.card}>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.count}>{carried(item.carries)}</Text>
                <View style={styles.row}>
                  {item.mine ? (
                    <>
                      {mine.ready ? (
                        <View style={{ flex: 1 }}>
                          <ShowSwitch on={mine.isIntentionShown(item.id)} change={(next) => setIntentionShown(item.id, next)} />
                        </View>
                      ) : null}
                      <Pressable onPress={() => withdraw(item.id)} hitSlop={8} accessibilityLabel="Retirer ton intention">
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
                        <Ionicons name={item.carrying ? 'heart' : 'heart-outline'} size={16} color={item.carrying ? C.bg : C.gold} />
                        <Text style={[styles.carryText, item.carrying && styles.carryTextOn]}>Je la porte</Text>
                      </Pressable>
                      <Pressable onPress={() => report(item.id)} hitSlop={8} accessibilityLabel="Signaler cette intention">
                        <Text style={styles.link}>Signaler</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
          {mine.canShow ? (
            <Pressable
              onPress={() => setOnProfile((on) => !on)}
              style={styles.profileCheck}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: onProfile }}
            >
              <Ionicons name={onProfile ? 'checkbox' : 'square-outline'} size={22} color={onProfile ? C.gold : C.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileCheckLabel}>Afficher aussi sur mon profil</Text>
                <Text style={styles.profileCheckHint}>
                  Elle reste anonyme dans le fil, mais s’affiche sur ton profil pour les personnes que tu suis et les membres de tes
                  groupes.
                </Text>
              </View>
            </Pressable>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Une personne, une situation…"
              placeholderTextColor={C.faint}
              style={styles.input}
              multiline
              maxLength={280}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!draft.trim() || sending || !!offline}
              style={[styles.send, (!draft.trim() || sending || !!offline) && { opacity: 0.4 }]}
              accessibilityLabel="Confier cette intention"
            >
              <Text style={styles.sendText}>{sending ? '…' : 'Confier'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    list: { padding: 20, gap: 12, paddingBottom: 24 },
    lead: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
    muted: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
    body: { color: C.text, fontSize: 17, lineHeight: 24 },
    count: { color: C.faint, fontSize: 13, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    carry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'rgba(255,209,102,0.45)',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    carryOn: { backgroundColor: C.gold, borderColor: C.gold },
    carryText: { color: C.gold, fontWeight: '700', fontSize: 14 },
    carryTextOn: { color: C.onGold },
    link: { color: C.faint, fontSize: 13, fontWeight: '700' },
    notice: { color: C.red, fontSize: 14, textAlign: 'center' },
    profileCheck: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
    profileCheckLabel: { color: C.text, fontSize: 14, fontWeight: '600' },
    profileCheckHint: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 1 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: C.line,
    },
    input: {
      flex: 1,
      minHeight: 46,
      maxHeight: 120,
      color: C.text,
      fontSize: 16,
      backgroundColor: C.cardHi,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    send: { backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
    sendText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
  });
