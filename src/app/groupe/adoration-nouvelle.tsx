import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  type AdorationChain,
  CHAIN_INTENTION_MAX,
  CHAIN_SPANS,
  CHAIN_TITLE_MAX,
  type ChainInput,
  type ChainRecurrence,
  chainIntentionProblem,
  chainSpans,
  chainTitleProblem,
  createChain,
  DURATION_PRESETS,
  dayOffsetOf,
  getChain,
  localInstant,
  MAX_ACTIVE_CHAINS,
  OCCURRENCES_MAX,
  occurrenceMinutes,
  PLACE_MAX,
  periodLabel,
  periodProblem,
  placeProblem,
  recurrenceLabel,
  SLOT_CHOICES,
  type SlotMinutes,
  SPAN_MAX_DAYS,
  START_MAX_DAYS,
  slotDateLabel,
  slotSummary,
  updateChain,
  type WeeklyPattern,
  weeklyOccurrences,
  weeklyProblem,
} from '../../adoration-chain';
import type { Palette } from '../../appearance';
import { localDate, shiftDay, shortDate, WEEKDAYS } from '../../dates';
import { deviceTimeZone, durationLabel, lastDayFor, timeLabel, weekdaysInZone, zonedParts } from '../../gatherings';
import { NeedProfile, useGroupGate } from '../../group-ui';
import { canModerate, firstParam, type GroupDetail, getGroup } from '../../groups';
import { haptic } from '../../haptics';
import { Chip } from '../../novena-ui';
import { localDateIn } from '../../novenas';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { DateStepper, WeekdayChips } from '../../recurrence-ui';
import { Text } from '../../text';
import { useThemed } from '../../theme';

type Draft = {
  title: string;
  intention: string;
  place: string;
  slotMinutes: SlotMinutes;
  recurrence: ChainRecurrence;
  /** Ponctuel — début : jours à partir d'aujourd'hui, heure, minutes (0 ou 30). Hebdomadaire — heure et minutes de début de chaque plage. */
  dayOffset: number;
  hour: number;
  minute: number;
  /** Ponctuel — fin : une durée rapide, ou une fin explicite (jours à partir d'aujourd'hui, heure, minutes). */
  preset: number | null;
  endDayOffset: number;
  endHour: number;
  endMinute: number;
  /** Hebdomadaire : les jours, 0 (dimanche) à 6. */
  weekdays: number[];
  /** Hebdomadaire : le premier jour (AAAA-MM-JJ), l'heure de fin de chaque plage (le lendemain si elle n'est pas après le début). */
  firstOn: string;
  localEndHour: number;
  localEndMinute: number;
  /** Hebdomadaire — « Pendant » : un choix rapide (CHAIN_SPANS) ou `date` (une date de fin choisie, `lastDate`). */
  span: string;
  lastDate: string;
};

const emptyDraft = (): Draft => ({
  title: '',
  intention: '',
  place: '',
  slotMinutes: 60,
  recurrence: 'once',
  dayOffset: 1,
  hour: 21,
  minute: 0,
  preset: 600,
  endDayOffset: 2,
  endHour: 7,
  endMinute: 0,
  weekdays: [5],
  firstOn: shiftDay(localDate(), 1),
  localEndHour: 22,
  localEndMinute: 0,
  span: 'w3',
  lastDate: shiftDay(localDate(), 41),
});

