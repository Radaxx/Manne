import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Appearance, AppState, useColorScheme } from 'react-native';
import { onAdorationChanged } from '../adoration-chain';
import { adorationChainIdFromUrl, syncAdorationReminders } from '../adoration-reminders';
import { type Palette, paletteFor } from '../appearance';
import { AuthProvider, ensureSession, useAuth } from '../auth';
import { adoptPending, hasPendingNonce } from '../auth/adoption';
import { loadOwner, ownerDecision, saveOwner } from '../auth/owner';
import { EchoHost } from '../echoes';
import { FONT_FILES } from '../font-files';
import { fontFace } from '../fonts';
import { groupIdFromUrl, syncGatheringReminders } from '../gathering-reminders';
import { onGatheringsChanged } from '../gatherings';
import { openAdorationChain, openGroup } from '../group-ui';
import { liturgicalDay } from '../liturgical-year';
import { onRosariesChanged } from '../living-rosary';
import { openRosary } from '../living-rosary-ui';
import { novenaIdFromUrl, syncNovenaReminders } from '../novena-reminders';
import { openNovena } from '../novena-ui';
import { onNovenasChanged } from '../novenas';
import { canAskNotificationPermission, clearPrefsCache, onPushTokenChanged, pushRouteFromUrl, registerPushToken } from '../push';
import { notificationsSupported, scheduleReminders } from '../reminder';
import { rosaryIdFromUrl, syncRosaryReminders } from '../rosary-reminders';
import { removedKeys, type ShowcasePassage } from '../showcase';
import { dropPassageCopies } from '../showcase-store';
import { type Progress, ProgressProvider, useApp } from '../storage';
import { supabase } from '../supabase';
import { syncProgress } from '../sync';
import { PaletteProvider } from '../theme';
import { dayComplete, liveLog } from '../today';
import { markTourSeen, tourSeen } from '../tour';

function navigationTheme(palette: Palette) {
  const base = palette.statusBar === 'light' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, background: palette.bg, card: palette.bg, primary: palette.gold, text: palette.text, border: palette.line },
  };
}

/**
 * Avant toute synchro : la session est confirmée (ou rouverte en anonyme), puis on vérifie à qui appartient la progression
 * du téléphone. Si elle venait d'un autre compte relié (session disparue sans « Se déconnecter »), elle est effacée avant
 * d'être envoyée ou fusionnée où que ce soit. Faux si aucune session n'a pu être ouverte.
 */
async function claimProgress(reset: () => void, current: () => Progress): Promise<boolean> {
  const client = supabase;
  if (!client || !(await ensureSession())) return false;
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return false;
  const owner = { userId: user.id, linked: user.is_anonymous === false };
  const stored = await loadOwner();
  const decision = ownerDecision(stored, owner);
  if (decision.reset) {
    const before = current();
    reset();
    // Laisse l'état effacé arriver jusqu'à la synchro avant qu'elle ne lise la progression.
    for (let i = 0; i < 20 && current() === before; i++) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!stored || stored.userId !== owner.userId || stored.linked !== owner.linked) await saveOwner(decision.next);
  return true;
}

