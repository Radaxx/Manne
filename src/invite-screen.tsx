import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { NeedProfile, openGroup, useGroupGate } from './group-ui';
import {
  endLabel,
  formatInviteCode,
  groupByCode,
  type InvitedGroup,
  isInviteCode,
  joinByCode,
  kindLabel,
  memberCountLabel,
} from './groups';
import { haptic } from './haptics';
import { Button, FormScreen } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

const UNKNOWN = 'Code d’invitation inconnu.';

/** L'arrivée d'un lien `manne://rejoindre/<code>` ou d'un code saisi : la carte du groupe et « Rejoindre ». */
export function InviteLanding({ code }: { code: string }) {
  const { C, styles } = useThemed(stylesFor);
  const gate = useGroupGate();
  // `undefined` : en cours ; `null` : code inconnu.
  const [group, setGroup] = useState<InvitedGroup | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = isInviteCode(code);

  useEffect(() => {
    if (!gate.ready) return;
    if (!valid) {
      setGroup(null);
      return;
    }
    let alive = true;
    void groupByCode(code).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setError(result.message);
        setGroup(null);
        return;
      }
      setError(null);
      setGroup(result.group);
    });
    return () => {
      alive = false;
    };
  }, [gate.ready, valid, code]);

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) {
    return (
      <FormScreen>
        <NeedProfile />
        <Text style={styles.muted}>
          Ensuite, rouvre le lien d’invitation ou saisis le code : {formatInviteCode(code) || 'celui que tu as reçu'}.
        </Text>
      </FormScreen>
    );
  }
  if (group === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!group) {
    return (
      <FormScreen>
        <Text style={styles.problem}>{error ?? UNKNOWN}</Text>
        <Button label="Saisir un autre code" kind="secondary" onPress={() => router.replace('/groupe/rejoindre')} />
      </FormScreen>
    );
  }

  const end = endLabel(group.endsAt);
  const member = group.myStatus === 'member';
  const blocked = group.ended ? 'Ce groupe est terminé.' : group.full ? 'Ce groupe est complet.' : null;

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await joinByCode(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (!result.groupId) {
      setError(UNKNOWN);
      return;
    }
    haptic('success');
    router.replace({ pathname: '/groupe/[id]', params: { id: result.groupId } });
  };

  return (
    <FormScreen>
      <View style={styles.card}>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.meta}>
          {kindLabel(group.kind)} · {memberCountLabel(group.memberCount)}
        </Text>
        {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
        {end ? <Text style={styles.meta}>{end}</Text> : null}
      </View>
      {member ? (
        <>
          <Text style={styles.muted}>Tu fais déjà partie de ce groupe.</Text>
          <Button label="Ouvrir le groupe" onPress={() => openGroup(group.id)} />
        </>
      ) : blocked ? (
        <Text style={styles.problem}>{blocked}</Text>
      ) : (
        <>
          <Text style={styles.muted}>
            En rejoignant, les membres voient ton pseudo, et ton profil s’ouvre à eux comme aux personnes que tu suis. Ce que tu écris dans
            le groupe n’est vu que par ses membres.
          </Text>
          <Button label="Rejoindre" onPress={() => void join()} busy={busy} />
        </>
      )}
      {error ? <Text style={styles.problem}>{error}</Text> : null}
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 6 },
    name: { color: C.text, fontSize: 22, fontWeight: '800' },
    meta: { color: C.muted, fontSize: 14, fontWeight: '600' },
    description: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 4 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
    problem: { color: C.red, fontSize: 15, lineHeight: 22, marginTop: 8 },
  });
