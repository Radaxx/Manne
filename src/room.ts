import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { currentOffice } from './aelf';
import { type PrayerKind, readPrayerKind } from './gatherings';
import { type GroupIntention, isGoneMessage, readGroupIntention } from './groups';
import { haptic } from './haptics';
import { asRecord, call, readRows } from './profile';
import { supabase } from './supabase';

// Salle de prière en direct (supabase/migrations/010_prayer_room.sql).
//
// Ce qui vient du SERVEUR (room_state, appel RPC) : l'ouverture de la salle (fenêtre calculée par le serveur), l'heure de
// fin, les présents déclarés (sans les personnes bloquées) et les intentions de CETTE occurrence, filtrées (blocage,
// masquage). C'est la seule source de vérité.
//
// Ce qui passe par Supabase Realtime : un canal PRIVÉ par occurrence, de topic `room:<rendez-vous>:<début en ms>`, autorisé
// par des politiques sur realtime.messages (membre du groupe, présent, fenêtre en cours). Il ne transporte que des
// SIGNAUX : la présence { handle }, le broadcast `amen` { handle } et le broadcast `intention` (sans contenu : à sa réception,
// chaque téléphone relit les intentions par room_state). Rien n'est stocké.
//
// Le pseudo des signaux vient du profil local : un téléphone modifié pourrait en envoyer un autre. C'est acceptable : seuls
// des présents autorisés reçoivent ces signaux, et l'écran n'affiche que les pseudos que room_state confirme présents.
//
// Si le canal ne s'abonne pas, la salle marche quand même : relecture toutes les 20 secondes et au retour au premier plan.

export const ROOM_POLL_MS = 20_000;
/** Le jeton du canal privé : au-delà, on s'abonne quand même (le client le renvoie dès qu'il l'a). */
const AUTH_WAIT_MS = 3_000;
/** Sans réponse du serveur à l'abonnement dans ce délai, le canal est considéré comme tombé. */
const JOIN_WAIT_MS = 12_000;
/** Délai avant une nouvelle tentative d'abonnement. */
const RETRY_MS = 10_000;
export const AMEN_COOLDOWN_MS = 5_000;
/** Combien de temps un « Amen » reçu reste affiché. */
export const AMEN_SHOWN_MS = 3_500;
export const LEAD_MS = 10 * 60_000;

// ---------------------------------------------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------------------------------------------

/** Le topic du canal privé de l'occurrence qui commence à `occurrenceMs` (ms epoch). Doit rester identique à can_use_room. */
export function roomTopic(gatheringId: string, occurrenceMs: number): string {
  return `room:${gatheringId.toLowerCase()}:${Math.floor(occurrenceMs)}`;
}

/** Un « Amen » peut-il partir ? Un seul toutes les 5 secondes. */
export function canAmen(lastSentAt: number, now: number): boolean {
  return lastSentAt <= 0 || now - lastSentAt >= AMEN_COOLDOWN_MS || now < lastSentAt;
}

/** Secondes à attendre avant le prochain « Amen » (0 s'il peut partir). */
export function amenWaitSeconds(lastSentAt: number, now: number): number {
  return canAmen(lastSentAt, now) ? 0 : Math.ceil((AMEN_COOLDOWN_MS - (now - lastSentAt)) / 1000);
}

/** Écart entre l'horloge du serveur et celle du téléphone, à ajouter à Date.now() pour obtenir l'heure du serveur. */
export function clockOffset(serverNowMs: number, localNowMs: number): number {
  return Number.isFinite(serverNowMs) ? serverNowMs - localNowMs : 0;
}

/** Temps restant jusqu'à `endsAt` (ISO), à l'heure du serveur ; jamais négatif. */
export function remainingMs(endsAt: string | null, nowMs: number, offsetMs: number): number {
  const end = endsAt ? Date.parse(endsAt) : Number.NaN;
  return Number.isFinite(end) ? Math.max(0, end - (nowMs + offsetMs)) : 0;
}