/** Envoie la progression dès qu'une session existe, et la fusionne au retour du cloud. */
function ProgressSync() {
  const { loaded, progress, hydrate, resetAccountData } = useApp();
  const ref = useRef(progress);
  ref.current = progress;
  const resetRef = useRef(resetAccountData);
  resetRef.current = resetAccountData;
  const claiming = useRef<Promise<boolean> | null>(null);
  const sync = useCallback(async () => {
    // Une seule vérification à la fois ; chaque synchro attend la sienne.
    claiming.current ??= claimProgress(
      () => resetRef.current(),
      () => ref.current,
    ).finally(() => {
      claiming.current = null;
    });
    if (!(await claiming.current)) return;
    await syncProgress(() => ref.current, hydrate);
  }, [hydrate]);
  useEffect(() => {
    if (!loaded || !supabase) return;
    ref.current = progress;
    const timer = setTimeout(() => {
      sync().catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [loaded, progress, sync]);
  useEffect(() => {
    const client = supabase;
    if (!loaded || !client) return;
    sync().catch(() => {});
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') sync().catch(() => {});
    });
    return () => data.subscription.unsubscribe();
  }, [loaded, sync]);
  return null;
}

/**
 * Une reprise restée en attente (réseau absent quand le lien ou le code a abouti) est rejouée au lancement et au retour au
 * premier plan, tant qu'un compte relié est connecté. Le serveur refuse un nonce expiré : il est alors abandonné.
 */
function AdoptionRetry() {
  const { status, userId } = useAuth();
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance l'essai quand on change de compte
  useEffect(() => {
    if (status !== 'signedIn') return;
    const retry = () =>
      void hasPendingNonce()
        .then((pending) => (pending ? adoptPending() : null))
        .catch(() => {});
    retry();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });
    return () => sub.remove();
  }, [status, userId]);
  return null;
}

/**
 * Un passage qui n'est plus gardé (depuis la lecture, un fil ou un autre appareil) perd sa copie sur le profil.
 * On ne réagit qu'aux retraits vus pendant la session : le chargement initial ne retire jamais rien.
 */
function ShowcaseSync() {
  const { loaded, progress } = useApp();
  const known = useRef<ShowcasePassage[] | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (known.current) void dropPassageCopies(removedKeys(known.current, progress.saved));
    known.current = progress.saved;
  }, [loaded, progress.saved]);
  return null;
}

/** Le rappel part aujourd'hui tant que la journée n'est pas faite et que l'heure est encore devant. */
function ReminderSync() {
  const { loaded, progress } = useApp();
  const { reminder } = progress;
  const todayDone = dayComplete(liveLog(progress));
  useEffect(() => {
    if (!loaded) return;
    scheduleReminders(reminder, todayDone).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleReminders(reminder, todayDone).catch(() => {});
    });
    return () => sub.remove();
  }, [loaded, reminder, todayDone]);
  return null;
}

/**
 * Les rappels des rendez-vous de groupe auxquels je suis inscrit sont reprogrammés au lancement, au retour de l'app au
 * premier plan, quand le compte ou le profil change, et après chaque inscription, désinscription ou modification.
 * Sans compte relié ni profil, tous les rappels de rendez-vous sont annulés. Hors ligne, on garde ce qui est programmé.
 */
function GatheringSync() {
  const { status, userId, profile, profileLoaded, profileOffline } = useAuth();
  // Un compte relié dont le profil est connu comme absent : plus de rendez-vous, donc plus de rappels.
  const profileMissing = status === 'signedIn' && profileLoaded && !profileOffline && !profile;
  const waiting = status === 'signedIn' && !profileLoaded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance la synchro quand on change de compte
  useEffect(() => {
    if (!notificationsSupported || waiting) return;
    const sync = () => syncGatheringReminders({ profileMissing }).catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const off = onGatheringsChanged(sync);
    return () => {
      sub.remove();
      off();
    };
  }, [waiting, profileMissing, userId, status]);
  return null;
}

/**
 * Les rappels des neuvaines de groupe (« Me le rappeler chaque jour ») sont reprogrammés au lancement, au retour de l'app au
 * premier plan, quand le compte ou le profil change, et après chaque jour prié, rappel réglé, neuvaine lancée ou annulée.
 * Sans compte relié ni profil, tous les rappels `novena-…` sont annulés (les autres rappels ne sont pas touchés). Hors ligne,
 * on garde ce qui est programmé.
 */
function NovenaSync() {
  const { status, userId, profile, profileLoaded, profileOffline } = useAuth();
  const profileMissing = status === 'signedIn' && profileLoaded && !profileOffline && !profile;
  const waiting = status === 'signedIn' && !profileLoaded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance la synchro quand on change de compte
  useEffect(() => {
    if (!notificationsSupported || waiting) return;
    const sync = () => syncNovenaReminders({ profileMissing }).catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const off = onNovenasChanged(sync);
    return () => {
      sub.remove();
      off();
    };
  }, [waiting, profileMissing, userId, status]);
  return null;
}

