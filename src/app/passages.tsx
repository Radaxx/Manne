import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SERIF } from '../cards';
import { C } from '../liturgy';
import { useApp } from '../storage';

export default function PassagesScreen() {
  const { progress, goTo } = useApp();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {progress.saved.length === 0 ? (
        <Text style={styles.muted}>Garde un verset pendant la lecture : il reviendra ici.</Text>
      ) : (
        progress.saved.map((passage) => (
          <Pressable
            key={passage.id}
            onPress={() => {
              goTo(passage.book, passage.chapter);
              router.navigate('/lecture');
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.link}>{passage.reference}</Text>
            <Text style={styles.passage}>{passage.text}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 48 },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6, marginBottom: 10 },
  link: { color: C.gold, fontSize: 14, fontWeight: '700' },
  passage: { color: C.muted, fontFamily: SERIF, fontSize: 15, lineHeight: 22 },
  pressed: { opacity: 0.75 },
});
