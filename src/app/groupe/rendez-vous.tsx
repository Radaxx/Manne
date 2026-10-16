import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../../appearance';
import { daysSince, localDate, shortDate, WEEKDAYS } from '../../dates';
import {
  createGathering,
  DEFAULT_DURATION,
  DURATION_CHOICES,
  deviceTimeZone,
  GATHERING_DESCRIPTION_MAX,
  type Gathering,
  gatheringDescriptionProblem,
  listGatherings,
  nextOccurrences,
  ONCE_MAX_DAYS,
  onceProblem,
  PRAYER_KINDS,
  type PrayerKind,
  prayerKindLabel,
  type Recurrence,
  TITLE_MAX,
  timeLabel,
  titleProblem,
  updateGathering,
  zonedParts,
} from '../../gatherings';
import { NeedProfile, useGroupGate } from '../../group-ui';
import { firstParam } from '../../groups';
import { haptic } from '../../haptics';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { useThemed } from '../../theme';

// Les jours de la semaine, du lundi au dimanche (le serveur compte 0 = dimanche).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

/** Ce que contient le formulaire. */
type Draft = {
  title: string;
  description: string;
  durationMin: number;
  recurrence: Recurrence;
  prayerKind: PrayerKind;
  weekday: number;
  hour: number;
  minute: number;
  /** Ponctuel : nombre de jours à partir d'aujourd'hui (0 à ONCE_MAX_DAYS). */
  dayOffset: number;
};

const EMPTY: Draft = {
  title: '',
  description: '',
  durationMin: DEFAULT_DURATION,
  recurrence: 'weekly',
  prayerKind: 'libre',
  weekday: 2,
  hour: 21,
  minute: 0,
  dayOffset: 1,
};

/** Le formulaire d'un rendez-vous existant, vu depuis le fuseau de ce téléphone (c'est lui qui sera enregistré). */
function draftFrom(g: Gathering): Draft {
  const base: Draft = {
    ...EMPTY,
    title: g.title,
    description: g.description,
    durationMin: g.durationMin,
    recurrence: g.recurrence,
    prayerKind: g.prayerKind,
  };
  const zone = deviceTimeZone();
  const start = g.recurrence === 'weekly' ? nextOccurrences(g, new Date(), 1)[0] : g.startsAt ? new Date(g.startsAt) : undefined;
  if (!start) return base;
  const p = zonedParts(start.getTime(), zone);
  const iso = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  const offset = Math.min(ONCE_MAX_DAYS, Math.max(0, daysSince(localDate(), iso)));
  return { ...base, weekday: p.weekday, hour: p.hour, minute: p.minute, dayOffset: offset };
}

/** Le moment d'un rendez-vous ponctuel, à l'heure du téléphone. */
function onceDate(draft: Draft): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + draft.dayOffset, draft.hour, draft.minute, 0, 0);
}