/**
 * Le rappel du Rosaire vivant (« Me rappeler ma dizaine chaque jour ») est reprogrammé au lancement, au retour de l'app au
 * premier plan, quand le compte ou le profil change, et après chaque dizaine cochée, rappel réglé, place prise ou quittée.
 * Sans compte relié ni profil, tous les rappels `rosary-…` sont annulés (les autres rappels ne sont pas touchés). Hors ligne,
 * on garde ce qui est programmé.
 */
function RosarySync() {
  const { status, userId, profile, profileLoaded, profileOffline } = useAuth();
  const profileMissing = status === 'signedIn' && profileLoaded && !profileOffline && !profile;
  const waiting = status === 'signedIn' && !profileLoaded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance la synchro quand on change de compte
  useEffect(() => {
    if (!notificationsSupported || waiting) return;
    const sync = () => syncRosaryReminders({ profileMissing }).catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const off = onRosariesChanged(sync);
    return () => {
      sub.remove();
      off();
    };
  }, [waiting, profileMissing, userId, status]);
  return null;
}

/**
 * Les rappels de la chaîne d'adoration (10 minutes avant chacun de mes 3 prochains créneaux) sont reprogrammés au lancement,
 * au retour de l'app au premier plan, quand le compte ou le profil change, et après chaque créneau réservé ou libéré, chaîne
 * organisée, modifiée ou annulée. Sans compte relié ni profil, tous les rappels `adoration-…` sont annulés (les autres rappels
 * ne sont pas touchés). Hors ligne, on garde ce qui est programmé.
 */
function AdorationSync() {
  const { status, userId, profile, profileLoaded, profileOffline } = useAuth();
  const profileMissing = status === 'signedIn' && profileLoaded && !profileOffline && !profile;
  const waiting = status === 'signedIn' && !profileLoaded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance la synchro quand on change de compte
  useEffect(() => {
    if (!notificationsSupported || waiting) return;
    const sync = () => syncAdorationReminders({ profileMissing }).catch(() => {});
    sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const off = onAdorationChanged(sync);
    return () => {
      sub.remove();
      off();
    };
  }, [waiting, profileMissing, userId, status]);
  return null;
}

/**
 * Le jeton de notification de ce téléphone est enregistré pour le compte relié : au lancement, au retour au premier plan, quand
 * le compte change et quand le téléphone change de jeton. On ne demande l'autorisation qu'une fois, à une personne qui a un
 * profil (c'est elle qui reçoit des demandes, des abonnés, des nouvelles de groupe) ; sans autorisation, rien n'est enregistré.
 * Sans compte relié, rien n'est enregistré. Les erreurs (Firebase absent, hors ligne) ne bloquent rien.
 */
function PushSync() {
  const { status, userId, profile } = useAuth();
  const hasProfile = !!profile;
  // biome-ignore lint/correctness/useExhaustiveDependencies: userId relance l'enregistrement quand on change de compte
  useEffect(() => {
    clearPrefsCache();
    if (!notificationsSupported || status !== 'signedIn') return;
    const register = (force = false) => registerPushToken({ force }).catch(() => {});
    const start = async () => {
      const ask = hasProfile && (await canAskNotificationPermission().catch(() => false));
      await registerPushToken({ ask, force: true }).catch(() => {});
    };
    void start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void register();
    });
    const off = onPushTokenChanged(() => void register(true));
    return () => {
      sub.remove();
      off();
    };
  }, [status, userId, hasProfile]);
  return null;
}

