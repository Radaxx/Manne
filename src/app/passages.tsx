import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../appearance';
import { SERIF } from '../cards';
import { isShowablePassage, type ShowcasePassage } from '../showcase';
import { setPassageShown, useMyShowcase } from '../showcase-store';
import { ShowcaseInvite, ShowSwitch } from '../showcase-ui';
import { useApp } from '../storage';
import { useThemed } from '../theme';

export default function PassagesScreen() {
  const { styles } = useThemed(stylesFor);
  const { progress, goTo } = useApp();
  const mine = useMyShowcase();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {progress.saved.length > 0 ? <ShowcaseInvite /> : null}
      {mine.ready && progress.saved.length > 0 ? (
        <Text style={styles.hint}>
          Tu peux afficher des passages sur ton profil. Les personnes que tu suis et les membres de tes groupes les voient ; seule la
          référence est partagée, chacun lit le texte dans sa traduction.
        </Text>
      ) : null}
      {progress.saved.length === 0 ? (
        <Text style={styles.muted}>Garde un verset pendant la lecture : il reviendra ici.</Text>
      ) : (
        progress.saved.map((passage) => {
          const shown: ShowcasePassage = { book: passage.book, chapter: passage.chapter, from: passage.from, to: passage.to };
          return (
            <View key={passage.id} style={styles.card}>
              <Pressable
                onPress={() => {
                  goTo(passage.book, passage.chapter);
                  router.navigate('/lecture');
                }}
                style={({ pressed }) => [styles.body, pressed && styles.pressed]}
              >
                <Text style={styles.link}>{passage.reference}</Text>
                <Text style={styles.passage}>{passage.text}</Text>
              </Pressable>
              {mine.ready && isShowablePassage(shown) ? (
                <ShowSwitch on={mine.isPassageShown(shown)} change={(next) => setPassageShown(shown, next)} />
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18, marginBottom: 10 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 12, marginBottom: 10 },
    body: { gap: 6 },
    link: { color: C.gold, fontSize: 14, fontWeight: '700' },
    passage: { color: C.muted, fontFamily: SERIF, fontSize: 15, lineHeight: 22 },
    pressed: { opacity: 0.75 },
  });
