import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SERIF } from '../cards';
import { C } from '../liturgy';
import { useApp } from '../storage';

/** Écrire ou modifier une prière personnelle. */
export default function PrayerEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { progress, saveCustomPrayer, togglePin } = useApp();
  const existing = progress.customPrayers.find((p) => p.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const canSave = title.trim().length > 0 && text.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const savedId = saveCustomPrayer({ id: existing?.id, title: title.trim(), text: text.trim() });
    if (existing) {
      if (router.canGoBack()) router.back();
      else router.replace(`/priere/${savedId}`);
    } else {
      // Une prière qu'on vient d'écrire, on veut la retrouver vite : on l'épingle d'emblée.
      togglePin(savedId);
      router.replace(`/priere/${savedId}`);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: existing ? 'Modifier ma prière' : 'Nouvelle prière',
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={10}>
              <Text style={[styles.save, !canSave && { opacity: 0.35 }]}>Enregistrer</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Titre</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. : Prière pour ma famille"
          placeholderTextColor={C.faint}
          style={styles.title}
          maxLength={80}
          autoFocus={!existing}
        />
        <Text style={styles.label}>Prière</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={'Seigneur,\n…'}
          placeholderTextColor={C.faint}
          style={styles.text}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.hint}>Une ligne vide sépare deux paragraphes. Ta prière reste sur ton téléphone.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  label: { color: C.muted, fontSize: 12, letterSpacing: 1.8, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  title: {
    color: C.text,
    fontFamily: SERIF,
    fontSize: 24,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  text: {
    color: C.text,
    fontFamily: SERIF,
    fontSize: 19,
    lineHeight: 29,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 260,
  },
  hint: { color: C.faint, fontSize: 13, marginTop: 10, lineHeight: 19 },
  save: { color: C.gold, fontSize: 16, fontWeight: '700' },
});
