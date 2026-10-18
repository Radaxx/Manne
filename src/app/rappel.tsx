import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type { Palette } from '../appearance';
import { ExactAlarmNote } from '../gathering-ui';
import {
  formatTime,
  notificationsSupported,
  REMINDER_TIMES,
  reminderContent,
  reminderPermissionGranted,
  requestReminderPermission,
} from '../reminder';
import { useApp } from '../storage';
import { Text } from '../text';
import { useThemed } from '../theme';

export default function ReminderScreen() {
  const { C, styles } = useThemed(stylesFor);
  const { progress, setReminder } = useApp();
  const { reminder } = progress;
  // null : on ne sait pas encore ; false : l'utilisateur a refusé les notifications.
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    reminderPermissionGranted().then(setGranted);
  }, []);

  const toggle = async (enabled: boolean) => {
    if (enabled) {
      const ok = await requestReminderPermission();
      setGranted(ok);
      if (!ok) return;
    }
    setReminder({ ...reminder, enabled });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const example = reminderContent(tomorrow);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        Une notification par jour pour t’inviter à lire, avec un verset. Elle n’arrive pas si ta journée est déjà faite : l’Évangile, la
        lecture et une prière.
      </Text>

      {!notificationsSupported ? (
        <Text style={styles.warning}>Les rappels ne sont disponibles que dans l’app sur téléphone.</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Rappel quotidien</Text>
            <Switch
              value={reminder.enabled}
              onValueChange={toggle}
              trackColor={{ true: C.gold, false: C.switchOff }}
              thumbColor={C.switchThumb}
            />
          </View>

          {granted === false && (
            <View style={styles.warningBox}>
              <Text style={styles.warning}>
                Les notifications sont désactivées pour Manne. Autorise-les dans les réglages du téléphone.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.settingsBtn}>
                <Text style={styles.settingsText}>Ouvrir les réglages</Text>
              </Pressable>
            </View>
          )}

          <ExactAlarmNote spaced visible={reminder.enabled && granted === true} />

          <Text style={[styles.section, !reminder.enabled && styles.disabled]}>À quelle heure ?</Text>
          <View style={[styles.times, !reminder.enabled && styles.disabled]}>
            {REMINDER_TIMES.map(([h, m]) => {
              const active = reminder.hour === h && reminder.minute === m;
              return (
                <Pressable
                  key={`${h}:${m}`}
                  disabled={!reminder.enabled}
                  onPress={() => setReminder({ ...reminder, hour: h, minute: m })}
                  style={[styles.time, active && styles.timeActive]}
                >
                  <Text style={[styles.timeText, active && styles.timeTextActive]}>{formatTime(h, m)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, !reminder.enabled && styles.disabled]}>Aperçu</Text>
          <View style={[styles.preview, !reminder.enabled && styles.disabled]}>
            <View style={styles.previewHead}>
              <Ionicons name="book" size={14} color={C.gold} />
              <Text style={styles.previewApp}>MANNE · {formatTime(reminder.hour, reminder.minute)}</Text>
            </View>
            <Text style={styles.previewTitle}>{example.title}</Text>
            <Text style={styles.previewBody}>{example.body}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 60 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 18 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    label: { color: C.text, fontSize: 17, fontWeight: '700' },
    section: { color: C.text, fontSize: 15, fontWeight: '700', marginTop: 26, marginBottom: 10 },
    disabled: { opacity: 0.4 },
    times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    time: {
      backgroundColor: C.card,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    timeActive: { borderColor: C.gold, backgroundColor: 'rgba(255,209,102,0.12)' },
    timeText: { color: C.text, fontSize: 15, fontWeight: '600' },
    timeTextActive: { color: C.gold },
    preview: { backgroundColor: C.cardHi, borderRadius: 18, padding: 14, gap: 4 },
    previewHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    previewApp: { color: C.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
    previewTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
    previewBody: { color: C.text, fontSize: 14, lineHeight: 20 },
    warningBox: { backgroundColor: 'rgba(224,122,107,0.1)', borderRadius: 12, padding: 12, marginTop: 12, gap: 10 },
    warning: { color: C.red, fontSize: 14, lineHeight: 20 },
    settingsBtn: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: C.red,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    settingsText: { color: C.red, fontWeight: '700', fontSize: 13 },
  });
