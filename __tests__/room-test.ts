import { currentOccurrence, nextOccurrences, presenceWindow, readPrayerKind, type Schedule } from '../src/gatherings';
import {
  AMEN_COOLDOWN_MS,
  amenLabel,
  amenWaitSeconds,
  canAmen,
  clockOffset,
  declaredNote,
  hasUnknownHandle,
  inRoomLabel,
  isFreshRequest,
  mergePresence,
  prayerButtonLabel,
  prayerHref,
  presenceHandles,
  readAmenHandle,
  readRoomState,
  remainingMs,
  roomTopic,
  timerLabel,
  untilStartMs,
} from '../src/room';

const GID = '3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b';

const intention = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  body: 'Pour la paix.',
  created_at: '2026-10-20T19:02:00Z',
  mine: false,
  handle: 'dev_marie',
  carries: 2,
  carrying: false,
  answered_at: null,
  thanks: null,
  hidden: false,
  ...over,
});

const open = (over: Record<string, unknown> = {}) => ({
  title: 'Chapelet',
  group_id: 'grp',
  group_name: 'Fraternité de test',
  prayer_kind: 'chapelet',
  server_now: '2026-10-20T19:01:00Z',
  open: true,
  starts_at: '2026-10-20T19:00:00Z',
  ends_at: '2026-10-20T19:30:00Z',
  occurrence_ms: Date.parse('2026-10-20T19:00:00Z'),
  present: true,
  present_count: 3,
  present_handles: ['dev_marie', 'dev_claire'],
  intentions: [intention()],
  ...over,
});

describe('topic du canal', () => {
  it('suit la forme room:<rendez-vous>:<ms>, en minuscules', () => {
    expect(roomTopic(GID.toUpperCase(), 1_792_522_800_000)).toBe(`room:${GID}:1792522800000`);
    expect(roomTopic(GID, 1_792_522_800_000.9)).toBe(`room:${GID}:1792522800000`);
  });
});

describe('« Amen »', () => {
  it('part au plus une fois toutes les 5 secondes', () => {
    expect(canAmen(0, 1000)).toBe(true);
    expect(canAmen(10_000, 10_000 + AMEN_COOLDOWN_MS - 1)).toBe(false);
    expect(canAmen(10_000, 10_000 + AMEN_COOLDOWN_MS)).toBe(true);
    // Horloge revenue en arrière : on ne bloque pas.
    expect(canAmen(10_000, 5_000)).toBe(true);
  });

  it('compte les secondes d’attente', () => {
    expect(amenWaitSeconds(10_000, 10_000)).toBe(5);
    expect(amenWaitSeconds(10_000, 12_100)).toBe(3);
    expect(amenWaitSeconds(10_000, 15_000)).toBe(0);
  });

  it('lit le pseudo d’un signal, brut ou enveloppé, et ignore le reste', () => {
    expect(readAmenHandle({ handle: 'dev_marie' })).toBe('dev_marie');
    expect(readAmenHandle({ type: 'broadcast', event: 'amen', payload: { handle: 'dev_claire' } })).toBe('dev_claire');
    expect(readAmenHandle({ payload: {} })).toBeNull();
    expect(readAmenHandle({ handle: 12 })).toBeNull();
    expect(readAmenHandle({ handle: 'x'.repeat(41) })).toBeNull();
    expect(readAmenHandle(null)).toBeNull();
    expect(amenLabel('dev_marie')).toBe('@dev_marie : Amen');
  });
});

describe('minuteur', () => {
  it('suit l’horloge du serveur, jamais négatif', () => {
    const offset = clockOffset(Date.parse('2026-10-20T19:01:00Z'), Date.parse('2026-10-20T19:00:00Z'));
    expect(offset).toBe(60_000);
    const local = Date.parse('2026-10-20T19:00:00Z'); // le serveur est à 19 h 01
    expect(remainingMs('2026-10-20T19:30:00Z', local, offset)).toBe(29 * 60_000);
    expect(remainingMs('2026-10-20T19:30:00Z', Date.parse('2026-10-20T20:00:00Z'), 0)).toBe(0);
    expect(remainingMs(null, local, 0)).toBe(0);
    expect(untilStartMs('2026-10-20T19:05:00Z', local, offset)).toBe(4 * 60_000);
    expect(untilStartMs('2026-10-20T19:00:00Z', local, offset)).toBe(0);
    expect(clockOffset(Number.NaN, 5)).toBe(0);
  });

  it('s’écrit mm:ss, puis h:mm:ss', () => {
    expect(timerLabel(0)).toBe('00:00');
    expect(timerLabel(1)).toBe('00:01');
    expect(timerLabel(12 * 60_000 + 5_000)).toBe('12:05');
    expect(timerLabel(3_723_000)).toBe('1:02:03');
    expect(timerLabel(-5)).toBe('00:00');
  });
});

