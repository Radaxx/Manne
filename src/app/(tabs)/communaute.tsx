import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdorationHourRow, useMyAdorationSlots } from '../../adoration-ui';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { SERIF } from '../../cards';
import { UpcomingGatheringRows, useUpcomingGatherings } from '../../gathering-ui';
import { GroupRow, openGroup } from '../../group-ui';
import { type GroupCard, listMyGroups, type MyGroup, searchGroups } from '../../groups';
import { LivingRosaryRows, useMyRosaries } from '../../living-rosary-ui';
import { RunningNovenaRows, useRunningNovenas } from '../../novena-ui';
import { type FoundProfile, findProfile, listFollowing, normalizeHandle, type ProfileCard } from '../../profile';
import { Button, openProfile, PersonRow } from '../../profile-ui';
import { SectionHead } from '../../section';
import { Text, TextInput } from '../../text';
import { useThemed } from '../../theme';

type Scope = 'groupes' | 'personnes';

export default function CommunauteScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { configured, status, profile, profileLoaded } = useAuth();
  const [following, setFollowing] = useState<ProfileCard[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('groupes');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // `undefined` : pas de recherche faite ; `null` : personne ne porte ce pseudo.
  const [found, setFound] = useState<FoundProfile | null | undefined>(undefined);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [groupsOffline, setGroupsOffline] = useState<string | null>(null);
  // `undefined` : pas de recherche faite.
  const [groupResults, setGroupResults] = useState<GroupCard[] | undefined>(undefined);
  const inputRef = useRef<TextInput>(null);
  const hasProfile = status === 'signedIn' && !!profile;
  // Mes prochains rendez-vous (inscriptions) : les 3 plus proches, section masquée s'il n'y en a pas.
  const upcoming = useUpcomingGatherings(hasProfile);
  // Mes neuvaines de groupe en cours aujourd'hui : section masquée s'il n'y en a pas.
  const novenas = useRunningNovenas(hasProfile);
  // Mes Rosaires vivants (où j'ai une place) : mêmes règles.
  const rosaries = useMyRosaries(hasProfile);
  // Mon heure d'adoration : mêmes règles.
  const adoration = useMyAdorationSlots(hasProfile);

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

  const canSearch = scope === 'groupes' ? query.trim().length >= 2 : !!normalizeHandle(query);

  const search = async () => {
    if (!canSearch || searching) return;
    setSearching(true);
    setSearchError(null);
    if (scope === 'groupes') {
      const result = await searchGroups(query.trim());
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.message);
        setGroupResults(undefined);
        return;
      }
      setGroupResults(result.groups);
      return;
    }
    const result = await findProfile(normalizeHandle(query));
    setSearching(false);
    if (!result.ok) {
      setSearchError(result.message);
      setFound(undefined);
      return;
    }
    setFound(result.found);
  };

  const pickScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    setQuery('');
    setSearchError(null);
    setGroupResults(undefined);
    setFound(undefined);
  };

  const onChangeQuery = (value: string) => {
    setQuery(value);
    setGroupResults(undefined);
    setFound(undefined);
  };

  const findSomeone = () => {
    pickScope('personnes');
    inputRef.current?.focus();
  };

  const inUpcoming = upcoming.length > 0 || novenas.length > 0 || rosaries.length > 0 || adoration.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.header}>
            <Text style={styles.title}>Communauté</Text>
            <Pressable onPress={() => router.push('/profil')} hitSlop={6} accessibilityLabel="Mon profil" style={styles.avatar}>
              <Avatar handle={profile?.handle} size={36} />
            </Pressable>
          </View>

          {!configured ? (
            <Text style={styles.muted}>La communauté n’est pas disponible pour le moment.</Text>
          ) : status === 'signedIn' && !profileLoaded ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 16 }} />
          ) : !hasProfile ? (
            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>Crée ton profil</Text>
              <Text style={styles.welcomeText}>
                Choisis un pseudo pour retrouver des proches, les suivre et rejoindre des groupes de prière. Les membres d’un groupe voient
                ton pseudo.
              </Text>
              <View style={styles.benefits}>
                <View style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="people-outline" size={18} color={C.gold} />
                  </View>
                  <Text style={styles.benefitText}>Retrouver des proches et les suivre</Text>
                </View>
                <View style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="lock-closed-outline" size={18} color={C.gold} />
                  </View>
                  <Text style={styles.benefitText}>Rejoindre ou créer un groupe de prière</Text>
                </View>
                <View style={styles.benefit}>
                  <View style={styles.benefitIcon}>
                    <Ionicons name="calendar-outline" size={18} color={C.gold} />
                  </View>
                  <Text style={styles.benefitText}>Prier ensemble : rendez-vous, neuvaines et Rosaire vivant</Text>
                </View>
              </View>
              <Button
                label="Créer mon profil"
                onPress={() => router.push(status === 'signedIn' ? '/inscription/pseudo' : '/inscription')}
              />
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={20} color={C.faint} />
                <TextInput
                  ref={inputRef}
                  value={query}
                  onChangeText={onChangeQuery}
                  onSubmitEditing={() => void search()}
                  placeholder={scope === 'groupes' ? 'Nom du groupe' : 'Son pseudo exact'}
                  placeholderTextColor={C.faint}
                  autoCapitalize={scope === 'groupes' ? 'sentences' : 'none'}
                  autoCorrect={false}
                  spellCheck={false}
                  returnKeyType="search"
                  accessibilityLabel={scope === 'groupes' ? 'Chercher un groupe' : 'Chercher quelqu’un par son pseudo'}
                  style={styles.input}
                />
                <Pressable
                  onPress={() => void search()}
                  disabled={!canSearch || searching}
                  accessibilityLabel="Chercher"
                  style={[styles.searchBtn, (!canSearch || searching) && { opacity: 0.4 }]}
                >
                  {searching ? <ActivityIndicator color={C.onGold} /> : <Ionicons name="arrow-forward" size={20} color={C.onGold} />}
                </Pressable>
              </View>
              <View style={styles.scopes}>
                {(['groupes', 'personnes'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => pickScope(s)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scope === s }}
                    style={[styles.scope, scope === s && styles.scopeOn]}
                  >
                    <Text style={[styles.scopeText, scope === s && styles.scopeTextOn]}>{s === 'groupes' ? 'Groupes' : 'Personnes'}</Text>
                  </Pressable>
                ))}
              </View>
              {scope === 'groupes' ? (
                <Text style={styles.hint}>
                  On trouve les communautés et les groupes éphémères. Une fraternité reste introuvable : on y entre avec son code.
                </Text>
              ) : null}
              {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
              {scope === 'groupes' && groupResults && groupResults.length === 0 ? (
                <Text style={styles.muted}>Aucun groupe avec ce nom.</Text>
              ) : null}
              {scope === 'groupes' && groupResults ? (
                <View style={styles.results}>
                  {groupResults.map((group) => (
                    <GroupRow
                      key={group.id}
                      name={group.name}
                      kind={group.kind}
                      memberCount={group.memberCount}
                      note={
                        group.myStatus === 'member' ? 'tu en fais partie' : group.myStatus === 'requested' ? 'demande envoyée' : undefined
                      }
                      onPress={() => openGroup(group.id)}
                    />
                  ))}
                </View>
              ) : null}
              {scope === 'personnes' && found === null ? <Text style={styles.muted}>Aucun profil avec ce pseudo.</Text> : null}
              {scope === 'personnes' && found ? (
                <View style={styles.results}>
                  <PersonRow
                    person={{ ...found, note: found.following ? 'tu le suis' : undefined }}
                    onPress={() => openProfile(found.handle)}
                  />
                </View>
              ) : null}

              {inUpcoming ? (
                <>
                  <SectionHead title="À venir" />
                  <View style={styles.upcoming}>
                    <UpcomingGatheringRows items={upcoming} />
                    {upcoming.length > 0 && novenas.length > 0 ? <View style={styles.divider} /> : null}
                    <RunningNovenaRows items={novenas} />
                    {rosaries.length > 0 && (upcoming.length > 0 || novenas.length > 0) ? <View style={styles.divider} /> : null}
                    <LivingRosaryRows items={rosaries} />
                    {adoration.length > 0 && (upcoming.length > 0 || novenas.length > 0 || rosaries.length > 0) ? (
                      <View style={styles.divider} />
                    ) : null}
                    <AdorationHourRow items={adoration} />
                  </View>
                </>
              ) : null}

              <SectionHead title="Mes groupes" note={groups && groups.length > 0 ? String(groups.length) : undefined} />
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
              <View style={styles.actions}>
                <Pressable
                  onPress={() => router.push('/groupe/nouveau')}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={20} color={C.onGold} />
                  <Text style={styles.primaryText}>Créer un groupe</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/groupe/rejoindre')}
                  accessibilityRole="button"
                  accessibilityLabel="Rejoindre avec un code"
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryText}>Avec un code</Text>
                </Pressable>
              </View>

              <SectionHead title="Tu suis" action={{ label: 'Trouver quelqu’un', onPress: findSomeone }} />
              {following === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 12 }} /> : null}
              {offline ? <Text style={styles.muted}>{offline}</Text> : null}
              {following && following.length === 0 && !offline ? (
                <Text style={styles.muted}>Tu ne suis personne pour l’instant. Chercher un pseudo est le plus simple pour commencer.</Text>
              ) : null}
              {following && following.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.people}>
                  {following.map((person) => (
                    <Pressable
                      key={person.handle}
                      onPress={() => openProfile(person.handle)}
                      accessibilityRole="button"
                      accessibilityLabel={`Profil de @${person.handle}`}
                      style={({ pressed }) => [styles.person, pressed && styles.pressed]}
                    >
                      <Avatar handle={person.handle} size={60} />
                      <Text style={styles.personName} numberOfLines={1}>
                        @{person.handle}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={findSomeone} accessibilityLabel="Trouver quelqu’un par son pseudo" style={styles.person}>
                    <View style={styles.addPerson}>
                      <Ionicons name="add" size={22} color={C.muted} />
                    </View>
                    <Text style={styles.personName}>Ajouter</Text>
                  </Pressable>
                </ScrollView>
              ) : null}
            </>
          )}

          <Pressable onPress={() => router.push('/intentions')} style={({ pressed }) => [styles.intentions, pressed && styles.pressed]}>
            <View style={styles.intentionsIcon}>
              <Ionicons name="heart-outline" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.intentionsTitle}>Intentions confiées</Text>
              <Text style={styles.muted}>Confie une intention, ou porte celle d’un autre. Elles restent anonymes.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { color: C.text, fontFamily: SERIF, fontSize: 32, lineHeight: 40 },
    avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
    pressed: { opacity: 0.75 },
    welcome: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 20, gap: 8, marginTop: 8 },
    welcomeTitle: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 32, fontWeight: '700', textAlign: 'center' },
    welcomeText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    benefits: { gap: 12, marginTop: 12 },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    benefitText: { color: C.text, fontSize: 15, lineHeight: 21, flex: 1 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      backgroundColor: C.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.line,
      paddingLeft: 16,
      paddingRight: 6,
      marginTop: 8,
    },
    input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 12 },
    searchBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
    scopes: { flexDirection: 'row', gap: 8, marginTop: 10 },
    scope: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 22, backgroundColor: C.card },
    scopeOn: { backgroundColor: C.gold },
    scopeText: { color: C.text, fontSize: 14, fontWeight: '600' },
    scopeTextOn: { color: C.onGold, fontWeight: '800' },
    results: { marginTop: 12 },
    upcoming: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginHorizontal: 16 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
    primary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 52,
      borderRadius: 16,
      backgroundColor: C.gold,
    },
    primaryText: { color: C.onGold, fontSize: 15, fontWeight: '800' },
    secondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: 16,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.line,
    },
    secondaryText: { color: C.text, fontSize: 15, fontWeight: '700' },
    bleed: { marginHorizontal: -20 },
    people: { gap: 16, paddingHorizontal: 20 },
    person: { width: 64, alignItems: 'center', gap: 6 },
    personName: { color: C.muted, fontSize: 12, maxWidth: 64 },
    addPerson: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: C.faint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    intentions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: C.highlight,
      borderRadius: 20,
      padding: 18,
      marginTop: 32,
    },
    intentionsIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    intentionsTitle: { color: C.text, fontFamily: SERIF, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  });
