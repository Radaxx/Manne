import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Palette } from './appearance';
import { clampChapter, loadPassage, passageLabel } from './bible';
import { SERIF } from './cards';
import { setCarry } from './community';
import { haptic } from './haptics';
import { MASKED_NOTE } from './moderation';
import { useReportSheet } from './moderation-ui';
import { PrayerText } from './prayers';
import {
  excerpt,
  passageKey,
  reportProfilePrayer,
  type Showcase,
  type ShowcaseIntention,
  type ShowcasePassage,
  type ShowcasePrayer,
} from './showcase';
import { setIntentionShown, setPassageShown, setPrayerShown } from './showcase-store';
import { useApp } from './storage';
import { Text } from './text';
import { useThemed } from './theme';

const carried = (n: number) => (n === 0 ? 'Personne ne la porte encore' : n === 1 ? '1 personne la porte' : `${n} personnes la portent`);

/**
 * Les passages, prières et intentions affichés sur un profil.
 * `mine` : c'est ma vitrine (toutes les sections, une aide quand elles sont vides, « Retirer du profil »).
 * Sinon : celle d'une personne qui me suit, sans section vide, avec « Je la porte » sur les intentions.
 * `handle` : le pseudo de la personne dont c'est la vitrine ; il permet de signaler une de ses prières.
 */
export function ShowcaseSections({ showcase, mine, handle }: { showcase: Showcase; mine: boolean; handle?: string }) {
  const { styles } = useThemed(stylesFor);
  const { ask, sheet } = useReportSheet();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fail = (result: { ok: boolean; message?: string }) => setError(result.ok ? null : (result.message ?? null));
  const reportPrayer = (prayer: ShowcasePrayer) =>
    ask({
      title: 'Signaler cette prière ?',
      message: 'Trois signalements la masquent.',
      send: (reason) => {
        setError(null);
        setNote(null);
        if (!handle) return;
        void reportProfilePrayer(handle, prayer.id, reason).then((result) => {
          if (!result.ok) setError(result.message);
          else setNote('Merci, ton signalement est envoyé.');
        });
      },
    });

  const passages = showcase.passages;
  const prayers = showcase.prayers;
  const intentions = showcase.intentions;
  if (!mine && passages.length + prayers.length + intentions.length === 0) return null;

  return (
    <View>
      {mine ? (
        <Text style={styles.lead}>
          Ces éléments sont visibles par les personnes que tu suis et les membres de tes groupes. Rien n’est affiché sans ton choix.
        </Text>
      ) : null}

      {mine || passages.length > 0 ? (
        <>
          <Text style={styles.section}>Passages</Text>
          {passages.length === 0 ? (
            <Text style={styles.help}>Aucun passage affiché. Dans tes passages gardés, active « Afficher sur mon profil ».</Text>
          ) : null}
          {passages.map((passage) => (
            <PassageCard
              key={passageKey(passage)}
              passage={passage}
              onRemove={mine ? () => void setPassageShown(passage, false).then(fail) : undefined}
            />
          ))}
        </>
      ) : null}

      {mine || prayers.length > 0 ? (
        <>
          <Text style={styles.section}>Prières</Text>
          {prayers.length === 0 ? (
            <Text style={styles.help}>
              Aucune prière affichée. Ouvre une de tes prières personnelles et active « Afficher sur mon profil ».
            </Text>
          ) : null}
          {prayers.map((prayer) => (
            <PrayerCard
              key={prayer.id}
              prayer={prayer}
              onRemove={mine ? () => void setPrayerShown(prayer, false).then(fail) : undefined}
              onReport={!mine && handle ? () => reportPrayer(prayer) : undefined}
            />
          ))}
        </>
      ) : null}

      {mine || intentions.length > 0 ? (
        <>
          <Text style={styles.section}>Intentions</Text>
          {intentions.length === 0 ? (
            <Text style={styles.help}>Aucune intention affichée. Dans tes intentions confiées, active « Afficher sur mon profil ».</Text>
          ) : null}
          {intentions.map((intention) => (
            <IntentionCard
              key={intention.id}
              intention={intention}
              mine={mine}
              onRemove={() => void setIntentionShown(intention.id, false).then(fail)}
              onError={setError}
            />
          ))}
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {note ? <Text style={styles.help}>{note}</Text> : null}
      {sheet}
    </View>
  );
}

/** Le texte vient de la Bible embarquée, dans la traduction de celui qui regarde. */
function PassageCard({ passage, onRemove }: { passage: ShowcasePassage; onRemove?: () => void }) {
  const { styles } = useThemed(stylesFor);
  const { progress, goTo } = useApp();
  const t = progress.translation;
  const verses = loadPassage(passage.book, passage.chapter, passage.from, passage.to, t);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          goTo(passage.book, clampChapter(passage.book, passage.chapter, t));
          router.navigate('/lecture');
        }}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.link}>{passageLabel(passage.book, passage.chapter, passage.from, passage.to, t)}</Text>
        {verses.length > 0 ? <Text style={styles.passage}>{verses.join(' ')}</Text> : null}
      </Pressable>
      {onRemove ? <RemoveLink onPress={onRemove} /> : null}
    </View>
  );
}