describe('présence en ligne', () => {
  it('lit presenceState sans doublon et ignore les entrées illisibles', () => {
    const state = {
      a: [{ handle: 'dev_marie', presence_ref: 'x' }],
      b: [{ handle: 'dev_marie' }, { handle: 'dev_claire' }],
      c: [{ nope: true }, null, { handle: 3 }],
      d: 'x',
    };
    expect(presenceHandles(state).sort()).toEqual(['dev_claire', 'dev_marie']);
    expect(presenceHandles(null)).toEqual([]);
    expect(presenceHandles([])).toEqual([]);
  });

  it('ne garde que les pseudos confirmés par le serveur, triés', () => {
    expect(mergePresence(['dev_pierre', 'dev_marie', 'dev_marie', 'intrus'], ['dev_marie', 'dev_pierre'])).toEqual([
      'dev_marie',
      'dev_pierre',
    ]);
    expect(mergePresence([], ['dev_marie'])).toEqual([]);
    expect(hasUnknownHandle(['dev_marie', 'nouveau'], ['dev_marie'])).toBe(true);
    expect(hasUnknownHandle(['dev_marie'], ['dev_marie'])).toBe(false);
  });
});

describe('prière du rendez-vous', () => {
  it('propose un bouton selon la prière, aucun pour la prière libre', () => {
    expect(prayerButtonLabel('libre')).toBeNull();
    expect(prayerButtonLabel('chapelet')).toBe('Prier le chapelet');
    expect(prayerButtonLabel('office')).toBe('Prier l’office');
    expect(prayerButtonLabel('adoration')).toBe('Entrer en adoration');
  });

  it('ouvre l’écran guidé existant', () => {
    expect(prayerHref('libre')).toBeNull();
    expect(prayerHref('chapelet')).toBe('/chapelet');
    expect(prayerHref('adoration')).toBe('/adoration');
    expect(prayerHref('office', new Date(2026, 9, 20, 21, 0))).toMatch(/^\/office\/.+/);
  });

  it('une valeur inconnue vaut « libre »', () => {
    expect(readPrayerKind('chapelet')).toBe('chapelet');
    expect(readPrayerKind('autre')).toBe('libre');
    expect(readPrayerKind(undefined)).toBe('libre');
  });
});

describe('état de la salle', () => {
  it('lit une salle ouverte où l’on est présent', () => {
    const room = readRoomState(open());
    expect(room).toMatchObject({
      title: 'Chapelet',
      groupId: 'grp',
      prayerKind: 'chapelet',
      open: true,
      present: true,
      presentCount: 3,
      presentHandles: ['dev_marie', 'dev_claire'],
      occurrenceMs: Date.parse('2026-10-20T19:00:00Z'),
      serverNow: Date.parse('2026-10-20T19:01:00Z'),
    });
    expect(room?.intentions.map((i) => i.id)).toEqual(['i1']);
  });

  it('sans présence déclarée, ni présents ni intentions', () => {
    const room = readRoomState(open({ present: false }));
    expect(room).toMatchObject({ open: true, present: false, presentHandles: [], intentions: [] });
  });

  it('fermée ou incomplète : rien d’autre que le titre et le groupe', () => {
    for (const record of [open({ open: false }), open({ ends_at: 'pas une date' }), open({ occurrence_ms: null })]) {
      expect(readRoomState(record)).toMatchObject({
        open: false,
        present: false,
        endsAt: null,
        occurrenceMs: null,
        presentHandles: [],
        intentions: [],
      });
    }
  });

  it('ignore une intention illisible, refuse une réponse sans titre', () => {
    expect(readRoomState(open({ intentions: [intention(), { id: 'x' }, null] }))?.intentions).toHaveLength(1);
    expect(readRoomState(open({ title: '' }))).toBeNull();
    expect(readRoomState(null)).toBeNull();
    expect(readRoomState('x')).toBeNull();
  });

  it('une prière inconnue vaut « libre »', () => {
    expect(readRoomState(open({ prayer_kind: 'zzz' }))?.prayerKind).toBe('libre');
  });
});

