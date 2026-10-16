import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { Avatar } from '../../avatar';
import { NeedProfile, useGroupGate } from '../../group-ui';
import {
  firstParam,
  type GroupDetail,
  type GroupMember,
  getGroup,
  listMembers,
  memberCountLabel,
  removeMember,
  roleLabel,
  setRole,
  transferOwnership,
} from '../../groups';
import { haptic } from '../../haptics';
import { openProfile } from '../../profile-ui';
import { Text } from '../../text';
import { useThemed } from '../../theme';

type Action = {
  label: string;
  title: string;
  message: string;
  destructive?: boolean;
  run: () => Promise<{ ok: boolean; message?: string }>;
};

export default function MembresScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [detail, listed] = await Promise.all([getGroup(id), listMembers(id)]);
    if (!detail.ok) {
      setError(detail.message);
      setGroup(null);
      return;
    }
    if (!listed.ok) {
      setError(listed.message);
      setGroup(detail.group);
      return;
    }
    setError(null);
    setGroup(detail.group);
    setMembers(listed.members);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (gate.ready) void load();
    }, [gate.ready, load]),
  );

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (group === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;

  const myRole = group?.myRole ?? null;

  /** Ce que je peux faire à ce membre : le propriétaire tout (sauf sur lui-même), un modérateur exclut un simple membre. */
  const actionsFor = (member: GroupMember): Action[] => {
    if (!group || member.mine || member.role === 'owner') return [];
    const handle = member.handle;
    if (myRole === 'owner') {
      return [
        member.role === 'moderator'
          ? {
              label: 'Retirer modérateur',
              title: `Retirer @${handle} des modérateurs ?`,
              message: 'Cette personne reste membre du groupe.',
              run: () => setRole(group.id, handle, 'member'),
            }
          : {
              label: 'Nommer modérateur',
              title: `Nommer @${handle} modérateur ?`,
              message: 'Un modérateur accepte ou refuse les demandes, retire des intentions et exclut des membres.',
              run: () => setRole(group.id, handle, 'moderator'),
            },
        {
          label: 'Transférer',
          title: `Donner le groupe à @${handle} ?`,
          message: 'Cette personne devient propriétaire. Tu deviens modérateur.',
          destructive: true,
          run: () => transferOwnership(group.id, handle),
        },
        {
          label: 'Exclure',
          title: `Exclure @${handle} ?`,
          message: 'Cette personne sort du groupe et ses intentions y sont retirées. Elle peut revenir si elle a le code d’invitation.',
          destructive: true,
          run: () => removeMember(group.id, handle),
        },
      ];
    }
    if (myRole === 'moderator' && member.role === 'member') {
      return [
        {
          label: 'Exclure',
          title: `Exclure @${handle} ?`,
          message: 'Cette personne sort du groupe et ses intentions y sont retirées. Elle peut revenir si elle a le code d’invitation.',
          destructive: true,
          run: () => removeMember(group.id, handle),
        },
      ];
    }
    return [];
  };

  const confirm = (action: Action) => {
    Alert.alert(action.title, action.message, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: action.label,
        style: action.destructive ? 'destructive' : 'default',
        onPress: () => {
          if (busy) return;
          setBusy(true);
          haptic();
          void action.run().then(async (result) => {
            setError(result.ok ? null : (result.message ?? null));
            await load();
            setBusy(false);
          });
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().then(() => setRefreshing(false));
          }}
          tintColor={C.gold}
        />
      }
    >
      {group ? (
        <Text style={styles.muted}>
          {group.name} · {memberCountLabel(group.memberCount)}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {members.map((member) => {
        const actions = actionsFor(member);
        return (
          <View key={member.handle} style={styles.card}>
            <Pressable onPress={() => openProfile(member.handle)} style={styles.person} accessibilityRole="button">
              <Avatar handle={member.handle} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  @{member.handle}
                </Text>
                <Text style={styles.role}>{member.mine ? `${roleLabel(member.role)} · toi` : roleLabel(member.role)}</Text>
              </View>
            </Pressable>
            {actions.length > 0 ? (
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Pressable key={action.label} onPress={() => confirm(action)} hitSlop={6} disabled={busy}>
                    <Text style={[styles.action, action.destructive && styles.danger]}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 8 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
    error: { color: C.red, fontSize: 14 },
    card: { backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 10 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    name: { color: C.text, fontSize: 16, fontWeight: '700' },
    role: { color: C.muted, fontSize: 13, marginTop: 1 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, paddingLeft: 56 },
    action: { color: C.gold, fontSize: 14, fontWeight: '700' },
    danger: { color: C.red },
  });
