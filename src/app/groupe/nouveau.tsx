import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from '../../appearance';
import { NeedProfile, useGroupGate } from '../../group-ui';
import {
  createGroup,
  DESCRIPTION_MAX,
  descriptionProblem,
  END_CHOICES,
  type EndChoiceId,
  endDateFor,
  endLabel,
  type GroupKind,
  KIND_HELP,
  KIND_ORDER,
  kindLabel,
  NAME_MAX,
  nameProblem,
} from '../../groups';
import { haptic } from '../../haptics';
import { Button, Field, FormScreen, Lead } from '../../profile-ui';
import { Text } from '../../text';
import { useThemed } from '../../theme';

export default function NouveauGroupe() {
  const { C, styles } = useThemed(stylesFor);
  const gate = useGroupGate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<GroupKind>('fraternite');
  const [choice, setChoice] = useState<EndChoiceId>('9j');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate.loading) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;

  const nameError = name.trim() ? nameProblem(name) : null;
  const descriptionError = descriptionProblem(description);
  const ends = endDateFor(choice);
  const canCreate = !nameProblem(name) && !descriptionError;

  const create = async () => {
    if (busy || !canCreate) return;
    setBusy(true);
    setError(null);
    const result = await createGroup({ name, description, kind, endsAt: kind === 'ephemere' ? ends : null });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    haptic('success');
    if (typeof result.data === 'string') router.replace({ pathname: '/groupe/[id]', params: { id: result.data } });
    else router.back();
  };

  return (
    <FormScreen>
      <Lead>Un groupe réunit des personnes qui prient ensemble. Seuls les membres voient les pseudos et les intentions du groupe.</Lead>
      <Field
        label="Nom"
        value={name}
        onChangeText={setName}
        max={NAME_MAX}
        error={!!nameError}
        hint={nameError ?? undefined}
        placeholder="par exemple Fraternité Saint-Joseph"
      />
      <Field
        label="Description (facultative)"
        value={description}
        onChangeText={setDescription}
        max={DESCRIPTION_MAX}
        multiline
        error={!!descriptionError}
        hint={descriptionError ?? undefined}
      />

      <Text style={styles.section}>Type de groupe</Text>
      {KIND_ORDER.map((option) => {
        const on = option === kind;
        return (
          <Pressable
            key={option}
            onPress={() => setKind(option)}
            style={[styles.option, on && styles.optionOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? C.gold : C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{kindLabel(option)}</Text>
              <Text style={styles.optionHelp}>{KIND_HELP[option]}</Text>
            </View>
          </Pressable>
        );
      })}

      {kind === 'ephemere' ? (
        <>
          <Text style={styles.section}>Durée</Text>
          <View style={styles.chips}>
            {END_CHOICES.map((option) => {
              const on = option.id === choice;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setChoice(option.id)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>{endLabel(ends.toISOString())}. Ensuite le groupe reste en lecture seule.</Text>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Créer le groupe" onPress={() => void create()} disabled={!canCreate} busy={busy} />
    </FormScreen>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    section: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: C.line,
    },
    optionOn: { borderColor: C.gold },
    optionTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    optionHelp: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: C.line },
    chipOn: { backgroundColor: C.gold, borderColor: C.gold },
    chipText: { color: C.text, fontWeight: '700', fontSize: 14 },
    chipTextOn: { color: C.onGold },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 8 },
    error: { color: C.red, fontSize: 14, marginTop: 8 },
  });
