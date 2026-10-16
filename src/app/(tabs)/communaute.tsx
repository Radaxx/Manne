import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { UpcomingGatheringRows, useUpcomingGatherings } from '../../gathering-ui';
import { GroupRow, openGroup } from '../../group-ui';
import { type GroupCard, listMyGroups, type MyGroup, searchGroups } from '../../groups';
import { type FoundProfile, findProfile, listFollowing, normalizeHandle, type ProfileCard } from '../../profile';
import { Button, openProfile, PersonRow } from '../../profile-ui';
import { useThemed } from '../../theme';

export default function CommunauteScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { configured, status, profile, profileLoaded } = useAuth();
  const [following, setFollowing] = useState<ProfileCard[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // `undefined` : pas de recherche faite ; `null` : personne ne porte ce pseudo.
  const [found, setFound] = useState<FoundProfile | null | undefined>(undefined);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [groupsOffline, setGroupsOffline] = useState<string | null>(null);
  const [groupQuery, setGroupQuery] = useState('');
  const [groupSearching, setGroupSearching] = useState(false);
  // `undefined` : pas de recherche faite.
  const [groupResults, setGroupResults] = useState<GroupCard[] | undefined>(undefined);
  const [groupError, setGroupError] = useState<string | null>(null);
  const hasProfile = status === 'signedIn' && !!profile;
  // Mes prochains rendez-vous (inscriptions) : les 3 plus proches, section masquée s'il n'y en a pas.
  const upcoming = useUpcomingGatherings(hasProfile);

  const load = useCallback(async () => {
    if (!hasProfile) {
      setFollowing(null);
      setGroups(null);
      return;
    }
    const [people, mine] = await Promise.all([listFollowing(), listMyGroups()]);
    if (!people.ok) {
      setOffline(people.message);
      setFollowing([]);
    } else {
      setOffline(null);
      setFollowing(people.people);
    }
    if (!mine.ok) {
      setGroupsOffline(mine.message);
      setGroups([]);
    } else {
      setGroupsOffline(null);
      setGroups(mine.groups);
    }
  }, [hasProfile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const search = async () => {
    const handle = normalizeHandle(query);
    if (!handle || searching) return;
    setSearching(true);
    setSearchError(null);
    const result = await findProfile(handle);
    setSearching(false);
    if (!result.ok) {
      setSearchError(result.message);
      setFound(undefined);
      return;
    }
    setFound(result.found);
  };

  const searchGroup = async () => {
    const text = groupQuery.trim();
    if (text.length < 2 || groupSearching) return;
    setGroupSearching(true);
    setGroupError(null);
    const result = await searchGroups(text);
    setGroupSearching(false);
    if (!result.ok) {
      setGroupError(result.message);
      setGroupResults(undefined);
      return;
    }
    setGroupResults(result.groups);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <Text style={styles.title}>Communauté</Text>
            <Pressable onPress={() => router.push('/profil')} hitSlop={10} accessibilityLabel="Mon profil">
              <Avatar handle={profile?.handle} size={36} />
            </Pressable>
          </View>

          {!configured ? (
            <Text style={styles.muted}>La communauté n’est pas disponible pour le moment.</Text>
          ) : status === 'signedIn' && !profileLoaded ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} />
          ) : !hasProfile ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Crée ton profil</Text>
              <Text style={styles.muted}>
                Choisis un pseudo pour retrouver des proches, les suivre et rejoindre des groupes de prière. Les membres d’un groupe voient
                ton pseudo.
              </Text>
              <Button
                label="Créer mon profil"
                onPress={() => router.push(status === 'signedIn' ? '/inscription/pseudo' : '/inscription')}
              />
            </View>
          ) : (
            <>
              {upcoming.length > 0 ? (
                <>
                  <Text style={[styles.section, { marginTop: 8 }]}>Prochains rendez-vous</Text>
                  <UpcomingGatheringRows items={upcoming} />
                </>
              ) : null}

              <Text style={[styles.section, upcoming.length === 0 && { marginTop: 8 }]}>Mes groupes</Text>
              {groups === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 12 }} /> : null}
              {groupsOffline ? <Text style={styles.muted}>{groupsOffline}</Text> : null}
              {groups && groups.length === 0 && !groupsOffline ? (
                <Text style={styles.muted}>Tu n’es dans aucun groupe pour l’instant.</Text>
              ) : null}
              {groups?.map((group) => (
                <GroupRow
                  key={group.id}
                  name={group.name}
                  kind={group.kind}
                  memberCount={group.memberCount}
                  note={group.ended ? 'terminé' : undefined}
                  badge={group.pendingRequests}
                  onPress={() => openGroup(group.id)}
                />
              ))}
              <Button label="Créer un groupe" onPress={() => router.push('/groupe/nouveau')} />
              <Button label="Rejoindre avec un code" kind="secondary" onPress={() => router.push('/groupe/rejoindre')} />

              <Text style={styles.section}>Trouver un groupe par son nom</Text>
              <Text style={styles.muted}>
                On trouve les communautés et les groupes éphémères. Une fraternité reste introuvable : on y entre avec son code.
              </Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={groupQuery}
                  onChangeText={(value) => {
                    setGroupQuery(value);
                    setGroupResults(undefined);
                  }}
                  onSubmitEditing={() => void searchGroup()}
                  placeholder="Nom du groupe"
                  placeholderTextColor={C.faint}
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.input}
                />
                <Pressable
                  onPress={() => void searchGroup()}
                  disabled={groupQuery.trim().length < 2 || groupSearching}
                  accessibilityLabel="Chercher un groupe"
                  style={[styles.searchBtn, (groupQuery.trim().length < 2 || groupSearching) && { opacity: 0.4 }]}
                >
                  {groupSearching ? <ActivityIndicator color={C.onGold} /> : <Ionicons name="search" size={20} color={C.onGold} />}
                </Pressable>
              </View>
              {groupError ? <Text style={styles.error}>{groupError}</Text> : null}
              {groupResults && groupResults.length === 0 ? <Text style={styles.muted}>Aucun groupe avec ce nom.</Text> : null}
              {groupResults?.map((group) => (
                <GroupRow
                  key={group.id}
                  name={group.name}
                  kind={group.kind}
                  memberCount={group.memberCount}
                  note={group.myStatus === 'member' ? 'tu en fais partie' : group.myStatus === 'requested' ? 'demande envoyée' : undefined}
                  onPress={() => openGroup(group.id)}
                />
              ))}

              <Text style={styles.section}>Trouver quelqu’un par son pseudo</Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    setFound(undefined);
                  }}
                  onSubmitEditing={() => void search()}
                  placeholder="Son pseudo exact"
                  placeholderTextColor={C.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="search"
                  style={styles.input}
                />
                <Pressable
                  onPress={() => void search()}
                  disabled={!normalizeHandle(query) || searching}
                  accessibilityLabel="Chercher"
                  style={[styles.searchBtn, (!normalizeHandle(query) || searching) && { opacity: 0.4 }]}
                >
                  {searching ? <ActivityIndicator color={C.onGold} /> : <Ionicons name="search" size={20} color={C.onGold} />}
                </Pressable>
              </View>
              {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
              {found === null ? <Text style={styles.muted}>Aucun profil avec ce pseudo.</Text> : null}
              {found ? (
                <PersonRow
                  person={{ ...found, note: found.following ? 'tu le suis' : undefined }}
                  onPress={() => openProfile(found.handle)}
                />
              ) : null}

              <Text style={styles.section}>Tu suis</Text>
              {following === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 12 }} /> : null}
              {offline ? <Text style={styles.muted}>{offline}</Text> : null}
              {following && following.length === 0 && !offline ? (
                <Text style={styles.muted}>Tu ne suis personne pour l’instant. Chercher un pseudo est le plus simple pour commencer.</Text>
              ) : null}
              {following?.map((person) => (
                <PersonRow key={person.handle} person={person} onPress={() => openProfile(person.handle)} />
              ))}
            </>
          )}

          <Pressable onPress={() => router.push('/intentions')} style={({ pressed }) => [styles.intentions, pressed && { opacity: 0.75 }]}>
            <Ionicons name="heart-outline" size={24} color={C.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Intentions confiées</Text>
              <Text style={styles.muted}>Confie une intention, ou porte celle d’un autre. Elles restent anonymes.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40, gap: 4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { color: C.text, fontSize: 28, fontWeight: '800' },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    error: { color: C.red, fontSize: 14, marginBottom: 6 },
    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    input: {
      flex: 1,
      color: C.text,
      backgroundColor: C.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: C.line,
    },
    searchBtn: { width: 48, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    intentions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 16,
      marginTop: 24,
    },
  });
