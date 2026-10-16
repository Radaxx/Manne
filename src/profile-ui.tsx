import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import type { Palette } from './appearance';
import { Avatar } from './avatar';
import { handleProblem, isHandleAvailable, normalizeHandle, type ProfileCard } from './profile';
import { usePalette, useThemed } from './theme';

/** L'icône réglages du coin de l'en-tête. */
export function SettingsButton() {
  const C = usePalette();
  return (
    <Pressable onPress={() => router.push('/reglages')} hitSlop={12} accessibilityLabel="Réglages" style={{ marginRight: 4 }}>
      <Ionicons name="settings-outline" size={22} color={C.text} />
    </Pressable>
  );
}

/** Un écran de formulaire : défile, remonte au-dessus du clavier. */
export function FormScreen({ children }: { children: ReactNode }) {
  const { styles } = useThemed(stylesFor);
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Title({ children }: { children: string }) {
  const { styles } = useThemed(stylesFor);
  return <Text style={styles.title}>{children}</Text>;
}

export function Lead({ children }: { children: ReactNode }) {
  const { styles } = useThemed(stylesFor);
  return <Text style={styles.lead}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  disabled,
  busy,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  kind?: 'primary' | 'secondary' | 'quiet';
}) {
  const { C, styles } = useThemed(stylesFor);
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        kind === 'primary' ? styles.primary : kind === 'secondary' ? styles.secondary : styles.quiet,
        off && styles.off,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={kind === 'primary' ? C.onGold : C.gold} />
      ) : (
        <Text style={kind === 'primary' ? styles.primaryText : kind === 'secondary' ? styles.secondaryText : styles.quietText}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Un champ avec son étiquette, un compteur de caractères facultatif et un message. */
export function Field({
  label,
  value,
  onChangeText,
  max,
  hint,
  error,
  ...input
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  max?: number;
  hint?: string;
  error?: boolean;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'placeholderTextColor'>) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {max ? (
          <Text style={styles.count}>
            {value.length}/{max}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        maxLength={max}
        placeholderTextColor={C.faint}
        style={[styles.input, input.multiline && styles.multiline, error && styles.inputError]}
        {...input}
      />
      {hint ? <Text style={[styles.hint, error && styles.hintError]}>{hint}</Text> : null}
    </View>
  );
}

export type HandleStatus = 'empty' | 'invalid' | 'checking' | 'free' | 'taken' | 'unknown';

/** Vérifie un pseudo : le format tout de suite, la disponibilité après une courte pause dans la frappe. */
export function useHandleCheck(value: string, own?: string) {
  const handle = normalizeHandle(value);
  const problem = handle ? handleProblem(handle) : null;
  const [answer, setAnswer] = useState<{ handle: string; state: 'free' | 'taken' | 'unknown' } | null>(null);
  const skip = !handle || !!problem || handle === own;

  useEffect(() => {
    if (skip) return;
    let alive = true;
    const timer = setTimeout(() => {
      void isHandleAvailable(handle).then((result) => {
        if (alive) setAnswer({ handle, state: !result.ok ? 'unknown' : result.available ? 'free' : 'taken' });
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [handle, skip]);

  const status: HandleStatus = !handle
    ? 'empty'
    : problem
      ? 'invalid'
      : handle === own
        ? 'free'
        : answer?.handle === handle
          ? answer.state
          : 'checking';
  const message =
    status === 'invalid'
      ? (problem ?? undefined)
      : status === 'checking'
        ? 'Vérification…'
        : status === 'free'
          ? 'Ce pseudo est libre.'
          : status === 'taken'
            ? 'Ce pseudo est déjà pris.'
            : status === 'unknown'
              ? 'Impossible de vérifier pour l’instant. Réessaie dans un instant.'
              : undefined;
  return { handle, status, ok: status === 'free', message, error: status === 'invalid' || status === 'taken' || status === 'unknown' };
}

/** Le champ du pseudo, avec l'aperçu de l'avatar et l'état de la vérification. */
export function HandleField({
  value,
  onChangeText,
  check,
}: {
  value: string;
  onChangeText: (value: string) => void;
  check: ReturnType<typeof useHandleCheck>;
}) {
  const { styles } = useThemed(stylesFor);
  return (
    <View style={styles.handleRow}>
      <Avatar handle={check.handle} size={64} />
      <View style={{ flex: 1 }}>
        <Field
          label="Pseudo"
          value={value}
          onChangeText={onChangeText}
          max={24}
          hint={check.message}
          error={check.error}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="par exemple jean.marie"
        />
      </View>
    </View>
  );
}

/** Une personne dans une liste : avatar et pseudo, avec une note éventuelle. */
export function PersonRow({ person, onPress }: { person: ProfileCard & { note?: string }; onPress: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.person, pressed && styles.pressed]} accessibilityRole="button">
      <Avatar handle={person.handle} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.personName} numberOfLines={1}>
          @{person.handle}
        </Text>
        {person.note ? (
          <Text style={styles.personHandle} numberOfLines={1}>
            {person.note}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </Pressable>
  );
}

export function openProfile(handle: string) {
  router.push({ pathname: '/profil/[handle]', params: { handle } });
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 6 },
    title: { color: C.text, fontSize: 26, fontWeight: '800', marginBottom: 4 },
    lead: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 12 },
    field: { marginTop: 10 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    label: { color: C.text, fontSize: 14, fontWeight: '700' },
    count: { color: C.faint, fontSize: 12, fontWeight: '600' },
    input: {
      color: C.text,
      backgroundColor: C.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginTop: 6,
      borderWidth: 1,
      borderColor: C.line,
    },
    multiline: { minHeight: 92, textAlignVertical: 'top' },
    inputError: { borderColor: C.red },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 6 },
    hintError: { color: C.red },
    handleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    primary: { backgroundColor: C.gold, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
    primaryText: { color: C.onGold, fontWeight: '800', fontSize: 16 },
    secondary: { borderRadius: 999, paddingVertical: 13, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: C.line },
    secondaryText: { color: C.text, fontWeight: '700', fontSize: 15 },
    quiet: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    quietText: { color: C.muted, fontWeight: '700', fontSize: 14 },
    off: { opacity: 0.4 },
    pressed: { opacity: 0.75 },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 14,
      padding: 12,
      marginBottom: 8,
    },
    personName: { color: C.text, fontSize: 16, fontWeight: '700' },
    personHandle: { color: C.muted, fontSize: 13, marginTop: 1 },
  });
