import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../appearance';
import { Avatar } from '../../avatar';
import { NeedProfile, useGroupGate } from '../../group-ui';
import {
  answerRequest,
  DESCRIPTION_MAX,
  deleteGroup,
  descriptionProblem,
  firstParam,
  formatInviteCode,
  type GroupDetail,
  type GroupRequest,
  getGroup,
  listRequests,
  NAME_MAX,
  nameProblem,
  regenerateInvite,
  updateGroup,
} from '../../groups';
import { haptic } from '../../haptics';
import { Button, Field, FormScreen } from '../../profile-ui';
import { useThemed } from '../../theme';

export default function ReglagesGroupe() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [requests, setRequests] = useState<GroupRequest[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const filled = useRef(false);

  const load = useCallback(async () => {
    const detail = await getGroup(id);
    if (!detail.ok) {
      setError(detail.message);
      setGroup(null);
      return;
    }
    setGroup(detail.group);
    if (detail.group && !filled.current) {
      // Le texte en cours de frappe ne bouge plus ensuite : on ne le remplit qu'au premier chargement.
      filled.current = true;
      setName(detail.group.name);
      setDescription(detail.group.description);
    }
    if (detail.group?.myRole === 'owner' || detail.group?.myRole === 'moderator') {
      const listed = await listRequests(id);
      if (listed.ok) setRequests(listed.requests);
      else setError(listed.message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (gate.ready) void load();
    }, [gate.ready, load]),
  );

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (group === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!group || (group.myRole !== 'owner' && group.myRole !== 'moderator')) {
    return (
      <FormScreen>
        <Text style={styles.muted}>{error ?? 'Les réglages sont réservés au propriétaire et aux modérateurs du groupe.'}</Text>
      </FormScreen>
    );
  }
  const owner = group.myRole === 'owner';

  const run = async (key: string, task: () => Promise<{ ok: boolean; message?: string }>, success?: string) => {
    if (busy) return false;
    setBusy(key);
    setError(null);
    setMessage(null);
    const result = await task();
    if (!result.ok) setError(result.message ?? null);
    else {
      haptic();
      if (success) setMessage(success);
    }
    await load();
    setBusy(null);
    return result.ok;
  };

  const nameError = name.trim() ? nameProblem(name) : null;
  const descriptionError = descriptionProblem(description);
  const unchanged = name.trim() === group.name && description.trim() === group.description;

  const regenerate = () => {
    Alert.alert(
      'Changer le code d’invitation ?',
      'L’ancien code et l’ancien lien ne marcheront plus. Les membres actuels restent dans le groupe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Changer le code',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (busy) return;
              setBusy('code');
              setError(null);
              const result = await regenerateInvite(group.id);
              if (!result.ok) setError(result.message);
              else if (typeof result.data === 'string') setNewCode(result.data);
              await load();
              setBusy(null);
            })();
          },
        },
      ],
    );
  };

  const remove = () => {
    Alert.alert(
      `Supprimer « ${group.name} » ?`,
      'Le groupe, ses membres et toutes ses intentions sont effacés pour tout le monde. Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer le groupe',
          style: 'destructive',
          onPress: () => {
            void deleteGroup(group.id).then((result) => {
              if (!result.ok) {
                setError(result.message);
                return;
              }
              haptic('success');
              router.replace('/communaute');
            });
          },
        },
      ],
    );
  };

  return (
    <FormScreen>
      {owner ? (
        <>
          <Text style={styles.section}>Nom et description</Text>
          <Field label="Nom" value={name} onChangeText={setName} max={NAME_MAX} error={!!nameError} hint={nameError ?? undefined} />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            max={DESCRIPTION_MAX}
            multiline
            error={!!descriptionError}
            hint={descriptionError ?? undefined}
          />
          <Button
            label="Enregistrer"
            onPress={() => void run('save', () => updateGroup(group.id, name, description), 'Enregistré.')}
            disabled={!!nameProblem(name) || !!descriptionError || unchanged}
            busy={busy === 'save'}
          />
        </>
      ) : null}

      <Text style={styles.section}>Demandes en attente</Text>
      {group.kind !== 'communaute' ? (
        <Text style={styles.muted}>Ce groupe ne reçoit pas de demandes : seule une communauté en reçoit.</Text>
      ) : requests.length === 0 ? (
        <Text style={styles.muted}>Aucune demande pour l’instant.</Text>
      ) : (
        requests.map((request) => (
          <View key={request.handle} style={styles.request}>
            <View style={styles.requestHead}>
              <Avatar handle={request.handle} size={40} />
              <Text style={styles.requestName} numberOfLines={1}>
                @{request.handle}
              </Text>
            </View>
            <Button
              label="Refuser"
              kind="secondary"
              disabled={!!busy}
              onPress={() => void run(`no:${request.handle}`, () => answerRequest(group.id, request.handle, false))}
            />
            <Button
              label="Accepter"
              disabled={!!busy}
              onPress={() => void run(`yes:${request.handle}`, () => answerRequest(group.id, request.handle, true))}
            />
          </View>
        ))
      )}

      {owner ? (
        <>
          <Text style={styles.section}>Code d’invitation</Text>
          <Text style={styles.muted}>
            Changer le code rend l’ancien code et l’ancien lien inutilisables. Le nouveau est visible de tous les membres, depuis « Inviter
            ».
          </Text>
          {newCode ? <Text style={styles.code}>{formatInviteCode(newCode)}</Text> : null}
          <Button label="Changer le code" kind="secondary" onPress={regenerate} busy={busy === 'code'} />

          <Text style={styles.section}>Supprimer le groupe</Text>
          <Text style={styles.muted}>Le groupe, ses membres et ses intentions disparaissent pour tout le monde.</Text>
          <Button label="Supprimer le groupe" kind="secondary" onPress={remove} />
        </>
      ) : null}

      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 6 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    error: { color: C.red, fontSize: 14, marginTop: 10 },
    request: { backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 4, marginTop: 8 },
    requestHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    requestName: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
    code: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginTop: 10 },
  });
