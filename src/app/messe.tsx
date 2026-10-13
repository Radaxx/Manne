import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LITURGICAL_COLORS, plainText, useMass } from '../aelf';
import { SERIF } from '../cards';
import { C, MassBody } from '../liturgy';
import { useApp } from '../storage';
import { liveLog } from '../today';

export default function MassScreen() {
  const { data, error } = useMass();
  const { progress, markGospel } = useApp();
  const gospelRead = liveLog(progress).gospel;
  const info = data?.informations;
  const masses = data?.messes ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {info && (
        <>
          <Text style={styles.title}>{info.ligne2 && info.ligne2 !== 'de la férie' ? plainText(info.ligne2) : 'Lectures du jour'}</Text>
          <View style={styles.infoRow}>
            <View style={[styles.dot, { backgroundColor: LITURGICAL_COLORS[info.couleur] ?? C.muted }]} />
            <Text style={styles.info}>{info.ligne1}</Text>
          </View>
        </>
      )}
      {masses.map((m, i) => (
        <View key={i}>
          {/* Certains jours (Noël, Pâques…) ont plusieurs messes. */}
          {masses.length > 1 && <Text style={styles.massName}>{m.nom}</Text>}
          <MassBody mass={m} gospelRead={gospelRead} onGospelRead={markGospel} />
        </View>
      ))}
      {!data && !error && <ActivityIndicator color={C.muted} style={{ marginTop: 40 }} />}
      {error && <Text style={styles.info}>Les lectures n’ont pas pu être chargées. Vérifie ta connexion et réessaie.</Text>}
      <Text style={styles.credits}>Textes liturgiques © AELF — aelf.org</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 22, paddingBottom: 60 },
  title: { color: C.text, fontFamily: SERIF, fontSize: 30, lineHeight: 38, marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  info: { color: C.muted, fontSize: 14, flexShrink: 1, lineHeight: 20 },
  massName: { color: C.gold, fontSize: 16, fontWeight: '800', marginTop: 24 },
  credits: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 30 },
});
