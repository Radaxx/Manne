import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LITURGICAL_COLORS, OFFICES, type OfficeId, plainText, useOffice } from '../../aelf';
import type { Palette } from '../../appearance';
import { SERIF } from '../../cards';
import { OfficeBody } from '../../liturgy';
import { useApp } from '../../storage';
import { useThemed } from '../../theme';
import { liveLog } from '../../today';

export default function OfficeScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { id } = useLocalSearchParams<{ id: string }>();
  const office = OFFICES.find((o) => o.id === id) ?? OFFICES[1];
  const { data, error } = useOffice(office.id as OfficeId);
  const { progress, markOffice } = useApp();
  const officeRead = liveLog(progress).office;
  const info = data?.informations;
  const body = data?.[office.id];

  return (
    <>
      <Stack.Screen options={{ title: office.name }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{office.name}</Text>
        {info && (
          <View style={styles.infoRow}>
            <View style={[styles.dot, { backgroundColor: LITURGICAL_COLORS[info.couleur] ?? C.muted }]} />
            <Text style={styles.info}>
              {info.ligne1}
              {info.fete && info.fete !== 'de la férie' ? ` · ${plainText(info.fete)}` : ''}
            </Text>
          </View>
        )}
        {body ? (
          <OfficeBody office={body} />
        ) : error ? (
          <Text style={styles.info}>L’office n’a pas pu être chargé. Vérifie ta connexion et réessaie.</Text>
        ) : (
          <ActivityIndicator color={C.muted} style={{ marginTop: 40 }} />
        )}
        {body ? (
          <Pressable
            onPress={markOffice}
            disabled={officeRead}
            style={({ pressed }) => [styles.doneBtn, officeRead && styles.doneBtnOn, pressed && !officeRead && styles.pressed]}
          >
            <Text style={[styles.doneBtnText, officeRead && styles.doneBtnTextOn]}>
              {officeRead ? 'Office prié aujourd’hui' : 'J’ai prié cet office'}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.credits}>Textes liturgiques © AELF — aelf.org</Text>
      </ScrollView>
    </>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingHorizontal: 22, paddingBottom: 60 },
    title: { color: C.text, fontFamily: SERIF, fontSize: 34, lineHeight: 42, marginTop: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
    dot: { width: 9, height: 9, borderRadius: 5 },
    info: { color: C.muted, fontSize: 14, flexShrink: 1, lineHeight: 20 },
    credits: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 30 },
    doneBtn: {
      alignSelf: 'flex-start',
      marginTop: 28,
      backgroundColor: C.gold,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    doneBtnOn: { backgroundColor: 'rgba(255,209,102,0.12)' },
    doneBtnText: { color: C.onGold, fontWeight: '800', fontSize: 15 },
    doneBtnTextOn: { color: C.gold },
    pressed: { opacity: 0.7 },
  });
