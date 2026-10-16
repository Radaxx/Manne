import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
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
  const hasProfile = status === 'signedIn' && !!profile;

  const load = useCallback(async () => {
    if (!hasProfile) {
      setFollowing(null);
      return;
    }
    const result = await listFollowing();
    if (!result.ok) {
      setOffline(result.message);
      setFollowing([]);
      return;
    }
    setOffline(null);
    setFollowing(result.people);
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
              <Text style={styles.muted}>Choisis un pseudo pour retrouver des proches et les suivre.</Text>
              <Button
                label="Créer mon profil"
                onPress={() => router.push(status === 'signedIn' ? '/inscription/pseudo' : '/inscription')}
              />
            </View>
          ) : (
            <>
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
