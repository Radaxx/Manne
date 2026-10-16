import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { daysSince, localDate, shiftDay, shortDate, WEEKDAYS } from '../../dates';
import {
  addMonths,
  createGathering,
  DEFAULT_DURATION,
  DURATION_CHOICES,
  deviceTimeZone,
  ENDS_CHOICES,
  ENDS_MAX_MONTHS,
  endsOnProblem,
  GATHERING_DESCRIPTION_MAX,
  type Gathering,
  gatheringDescriptionProblem,
  lastDayFor,
  listGatherings,
  nextOccurrences,
  ONCE_MAX_DAYS,
  onceProblem,
  PRAYER_KINDS,
  type PrayerKind,
  prayerKindLabel,
  type Recurrence,
  recurrenceText,
  type Schedule,
  TITLE_MAX,
  timeLabel,
  titleProblem,
  updateGathering,
  weekdaysInZone,
  zonedParts,
} from '../../gatherings';
import { NeedProfile, useGroupGate } from '../../group-ui';
import { firstParam } from '../../groups';
import { haptic } from '../../haptics';
import { Chip } from '../../novena-ui';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { DateStepper, WeekdayChips } from '../../recurrence-ui';
import { Text } from '../../text';
import { useThemed } from '../../theme';

/** « Pendant » d'un hebdomadaire : `none` (sans fin), l'un des choix rapides (ENDS_CHOICES) ou `date` (une date de fin choisie). */
type Until = 'none' | 'date' | string;

/** Ce que contient le formulaire. */
type Draft = {
  title: string;
  description: string;
  durationMin: number;
  recurrence: Recurrence;
  prayerKind: PrayerKind;
  /** Hebdomadaire : les jours, 0 (dimanche) à 6. */
  weekdays: number[];
  hour: number;
  minute: number;
  /** Ponctuel : nombre de jours à partir d'aujourd'hui (0 à ONCE_MAX_DAYS). */
  dayOffset: number;
  /** Hebdomadaire : combien de temps. */
  until: Until;
  /** Hebdomadaire, `until` = `date` : le dernier jour (AAAA-MM-JJ). */
  untilDate: string;
};

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  durationMin: DEFAULT_DURATION,
  recurrence: 'weekly',
  prayerKind: 'libre',
  weekdays: [2],
  hour: 21,
  minute: 0,
  dayOffset: 1,
  until: 'none',
  untilDate: shiftDay(localDate(), 29),
});

/** Le formulaire d'un rendez-vous existant, vu depuis le fuseau de ce téléphone (c'est lui qui sera enregistré). */
function draftFrom(g: Gathering): Draft {
  const base: Draft = {
    ...emptyDraft(),
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
  const weekdays = g.recurrence === 'weekly' && g.timezone ? weekdaysInZone(g.weekdays, start, g.timezone, zone) : base.weekdays;
  const ends = g.endsOn ? { until: 'date' as const, untilDate: g.endsOn } : { until: 'none' as const };
  return { ...base, weekdays, hour: p.hour, minute: p.minute, dayOffset: offset, ...ends };
}

/** Le moment d'un rendez-vous ponctuel, à l'heure du téléphone. */
function onceDate(draft: Draft): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + draft.dayOffset, draft.hour, draft.minute, 0, 0);
}

/** Le dernier jour d'un hebdomadaire d'après « Pendant » (à partir d'aujourd'hui), ou null s'il n'a pas de fin. */
function endsOnOf(draft: Draft): string | null {
  if (draft.recurrence !== 'weekly' || draft.until === 'none') return null;
  if (draft.until === 'date') return draft.untilDate;
  const choice = ENDS_CHOICES.find((c) => c.id === draft.until);
  return choice ? lastDayFor(choice, localDate()) : null;
}

/** L'hebdomadaire que décrit le formulaire, dans le fuseau de ce téléphone. */
function weeklyOf(draft: Draft): Schedule {
  return {
    recurrence: 'weekly',
    weekdays: draft.weekdays,
    localTime: `${String(draft.hour).padStart(2, '0')}:${String(draft.minute).padStart(2, '0')}`,
    timezone: deviceTimeZone(),
    startsAt: null,
    endsOn: endsOnOf(draft),
    durationMin: draft.durationMin,
  };
}

export default function RendezVousScreen() {
  const { C, styles } = useThemed(stylesFor);
  const params = useLocalSearchParams<{ id?: string | string[]; gathering?: string | string[] }>();
  const groupId = firstParam(params.id);
  const gatheringId = firstParam(params.gathering);
  const gate = useGroupGate();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
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
  const weekly = weeklyOf(draft);
  const endsError = draft.recurrence === 'weekly' ? endsOnProblem(weekly, localDate()) : null;
  const canSave = !titleProblem(draft.title) && !descriptionError && !onceError && !endsError;

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
      weekdays: draft.weekdays,
      hour: draft.hour,
      minute: draft.minute,
      endsOn: weekly.endsOn,
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
  const todayDate = new Date();
  const today = localDate(todayDate);
  const days = Array.from({ length: ONCE_MAX_DAYS + 1 }, (_, k) => {
    const d = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() + k);
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
          <Text style={styles.section}>Jours</Text>
          <WeekdayChips days={draft.weekdays} onChange={(weekdays) => set({ weekdays })} />
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
      {draft.recurrence === 'weekly' ? (
        <>
          <Text style={styles.section}>Pendant</Text>
          <View style={styles.chips}>
            {ENDS_CHOICES.map((choice) => (
              <Chip key={choice.id} label={choice.label} on={draft.until === choice.id} onPress={() => set({ until: choice.id })} />
            ))}
            <Chip label="Choisir la date de fin" on={draft.until === 'date'} onPress={() => set({ until: 'date' })} />
          </View>
          {draft.until === 'date' ? (
            <DateStepper
              label="Dernier jour"
              value={draft.untilDate}
              min={today}
              max={addMonths(today, ENDS_MAX_MONTHS)}
              onChange={(untilDate) => set({ untilDate })}
            />
          ) : null}
          <Text style={styles.hint}>{weeklySummary(weekly)}</Text>
          {endsError ? <Text style={styles.error}>{endsError}</Text> : null}
        </>
      ) : (
        <Text style={styles.hint}>{timeLabel(draft.hour, draft.minute)}, heure de ce téléphone.</Text>
      )}
      {onceError ? <Text style={styles.error}>{onceError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={gatheringId ? 'Enregistrer' : 'Créer le rendez-vous'} onPress={() => void save()} disabled={!canSave} busy={busy} />
    </FormScreen>
  );
}

/** « Les mardis, jeudis et samedis de 10 h à 10 h 15, jusqu’au 30 novembre, heure de ce téléphone (Europe/Paris). » */
function weeklySummary(rdv: Schedule): string {
  const zone = deviceTimeZone();
  const next = nextOccurrences(rdv, new Date(), 1)[0];
  const text = next ? recurrenceText(rdv, next, zone) : '';
  return text
    ? `${text}, heure de ce téléphone (${zone}). Les membres d’un autre fuseau la voient à leur heure, avec l’heure d’origine.`
    : '';
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
    steppers: { flexDirection: 'row', gap: 12 },
    stepper: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 6, alignItems: 'center' },
    stepperLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    stepperValue: { color: C.text, fontSize: 28, fontWeight: '800', minWidth: 44, textAlign: 'center' },
    stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardHi },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