function PrayerCard({ prayer, onRemove, onReport }: { prayer: ShowcasePrayer; onRemove?: () => void; onReport?: () => void }) {
  const { C, styles } = useThemed(stylesFor);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.prayerHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.prayerTitle}>{prayer.title}</Text>
          {open ? null : (
            <Text style={styles.excerpt} numberOfLines={2}>
              {excerpt(prayer.text)}
            </Text>
          )}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} />
      </Pressable>
      {open ? <PrayerText text={prayer.text} style={styles.prayerText} /> : null}
      {prayer.hidden ? (
        <Text style={styles.masked}>{MASKED_NOTE}. Si tu modifies cette prière, elle redevient visible pour les autres.</Text>
      ) : null}
      {onRemove ? <RemoveLink onPress={onRemove} /> : null}
      {onReport ? <ReportLink onPress={onReport} /> : null}
    </View>
  );
}

function IntentionCard({
  intention,
  mine,
  onRemove,
  onError,
}: {
  intention: ShowcaseIntention;
  mine: boolean;
  onRemove: () => void;
  onError: (message: string | null) => void;
}) {
  const { C, styles } = useThemed(stylesFor);
  const [carrying, setCarrying] = useState(intention.carrying);
  const [carries, setCarries] = useState(intention.carries);
  // Ma propre intention n'est pas « portable » (le serveur refuse) : on affiche seulement le compteur.
  const canCarry = !mine && !intention.mine;
  const toggle = () => {
    haptic();
    const next = !carrying;
    setCarrying(next);
    setCarries((n) => Math.max(0, n + (next ? 1 : -1)));
    onError(null);
    void setCarry(intention.id, next).then((result) => {
      if (result.ok) return;
      setCarrying(!next);
      setCarries((n) => Math.max(0, n + (next ? -1 : 1)));
      onError(result.message);
    });
  };
  return (
    <View style={styles.card}>
      <Text style={styles.intentionBody}>{intention.body}</Text>
      <Text style={styles.count}>{carried(carries)}</Text>
      {canCarry ? (
        <Pressable
          onPress={toggle}
          style={[styles.carry, carrying && styles.carryOn]}
          accessibilityLabel={carrying ? 'Ne plus porter cette intention' : 'Je la porte'}
        >
          <Ionicons name={carrying ? 'heart' : 'heart-outline'} size={16} color={carrying ? C.onGold : C.gold} />
          <Text style={[styles.carryText, carrying && styles.carryTextOn]}>Je la porte</Text>
        </Pressable>
      ) : null}
      {mine ? <RemoveLink onPress={onRemove} /> : null}
    </View>
  );
}

function ReportLink({ onPress }: { onPress: () => void }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Signaler cette prière" style={styles.remove}>
      <Text style={styles.removeText}>Signaler</Text>
    </Pressable>
  );
}

function RemoveLink({ onPress }: { onPress: () => void }) {
  const { styles } = useThemed(stylesFor);
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.remove}>
      <Text style={styles.removeText}>Retirer du profil</Text>
    </Pressable>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    lead: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 22, marginBottom: 8 },
    help: { color: C.muted, fontSize: 14, lineHeight: 20 },
    error: { color: C.red, fontSize: 14, marginTop: 10, textAlign: 'center' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10, marginBottom: 10 },
    body: { gap: 6 },
    pressed: { opacity: 0.75 },
    link: { color: C.gold, fontSize: 14, fontWeight: '700' },
    passage: { color: C.muted, fontFamily: SERIF, fontSize: 15, lineHeight: 22 },
    prayerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    prayerTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
    excerpt: { color: C.muted, fontSize: 14, lineHeight: 20 },
    prayerText: { color: C.text, fontFamily: SERIF, fontSize: 17, lineHeight: 27, marginBottom: 8 },
    intentionBody: { color: C.text, fontSize: 16, lineHeight: 23 },
    count: { color: C.faint, fontSize: 13, fontWeight: '600' },
    carry: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      borderWidth: 1,
      borderColor: C.gold,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    carryOn: { backgroundColor: C.gold },
    carryText: { color: C.gold, fontWeight: '700', fontSize: 14 },
    carryTextOn: { color: C.onGold },
    masked: { color: C.muted, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
    remove: { alignSelf: 'flex-start' },
    removeText: { color: C.faint, fontSize: 13, fontWeight: '700' },
  });
