import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import type { Palette } from './appearance';
import { listFollowers, listFollowing, type ProfileCard } from './profile';
import { openProfile, PersonRow } from './profile-ui';
import { Text } from './text';
import { useThemed } from './theme';

const COPY = {
  followers: {
    lead: 'Les personnes qui te suivent. En te suivant, elles t’ont ouvert leur profil.',
    empty: 'Personne ne te suit pour l’instant.',
  },
  following: { lead: 'Les personnes que tu suis. Elles ont accès à ton profil.', empty: 'Tu ne suis personne pour l’instant.' },
} as const;

/** La liste de mes abonnés ou de mes abonnements. */
export function PeopleScreen({ kind }: { kind: 'followers' | 'following' }) {
  const { C, styles } = useThemed(stylesFor);
  const [people, setPeople] = useState<ProfileCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (kind === 'followers' ? listFollowers() : listFollowing()).then((result) => {
        if (!result.ok) {
          setError(result.message);
          setPeople([]);
          return;
        }
        setError(null);
        setPeople(result.people);
      });
    }, [kind]),
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.muted}>{COPY[kind].lead}</Text>
      {people === null ? <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.muted}>{error}</Text> : null}
      {people && people.length === 0 && !error ? <Text style={styles.muted}>{COPY[kind].empty}</Text> : null}
      {people?.map((person) => (
        <PersonRow key={person.handle} person={person} onPress={() => openProfile(person.handle)} />
      ))}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 4 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  });