/** « Aujourd’hui », « Demain », puis « Sam. 17 oct. » */
function dayChip(offset: number, now: Date): string {
  if (offset === 0) return 'Aujourd’hui';
  if (offset === 1) return 'Demain';
  const d = localInstant(offset, 12, 0, now);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${WEEKDAYS[d.getDay()].slice(0, 3)}. ${shortDate(iso)}`;
}

const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Le formulaire d'une chaîne existante, vu depuis le fuseau de ce téléphone. */
function draftFrom(chain: AdorationChain): Draft {
  const base: Draft = {
    ...emptyDraft(),
    title: chain.title,
    intention: chain.intention,
    place: chain.place,
    slotMinutes: chain.slotMinutes,
    recurrence: chain.recurrence,
  };
  const zone = deviceTimeZone();
  if (chain.recurrence === 'weekly') {
    const spans = chainSpans(chain);
    const first = spans[0];
    const last = spans[spans.length - 1];
    if (!first || !last) return base;
    const a = zonedParts(first.start.getTime(), zone);
    const b = zonedParts(first.end.getTime(), zone);
    return {
      ...base,
      weekdays: weekdaysInZone(chain.weekdays, first.start, chain.timezone, zone),
      hour: a.hour,
      minute: a.minute,
      localEndHour: b.hour,
      localEndMinute: b.minute,
      firstOn: localDateIn(first.start.getTime(), zone),
      span: 'date',
      lastDate: localDateIn(last.start.getTime(), zone),
    };
  }
  const start = new Date(chain.startsAt);
  const end = new Date(chain.endsAt);
  const now = new Date();
  return {
    ...base,
    dayOffset: Math.max(0, dayOffsetOf(start, now)),
    hour: start.getHours(),
    minute: start.getMinutes() >= 30 ? 30 : 0,
    preset: null,
    endDayOffset: Math.max(0, dayOffsetOf(end, now)),
    endHour: end.getHours(),
    endMinute: end.getMinutes(),
  };
}

export default function AdorationNouvelleScreen() {
  const { C, styles } = useThemed(stylesFor);
  const params = useLocalSearchParams<{ id?: string | string[]; chain?: string | string[] }>();
  const groupId = firstParam(params.id);
  const chainId = firstParam(params.chain);
  const gate = useGroupGate();
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // En modification : la chaîne telle qu'elle est enregistrée. Dès qu'elle a commencé ou que des créneaux sont réservés, son rythme
  // ne change plus : seule sa fin peut être repoussée (le serveur le refuse sinon).
  const [original, setOriginal] = useState<{ chain: AdorationChain; started: boolean; reserved: boolean } | null>(null);
  const [loading, setLoading] = useState(!!chainId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gate.ready) return;
    let alive = true;
    void getGroup(groupId).then((result) => {
      if (!alive) return;
      if (result.ok) setGroup(result.group);
      else {
        setLoadError(result.message);
        setGroup(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [groupId, gate.ready]);

  useEffect(() => {
    if (!chainId || !gate.ready) return;
    let alive = true;
    void getChain(chainId).then((result) => {
      if (!alive) return;
      if (result.ok && result.chain) {
        const chain = result.chain;
        setDraft(draftFrom(chain));
        setOriginal({ chain, started: Date.parse(chain.startsAt) <= Date.now(), reserved: chain.reserved });
      } else setError(result.ok ? 'Cette chaîne n’existe plus.' : result.message);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [chainId, gate.ready]);

  if (gate.loading || loading || (gate.ready && group === undefined)) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (group?.myStatus !== 'member') {
    return <Text style={styles.message}>{loadError ?? 'Ce groupe n’existe pas, ou tu n’en fais pas partie.'}</Text>;
  }
  if (group.ended) return <Text style={styles.message}>Ce groupe est terminé : on n’y organise plus de chaîne d’adoration.</Text>;
  if (!canModerate(group.myRole)) {
    return <Text style={styles.message}>Seuls le propriétaire et les modérateurs peuvent organiser une chaîne d’adoration.</Text>;
  }
  if (chainId && !original) return <Text style={styles.message}>{error ?? 'Cette chaîne n’existe plus.'}</Text>;

  const now = new Date();
  const today = localDate(now);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const weekly = draft.recurrence === 'weekly';
  const locked = !!original && (original.started || original.reserved);

  // Ponctuel : début et fin en instants.
  const start =
    locked && original && !weekly ? new Date(original.chain.startsAt) : localInstant(draft.dayOffset, draft.hour, draft.minute, now);
  const end =
    draft.preset !== null
      ? new Date(start.getTime() + draft.preset * 60_000)
      : localInstant(draft.endDayOffset, draft.endHour, draft.endMinute, now);

  // Hebdomadaire : le motif. Verrouillé, on renvoie celui qui est enregistré (dans le fuseau de la chaîne).
  const firstOn = locked && original?.chain.firstOn ? original.chain.firstOn : draft.firstOn;
  const choice = CHAIN_SPANS.find((c) => c.id === draft.span);
  const lastOn = draft.span === 'date' || !choice ? draft.lastDate : (lastDayFor(choice, firstOn) ?? draft.lastDate);
  const pattern: WeeklyPattern =
    locked && original?.chain.localStart && original.chain.localEnd && original.chain.firstOn
      ? {
          weekdays: original.chain.weekdays,
          localStart: original.chain.localStart,
          localEnd: original.chain.localEnd,
          timezone: original.chain.timezone,
          firstOn: original.chain.firstOn,
          lastOn,
        }
      : {
          weekdays: draft.weekdays,
          localStart: hhmm(draft.hour, draft.minute),
          localEnd: hhmm(draft.localEndHour, draft.localEndMinute),
          timezone: deviceTimeZone(),
          firstOn: draft.firstOn,
          lastOn,
        };

  const problemOfPeriod = weekly
    ? weeklyProblem({ pattern, slotMinutes: draft.slotMinutes, now, groupEndsAt: group.endsAt, keepStart: locked })
    : periodProblem({
        start,
        end,
        slotMinutes: draft.slotMinutes,
        now,
        groupEndsAt: group.endsAt,
        keepStart: !!original && (original.started || start.getTime() === Date.parse(original.chain.startsAt)),
      });
  const lockedEndProblem =
    locked && original
      ? weekly
        ? original.chain.lastOn && lastOn < original.chain.lastOn
          ? 'La fin peut seulement être repoussée.'
          : null
        : end.getTime() < Date.parse(original.chain.endsAt)
          ? 'La fin peut seulement être repoussée.'
          : null
      : null;
  const titleError = draft.title.trim() ? chainTitleProblem(draft.title) : null;
  const intentionError = chainIntentionProblem(draft.intention);
  const placeError = placeProblem(draft.place);
  const periodError = problemOfPeriod ?? lockedEndProblem;
  const canSave = !chainTitleProblem(draft.title) && !intentionError && !placeError && !periodError;

  // Le résumé affiché sous le formulaire.
  const occurrences = weekly && !periodError ? weeklyOccurrences(pattern) : [];
  const summary = weekly
    ? occurrences.length > 0
      ? {
          startsAt: occurrences[0].start.toISOString(),
          endsAt: occurrences[occurrences.length - 1].end.toISOString(),
          occurrences: occurrences.length,
        }
      : null
    : null;
  const weeklySchedule = summary
    ? {
        recurrence: 'weekly' as const,
        slotMinutes: draft.slotMinutes,
        timezone: pattern.timezone,
        startsAt: summary.startsAt,
        endsAt: summary.endsAt,
        weekdays: pattern.weekdays,
        localStart: pattern.localStart,
        localEnd: pattern.localEnd,
        firstOn: pattern.firstOn,
        lastOn: pattern.lastOn,
      }
    : null;
  const plageMinutes = weekly ? occurrenceMinutes(pattern.localStart, pattern.localEnd) : null;
  const period = { startsAt: start.toISOString(), endsAt: end.toISOString(), slotMinutes: draft.slotMinutes };

  const save = async () => {
    if (busy || !canSave) return;
    setBusy(true);
    setError(null);
    const texts = { title: draft.title, intention: draft.intention, place: draft.place };
    const input: ChainInput = weekly
      ? {
          ...texts,
          recurrence: 'weekly',
          slotMinutes: locked && original ? original.chain.slotMinutes : draft.slotMinutes,
          weekdays: pattern.weekdays,
          localStart: pattern.localStart,
          localEnd: pattern.localEnd,
          firstOn: pattern.firstOn,
          lastOn: pattern.lastOn,
        }
      : {
          ...texts,
          recurrence: 'once',
          slotMinutes: locked && original ? original.chain.slotMinutes : draft.slotMinutes,
          startsAt: start,
          endsAt: end,
        };
    const result = chainId ? await updateChain(chainId, input) : await createChain(groupId, input);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    haptic('success');
    const created = !chainId && typeof result.data === 'string' ? result.data : null;
    if (created) router.replace({ pathname: '/adoration-chaine/[id]', params: { id: created } });
    else router.back();
  };

  const startDays = Array.from({ length: START_MAX_DAYS + 1 }, (_, k) => k);
  const endDays = Array.from({ length: START_MAX_DAYS + 9 }, (_, k) => k);

  const lockNote = original?.started
    ? 'Cette chaîne a déjà commencé : ses jours, ses heures et la durée des créneaux ne changent plus. Tu peux repousser sa fin.'
    : 'Des créneaux sont déjà réservés : les jours, les heures et la durée des créneaux ne changent plus. Tu peux repousser la fin.';

  return (
    <FormScreen>
      <Lead>
        Une chaîne d’adoration couvre des plages de temps par créneaux de 30 ou 60 minutes : chaque membre réserve les créneaux où il veut
        adorer, et plusieurs personnes peuvent adorer en même temps. Elle a lieu une seule fois, ou se répète chaque semaine. Seuls les
        membres du groupe la voient. Un groupe a {MAX_ACTIVE_CHAINS} chaînes à venir ou en cours au plus.
      </Lead>
      <Field
        label="Titre"
        value={draft.title}
        onChangeText={(title) => set({ title })}
        max={CHAIN_TITLE_MAX}
        error={!!titleError}
        hint={titleError ?? undefined}
        placeholder="par exemple Nuit d’adoration"
      />
      <Field
        label="Intention (facultative)"
        value={draft.intention}
        onChangeText={(intention) => set({ intention })}
        max={CHAIN_INTENTION_MAX}
        multiline
        error={!!intentionError}
        hint={intentionError ?? 'Tous les membres du groupe verront cette intention.'}
      />
      <Field
        label="Lieu (facultatif)"
        value={draft.place}
        onChangeText={(place) => set({ place })}
        max={PLACE_MAX}
        error={!!placeError}
        hint={placeError ?? 'Laisse vide si chacun adore là où il est.'}
        placeholder="par exemple Chapelle Saint-Joseph"
      />

      {chainId ? null : (
        <>
          <Text style={styles.section}>Récurrence</Text>
          <View style={styles.chips}>
            <Chip label="Une seule fois" on={!weekly} onPress={() => set({ recurrence: 'once' })} />
            <Chip label="Chaque semaine" on={weekly} onPress={() => set({ recurrence: 'weekly' })} />
          </View>
        </>
      )}

      <Text style={styles.section}>Créneaux</Text>
      <View style={styles.chips}>
        {SLOT_CHOICES.map((min) => (
          <Chip
            key={min}
            label={`${min} min`}
            on={draft.slotMinutes === min}
            onPress={() => {
              if (!locked) set({ slotMinutes: min });
            }}
          />
        ))}
      </View>
      {locked ? <Text style={styles.hint}>{lockNote}</Text> : null}

      {weekly ? (
        <>
          {locked && original ? (
            <>
              <Text style={styles.section}>Rythme</Text>
              <Text style={styles.summaryText}>{recurrenceLabel(original.chain)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.section}>Jours</Text>
              <WeekdayChips days={draft.weekdays} onChange={(weekdays) => set({ weekdays })} />

              <Text style={styles.section}>Premier jour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {startDays.map((k) => (
                  <Chip
                    key={k}
                    label={dayChip(k, now)}
                    on={draft.firstOn === shiftDay(today, k)}
                    onPress={() => set({ firstOn: shiftDay(today, k) })}
                  />
                ))}
              </ScrollView>

              <Text style={styles.section}>De</Text>
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
                  onMinus={() => set({ minute: draft.minute === 0 ? 30 : 0 })}
                  onPlus={() => set({ minute: draft.minute === 0 ? 30 : 0 })}
                />
              </View>
              <Text style={styles.section}>À</Text>
              <View style={styles.steppers}>
                <Stepper
                  label="Heure"
                  value={String(draft.localEndHour).padStart(2, '0')}
                  onMinus={() => set({ localEndHour: (draft.localEndHour + 23) % 24 })}
                  onPlus={() => set({ localEndHour: (draft.localEndHour + 1) % 24 })}
                />
                <Stepper
                  label="Minutes"
                  value={String(draft.localEndMinute).padStart(2, '0')}
                  onMinus={() => set({ localEndMinute: draft.localEndMinute === 0 ? 30 : 0 })}
                  onPlus={() => set({ localEndMinute: draft.localEndMinute === 0 ? 30 : 0 })}
                />
              </View>
              {plageMinutes !== null ? (
                <Text style={styles.hint}>
                  Chaque plage dure {durationLabel(plageMinutes)}
                  {plageMinutes % draft.slotMinutes === 0
                    ? `, soit ${plageMinutes / draft.slotMinutes} créneaux de ${draft.slotMinutes} min`
                    : ''}
                  {pattern.localEnd <= pattern.localStart ? ' ; elle finit le lendemain' : ''}. Elle va de 30 min à 24 h.
                </Text>
              ) : null}
            </>
          )}

          <Text style={styles.section}>Pendant</Text>
          <View style={styles.chips}>
            {CHAIN_SPANS.map((c) => (
              <Chip key={c.id} label={c.label} on={draft.span === c.id} onPress={() => set({ span: c.id })} />
            ))}
            <Chip label="Choisir la date de fin" on={draft.span === 'date'} onPress={() => set({ span: 'date', lastDate: lastOn })} />
          </View>
          {draft.span === 'date' ? (
            <DateStepper
              label="Dernier jour"
              value={draft.lastDate}
              min={locked && original?.chain.lastOn ? original.chain.lastOn : firstOn}
              max={shiftDay(firstOn, SPAN_MAX_DAYS)}
              onChange={(lastDate) => set({ lastDate })}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.section}>Début</Text>
          {locked ? (
            <Text style={styles.hint}>
              {original?.started
                ? 'Cette chaîne a déjà commencé : son début ne change plus.'
                : 'Des créneaux sont déjà réservés : le début ne change plus.'}
            </Text>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {startDays.map((k) => (
                  <Chip key={k} label={dayChip(k, now)} on={draft.dayOffset === k} onPress={() => set({ dayOffset: k })} />
                ))}
              </ScrollView>
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
                  onMinus={() => set({ minute: draft.minute === 0 ? 30 : 0 })}
                  onPlus={() => set({ minute: draft.minute === 0 ? 30 : 0 })}
                />
              </View>
            </>
          )}

          <Text style={styles.section}>Durée</Text>
          <View style={styles.chips}>
            {DURATION_PRESETS.map((p) => (
              <Chip key={p.minutes} label={p.label} on={draft.preset === p.minutes} onPress={() => set({ preset: p.minutes })} />
            ))}
            <Chip
              label="Choisir la fin"
              on={draft.preset === null}
              onPress={() =>
                set({
                  preset: null,
                  endDayOffset: Math.max(0, dayOffsetOf(end, now)),
                  endHour: end.getHours(),
                  endMinute: end.getMinutes() >= 30 ? 30 : 0,
                })
              }
            />
          </View>
          {draft.preset === null ? (
            <>
              <Text style={styles.section}>Fin</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {endDays.map((k) => (
                  <Chip key={k} label={dayChip(k, now)} on={draft.endDayOffset === k} onPress={() => set({ endDayOffset: k })} />
                ))}
              </ScrollView>
              <View style={styles.steppers}>
                <Stepper
                  label="Heure"
                  value={String(draft.endHour).padStart(2, '0')}
                  onMinus={() => set({ endHour: (draft.endHour + 23) % 24 })}
                  onPlus={() => set({ endHour: (draft.endHour + 1) % 24 })}
                />
                <Stepper
                  label="Minutes"
                  value={String(draft.endMinute).padStart(2, '0')}
                  onMinus={() => set({ endMinute: draft.endMinute === 0 ? 30 : 0 })}
                  onPlus={() => set({ endMinute: draft.endMinute === 0 ? 30 : 0 })}
                />
              </View>
            </>
          ) : null}
        </>
      )}

      <View style={styles.summary}>
        <Ionicons name={weekly ? 'repeat-outline' : 'sunny-outline'} size={18} color={C.gold} />
        <View style={{ flex: 1 }}>
          {weekly ? (
            weeklySchedule && summary ? (
              <>
                <Text style={styles.summaryText}>{recurrenceLabel(weeklySchedule)}</Text>
                <Text style={styles.hint}>{slotSummary({ ...weeklySchedule, occurrenceCount: summary.occurrences })}</Text>
                <Text style={styles.hint}>Première plage : {slotDateLabel(occurrences[0].start, occurrences[0].end)}</Text>
              </>
            ) : (
              <Text style={styles.summaryText}>Choisis les jours, les heures et la durée.</Text>
            )
          ) : (
            <>
              <Text style={styles.summaryText}>{periodLabel(period)}</Text>
              {slotSummary({ recurrence: 'once', ...period, occurrenceCount: 1 }) ? (
                <Text style={styles.hint}>{slotSummary({ recurrence: 'once', ...period, occurrenceCount: 1 })}</Text>
              ) : null}
            </>
          )}
        </View>
      </View>
      <Text style={styles.hint}>
        {weekly
          ? `Heures du téléphone (${deviceTimeZone()}) : les membres d’un autre fuseau voient l’heure d’origine en plus. La première plage commence dans les ${START_MAX_DAYS} prochains jours, la chaîne dure un an au plus, avec ${OCCURRENCES_MAX} plages au plus.`
          : `Début à ${timeLabel(start.getHours(), start.getMinutes())}, heure de ce téléphone (${deviceTimeZone()}). Les membres d’un autre fuseau la voient à leur heure, avec l’heure d’origine. La chaîne dure de 1 h à 7 jours, et elle commence dans les ${START_MAX_DAYS} prochains jours.`}
      </Text>
      {periodError ? <Text style={styles.error}>{periodError}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={chainId ? 'Enregistrer' : 'Organiser la chaîne'} onPress={() => void save()} disabled={!canSave} busy={busy} />
    </FormScreen>
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
    message: { color: C.muted, fontSize: 15, lineHeight: 22, padding: 20 },
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    steppers: { flexDirection: 'row', gap: 12, marginTop: 12 },
    stepper: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, gap: 6, alignItems: 'center' },
    stepperLabel: { color: C.muted, fontSize: 13, fontWeight: '700' },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    stepperValue: { color: C.text, fontSize: 28, fontWeight: '800', minWidth: 44, textAlign: 'center' },
    stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.cardHi },
    summary: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginTop: 20,
    },
    summaryText: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
