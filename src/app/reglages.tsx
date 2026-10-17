import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { ACCENT_OPTIONS, type Palette, READING_THEMES, ROSARY_COLORS, SCHEME_OPTIONS } from '../appearance';
import { useAuth } from '../auth';
import { SERIF } from '../cards';
import { liturgicalDay, SEASONS } from '../liturgical-year';
import { pendingLabel } from '../publisher-moderation';
import { useModeratorStatus } from '../publisher-moderation-ui';
import { formatTime } from '../reminder';
import { TranslationPicker } from '../sheets';
import { today, useApp } from '../storage';
import { Text } from '../text';
import { useThemed } from '../theme';

/** La couleur du jour, et ce qu'elle donne pour l'accent. */
function accentHint() {
  const day = liturgicalDay(today());
  const season = SEASONS[day.season].name.toLowerCase();
  if (day.color === 'blanc') return `Aujourd’hui, le blanc des fêtes (${season}) : l’accent reste doré.`;
  return `Aujourd’hui : ${day.color}, ${day.feast ? day.feast.name : season}. L’accent change avec les temps de l’année.`;
}

export default function ReglagesScreen() {
  const { progress, setAppearance, setTranslation, setCultureCalendar } = useApp();
  const { appearance, reminder } = progress;
  const { C, styles } = useThemed(stylesFor);
  const { status } = useAuth();
  // L'entrée « Modération » n'existe que pour un modérateur de l'éditeur.
  const { moderator, pending } = useModeratorStatus(status === 'signedIn');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        Le thème et l’accent de l’app, la matière du chapelet, la traduction et le fond de la lecture, les œuvres de Découvrir et le rappel
        du jour.
      </Text>

      <Text style={styles.section}>Apparence</Text>
      <View style={styles.segment}>
        {SCHEME_OPTIONS.map((option) => {
          const on = appearance.scheme === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setAppearance({ scheme: option.id })}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Couleur d’accent</Text>
      <View style={styles.segment}>
        {ACCENT_OPTIONS.map((option) => {
          const on = appearance.accent === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setAppearance({ accent: option.id })}
              style={[styles.segmentItem, on && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{accentHint()}</Text>

      <Text style={styles.section}>Couleur du chapelet</Text>
      <View style={styles.swatches}>
        {ROSARY_COLORS.map((material) => {
          const on = appearance.rosary === material.id;
          return (
            <Pressable
              key={material.id}
              onPress={() => setAppearance({ rosary: material.id })}
              style={styles.swatchHit}
              accessibilityRole="button"
              accessibilityLabel={material.name}
              accessibilityState={{ selected: on }}
            >
              <View style={[styles.swatch, { backgroundColor: material.bead }, on && styles.swatchOn]}>
                <View style={[styles.swatchCore, { backgroundColor: material.lit }]} />
              </View>
              <Text style={[styles.swatchLabel, on && styles.swatchLabelOn]}>{material.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Fond de lecture</Text>
      <View style={styles.themes}>
        {READING_THEMES.map((theme) => {
          const on = appearance.reading === theme.id;
          return (
            <Pressable
              key={theme.id}
              onPress={() => setAppearance({ reading: theme.id })}
              style={styles.themeHit}
              accessibilityRole="button"
              accessibilityLabel={`${theme.name}. ${theme.blurb}`}
              accessibilityState={{ selected: on }}
            >
              <LinearGradient
                colors={theme.preview}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.preview, on && styles.previewOn]}
              >
                <Text style={[styles.previewText, { color: theme.previewInk }]}>Aa</Text>
              </LinearGradient>
              <Text style={[styles.themeName, on && styles.themeNameOn]}>{theme.name}</Text>
              <Text style={styles.themeBlurb}>{theme.blurb}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Traduction de la Bible</Text>
      <TranslationPicker translation={progress.translation} onChange={setTranslation} />

      <Text style={styles.section}>Découvrir</Text>
      <Pressable
        onPress={() => setCultureCalendar(!progress.cultureCalendar)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="switch"
        accessibilityState={{ checked: progress.cultureCalendar }}
      >
        <Ionicons name="calendar-outline" size={22} color={C.gold} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Œuvres au fil du calendrier</Text>
          <Text style={styles.rowHint}>
            Le jour d’un saint, d’une fête ou pendant un temps liturgique, les œuvres qui s’y rattachent passent en premier.
          </Text>
        </View>
        <Switch
          value={progress.cultureCalendar}
          onValueChange={setCultureCalendar}
          trackColor={{ true: C.gold, false: C.faint }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>

      <Text style={styles.section}>Notification</Text>
      <Pressable onPress={() => router.push('/rappel')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Ionicons name={reminder.enabled ? 'notifications' : 'notifications-outline'} size={22} color={C.gold} />
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>Rappel quotidien</Text>
          <Text style={styles.rowHint}>
            {reminder.enabled ? `Chaque jour à ${formatTime(reminder.hour, reminder.minute)}` : 'Désactivé'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </Pressable>

      {moderator ? (
        <>
          <Text style={styles.section}>Modération</Text>
          <Pressable onPress={() => router.push('/moderation')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={C.gold} />
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Modération</Text>
              <Text style={styles.rowHint}>{pendingLabel(pending)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 8 },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 28, marginBottom: 12 },
    segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, gap: 4 },
    segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
    segmentOn: { backgroundColor: C.gold },
    segmentText: { color: C.text, fontSize: 15, fontWeight: '700' },
    segmentTextOn: { color: C.onGold },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatchHit: { width: '31%', alignItems: 'center', gap: 8, marginBottom: 8 },
    swatch: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchOn: { borderColor: C.gold },
    swatchCore: { width: 16, height: 16, borderRadius: 8 },
    swatchLabel: { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    swatchLabelOn: { color: C.text },
    themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    themeHit: { width: '48%', marginBottom: 6 },
    preview: {
      height: 72,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    previewOn: { borderColor: C.gold },
    previewText: { fontFamily: SERIF, fontSize: 22 },
    themeName: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
    themeNameOn: { color: C.gold },
    themeBlurb: { color: C.faint, fontSize: 12, lineHeight: 16, marginTop: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
    },
    rowBody: { flex: 1 },
    rowLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
    rowHint: { color: C.muted, fontSize: 13, marginTop: 2 },
    pressed: { opacity: 0.75 },
  });
