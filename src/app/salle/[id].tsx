import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { Palette } from '../../appearance';
import { useAuth } from '../../auth';
import { Avatar } from '../../avatar';
import { markPresent, prayerKindLabel } from '../../gatherings';
import { NeedProfile, useGroupGate } from '../../group-ui';
import { firstParam, INTENTION_MAX, reportGroupIntention, setGroupCarry } from '../../groups';
import { haptic } from '../../haptics';
import { Button, openProfile } from '../../profile-ui';
import {
  AMEN_SHOWN_MS,
  amenLabel,
  amenWaitSeconds,
  declaredNote,
  inRoomLabel,
  postRoomIntention,
  prayerButtonLabel,
  prayerHref,
  presentInRoomLabel,
  remainingMs,
  timerLabel,
  untilStartMs,
  useRoom,
} from '../../room';
import { Text, TextInput } from '../../text';
import { useThemed } from '../../theme';

// La salle de prière en direct d'un rendez-vous (supabase/migrations/010_prayer_room.sql, src/room.ts).
// On y entre après « Je suis là », pendant la fenêtre du rendez-vous calculée par le serveur.

const carried = (n: number) => (n === 0 ? 'Personne ne la porte encore' : n === 1 ? '1 personne la porte' : `${n} personnes la portent`);

