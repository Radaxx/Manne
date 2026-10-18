import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { syncAdorationReminders } from '../adoration-reminders';
import type { Palette } from '../appearance';
import { useAuth } from '../auth';
import { syncGatheringReminders } from '../gathering-reminders';
import { haptic } from '../haptics';
import { syncNovenaReminders } from '../novena-reminders';
import {
  DEFAULT_PREFS,
  getPrefs,
  LOCAL_ITEMS,
  type LocalKey,
  type NotificationPrefs,
  type PrefKey,
  PUSH_ITEMS,
  PUSH_UNAVAILABLE,
  type PushStatus,
  registerPushToken,
  setPref,
} from '../push';
import { formatTime, notificationsSupported, reminderPermissionGranted, requestReminderPermission } from '../reminder';
import { syncRosaryReminders } from '../rosary-reminders';
import { SectionHead } from '../section';
import { useApp } from '../storage';
import { Text } from '../text';
import { useThemed } from '../theme';

// Les rappels qui dépendent d'un interrupteur local : on relance leur synchro dès qu'il change.
const RESYNC: Record<LocalKey, () => Promise<void>> = {
  local_gatherings: () => syncGatheringReminders(),
  local_novenas: () => syncNovenaReminders(),
  local_rosary: () => syncRosaryReminders(),
  local_adoration: () => syncAdorationReminders(),
};

export default function NotificationsScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { status } = useAuth();
  const { progress, setReminder } = useApp();
  const { reminder } = progress;
  const linked = status === 'signedIn';
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null : on ne sait pas encore ; false : notifications refusées dans les réglages du téléphone.
  const [granted, setGranted] = useState<boolean | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);

  const refresh = useCallback(async () => {
    if (!linked) return;
    const result = await getPrefs();
    if (result.ok) {
      setPrefs(result.prefs);
      setError(null);
    } else {
      setError(result.message);
    }
    setLoaded(true);
  }, [linked]);

  useEffect(() => {
    reminderPermissionGranted().then(setGranted);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // L'état du jeton de ce téléphone (sans redemander l'autorisation).
  useEffect(() => {
    if (!linked) return;
    registerPushToken().then(setPush);
  }, [linked]);

  const toggleDaily = async (enabled: boolean) => {
    haptic();
    if (enabled) {
      const ok = await requestReminderPermission();
      setGranted(ok);
      if (!ok) return;
    }
    setReminder({ ...reminder, enabled });
  };

  const toggle = async (key: PrefKey, on: boolean) => {
    haptic();
    if (on) {
      const ok = await requestReminderPermission();
      setGranted(ok);
      // Un rappel du téléphone n'a pas de sens sans autorisation ; une push se règle quand même (elle attend l'autorisation).
      if (!ok && key.startsWith('local_')) return;
      if (ok) setPush(await registerPushToken({ force: true }));
    }
    const before = prefs;
    setPrefs({ ...prefs, [key]: on });
    const result = await setPref(key, on);
    if (!result.ok) {
      setPrefs(before);
      setError(result.message);
      return;
    }
    setError(null);
    if (key.startsWith('local_')) RESYNC[key as LocalKey]().catch(() => {});
  };

  if (!notificationsSupported) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.warning}>Les notifications ne sont disponibles que dans l’app sur téléphone.</Text>
      </ScrollView>
    );
  }

  const row = (key: string, label: string, hint: string, value: boolean, onChange: (on: boolean) => void, disabled = false) => (
    <View key={key} style={[styles.card, disabled && styles.disabled]}>
      <View style={styles.cardBody}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: C.gold, false: C.switchOff }}
        thumbColor={C.switchThumb}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        Tout ce que Manne peut t’envoyer, avec un interrupteur pour chaque notification. Les rappels sont programmés par ton téléphone ; les
        notifications de la communauté viennent du serveur.
      </Text>

      {granted === false && (
        <View style={styles.warningBox}>
          <Text style={styles.warning}>Les notifications sont désactivées pour Manne. Autorise-les dans les réglages du téléphone.</Text>
          <Pressable onPress={() => Linking.openSettings()} style={styles.settingsBtn} accessibilityRole="button">
            <Text style={styles.settingsText}>Ouvrir les réglages</Text>
          </Pressable>
        </View>
      )}

      <SectionHead title="Rappels sur ton téléphone" />
      <View style={styles.list}>
        {row(
          'daily',
          'Rappel quotidien',
          reminder.enabled
            ? `Chaque jour à ${formatTime(reminder.hour, reminder.minute)}, si ta journée n’est pas faite.`
            : 'Un verset par jour, si ta journée n’est pas faite.',
          reminder.enabled,
          toggleDaily,
        )}
        {reminder.enabled ? (
          <Pressable onPress={() => router.push('/rappel')} style={styles.link} accessibilityRole="button">
            <Text style={styles.linkText}>Choisir l’heure</Text>
          </Pressable>
        ) : null}
        {LOCAL_ITEMS.map((item) => row(item.key, item.label, item.hint, prefs[item.key], (on) => void toggle(item.key, on), !linked))}
      </View>
      <Text style={styles.note}>
        {linked
          ? 'Ton choix est enregistré avec ton compte : tu le retrouves sur tes autres appareils.'
          : 'Les rappels de groupe demandent un compte relié. Le rappel quotidien marche sans compte.'}
      </Text>

      <SectionHead title="De la communauté" />
      {linked ? (
        <>
          {push === 'unavailable' ? <Text style={styles.warning}>{PUSH_UNAVAILABLE}</Text> : null}
          <View style={styles.list}>
            {PUSH_ITEMS.map((item) => row(item.key, item.label, item.hint, prefs[item.key], (on) => void toggle(item.key, on), !loaded))}
          </View>
          <Text style={styles.note}>
            Ces notifications passent par un service d’envoi (Expo, puis Google ou Apple). Elles ne contiennent jamais le texte d’une
            intention : seulement le nom du groupe ou le @pseudo. Pour couper un seul groupe, ouvre-le et utilise « Notifications de ce
            groupe ».
          </Text>
          {error ? <Text style={styles.warning}>{error}</Text> : null}
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardBody}>
            <Text style={styles.label}>Compte relié</Text>
            <Text style={styles.hint}>Connecte-toi à un compte pour recevoir les notifications de la communauté et de tes groupes.</Text>
          </View>
          <Pressable onPress={() => router.push('/compte')} style={styles.settingsBtnGold} accessibilityRole="button">
            <Text style={styles.settingsTextGold}>Me connecter</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22 },
    list: { gap: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    cardBody: { flex: 1 },
    disabled: { opacity: 0.5 },
    label: { color: C.text, fontSize: 16, fontWeight: '700' },
    hint: { color: C.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    note: { color: C.faint, fontSize: 13, lineHeight: 18, marginTop: 10 },
    link: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 4 },
    linkText: { color: C.gold, fontSize: 14, fontWeight: '600' },
    warningBox: { backgroundColor: 'rgba(224,122,107,0.1)', borderRadius: 12, padding: 12, marginTop: 14, gap: 10 },
    warning: { color: C.red, fontSize: 14, lineHeight: 20, marginBottom: 8 },
    settingsBtn: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: C.red,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    settingsText: { color: C.red, fontWeight: '700', fontSize: 13 },
    settingsBtnGold: { borderWidth: 1, borderColor: C.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
    settingsTextGold: { color: C.gold, fontWeight: '700', fontSize: 13 },
  });
