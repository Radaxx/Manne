import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SERIF } from './cards';
import { closeEchoes, deleteEcho, type Echo, flushLikes, listEchoes, postEcho, reportEcho, retryFailed, useCommunity } from './community';

const when = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function EchoSheet({ target, reference, onClose }: { target: string; reference: string; onClose: () => void }) {
  const [echoes, setEchoes] = useState<Echo[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listEchoes(target);
    if (!result.ok) {
      setEchoes([]);
      setOffline(result.message);
      return;
    }
    setOffline(null);
    setEchoes(result.echoes);
  }, [target]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = echoes?.find((echo) => echo.mine);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || mine) return;
    setSending(true);
    setNotice(null);
    const result = await postEcho(target, body);
    setSending(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setDraft('');
    await load();
  };

  const remove = (id: string) => {
    Alert.alert('Retirer ton écho ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: () => {
          void deleteEcho(target, id).then((result) => {
            if (!result.ok) setNotice(result.message);
            else void load();
          });
        },
      },
    ]);
  };

  const report = (id: string) => {
    Alert.alert('Signaler cet écho ?', 'Trois signalements le retirent.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Signaler',
        style: 'destructive',
        onPress: () => {
          void reportEcho(target, id).then((result) => {
            if (!result.ok) setNotice(result.message);
            else void load();
          });
        },
      },
    ]);
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} visible>
      <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Échos</Text>
            <Text style={styles.headerRef}>{reference}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
            <Ionicons name="close" size={26} color="#222" />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {echoes === null ? <ActivityIndicator color="#a08a4a" style={{ marginTop: 40 }} /> : null}
            {offline ? <Text style={styles.muted}>{offline}</Text> : null}
            {echoes && echoes.length === 0 && !offline ? (
              <Text style={styles.muted}>Aucun écho pour l’instant. Une phrase, pas un débat.</Text>
            ) : null}
            {echoes?.map((echo) => (
              <View key={echo.id} style={styles.item}>
                {echo.hidden ? (
                  <Text style={styles.hidden}>Ton écho a été retiré après des signalements.</Text>
                ) : (
                  <Text style={styles.body}>{echo.body}</Text>
                )}
                <View style={styles.row}>
                  <Text style={styles.when}>
                    {echo.mine ? 'Toi' : 'Quelqu’un'} · {when(echo.created_at)}
                  </Text>
                  {echo.mine ? (
                    <Pressable onPress={() => remove(echo.id)} hitSlop={8} accessibilityLabel="Retirer ton écho">
                      <Text style={styles.action}>Retirer</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => report(echo.id)} hitSlop={8} accessibilityLabel="Signaler cet écho">
                      <Text style={styles.action}>Signaler</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          </ScrollView>
          {echoes === null || offline || mine ? null : (
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Une méditation, en quelques mots"
                placeholderTextColor="#999"
                style={styles.input}
                multiline
                maxLength={240}
              />
              <Pressable
                onPress={() => void send()}
                disabled={!draft.trim() || sending}
                style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
                accessibilityLabel="Publier cet écho"
              >
                <Text style={styles.sendText}>{sending ? '…' : 'Publier'}</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

/** Session, file d'attente, et la feuille d'échos par-dessus les écrans. */
export function EchoHost() {
  const { echo } = useCommunity();
  useEffect(() => {
    const sync = () => {
      void flushLikes();
      retryFailed();
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, []);
  if (!echo) return null;
  return <EchoSheet target={echo.target} reference={echo.reference} onClose={closeEchoes} />;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#faf7f0' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  headerRef: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  muted: { color: '#777', fontSize: 15, textAlign: 'center', marginTop: 28, paddingHorizontal: 12, lineHeight: 22 },
  item: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 10 },
  body: { fontFamily: SERIF, fontSize: 17, lineHeight: 25, color: '#222' },
  hidden: { fontSize: 15, lineHeight: 22, color: '#888', fontStyle: 'italic' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  when: { color: '#999', fontSize: 12, fontWeight: '600' },
  action: { color: '#a08a4a', fontSize: 13, fontWeight: '700' },
  notice: { color: '#9a4a3a', fontSize: 14, textAlign: 'center', marginTop: 8 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
  },
  send: { backgroundColor: '#2b2b2b', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
