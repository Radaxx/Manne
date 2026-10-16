import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { haptic } from '../../haptics';
import { follow, getProfile, type OtherProfile, unfollow } from '../../profile';
import { Button } from '../../profile-ui';
import { blockPerson, EMPTY_SHOWCASE, fetchShowcase, type Showcase } from '../../showcase';
import { ShowcaseSections } from '../../showcase-sections';
import { Text } from '../../text';
import { useThemed } from '../../theme';

export default function AutreProfil() {
  const { C, styles } = useThemed(stylesFor);
  const params = useLocalSearchParams<{ handle?: string | string[] }>();
  const handle = (Array.isArray(params.handle) ? params.handle[0] : params.handle) ?? '';
  const { status, profile: mine } = useAuth();
  const [other, setOther] = useState<OtherProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showcase, setShowcase] = useState<Showcase>(EMPTY_SHOWCASE);

  const load = useCallback(async () => {
    const result = await getProfile(handle);
    if (!result.ok) {
      setError(result.message);
      setOther(null);
      return;
    }
    setError(null);
    setOther(result.profile);
    // La vitrine suit la même règle que le profil : le serveur n'envoie rien si la personne ne te suit pas et que vous n'avez aucun groupe en commun.
    if (result.profile?.visible) {
      const shown = await fetchShowcase(handle);
      setShowcase(shown.ok ? shown.showcase : EMPTY_SHOWCASE);
    } else {
      setShowcase(EMPTY_SHOWCASE);
    }
  }, [handle]);

  useFocusEffect(
    useCallback(() => {
      if (status === 'signedIn') void load();
    }, [status, load]),
  );

  if (mine && mine.handle === handle.toLowerCase()) return <Redirect href="/profil" />;

  if (status !== 'signedIn') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>Les profils demandent un compte relié.</Text>
        <Button label="Créer mon profil" onPress={() => router.push('/inscription')} />
      </ScrollView>
    );
  }

  if (other === undefined) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;

  if (!other) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Ce profil n’existe pas.'}</Text>
      </ScrollView>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    haptic();
    const result = other.iFollow ? await unfollow(other.handle) : await follow(other.handle);
    if (!result.ok) setError(result.message);
    await load();
    setBusy(false);
  };

  const block = () => {
    Alert.alert(
      `Bloquer @${other.handle} ?`,
      `Vous ne vous suivrez plus, et @${other.handle} ne pourra plus te trouver ni voir ton profil.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: () => {
            void blockPerson(other.handle).then((result) => {
              if (!result.ok) {
                setError(result.message);
                return;
              }
              haptic('success');
              if (router.canGoBack()) router.back();
              else router.replace('/profil');
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <View style={styles.identity}>
        <Avatar handle={other.handle} size={96} />
        <Text style={styles.name}>@{other.handle}</Text>
        {other.visible ? (
          <>
            {other.bio ? <Text style={styles.bio}>{other.bio}</Text> : null}
            {other.parish ? (
              <View style={styles.parish}>
                <Ionicons name="location-outline" size={16} color={C.muted} />
                <Text style={styles.muted}>{other.parish}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {other.visible ? (
        <View style={styles.counts}>
          <View style={styles.count}>
            <Text style={styles.countValue}>{other.followers ?? 0}</Text>
            <Text style={styles.muted}>abonné{(other.followers ?? 0) > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.count}>
            <Text style={styles.countValue}>{other.following ?? 0}</Text>
            <Text style={styles.muted}>abonnement{(other.following ?? 0) > 1 ? 's' : ''}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.closed}>Son profil s’ouvre à toi quand cette personne te suit ou que vous êtes dans un même groupe.</Text>
      )}

      {other.visible ? <ShowcaseSections showcase={showcase} mine={false} /> : null}

      {mine ? (
        <>
          <Button
            label={other.iFollow ? 'Ne plus suivre' : 'Suivre'}
            kind={other.iFollow ? 'secondary' : 'primary'}
            onPress={() => void toggle()}
            busy={busy}
          />
          <Text style={styles.note}>Le suivre lui ouvre ton profil.</Text>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.muted}>Crée ton profil pour suivre des personnes.</Text>
          <Button label="Créer mon profil" kind="secondary" onPress={() => router.push('/inscription/pseudo')} />
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={`Bloquer @${other.handle}`} kind="quiet" onPress={block} />
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 6 },
    identity: { alignItems: 'center', gap: 4, marginBottom: 12 },
    name: { color: C.text, fontSize: 26, fontWeight: '800', marginTop: 8, textAlign: 'center' },
    bio: { color: C.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
    parish: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    counts: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    count: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center' },
    countValue: { color: C.text, fontSize: 24, fontWeight: '800' },
    closed: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginVertical: 8 },
    note: { color: C.faint, fontSize: 13, textAlign: 'center', marginTop: 8 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginTop: 8 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    error: { color: C.red, fontSize: 14, marginTop: 8, textAlign: 'center' },
  });
