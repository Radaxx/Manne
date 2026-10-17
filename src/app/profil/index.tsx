import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinkedAccount } from '../../account-form';
import type { Palette } from '../../appearance';
import { useAccount, useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { SERIF } from '../../cards';
import { MASKED_NOTE } from '../../moderation';
import { Button, SettingsButton } from '../../profile-ui';
import { SuspensionBanner, useMySuspension } from '../../publisher-moderation-ui';
import { SectionHead } from '../../section';
import { ShowcaseSections } from '../../showcase-sections';
import { useMyShowcase } from '../../showcase-store';
import { useApp } from '../../storage';
import { Text, TextInput } from '../../text';
import { useThemed } from '../../theme';
import { weekStrip } from '../../today';

const days = (n: number) => (n === 0 ? 'Pas encore de jours de suite' : `${n} jour${n > 1 ? 's' : ''} de suite`);

export default function ProfilScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setDisplayName } = useApp();
  const { configured, status, profile, profileLoaded, profileOffline, refreshProfile } = useAuth();
  const account = useAccount();
  const mine = useMyShowcase();
  const suspension = useMySuspension(status === 'signedIn');
  // Le prénom en cours de frappe ; hors saisie, le champ suit toujours le prénom de la progression.
  const [draft, setDraft] = useState<string | null>(null);
  const week = weekStrip(progress);

  // Les compteurs bougent quand on revient d'une liste ou du profil d'un autre.
  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
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
          {profile.flagged ? (
            <Text style={styles.masked}>
              {MASKED_NOTE}. Les autres ne voient plus ta bio ni ta paroisse. Si tu les modifies, elles redeviennent visibles.
            </Text>
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
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <Stack.Screen options={{ headerRight: () => <SettingsButton /> }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <SuspensionBanner suspension={suspension} />
        {status === 'signedIn' && profile ? null : (
          <View style={styles.identity}>
            <Avatar size={96} />
          </View>
        )}
        {body}

        {/* La porte d'entrée de la page de progression */}
        <SectionHead title="Mon chemin" />
        <Pressable
          onPress={() => router.push('/compte')}
          style={({ pressed }) => [styles.chemin, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Mon chemin, ${days(progress.streak)}`}
        >
          <View style={styles.cheminHead}>
            <View style={styles.flame}>
              <Ionicons name="flame" size={22} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cheminTitle}>{days(progress.streak)}</Text>
              <Text style={styles.muted}>Ta progression, ta Bible, tes étapes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </View>
          <View style={styles.bars}>
            {week.map((cell) => (
              <View
                key={cell.date}
                style={[styles.bar, cell.complete && styles.barOn, cell.isToday && !cell.complete && styles.barToday]}
              />
            ))}
          </View>
        </Pressable>

        {profile && status === 'signedIn' && mine.showcase ? <ShowcaseSections showcase={mine.showcase} mine /> : null}

        <SectionHead title="Moi" />
        <View style={styles.group}>
          <View style={styles.field}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Prénom</Text>
              <TextInput
                value={draft ?? progress.displayName}
                onChangeText={setDraft}
                onEndEditing={() => {
                  if (draft !== null) setDisplayName(draft);
                  setDraft(null);
                }}
                placeholder="Ton prénom"
                placeholderTextColor={C.faint}
                style={styles.fieldInput}
                maxLength={40}
                autoCorrect={false}
              />
            </View>
            <Text style={styles.fieldHint}>Pour te saluer sur l’Accueil</Text>
          </View>
          {configured && status !== 'signedIn' ? (
            <>
              <View style={styles.separator} />
              <Pressable
                onPress={() => router.push('/inscription')}
                style={({ pressed }) => [styles.field, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Compte</Text>
                  <Text style={styles.fieldValue}>Pas encore relié</Text>
                </View>
                <Text style={styles.fieldHint}>Retrouve ton chemin ailleurs</Text>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </Pressable>
            </>
          ) : null}
        </View>
        {status === 'signedIn' ? <LinkedAccount account={account} /> : null}

        {profile && status === 'signedIn' ? (
          <View style={{ marginTop: 18 }}>
            <Button label="Modifier mon profil" onPress={() => router.push('/profil/modifier')} />
            <Button label="Personnes bloquées" kind="quiet" onPress={() => router.push('/profil/bloques')} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    identity: { alignItems: 'center', gap: 4, marginBottom: 12 },
    name: { color: C.text, fontFamily: SERIF, fontSize: 30, lineHeight: 36, fontWeight: '700', marginTop: 8, textAlign: 'center' },
    bio: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6 },
    parish: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    counts: { flexDirection: 'row', gap: 10, marginTop: 6 },
    count: { flex: 1, height: 72, backgroundColor: C.card, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    countValue: { color: C.text, fontFamily: SERIF, fontSize: 26, lineHeight: 30, fontWeight: '700' },
    chemin: { backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 18, gap: 14 },
    cheminHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    flame: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.highlight, alignItems: 'center', justifyContent: 'center' },
    cheminTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
    bars: { flexDirection: 'row', gap: 8 },
    bar: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.track },
    barOn: { backgroundColor: C.gold },
    barToday: { backgroundColor: 'transparent', borderWidth: 2, borderColor: C.gold },
    group: { backgroundColor: C.card, borderRadius: 20, marginBottom: 10 },
    field: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
    fieldLabel: { color: C.muted, fontSize: 13 },
    fieldValue: { color: C.text, fontSize: 16, fontWeight: '700' },
    fieldInput: { color: C.text, fontSize: 16, fontWeight: '700', padding: 0 },
    fieldHint: { color: C.faint, fontSize: 13, lineHeight: 17, maxWidth: 120, textAlign: 'right' },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginHorizontal: 16 },
    pressed: { opacity: 0.75 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
    cardTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    masked: { color: C.muted, fontSize: 13, lineHeight: 18, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  });
