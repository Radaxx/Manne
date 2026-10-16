import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Palette } from '../../appearance';
import { CUSTOM_SHORT, NOVENAS, novenaModelTitle, PASSAGE_SET_DATA } from '../../data/novenas';
import { dayLabel, shiftDay, shortDate, WEEKDAYS } from '../../dates';
import { deviceTimeZone } from '../../gatherings';
import { NeedProfile, useGroupGate } from '../../group-ui';
import { canModerate, firstParam, type GroupDetail, getGroup } from '../../groups';
import { haptic } from '../../haptics';
import { Chip } from '../../novena-ui';
import {
  CUSTOM_PRAYER_MAX,
  customPrayerProblem,
  endsAfterGroup,
  intentionProblem,
  MAX_ACTIVE_NOVENAS,
  NOVENA_INTENTION_MAX,
  type NovenaModel,
  PASSAGE_SETS,
  type PassageSetId,
  START_MAX_DAYS,
  startDateFor,
  startNovena,
} from '../../novenas';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { useThemed } from '../../theme';

type ModelChoice = { id: NovenaModel; title: string; short: string };

const CHOICES: ModelChoice[] = [
  ...NOVENAS.map((n) => ({ id: n.id, title: n.title, short: n.short })),
  { id: 'personnalisee', title: 'Neuvaine personnalisée', short: CUSTOM_SHORT },
];

/** « Aujourd’hui », « Demain », puis « Sam. 17 oct. » */
function startLabel(offset: number): string {
  if (offset === 0) return 'Aujourd’hui';
  if (offset === 1) return 'Demain';
  const iso = startDateFor(offset);
  return `${WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()].slice(0, 3)}. ${shortDate(iso)}`;
}

export default function NeuvaineNouvelleScreen() {
  const { C, styles } = useThemed(stylesFor);
  const groupId = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const [group, setGroup] = useState<GroupDetail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [model, setModel] = useState<NovenaModel>('esprit-saint');
  const [intention, setIntention] = useState('');
  const [customPrayer, setCustomPrayer] = useState('');
  const [passageSet, setPassageSet] = useState<PassageSetId | null>(null);
  const [offset, setOffset] = useState(0);
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

  if (gate.loading || (gate.ready && group === undefined)) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;
  if (group?.myStatus !== 'member') {
    return <Text style={styles.message}>{loadError ?? 'Ce groupe n’existe pas, ou tu n’en fais pas partie.'}</Text>;
  }
  if (group.ended) return <Text style={styles.message}>Ce groupe est terminé : on n’y lance plus de neuvaine.</Text>;
  if (!canModerate(group.myRole)) {
    return <Text style={styles.message}>Seuls le propriétaire et les modérateurs peuvent lancer une neuvaine.</Text>;
  }

  const custom = model === 'personnalisee';
  const startDate = startDateFor(offset);
  const timezone = deviceTimeZone();
  const intentionError = intention.trim() ? intentionProblem(intention) : null;
  const prayerError = custom && customPrayer.trim() ? customPrayerProblem(customPrayer) : null;
  const tooLate = endsAfterGroup({ startDate, timezone }, group.endsAt);
  const canSave = !intentionProblem(intention) && (!custom || !customPrayerProblem(customPrayer)) && !tooLate;

  const save = async () => {
    if (busy || !canSave) return;
    setBusy(true);
    setError(null);
    const result = await startNovena(groupId, {
      model,
      title: novenaModelTitle(model),
      intention,
      customPrayer,
      passageSet,
      startDate,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    haptic('success');
    const created = typeof result.data === 'string' ? result.data : null;
    if (created) router.replace({ pathname: '/neuvaine/[id]', params: { id: created } });
    else router.back();
  };

  return (
    <FormScreen>
      <Lead>
        Une neuvaine, ce sont neuf jours de prière pour une même intention. Chaque membre du groupe marque les jours qu’il a priés ; on
        compte les priants, sans les nommer. Un groupe a {MAX_ACTIVE_NOVENAS} neuvaines en cours au plus.
      </Lead>

      <Text style={styles.section}>Modèle</Text>
      {CHOICES.map((choice) => (
        <Pressable
          key={choice.id}
          onPress={() => setModel(choice.id)}
          style={[styles.choice, model === choice.id && styles.choiceOn]}
          accessibilityRole="radio"
          accessibilityState={{ selected: model === choice.id }}
        >
          <Text style={styles.choiceTitle}>{choice.title}</Text>
          <Text style={styles.choiceText}>{choice.short}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Pour quoi prions-nous ?</Text>
      <Field
        label="Intention commune"
        value={intention}
        onChangeText={setIntention}
        max={NOVENA_INTENTION_MAX}
        multiline
        error={!!intentionError}
        hint={intentionError ?? 'Tous les membres du groupe verront cette intention.'}
        placeholder="par exemple la guérison d’un proche, ou la paix dans nos familles"
      />

      {custom ? (
        <>
          <Field
            label="Prière récitée chaque jour"
            value={customPrayer}
            onChangeText={setCustomPrayer}
            max={CUSTOM_PRAYER_MAX}
            multiline
            error={!!prayerError}
            hint={
              prayerError ??
              'Le groupe la récite chaque jour, pendant neuf jours. Écris ta propre prière, ou une prière ancienne que tu connais.'
            }
          />
          <Text style={styles.section}>Un passage par jour (facultatif)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="Aucun passage" on={passageSet === null} onPress={() => setPassageSet(null)} />
            {PASSAGE_SETS.map((set) => (
              <Chip key={set} label={PASSAGE_SET_DATA[set].name} on={passageSet === set} onPress={() => setPassageSet(set)} />
            ))}
          </ScrollView>
          <Text style={styles.hint}>
            Les passages sont lus dans la traduction de chacun, du jour 1 au jour 9, dans l’ordre de la liste.
          </Text>
        </>
      ) : null}

      <Text style={styles.section}>Début</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {Array.from({ length: START_MAX_DAYS + 1 }, (_, k) => (
          <Chip key={k} label={startLabel(k)} on={offset === k} onPress={() => setOffset(k)} />
        ))}
      </ScrollView>
      <Text style={styles.hint}>
        Le jour 1 est le {dayLabel(startDate)} et le jour 9 le {dayLabel(shiftDay(startDate, 8))}. Les jours changent à minuit, à l’heure de
        ce téléphone ({timezone}) : les membres d’un autre fuseau suivent les mêmes dates.
      </Text>
      {tooLate ? <Text style={styles.error}>Ce groupe se termine avant la fin de la neuvaine : choisis un début plus tôt.</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Lancer la neuvaine" onPress={() => void save()} disabled={!canSave} busy={busy} />
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    message: { color: C.muted, fontSize: 15, lineHeight: 22, padding: 20 },
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    choice: { backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 4, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
    choiceOn: { borderColor: C.gold },
    choiceTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    choiceText: { color: C.muted, fontSize: 14, lineHeight: 20 },
    chips: { flexDirection: 'row', gap: 8 },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
