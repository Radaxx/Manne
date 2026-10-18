import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Palette } from '../appearance';
import { TOUR_PAGES } from '../guide';
import { haptic } from '../haptics';
import { Text } from '../text';
import { useThemed } from '../theme';
import { markTourSeen } from '../tour';

const LAST = TOUR_PAGES.length - 1;

/** La visite de bienvenue : quelques pages à faire glisser, une par onglet. */
export default function BienvenueScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { width } = useWindowDimensions();
  // Les marges de la zone sûre sont posées à la main : dans un modal plein écran, `SafeAreaView` ne les applique pas toujours.
  const insets = useSafeAreaInsets();
  const pager = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const close = () => {
    void markTourSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const goTo = (next: number) => {
    pager.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const followPage = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.max(0, Math.min(LAST, Math.round(e.nativeEvent.contentOffset.x / width)));
    setIndex((current) => (current === page ? current : page));
  };

  const last = index === LAST;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.top}>
        {last ? null : (
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Passer la visite">
            <Text style={styles.skip}>Passer</Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // La page courante suit le défilement : la fin d'un glissement ne déclenche pas toujours `onMomentumScrollEnd`.
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true, listener: followPage })}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {TOUR_PAGES.map((page) => (
          <ScrollView key={page.id} style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
            <View style={styles.icon}>
              <Ionicons name={page.icon as keyof typeof Ionicons.glyphMap} size={44} color={C.gold} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {page.title}
            </Text>
            {page.lines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}
            {page.bullets ? (
              <View style={styles.bullets}>
                {page.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bullet}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {page.note ? <Text style={styles.note}>{page.note}</Text> : null}
          </ScrollView>
        ))}
      </Animated.ScrollView>

      <View style={styles.dots} accessibilityLabel={`Page ${index + 1} sur ${TOUR_PAGES.length}`}>
        {TOUR_PAGES.map((page, i) => {
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          return (
            <View key={page.id} style={styles.dot}>
              <Animated.View
                style={[
                  styles.dotOn,
                  {
                    opacity: scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                    transform: [{ scale: scrollX.interpolate({ inputRange: range, outputRange: [0.6, 1.4, 0.6], extrapolate: 'clamp' }) }],
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => {
          haptic();
          if (last) close();
          else goTo(index + 1);
        }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{last ? 'Commencer' : 'Suivant'}</Text>
      </Pressable>
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 24 },
    skip: { color: C.muted, fontSize: 16, fontWeight: '600' },
    pager: { flex: 1 },
    page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 16, gap: 14 },
    icon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 10,
    },
    title: { color: C.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
    line: { color: C.muted, fontSize: 17, lineHeight: 25, textAlign: 'center' },
    bullets: { gap: 10, marginTop: 6, backgroundColor: C.card, borderRadius: 16, padding: 16 },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold, marginTop: 9 },
    bullet: { flex: 1, color: C.text, fontSize: 15, lineHeight: 23 },
    note: { color: C.faint, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 14 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.track },
    dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
    button: {
      backgroundColor: C.gold,
      borderRadius: 999,
      paddingVertical: 15,
      alignItems: 'center',
      marginHorizontal: 24,
      marginBottom: 12,
    },
    buttonText: { color: C.onGold, fontSize: 17, fontWeight: '800' },
    pressed: { opacity: 0.8 },
  });