/** Toucher le rappel d'un rendez-vous ouvre son groupe, celui d'une neuvaine ouvre la neuvaine, celui du Rosaire vivant ouvre le Rosaire, celui d'un créneau d'adoration ouvre la chaîne. Le rappel quotidien n'a pas d'adresse : il ouvre l'app, comme avant. */
function NotificationLinks() {
  useEffect(() => {
    if (!notificationsSupported) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const url = response.notification.request.content.data?.url;
      const chain = adorationChainIdFromUrl(url);
      if (chain) {
        openAdorationChain(chain);
        return;
      }
      const novena = novenaIdFromUrl(url);
      if (novena) {
        openNovena(novena);
        return;
      }
      const rosary = rosaryIdFromUrl(url);
      if (rosary) {
        openRosary(rosary);
        return;
      }
      const id = groupIdFromUrl(url);
      if (id) {
        openGroup(id);
        return;
      }
      // Push de la communauté : réglages du groupe (demande, signalement) et profil d'un abonné.
      const route = pushRouteFromUrl(url);
      if (route) router.push(route);
    };
    // Le toucher qui a lancé l'app, puis ceux de la session ; on l'efface pour ne pas rouvrir le groupe au prochain montage.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      open(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}

/**
 * La visite de bienvenue s'ouvre une seule fois par téléphone, une fois la progression chargée. On ne la montre que si l'app
 * s'ouvre sur l'accueil : un lien, un rappel touché ou l'inscription ne sont pas détournés. Elle est notée comme vue dès qu'on
 * l'ouvre, pour ne jamais revenir.
 */
function TourGate() {
  const { loaded } = useApp();
  const pathname = usePathname();
  const checked = useRef(false);
  useEffect(() => {
    if (!loaded || checked.current) return;
    checked.current = true;
    if (pathname !== '/') return;
    void tourSeen().then((seen) => {
      if (seen) return;
      void markTourSeen();
      router.push('/bienvenue');
    });
  }, [loaded, pathname]);
  return null;
}

function ThemedShell() {
  const { progress } = useApp();
  const system = useColorScheme();
  const { scheme, accent } = progress.appearance;
  // Les éléments natifs (alertes, clavier, Face ID) suivent le thème choisi dans l'app ; « Système » les rend à l'OS.
  useEffect(() => {
    Appearance.setColorScheme(scheme === 'system' ? 'unspecified' : scheme);
  }, [scheme]);
  // La couleur du jour vient du calendrier calculé sur le téléphone : elle ne dépend pas du réseau.
  const liturgical = accent === 'liturgique' ? liturgicalDay(progress.day).color : null;
  const palette = useMemo(() => paletteFor(scheme, system, liturgical), [scheme, system, liturgical]);
  const theme = useMemo(() => navigationTheme(palette), [palette]);
  return (
    <PaletteProvider value={palette}>
      <ThemeProvider value={theme}>
        <StatusBar style={palette.statusBar} />
        <ReminderSync />
        <GatheringSync />
        <NovenaSync />
        <RosarySync />
        <AdorationSync />
        <PushSync />
        <NotificationLinks />
        <ProgressSync />
        <AdoptionRetry />
        <ShowcaseSync />
        <TourGate />
        <EchoHost />
        <Stack
          screenOptions={{
            headerTintColor: palette.text,
            headerTitleStyle: { fontFamily: fontFace('sans', 700, false) },
            headerStyle: { backgroundColor: palette.bg },
            headerShadowVisible: false,
            headerBackTitle: 'Retour',
            contentStyle: { backgroundColor: palette.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="office/[id]" options={{ title: '' }} />
          <Stack.Screen name="priere/[id]" options={{ title: '' }} />
          <Stack.Screen name="confession" options={{ title: 'Confession' }} />
          <Stack.Screen name="chapelet" options={{ title: 'Chapelet' }} />
          <Stack.Screen name="adoration" options={{ title: 'Adoration' }} />
          <Stack.Screen name="priere-edition" options={{ title: 'Ma prière', presentation: 'modal' }} />
          <Stack.Screen name="messe" options={{ title: 'Messe du jour' }} />
          <Stack.Screen name="suivre-messe" options={{ title: 'Suivre la messe' }} />
          <Stack.Screen name="genealogie" options={{ title: 'D’Adam à Jésus' }} />
          <Stack.Screen name="annee-liturgique" options={{ title: 'Année liturgique' }} />
          <Stack.Screen name="saints" options={{ title: 'Saint du jour' }} />
          <Stack.Screen name="avent" options={{ title: 'Parcours de l’Avent' }} />
          <Stack.Screen name="careme" options={{ title: 'Parcours de Carême' }} />
          <Stack.Screen name="actualites" options={{ title: 'L’Église aujourd’hui' }} />
          <Stack.Screen name="plan/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="plans" options={{ title: 'Plans de lecture', presentation: 'modal' }} />
          <Stack.Screen name="intentions" options={{ title: 'Intentions confiées' }} />
          <Stack.Screen name="rappel" options={{ title: 'Rappel quotidien', presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="compte" options={{ title: '' }} />
          <Stack.Screen name="inscription" options={{ headerShown: false }} />
          <Stack.Screen name="profil/index" options={{ title: 'Profil' }} />
          <Stack.Screen name="profil/[handle]" options={{ title: 'Profil' }} />
          <Stack.Screen name="profil/modifier" options={{ title: 'Modifier mon profil' }} />
          <Stack.Screen name="profil/abonnes" options={{ title: 'Abonnés' }} />
          <Stack.Screen name="profil/abonnements" options={{ title: 'Abonnements' }} />
          <Stack.Screen name="profil/bloques" options={{ title: 'Personnes bloquées' }} />
          <Stack.Screen name="groupe/nouveau" options={{ title: 'Créer un groupe' }} />
          <Stack.Screen name="groupe/rejoindre" options={{ title: 'Rejoindre avec un code' }} />
          <Stack.Screen name="groupe/[id]" options={{ title: 'Groupe' }} />
          <Stack.Screen name="groupe/rendez-vous" options={{ title: 'Rendez-vous' }} />
          <Stack.Screen name="groupe/neuvaine-nouvelle" options={{ title: 'Lancer une neuvaine' }} />
          <Stack.Screen name="neuvaine/[id]" options={{ title: 'Neuvaine' }} />
          <Stack.Screen name="rosaire/[id]" options={{ title: 'Rosaire vivant' }} />
          <Stack.Screen name="groupe/adoration-nouvelle" options={{ title: 'Chaîne d’adoration' }} />
          <Stack.Screen name="adoration-chaine/[id]" options={{ title: 'Chaîne d’adoration' }} />
          <Stack.Screen name="groupe/membres" options={{ title: 'Membres' }} />
          <Stack.Screen name="groupe/reglages" options={{ title: 'Réglages du groupe' }} />
          {/* Pas de geste de retour : on ne quitte pas la salle par erreur, le bouton « Quitter la salle » suffit. */}
          <Stack.Screen name="salle/[id]" options={{ title: 'Salle de prière', gestureEnabled: false }} />
          <Stack.Screen name="rejoindre/[code]" options={{ title: 'Rejoindre un groupe' }} />
          <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
          <Stack.Screen name="moderation" options={{ title: 'Modération' }} />
          <Stack.Screen name="passages" options={{ title: 'Passages gardés' }} />
          <Stack.Screen name="guide" options={{ title: 'Guide de l’app' }} />
          <Stack.Screen name="bienvenue" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        </Stack>
      </ThemeProvider>
    </PaletteProvider>
  );
}

// Le splash reste affiché le temps de charger les polices : pas de flash de police système.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts(FONT_FILES);
  const ready = fontsLoaded || !!fontsError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  // Une police qui ne charge pas ne bloque pas l'app : le texte reprend la police du téléphone.
  if (!ready) return null;
  return (
    <ProgressProvider>
      <AuthProvider>
        <ThemedShell />
      </AuthProvider>
    </ProgressProvider>
  );
}
