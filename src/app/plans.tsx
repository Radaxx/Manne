import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '../appearance';
import { PLANS, planChapters, planStatus } from '../plans';
import { today, useApp } from '../storage';
import { useThemed } from '../theme';

export default function PlansScreen() {
  const { styles } = useThemed(stylesFor);
  const { progress, startPlan, stopPlan } = useApp();
  // Arrêter un plan efface sa progression : on demande une seconde confirmation.
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.intro}>
        Un peu chaque jour, à ton rythme. Les chapitres lus dans l’onglet Lecture avancent automatiquement tes plans.
      </Text>
      {PLANS.map((plan) => {
        const state = progress.plans[plan.id];
        const chapters = planChapters(plan).length;
        const status = state ? planStatus(plan, state, today()) : null;
        return (
          <View key={plan.id} style={[styles.card, state && styles.cardActive]}>
            <Text style={styles.title}>{plan.title}</Text>
            <Text style={styles.desc}>{plan.description}</Text>
            <Text style={styles.meta}>
              {plan.days} jours · {chapters} chapitres · ~{Math.ceil(chapters / plan.days)} par jour
            </Text>
            {status ? (
              <View style={styles.row}>
                <Text style={styles.progress}>
                  En cours · jour {status.day + 1} · {status.done}/{status.total} chapitres
                </Text>
                <Pressable
                  onPress={() => {
                    if (confirmStop === plan.id) {
                      stopPlan(plan.id);
                      setConfirmStop(null);
                    } else setConfirmStop(plan.id);
                  }}
                  style={[styles.btn, styles.btnGhost]}
                >
                  <Text style={styles.btnGhostText}>{confirmStop === plan.id ? 'Confirmer l’arrêt' : 'Arrêter'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => startPlan(plan.id)} style={styles.btn}>
                <Text style={styles.btnText}>Commencer aujourd’hui</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, gap: 12, paddingBottom: 60 },
    intro: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 6 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 6 },
    cardActive: { borderWidth: 1, borderColor: 'rgba(255,209,102,0.35)' },
    title: { color: C.text, fontSize: 17, fontWeight: '700' },
    desc: { color: C.muted, fontSize: 14, lineHeight: 20 },
    meta: { color: C.faint, fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
    progress: { color: C.gold, fontSize: 14, fontWeight: '600', flexShrink: 1 },
    btn: { alignSelf: 'flex-start', backgroundColor: C.gold, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, marginTop: 6 },
    btnText: { color: C.onGold, fontWeight: '800', fontSize: 14 },
    btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line, marginTop: 0 },
    btnGhostText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  });