/** Temps avant l'ouverture de la prière (début de l'occurrence), à l'heure du serveur ; 0 si elle a commencé. */
export function untilStartMs(startsAt: string | null, nowMs: number, offsetMs: number): number {
  const start = startsAt ? Date.parse(startsAt) : Number.NaN;
  return Number.isFinite(start) ? Math.max(0, start - (nowMs + offsetMs)) : 0;
}

/** « 12:05 » ; « 1:02:03 » à partir d'une heure. Arrondi à la seconde supérieure. */
export function timerLabel(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

/** Les pseudos d'un `presenceState()` de Realtime : { clé: [{ handle }, …] }. Les entrées illisibles sont ignorées. */
export function presenceHandles(state: unknown): string[] {
  const record = asRecord(state);
  if (!record) return [];
  const found = new Set<string>();
  for (const metas of Object.values(record)) {
    if (!Array.isArray(metas)) continue;
    for (const meta of metas) {
      const handle = asRecord(meta)?.handle;
      if (typeof handle === 'string' && handle) found.add(handle);
    }
  }
  return [...found];
}

/**
 * Qui est EN LIGNE dans la salle : les pseudos de la présence qui figurent aussi parmi les présents déclarés connus du
 * serveur (le serveur ne liste pas les personnes bloquées). Triés, sans doublon (deux téléphones, un pseudo).
 */
export function mergePresence(live: string[], declared: string[]): string[] {
  const known = new Set(declared);
  return [...new Set(live)].filter((handle) => known.has(handle)).sort((a, b) => a.localeCompare(b));
}

/** Y a-t-il un pseudo en ligne que le serveur ne nous a pas encore donné (arrivée récente) ? Alors on relit. */
export function hasUnknownHandle(live: string[], declared: string[]): boolean {
  const known = new Set(declared);
  return live.some((handle) => !known.has(handle));
}

export type AmenSignal = { handle: string; key: number };

/** Le pseudo d'un signal `amen` reçu, ou null s'il est illisible. */
export function readAmenHandle(payload: unknown): string | null {
  const record = asRecord(payload);
  const inner = asRecord(record?.payload) ?? record;
  const handle = inner?.handle;
  return typeof handle === 'string' && handle && handle.length <= 40 ? handle : null;
}

export const amenLabel = (handle: string) => `@${handle} : Amen`;

export const presentInRoomLabel = (n: number) => (n > 1 ? `${n} présents` : `${n} présent`);

/** Les personnes connectées en ce moment, moi compris : « 2 dans la salle ». */
export const inRoomLabel = (n: number) => `${n} dans la salle`;

/**
 * Ceux qui ont dit « Je suis là » sans être connectés en ce moment ne sont pas « dans la salle » : on ne les mentionne
 * qu'à part, et seulement s'il y en a plus que de connectés.
 */
export function declaredNote(declared: number, online: number): string | null {
  if (declared <= online) return null;
  return declared > 1 ? `${declared} ont dit « Je suis là » pour ce rendez-vous` : '1 a dit « Je suis là » pour ce rendez-vous';
}

/** Le bouton de la prière du rendez-vous, ou null pour une prière libre. */
export function prayerButtonLabel(kind: PrayerKind): string | null {
  if (kind === 'chapelet') return 'Prier le chapelet';
  if (kind === 'office') return 'Prier l’office';
  if (kind === 'adoration') return 'Entrer en adoration';
  return null;
}

/** L'écran guidé qui correspond à la prière du rendez-vous. L'office est celui de l'heure qu'il est. */
export function prayerHref(kind: PrayerKind, now: Date = new Date()): '/chapelet' | '/adoration' | `/office/${string}` | null {
  if (kind === 'chapelet') return '/chapelet';
  if (kind === 'adoration') return '/adoration';
  if (kind === 'office') return `/office/${currentOffice(now).id}`;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Lecteur de l'état de la salle (défensif)
// ---------------------------------------------------------------------------------------------------------------

export type RoomState = {
  title: string;
  groupId: string;
  groupName: string;
  prayerKind: PrayerKind;
  /** L'heure du serveur à la lecture (ms epoch). */
  serverNow: number;
  open: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Début de l'occurrence en ms epoch : sert au topic du canal. */
  occurrenceMs: number | null;
  present: boolean;
  presentCount: number;
  presentHandles: string[];
  intentions: GroupIntention[];
};

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const isoDate = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);

export function readRoomState(data: unknown): RoomState | null {
  const record = asRecord(data);
  if (!record) return null;
  const title = text(record.title);
  const groupId = text(record.group_id);
  const groupName = text(record.group_name);
  if (!title || !groupId || !groupName) return null;
  const serverNow = typeof record.server_now === 'string' ? Date.parse(record.server_now) : Number.NaN;
  const startsAt = isoDate(record.starts_at);
  const endsAt = isoDate(record.ends_at);
  const ms = typeof record.occurrence_ms === 'number' ? record.occurrence_ms : Number.NaN;
  // Ouverte seulement si tout ce qui sert à l'afficher est lisible.
  const open = record.open === true && !!startsAt && !!endsAt && Number.isFinite(ms) && ms > 0;
  const present = open && record.present === true;
  const count = Number(record.present_count);
  return {
    title,
    groupId,
    groupName,
    prayerKind: readPrayerKind(record.prayer_kind),
    serverNow: Number.isFinite(serverNow) ? serverNow : Date.now(),
    open,
    startsAt: open ? startsAt : null,
    endsAt: open ? endsAt : null,
    occurrenceMs: open ? Math.floor(ms) : null,
    present,
    presentCount: open && Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0,
    presentHandles:
      present && Array.isArray(record.present_handles)
        ? record.present_handles.filter((h): h is string => typeof h === 'string' && !!h)
        : [],
    intentions: present ? readRows(record.intentions, readGroupIntention) : [],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Appels
// ---------------------------------------------------------------------------------------------------------------

type Failure = { ok: false; message: string };

/** Une lecture numéro `mine` vaut d'être appliquée si aucune lecture plus récente ne l'a été avant elle. Fonction pure. */
export function isFreshRequest(applied: number, mine: number): boolean {
  return mine > applied;
}

export async function fetchRoomState(gatheringId: string): Promise<{ ok: true; room: RoomState } | Failure> {
  const result = await call('room_state', { p_id: gatheringId });
  if (!result.ok) return result;
  const room = readRoomState(result.data);
  return room ? { ok: true, room } : { ok: false, message: 'Ça n’a pas pu partir. Réessaie quand tu as du réseau.' };
}

export function postRoomIntention(gatheringId: string, body: string) {
  return call('post_room_intention', { p_id: gatheringId, p_body: body.trim() });
}

// ---------------------------------------------------------------------------------------------------------------
// Le hook de la salle
// ---------------------------------------------------------------------------------------------------------------

/** `off` : pas de canal (pas encore présent, hors fenêtre, en arrière-plan) ; `down` : le canal n'a pas pu s'abonner. */
export type Link = 'off' | 'connecting' | 'live' | 'down';

/** Ce qu'est devenu MON « Amen » : parti dans la salle, ou resté sur le téléphone faute de connexion en direct. */
export type AmenSent = { ok: boolean; key: number };

export function useRoom(gatheringId: string, myHandle: string | null) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<Link>('off');
  const [live, setLive] = useState<string[]>([]);
  const [amen, setAmen] = useState<AmenSignal | null>(null);
  const [amenSent, setAmenSent] = useState<AmenSent | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const offset = useRef(0);
  const declared = useRef<string[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastAmen = useRef(0);
  const amenKey = useRef(0);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  // Chaque lecture a un numéro croissant ; une lecture plus lente qu'une plus récente déjà appliquée est ignorée.
  const requestSeq = useRef(0);
  const appliedSeq = useRef(0);
  const currentId = useRef(gatheringId);
  currentId.current = gatheringId;

  const reload = useCallback(async () => {
    // Pas d'identifiant (profil pas encore prêt) : on reste en chargement, sans appeler le serveur.
    if (!gatheringId) return;
    const mine = ++requestSeq.current;
    const result = await fetchRoomState(gatheringId);
    if (!alive.current || currentId.current !== gatheringId || !isFreshRequest(appliedSeq.current, mine)) return;
    appliedSeq.current = mine;
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      // Salle ou rendez-vous disparu, ou accès retiré (retiré du groupe, banni) : on quitte l'état de la salle, ce qui ferme le canal.
      if (isGoneMessage(result.message)) {
        declared.current = [];
        setRoom(null);
      }
      return;
    }
    setError(null);
    offset.current = clockOffset(result.room.serverNow, Date.now());
    declared.current = result.room.presentHandles;
    setRoom(result.room);
  }, [gatheringId]);

  // Relit après un court délai : plusieurs signaux d'affilée ne font qu'une lecture.
  const reloadSoon = useCallback(() => {
    if (reloadTimer.current) return;
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      void reload();
    }, 400);
  }, [reload]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = null;
    };
  }, []);

  // Lecture au départ, toutes les 20 secondes (secours si le temps réel tombe), et au retour au premier plan.
  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void reload();
    }, ROOM_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state === 'active') void reload();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [reload]);

  // À la fin du rendez-vous, on relit : le serveur dit que la salle est fermée.
  const endsAt = room?.endsAt ?? null;
  useEffect(() => {
    if (!endsAt) return;
    const wait = remainingMs(endsAt, Date.now(), offset.current) + 1000;
    const timer = setTimeout(() => void reload(), Math.min(wait, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [endsAt, reload]);

  // Le canal privé de l'occurrence : seulement quand la salle est ouverte, que je suis présent et que l'app est au premier plan.
  const occurrenceMs = room?.open && room.present && active ? room.occurrenceMs : null;
  useEffect(() => {
    const client = supabase;
    if (!client || occurrenceMs === null) {
      setLink('off');
      setLive([]);
      return;
    }
    let closed = false;
    let opened: RealtimeChannel | null = null;
    let joinTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    setLink('connecting');
    // Le canal est tombé (refus, délai, coupure) : relecture régulière en attendant, et nouvel essai un peu plus tard.
    const fail = (why: string) => {
      if (closed) return;
      console.warn(`[salle] connexion en direct indisponible (essai ${attempt + 1}) : ${why}`);
      setLink('down');
      if (joinTimer) clearTimeout(joinTimer);
      joinTimer = null;
      if (!retryTimer) retryTimer = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS);
    };
    const connect = async () => {
      // Le JWT courant part avec le canal privé (Realtime Authorization) ; le client le renvoie aussi quand il se renouvelle.
      // On n'attend pas indéfiniment : un jeton qui tarde ne doit pas bloquer la salle en « connexion ».
      let authTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          client.realtime.setAuth(),
          new Promise((_, reject) => {
            authTimer = setTimeout(() => reject(new Error('jeton en retard')), AUTH_WAIT_MS);
          }),
        ]);
      } catch (e) {
        console.warn(`[salle] jeton du canal : ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (authTimer) clearTimeout(authTimer);
      }
      if (closed) return;
      joinTimer = setTimeout(() => fail('pas de réponse à l’abonnement'), JOIN_WAIT_MS);
      const next = client.channel(roomTopic(gatheringId, occurrenceMs), {
        config: { private: true, broadcast: { self: false }, presence: { enabled: true } },
      });
      opened = next;
      next
        .on('presence', { event: 'sync' }, () => {
          if (closed) return;
          const handles = presenceHandles(next.presenceState());
          setLive(handles);
          if (hasUnknownHandle(handles, declared.current)) reloadSoon();
        })
        .on('broadcast', { event: 'amen' }, (message) => {
          const handle = readAmenHandle(message);
          if (closed || !handle) return;
          // Un pseudo que le serveur ne confirme pas (bloqué, ou arrivé à l'instant) n'est pas affiché.
          if (!declared.current.includes(handle)) {
            reloadSoon();
            return;
          }
          haptic();
          amenKey.current += 1;
          setAmen({ handle, key: amenKey.current });
        })
        .on('broadcast', { event: 'intention' }, () => {
          if (!closed) reloadSoon();
        })
        .subscribe((status, err) => {
          if (closed) return;
          if (status === 'SUBSCRIBED') {
            if (joinTimer) clearTimeout(joinTimer);
            joinTimer = null;
            setLink('live');
            if (myHandle) void next.track({ handle: myHandle }).catch(() => {});
            // Quelqu'un a pu écrire pendant que le canal s'ouvrait.
            reloadSoon();
          } else {
            fail(`${status}${err?.message ? ` (${err.message})` : ''}`);
          }
        });
      channel.current = next;
    };
    void connect();
    return () => {
      closed = true;
      if (joinTimer) clearTimeout(joinTimer);
      if (retryTimer) clearTimeout(retryTimer);
      channel.current = null;
      setLive([]);
      const toClose = opened;
      if (toClose) {
        void toClose.untrack().catch(() => {});
        void client.removeChannel(toClose).catch(() => {});
      }
    };
  }, [gatheringId, occurrenceMs, myHandle, reloadSoon, attempt]);

  // L'« Amen » reçu s'efface seul.
  useEffect(() => {
    if (!amen) return;
    const timer = setTimeout(() => setAmen(null), AMEN_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [amen]);

  const online = useMemo(() => mergePresence(live, room?.presentHandles ?? []), [live, room?.presentHandles]);

  /**
   * Envoie un « Amen » aux autres (5 secondes entre deux). Renvoie faux s'il est trop tôt. `amenSent` dit ensuite s'il
   * est vraiment parti : sans canal ouvert, il ne peut atteindre personne.
   */
  const sendAmen = useCallback(() => {
    const now = Date.now();
    if (!canAmen(lastAmen.current, now)) return false;
    lastAmen.current = now;
    haptic();
    amenKey.current += 1;
    const key = amenKey.current;
    const open = channel.current;
    if (!myHandle || !open || link !== 'live') {
      setAmenSent({ ok: false, key });
      return true;
    }
    open
      .send({ type: 'broadcast', event: 'amen', payload: { handle: myHandle } })
      .then((result) => {
        if (alive.current) setAmenSent({ ok: result === 'ok', key });
      })
      .catch(() => {
        if (alive.current) setAmenSent({ ok: false, key });
      });
    return true;
  }, [myHandle, link]);

  // Le retour de mon « Amen » s'efface seul.
  useEffect(() => {
    if (!amenSent) return;
    const timer = setTimeout(() => setAmenSent(null), AMEN_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [amenSent]);

  /** Une intention vient d'être écrite : les autres téléphones la relisent (aucun contenu ne passe par le canal). */
  const signalIntention = useCallback(() => {
    void channel.current?.send({ type: 'broadcast', event: 'intention', payload: {} }).catch(() => {});
  }, []);

  /** Change l'état local sans attendre le serveur (par exemple « Je la porte ») ; la prochaine lecture le corrige. */
  const patchIntention = useCallback((id: string, change: (item: GroupIntention) => GroupIntention) => {
    setRoom((current) =>
      current ? { ...current, intentions: current.intentions.map((item) => (item.id === id ? change(item) : item)) } : current,
    );
  }, []);

  return { room, error, loading, link, online, amen, amenSent, offset, reload, sendAmen, signalIntention, patchIntention };
}