export default function SalleScreen() {
  const { C, styles } = useThemed(stylesFor);
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const gate = useGroupGate();
  const { profile } = useAuth();
  const { room, error, loading, link, online, amen, amenSent, offset, reload, sendAmen, signalIntention, patchIntention } = useRoom(
    gate.ready ? id : '',
    profile?.handle ?? null,
  );
  const [now, setNow] = useState(Date.now());
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [entering, setEntering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const lastAmen = useRef(0);

  // Une horloge à la seconde : minuteur et délai de l'« Amen ».
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setWait(amenWaitSeconds(lastAmen.current, t));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // L'écran reste allumé seulement pendant que la salle est ouverte. On relâche le verrou une fois activé, sinon le web
  // lève une erreur quand on quitte tout de suite.
  const open = room?.open === true;
  useEffect(() => {
    if (!open) return;
    const active = activateKeepAwakeAsync('salle').catch(() => {});
    return () => {
      active.then(() => deactivateKeepAwake('salle')).catch(() => {});
    };
  }, [open]);

  if (gate.loading || (gate.ready && loading)) return <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />;
  if (!gate.ready) return <NeedProfile />;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else if (room) router.replace({ pathname: '/groupe/[id]', params: { id: room.groupId } });
    else router.replace('/communaute');
  };

  if (!room) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.muted}>{error ?? 'Cette salle n’est pas disponible.'}</Text>
        <Button label="Réessayer" kind="secondary" onPress={() => void reload()} />
        <Button label="Quitter la salle" kind="quiet" onPress={leave} />
      </ScrollView>
    );
  }

  if (!room.open) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{room.title}</Text>
        <Text style={styles.meta}>{room.groupName}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>La salle est fermée</Text>
          <Text style={styles.muted}>
            Elle s’ouvre 10 minutes avant le début du rendez-vous et se ferme à sa fin. Les intentions écrites restent dans les intentions
            du groupe.
          </Text>
          <Button label="Retourner au groupe" onPress={() => router.replace({ pathname: '/groupe/[id]', params: { id: room.groupId } })} />
        </View>
      </ScrollView>
    );
  }

  if (!room.present) {
    const enter = async () => {
      if (entering) return;
      setEntering(true);
      setNotice(null);
      haptic();
      const result = await markPresent(id);
      if (!result.ok) setNotice(result.message);
      await reload();
      setEntering(false);
    };
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{room.title}</Text>
        <Text style={styles.meta}>{room.groupName}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dis que tu es là</Text>
          <Text style={styles.muted}>On entre dans la salle après « Je suis là ». Les membres du groupe déjà présents le verront.</Text>
          <Button label="Je suis là" busy={entering} onPress={() => void enter()} />
        </View>
        {notice ? <Text style={styles.error}>{notice}</Text> : null}
        <Button label="Quitter la salle" kind="quiet" onPress={leave} />
      </ScrollView>
    );
  }

  const beforeStart = untilStartMs(room.startsAt, now, offset.current);
  const left = remainingMs(room.endsAt, now, offset.current);
  const kindButton = prayerButtonLabel(room.prayerKind);
  const href = prayerHref(room.prayerKind);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setNotice(null);
    const result = await postRoomIntention(id, body);
    setSending(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    haptic('success');
    setDraft('');
    signalIntention();
    await reload();
  };

  const toggleCarry = (itemId: string, carrying: boolean) => {
    haptic();
    const next = !carrying;
    patchIntention(itemId, (row) => ({ ...row, carrying: next, carries: Math.max(0, row.carries + (next ? 1 : -1)) }));
    void setGroupCarry(itemId, next).then((result) => {
      if (!result.ok) {
        setNotice(result.message);
        void reload();
      }
    });
  };

  const report = (itemId: string) => {
    Alert.alert('Signaler cette intention ?', 'Trois signalements la masquent.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Signaler',
        style: 'destructive',
        onPress: () => {
          void reportGroupIntention(itemId).then((result) => {
            if (!result.ok) setNotice(result.message);
          });
        },
      },
    ]);
  };

  const amenNow = () => {
    if (sendAmen()) {
      lastAmen.current = Date.now();
      setWait(amenWaitSeconds(lastAmen.current, Date.now()));
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <Text style={styles.title}>{room.title}</Text>
          <Text style={styles.meta}>{room.groupName}</Text>
          <Text style={styles.timer} accessibilityLabel={`Il reste ${timerLabel(left)}`}>
            {timerLabel(left)}
          </Text>
          <Text style={styles.hint}>
            {beforeStart > 0 ? `Commence dans ${timerLabel(beforeStart)} · fin du rendez-vous` : 'jusqu’à la fin du rendez-vous'}
          </Text>
        </View>

        {link === 'down' ? <Text style={styles.hint}>Connexion en direct indisponible, la salle se met à jour régulièrement.</Text> : null}

        <Text style={styles.section}>Dans la salle</Text>
        <View style={styles.card}>
          {/* En direct, on compte les personnes connectées ; sans le direct, seulement celles qui ont dit « Je suis là ». */}
          <Text style={styles.count}>{link === 'live' ? inRoomLabel(online.length) : presentInRoomLabel(room.presentCount)}</Text>
          {link === 'live' && declaredNote(room.presentCount, online.length) ? (
            <Text style={styles.hint}>{declaredNote(room.presentCount, online.length)}</Text>
          ) : null}
          {online.length === 0 ? (
            <Text style={styles.muted}>
              {link === 'live' ? 'Tu es seul pour l’instant.' : 'Les personnes connectées apparaissent ici.'}
            </Text>
          ) : (
            <View style={styles.people}>
              {online.map((handle) => (
                <Pressable key={handle} onPress={() => openProfile(handle)} style={styles.person} accessibilityRole="button">
                  <Avatar handle={handle} size={30} />
                  <Text style={styles.personName}>@{handle}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Pressable
            onPress={amenNow}
            disabled={wait > 0}
            style={[styles.amen, wait > 0 && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Amen"
          >
            <Text style={styles.amenText}>{wait > 0 ? `Amen (${wait} s)` : 'Amen'}</Text>
          </Pressable>
          <Text style={styles.hint}>L’« Amen » s’affiche un instant chez les autres présents. Rien n’est enregistré.</Text>
        </View>

        {kindButton && href ? (
          <View style={styles.card}>
            <Button label={kindButton} kind="secondary" onPress={() => router.push(href)} />
            <Text style={styles.hint}>
              {prayerKindLabel(room.prayerKind)} : chacun prie à son rythme, sur son téléphone. Rien n’est synchronisé entre vous.
            </Text>
          </View>
        ) : null}

        <Text style={styles.section}>Intentions de la salle</Text>
        <View style={styles.card}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Une intention pour la salle…"
            placeholderTextColor={C.faint}
            style={styles.input}
            multiline
            maxLength={INTENTION_MAX}
          />
          <Text style={styles.hint}>Elle est confiée aux membres du groupe : elle reste ensuite dans les intentions du groupe.</Text>
          <Button label="Confier au groupe" onPress={() => void send()} disabled={!draft.trim()} busy={sending} />
        </View>
        {notice ? <Text style={styles.error}>{notice}</Text> : null}

        {room.intentions.length === 0 ? <Text style={styles.muted}>Aucune intention écrite pendant ce rendez-vous.</Text> : null}
        {room.intentions.map((item) => (
          <View key={item.id} style={styles.card}>
            <Pressable onPress={() => item.handle && openProfile(item.handle)} accessibilityRole="button">
              <Text style={styles.author}>{item.mine ? 'Toi' : `@${item.handle}`}</Text>
            </Pressable>
            <Text style={styles.body}>{item.body}</Text>
            {item.hidden ? <Text style={styles.hint}>Plusieurs membres l’ont signalée : les autres ne la voient plus.</Text> : null}
            <Text style={styles.hint}>{carried(item.carries)}</Text>
            {item.mine ? null : (
              <View style={styles.row}>
                <Pressable
                  onPress={() => toggleCarry(item.id, item.carrying)}
                  style={[styles.carry, item.carrying && styles.carryOn]}
                  accessibilityLabel={item.carrying ? 'Ne plus porter cette intention' : 'Je la porte'}
                >
                  <Ionicons name={item.carrying ? 'heart' : 'heart-outline'} size={16} color={item.carrying ? C.onGold : C.gold} />
                  <Text style={[styles.carryText, item.carrying && styles.carryTextOn]}>Je la porte</Text>
                </Pressable>
                <Pressable onPress={() => report(item.id)} hitSlop={8} accessibilityLabel="Signaler cette intention">
                  <Text style={styles.link}>Signaler</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}

        <Button label="Quitter la salle" kind="quiet" onPress={leave} />
      </ScrollView>
      {amen ? <AmenToast key={amen.key} text={amenLabel(amen.handle)} /> : null}
      {!amen && amenSent ? (
        <AmenToast
          key={`moi-${amenSent.key}`}
          text={
            amenSent.ok
              ? 'Ton « Amen » est parti dans la salle.'
              : 'Ton « Amen » n’a pas pu partir : la connexion en direct est indisponible.'
          }
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Un « Amen » (le mien ou celui d'un autre) : une bulle qui arrive en douceur au-dessus de la salle, puis s'efface. */
function AmenToast({ text }: { text: string }) {
  const { styles } = useThemed(stylesFor);
  const show = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.sequence([
      Animated.spring(show, { toValue: 1, damping: 14, stiffness: 160, mass: 0.8, useNativeDriver: true }),
      Animated.delay(AMEN_SHOWN_MS - 900),
      Animated.timing(leave, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [show, leave]);
  const opacity = Animated.multiply(
    show.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  );
  const translateY = Animated.add(
    show.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }),
  );
  const scale = show.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      <Ionicons name="heart" size={16} color={styles.toastIcon.color} />
      <Text style={styles.toastText}>{text}</Text>
    </Animated.View>
  );
}

const stylesFor = (C: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { padding: 20, paddingBottom: 48, gap: 12 },
    header: { alignItems: 'center', gap: 4, marginBottom: 4 },
    title: { color: C.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
    meta: { color: C.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    timer: { color: C.gold, fontSize: 44, fontWeight: '800', marginTop: 8, fontVariant: ['tabular-nums'] },
    section: { color: C.text, fontSize: 19, fontWeight: '800', marginTop: 10 },
    muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
    hint: { color: C.faint, fontSize: 13, lineHeight: 18 },
    error: { color: C.red, fontSize: 14, textAlign: 'center' },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
    cardTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
    count: { color: C.gold, fontSize: 15, fontWeight: '800' },
    people: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    person: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.cardHi,
      borderRadius: 999,
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 12,
    },
    personName: { color: C.text, fontSize: 14, fontWeight: '700' },
    amen: { alignSelf: 'flex-start', borderWidth: 1, borderColor: C.gold, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 9 },
    amenText: { color: C.gold, fontWeight: '800', fontSize: 15 },
    author: { color: C.gold, fontSize: 13, fontWeight: '700' },
    body: { color: C.text, fontSize: 17, lineHeight: 24 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    carry: {
      flexDirection: 'row',
      alignItems: 'center',
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
    link: { color: C.faint, fontSize: 13, fontWeight: '700' },
    input: {
      minHeight: 46,
      maxHeight: 140,
      color: C.text,
      fontSize: 16,
      backgroundColor: C.cardHi,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    // Fond opaque et premier plan (zIndex pour iOS, elevation pour Android) : le texte de la salle ne passe plus devant.
    toast: {
      position: 'absolute',
      top: 12,
      left: 20,
      right: 20,
      zIndex: 10,
      elevation: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: C.cardHi,
      borderColor: C.gold,
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 18,
      paddingVertical: 12,
      shadowColor: C.shadow,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    toastIcon: { color: C.gold },
    toastText: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  });
