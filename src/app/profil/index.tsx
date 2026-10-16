import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinkedAccount } from '../../account-form';
import type { Palette } from '../../appearance';
import { useAccount, useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { Button, SettingsButton } from '../../profile-ui';
import { ShowcaseSections } from '../../showcase-sections';
import { useMyShowcase } from '../../showcase-store';
import { useApp } from '../../storage';
import { useThemed } from '../../theme';

const days = (n: number) => (n === 0 ? 'Pas encore de jours de suite' : `${n} jour${n > 1 ? 's' : ''} de suite`);

export default function ProfilScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress } = useApp();
  const { configured, status, profile, profileLoaded, profileOffline, refreshProfile } = useAuth();
  const account = useAccount();
  const mine = useMyShowcase();

  // Les compteurs bougent quand on revient d'une liste ou du profil d'un autre.
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  const streak = (
    <View style={styles.streak}>
      <Ionicons name="flame" size={18} color={C.gold} />
      <Text style={styles.streakText}>{days(progress.streak)}</Text>
    </View>
  );

  let body: ReactNode;
  if (!configured) {
    body = <Text style={styles.muted}>Les profils ne sont pas disponibles pour le moment. Ton chemin reste sur ce téléphone.</Text>;
  } else if (status !== 'signedIn') {
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Crée ton profil</Text>
        <Text style={styles.muted}>
          Choisis un pseudo, retrouve des proches et ouvre-leur ton profil en les suivant. Les membres de tes groupes y ont aussi accès.
        </Text>
        <Button label="Créer mon profil" onPress={() => router.push('/inscription')} />
      </View>
    );
  } else if (!profileLoaded) {
    body = <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} />;
  } else if (profileOffline) {
    body = (
      <View style={styles.card}>
        <Text style={styles.muted}>Ton profil n’a pas pu être lu. Réessaie quand tu as du réseau.</Text>
        <Button label="Réessayer" kind="secondary" onPress={() => void refreshProfile()} />
      </View>
    );
  } else if (!profile) {
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Termine ton profil</Text>
        <Text style={styles.muted}>Ton compte est relié. Il te manque un pseudo pour avoir un profil.</Text>
        <Button label="Continuer" onPress={() => router.push('/inscription/pseudo')} />
      </View>
    );
  } else {
    body = (
      <>
        <View style={styles.identity}>
          <Avatar handle={profile.handle} size={96} />
          <Text style={styles.name}>@{profile.handle}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          {profile.parish ? (
            <View style={styles.parish}>
              <Ionicons name="location-outline" size={16} color={C.muted} />
              <Text style={styles.muted}>{profile.parish}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.counts}>
          <Pressable onPress={() => router.push('/profil/abonnes')} style={styles.count} accessibilityRole="button">
            <Text style={styles.countValue}>{profile.followers}</Text>
            <Text style={styles.muted}>abonné{profile.followers > 1 ? 's' : ''}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profil/abonnements')} style={styles.count} accessibilityRole="button">
            <Text style={styles.countValue}>{profile.following}</Text>
            <Text style={styles.muted}>abonnement{profile.following > 1 ? 's' : ''}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SettingsButton /> }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        {status === 'signedIn' && profile ? null : (
          <View style={styles.identity}>
            <Avatar size={96} />
          </View>
        )}
        {body}
        {streak}
        {profile && status === 'signedIn' && mine.showcase ? <ShowcaseSections showcase={mine.showcase} mine /> : null}
        {profile && status === 'signedIn' ? <Button label="Modifier mon profil" onPress={() => router.push('/profil/modifier')} /> : null}
        <Button label="Mon chemin" kind="secondary" onPress={() => router.push('/compte')} />
        {profile && status === 'signedIn' ? (
          <Button label="Personnes bloquées" kind="quiet" onPress={() => router.push('/profil/bloques')} />
        ) : null}
        {status === 'signedIn' ? (
          <>
            <Text style={styles.section}>Compte</Text>
            <LinkedAccount account={account} />
          </>
        ) : null}
      </ScrollView>
    </>
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
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
    },
    streakText: { color: C.text, fontSize: 16, fontWeight: '700' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 22, marginBottom: 4 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
  });