describe('compteur de la salle', () => {
  it('compte les personnes connectées', () => {
    expect(inRoomLabel(2)).toBe('2 dans la salle');
  });

  it('ne mentionne les déclarés que s’ils sont plus nombreux que les connectés', () => {
    expect(declaredNote(2, 2)).toBeNull();
    expect(declaredNote(1, 2)).toBeNull();
    expect(declaredNote(4, 2)).toBe('4 ont dit « Je suis là » pour ce rendez-vous');
    expect(declaredNote(1, 0)).toBe('1 a dit « Je suis là » pour ce rendez-vous');
  });
});

describe('la salle d’un rendez-vous sur plusieurs jours', () => {
  // Les mardis, jeudis et samedis de 10 h à 10 h 15 à Paris, jusqu’au mardi 3 novembre 2026 inclus.
  const trio: Schedule = {
    recurrence: 'weekly',
    weekdays: [2, 4, 6],
    localTime: '10:00',
    timezone: 'Europe/Paris',
    startsAt: null,
    endsOn: '2026-11-03',
    durationMin: 15,
  };

  it('s’ouvre 10 minutes avant chaque jour voulu et pas les autres', () => {
    // Jeudi 22 octobre 2026, 10 h à Paris (UTC+2) = 8 h UTC.
    expect(currentOccurrence(trio, new Date('2026-10-22T07:49:59Z'))).toBeNull();
    expect(currentOccurrence(trio, new Date('2026-10-22T07:50:00Z'))?.toISOString()).toBe('2026-10-22T08:00:00.000Z');
    expect(currentOccurrence(trio, new Date('2026-10-22T08:14:59Z'))?.toISOString()).toBe('2026-10-22T08:00:00.000Z');
    expect(currentOccurrence(trio, new Date('2026-10-22T08:15:00Z'))).toBeNull();
    // Mercredi 21 : pas de rendez-vous.
    expect(currentOccurrence(trio, new Date('2026-10-21T08:05:00Z'))).toBeNull();
  });

  it('la topic du canal suit l’occurrence du jour', () => {
    const at = currentOccurrence(trio, new Date('2026-10-24T08:05:00Z'));
    expect(at?.toISOString()).toBe('2026-10-24T08:00:00.000Z');
    expect(roomTopic(GID, (at as Date).getTime())).toBe(`room:${GID}:${Date.parse('2026-10-24T08:00:00Z')}`);
  });

  it('après le changement d’heure, la salle reste à 10 h du mur', () => {
    // Samedi 31 octobre 2026 : UTC+1 depuis le 25.
    expect(currentOccurrence(trio, new Date('2026-10-31T09:05:00Z'))?.toISOString()).toBe('2026-10-31T09:00:00.000Z');
    expect(currentOccurrence(trio, new Date('2026-10-31T08:05:00Z'))).toBeNull();
  });

  it('le jour de la fin la salle s’ouvre encore, ensuite jamais plus', () => {
    // Mardi 3 novembre 2026 10 h = 9 h UTC (fin incluse) ; jeudi 5 : plus rien.
    expect(currentOccurrence(trio, new Date('2026-11-03T09:05:00Z'))?.toISOString()).toBe('2026-11-03T09:00:00.000Z');
    expect(currentOccurrence(trio, new Date('2026-11-05T09:05:00Z'))).toBeNull();
    expect(nextOccurrences(trio, new Date('2026-11-03T09:20:00Z'), 3)).toEqual([]);
  });

  it('la fenêtre de présence dure 10 minutes avant, puis la durée', () => {
    const { opensAt, closesAt } = presenceWindow(new Date('2026-10-22T08:00:00Z'), 15);
    expect(opensAt.toISOString()).toBe('2026-10-22T07:50:00.000Z');
    expect(closesAt.toISOString()).toBe('2026-10-22T08:15:00.000Z');
  });
});

describe('isFreshRequest', () => {
  it('ignore une lecture plus ancienne que celle déjà appliquée', () => {
    expect(isFreshRequest(0, 1)).toBe(true);
    expect(isFreshRequest(2, 3)).toBe(true);
    expect(isFreshRequest(3, 2)).toBe(false);
    expect(isFreshRequest(3, 3)).toBe(false);
  });
});