export default function RendezVousScreen() {
  const { C, styles } = useThemed(stylesFor);
  const params = useLocalSearchParams<{ id?: string | string[]; gathering?: string | string[] }>();
  const groupId = firstParam(params.id);
  const gatheringId = firstParam(params.gathering);
  const gate = useGroupGate();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // En modification, on attend de connaître le rendez-vous pour préremplir.
  const [loading, setLoading] = useState(!!gatheringId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gatheringId || !gate.ready) return;
    let alive = true;
    void listGatherings(groupId).then((result) => {
      if (!alive) return;
      const found = result.ok ? result.gatherings.find((g) => g.id === gatheringId) : undefined;
      if (found) setDraft(draftFrom(found));
      else setError(result.ok ? 'Ce rendez-vous n’existe plus.' : result.message);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [gatheringId, groupId, gate.ready]);

  if (gate.loading || loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const titleError = draft.title.trim() ? titleProblem(draft.title) : null;
  const descriptionError = gatheringDescriptionProblem(draft.description);
  const when = draft.recurrence === 'once' ? onceDate(draft) : null;
  const onceError = when ? onceProblem(when) : null;
  const canSave = !titleProblem(draft.title) && !descriptionError && !onceError;

  const save = async () => {
    if (busy || !canSave) return;
    setBusy(true);
    setError(null);
    const input = {
      title: draft.title,
      description: draft.description,
      durationMin: draft.durationMin,
      recurrence: draft.recurrence,
      prayerKind: draft.prayerKind,
      weekday: draft.weekday,
      hour: draft.hour,
      minute: draft.minute,
      startsAt: when,
    };
    const result = gatheringId ? await updateGathering(gatheringId, input) : await createGathering(groupId, input);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    haptic('success');
    router.back();
  };

  // Les 61 prochains jours, aujourd'hui compris.
  const today = new Date();
  const days = Array.from({ length: ONCE_MAX_DAYS + 1 }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + k);
    return { k, label: `${WEEKDAYS[d.getDay()].slice(0, 3)}. ${shortDate(localDate(d))}` };
  });

  return (
    <FormScreen>
      <Lead>
        Un rendez-vous réunit les membres pour prier ensemble à une heure donnée. Seuls les membres du groupe le voient. Ceux qui s’y
        inscrivent reçoivent un rappel sur leur téléphone.
      </Lead>
      <Field
        label="Titre"
        value={draft.title}
        onChangeText={(title) => set({ title })}
        max={TITLE_MAX}
        error={!!titleError}
        hint={titleError ?? undefined}
        placeholder="par exemple Chapelet"
      />
      <Field
        label="Description (facultative)"
        value={draft.description}
        onChangeText={(description) => set({ description })}
        max={GATHERING_DESCRIPTION_MAX}
        multiline
        error={!!descriptionError}
        hint={descriptionError ?? undefined}
      />

      <Text style={styles.section}>Durée</Text>
      <View style={styles.chips}>
        {DURATION_CHOICES.map((min) => (
          <Chip key={min} label={`${min} min`} on={draft.durationMin === min} onPress={() => set({ durationMin: min })} />
        ))}
      </View>

      <Text style={styles.section}>Prière</Text>
      <View style={styles.chips}>
        {PRAYER_KINDS.map((kind) => (
          <Chip key={kind} label={prayerKindLabel(kind)} on={draft.prayerKind === kind} onPress={() => set({ prayerKind: kind })} />
        ))}
      </View>
      <Text style={styles.hint}>
        Pendant le rendez-vous, la salle de prière propose d’ouvrir ce temps de prière guidé. Chacun prie à son rythme, sur son téléphone :
        rien n’est synchronisé entre les membres.
      </Text>

      <Text style={styles.section}>Récurrence</Text>
      <View style={styles.chips}>
        <Chip label="Chaque semaine" on={draft.recurrence === 'weekly'} onPress={() => set({ recurrence: 'weekly' })} />
        <Chip label="Une seule fois" on={draft.recurrence === 'once'} onPress={() => set({ recurrence: 'once' })} />
      </View>

      {draft.recurrence === 'weekly' ? (
        <>
          <Text style={styles.section}>Jour</Text>
          <View style={styles.chips}>
            {WEEK_ORDER.map((day) => (
              <Chip key={day} label={capital(WEEKDAYS[day])} on={draft.weekday === day} onPress={() => set({ weekday: day })} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.section}>Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map((day) => (
              <Chip key={day.k} label={day.label} on={draft.dayOffset === day.k} onPress={() => set({ dayOffset: day.k })} />
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.section}>Heure</Text>
      <View style={styles.steppers}>
        <Stepper
          label="Heure"
          value={String(draft.hour).padStart(2, '0')}
          onMinus={() => set({ hour: (draft.hour + 23) % 24 })}
          onPlus={() => set({ hour: (draft.hour + 1) % 24 })}
        />
        <Stepper
          label="Minutes"
          value={String(draft.minute).padStart(2, '0')}
          onMinus={() => set({ minute: (draft.minute + 55) % 60 })}
          onPlus={() => set({ minute: (draft.minute + 5) % 60 })}
        />
      </View>
      <Text style={styles.hint}>
        {draft.recurrence === 'weekly'
          ? `${capital(WEEKDAYS[draft.weekday])}, ${timeLabel(draft.hour, draft.minute)}, heure de ce téléphone (${deviceTimeZone()}). Les membres d’un autre fuseau la voient à leur heure, avec l’heure d’origine.`
          : `${timeLabel(draft.hour, draft.minute)}, heure de ce téléphone.`}
      </Text>
      {onceError ? <Text style={styles.error}>{onceError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={gatheringId ? 'Enregistrer' : 'Créer le rendez-vous'} onPress={() => void save()} disabled={!canSave} busy={busy} />
    </FormScreen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={onMinus} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`${label} en moins`}>
          <Ionicons name="remove" size={22} color={C.gold} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable onPress={onPlus} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`${label} en plus`}>
          <Ionicons name="add" size={22} color={C.gold} />
        </Pressable>
      </View>
    </View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.line },
    chipOn: { backgroundColor: C.gold, borderColor: C.gold },
    chipText: { color: C.text, fontWeight: '700', fontSize: 14 },
    chipTextOn: { color: C.onGold },
    steppers: { flexDirection: 'row', gap: 12 },
    stepper: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 6, alignItems: 'center' },
    stepperLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    stepperValue: { color: C.text, fontSize: 28, fontWeight: '800', minWidth: 44, textAlign: 'center' },
    stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardHi },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
