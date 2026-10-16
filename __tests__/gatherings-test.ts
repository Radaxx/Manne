import { MAX_REMINDED, planReminders, reminderTitle } from '../src/gathering-reminders';
import {
  addMonths,
  currentOccurrence,
  durationLabel,
  ENDS_CHOICES,
  endsOnProblem,
  endTimeLabel,
  type Gathering,
  inPresenceWindow,
  isTimeZone,
  lastDayFor,
  lastOccurrence,
  type MyGathering,
  mergeServer,
  nextOccurrences,
  occurrenceLabel,
  onceProblem,
  participantsLabel,
  presenceWindow,
  presentLabel,
  readGathering,
  readMyGathering,
  restoreGathering,
  type Schedule,
  timeLabel,
  titleProblem,
  untilLabel,
  upcomingGatherings,
  weekdaysInZone,
  weekdaysPhrase,
  whenLabel,
  withParticipation,
  withPresence,
  zoneMention,
} from '../src/gatherings';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

const weekly = (
  weekday: number | number[],
  localTime: string,
  timezone: string,
  durationMin = 30,
  endsOn: string | null = null,
): Schedule => ({
  recurrence: 'weekly',
  weekdays: Array.isArray(weekday) ? weekday : [weekday],
  localTime,
  timezone,
  startsAt: null,
  endsOn,
  durationMin,
});

const once = (startsAt: string, durationMin = 30): Schedule => ({
  recurrence: 'once',
  weekdays: [],
  localTime: null,
  timezone: null,
  startsAt,
  endsOn: null,
  durationMin,
});

describe('nextOccurrences', () => {
  it('hebdomadaire dans le fuseau du téléphone : chaque mardi à 21 h, heure de Paris', () => {
    // Le mardi 20 octobre 2026 est encore à l'heure d'été (UTC+2) ; le 25 octobre on passe à l'heure d'hiver (UTC+1).
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    expect(iso(nextOccurrences(tuesday, new Date('2026-10-19T12:00:00Z'), 3))).toEqual([
      '2026-10-20T19:00:00.000Z',
      '2026-10-27T20:00:00.000Z',
      '2026-11-03T20:00:00.000Z',
    ]);
  });

  it('ne renvoie que des occurrences strictement futures', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    expect(iso(nextOccurrences(tuesday, new Date('2026-10-20T19:00:00Z'), 1))).toEqual(['2026-10-27T20:00:00.000Z']);
    expect(iso(nextOccurrences(tuesday, new Date('2026-10-20T18:59:59Z'), 1))).toEqual(['2026-10-20T19:00:00.000Z']);
    expect(nextOccurrences(tuesday, new Date('2026-10-19T12:00:00Z'), 0)).toEqual([]);
  });

  it('un autre fuseau : jeudi 19 h à Toronto, avec le retour à l’heure d’hiver américain du 1er novembre', () => {
    const toronto = weekly(4, '19:00', 'America/Toronto');
    expect(iso(nextOccurrences(toronto, new Date('2026-10-16T10:00:00Z'), 3))).toEqual([
      '2026-10-22T23:00:00.000Z',
      '2026-10-29T23:00:00.000Z',
      '2026-11-06T00:00:00.000Z',
    ]);
  });

  it('le jour de la semaine suit le fuseau du créateur, pas celui du serveur ni du téléphone', () => {
    // Mardi 1 h à Paris = lundi 23 h UTC.
    const early = weekly(2, '01:00', 'Europe/Paris');
    expect(iso(nextOccurrences(early, new Date('2026-10-18T00:00:00Z'), 1))).toEqual(['2026-10-19T23:00:00.000Z']);
  });

  it('passage à l’heure d’été (29 mars 2026) : le dimanche 21 h reste 21 h à Paris', () => {
    const sunday = weekly(0, '21:00', 'Europe/Paris');
    expect(iso(nextOccurrences(sunday, new Date('2026-03-22T12:00:00Z'), 3))).toEqual([
      '2026-03-22T20:00:00.000Z', // UTC+1
      '2026-03-29T19:00:00.000Z', // UTC+2
      '2026-04-05T19:00:00.000Z',
    ]);
  });

  it('passage à l’heure d’hiver (25 octobre 2026) : le dimanche 21 h reste 21 h à Paris', () => {
    const sunday = weekly(0, '21:00', 'Europe/Paris');
    expect(iso(nextOccurrences(sunday, new Date('2026-10-18T12:00:00Z'), 3))).toEqual([
      '2026-10-18T19:00:00.000Z', // UTC+2
      '2026-10-25T20:00:00.000Z', // UTC+1
      '2026-11-01T20:00:00.000Z',
    ]);
  });

  it('une heure qui n’existe pas (02 h 30 le 29 mars) est décalée vers l’avant, comme at time zone de Postgres', () => {
    const night = weekly(0, '02:30', 'Europe/Paris');
    expect(iso(nextOccurrences(night, new Date('2026-03-27T00:00:00Z'), 1))).toEqual(['2026-03-29T01:30:00.000Z']);
  });

  it('ponctuel : futur renvoyé, passé ignoré', () => {
    const meeting = once('2026-10-20T18:30:00Z');
    expect(iso(nextOccurrences(meeting, new Date('2026-10-16T10:00:00Z'), 2))).toEqual(['2026-10-20T18:30:00.000Z']);
    expect(nextOccurrences(meeting, new Date('2026-10-20T18:30:00Z'), 2)).toEqual([]);
    expect(nextOccurrences(meeting, new Date('2026-10-21T00:00:00Z'), 2)).toEqual([]);
  });

  it('ne plante jamais sur des données abîmées', () => {
    expect(nextOccurrences(weekly(2, '21:00', 'Nulle/Part'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(weekly(9, '21:00', 'Europe/Paris'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(weekly(2, '25:00', 'Europe/Paris'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(once('pas une date'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(weekly(2, '21:00', 'Europe/Paris'), new Date(Number.NaN), 2)).toEqual([]);
  });
});

describe('fenêtre de présence', () => {
  const start = new Date('2026-10-20T19:00:00Z');

  it('va de 10 minutes avant le début jusqu’à la fin de la durée', () => {
    const { opensAt, closesAt } = presenceWindow(start, 30);
    expect(opensAt.toISOString()).toBe('2026-10-20T18:50:00.000Z');
    expect(closesAt.toISOString()).toBe('2026-10-20T19:30:00.000Z');
  });

  it('est ouverte aux bornes qu’on attend', () => {
    expect(inPresenceWindow(start, 30, new Date('2026-10-20T18:49:59Z'))).toBe(false);
    expect(inPresenceWindow(start, 30, new Date('2026-10-20T18:50:00Z'))).toBe(true);
    expect(inPresenceWindow(start, 30, new Date('2026-10-20T19:29:59Z'))).toBe(true);
    expect(inPresenceWindow(start, 30, new Date('2026-10-20T19:30:00Z'))).toBe(false);
  });
});

describe('libellés', () => {
  it('écrit l’heure en français', () => {
    expect(timeLabel(21, 0)).toBe('21 h');
    expect(timeLabel(20, 30)).toBe('20 h 30');
    expect(timeLabel(9, 5)).toBe('9 h 05');
  });

  it('hebdomadaire : « Chaque mardi de 21 h à 21 h 30 »', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    const from = new Date('2026-10-19T12:00:00Z');
    expect(whenLabel(tuesday, from, 'Europe/Paris')).toBe('Chaque mardi de 21 h à 21 h 30');
    expect(whenLabel(weekly(0, '20:30', 'Europe/Paris'), from, 'Europe/Paris')).toBe('Chaque dimanche de 20 h 30 à 21 h');
  });

  it('ponctuel : « Mardi 20 octobre à 20 h 30 »', () => {
    const meeting = once('2026-10-20T18:30:00Z');
    expect(whenLabel(meeting, new Date('2026-10-16T10:00:00Z'), 'Europe/Paris')).toBe('Mardi 20 octobre à 20 h 30');
    expect(occurrenceLabel(new Date('2026-11-01T11:00:00Z'), 'Europe/Paris')).toBe('Dimanche 1er novembre à 12 h');
  });

  it('affiche l’heure du téléphone, et mentionne l’heure d’origine quand les fuseaux diffèrent', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    const from = new Date('2026-10-19T12:00:00Z');
    expect(whenLabel(tuesday, from, 'America/Toronto')).toBe('Chaque mardi de 15 h à 15 h 30');
    expect(zoneMention(tuesday, from, 'America/Toronto')).toBe('21 h, heure de Paris');
    expect(zoneMention(weekly(2, '20:30', 'America/Argentina/Buenos_Aires'), from, 'Europe/Paris')).toBe('20 h 30, heure de Buenos Aires');
  });

  it('le jour affiché suit le téléphone', () => {
    // Mardi 1 h à Paris : lundi 19 h à Toronto.
    expect(whenLabel(weekly(2, '01:00', 'Europe/Paris'), new Date('2026-10-18T00:00:00Z'), 'America/Toronto')).toBe(
      'Chaque lundi de 19 h à 19 h 30',
    );
  });

  it('pas de mention quand l’heure est la même, ni pour un ponctuel', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    const from = new Date('2026-10-19T12:00:00Z');
    expect(zoneMention(tuesday, from, 'Europe/Paris')).toBeNull();
    expect(zoneMention(tuesday, from, 'Europe/Brussels')).toBeNull();
    expect(zoneMention(once('2026-10-20T18:30:00Z'), from, 'America/Toronto')).toBeNull();
  });

  it('durées, inscrits, présents, heure de fin', () => {
    expect(durationLabel(15)).toBe('15 min');
    expect(durationLabel(60)).toBe('1 h');
    expect(durationLabel(90)).toBe('1 h 30');
    expect(participantsLabel(0)).toBe('0 inscrit');
    expect(participantsLabel(1)).toBe('1 inscrit');
    expect(participantsLabel(7)).toBe('7 inscrits');
    expect(presentLabel(1)).toBe('1 présent');
    expect(presentLabel(3)).toBe('3 présents');
    expect(endTimeLabel(new Date('2026-10-20T19:00:00Z'), 30, 'Europe/Paris')).toBe('21 h 30');
  });

  it('valide le titre et le moment d’un ponctuel', () => {
    const now = new Date('2026-10-16T10:00:00Z');
    expect(titleProblem('ab')).toMatch(/au moins 3/);
    expect(titleProblem('a'.repeat(61))).toMatch(/60 caractères au plus/);
    expect(titleProblem('Chapelet')).toBeNull();
    expect(onceProblem(null, now)).toMatch(/à venir/);
    expect(onceProblem(new Date('2026-10-16T09:00:00Z'), now)).toMatch(/à venir/);
    expect(onceProblem(new Date('2026-12-30T09:00:00Z'), now)).toMatch(/60 prochains jours/);
    expect(onceProblem(new Date('2026-10-20T09:00:00Z'), now)).toBeNull();
  });

  it('connaît les fuseaux IANA', () => {
    expect(isTimeZone('Europe/Paris')).toBe(true);
    expect(isTimeZone('Nulle/Part')).toBe(false);
  });
});

describe('lecteurs', () => {
  const row = {
    id: 'g1',
    title: 'Chapelet',
    description: 'Une dizaine chacun.',
    duration_min: 30,
    recurrence: 'weekly',
    weekday: 2,
    weekdays: [2],
    ends_on: null,
    local_time: '21:00',
    timezone: 'Europe/Paris',
    starts_at: null,
    next_start: '2026-10-20T19:00:00Z',
    current_start: null,
    participant_count: 3,
    participating: true,
    present_count: 2,
    present: true,
  };

  it('lit un rendez-vous hebdomadaire', () => {
    expect(readGathering(row)).toEqual({
      id: 'g1',
      title: 'Chapelet',
      description: 'Une dizaine chacun.',
      durationMin: 30,
      recurrence: 'weekly',
      weekdays: [2],
      localTime: '21:00',
      timezone: 'Europe/Paris',
      startsAt: null,
      endsOn: null,
      nextStart: '2026-10-20T19:00:00Z',
      currentStart: null,
      participantCount: 3,
      participating: true,
      // Pas d'occurrence en cours : ni présents ni « tu es là ».
      presentCount: 0,
      present: false,
      prayerKind: 'libre',
    });
  });

  it('lit la prière du rendez-vous', () => {
    expect(readGathering({ ...row, prayer_kind: 'adoration' })?.prayerKind).toBe('adoration');
    expect(readGathering({ ...row, prayer_kind: 'autre' })?.prayerKind).toBe('libre');
  });

  it('garde les présents pendant la fenêtre, et accepte une heure avec secondes', () => {
    const read = readGathering({ ...row, local_time: '21:00:00', current_start: '2026-10-20T19:00:00Z' });
    expect(read?.localTime).toBe('21:00');
    expect(read?.presentCount).toBe(2);
    expect(read?.present).toBe(true);
  });

  it('lit un ponctuel', () => {
    const read = readGathering({
      ...row,
      recurrence: 'once',
      weekday: null,
      weekdays: null,
      local_time: null,
      timezone: null,
      starts_at: '2026-10-20T18:30:00Z',
    });
    expect(read).toMatchObject({
      recurrence: 'once',
      startsAt: '2026-10-20T18:30:00Z',
      weekdays: [],
      endsOn: null,
      localTime: null,
      timezone: null,
    });
  });

  it('ignore les lignes abîmées', () => {
    expect(readGathering(null)).toBeNull();
    expect(readGathering({ ...row, id: '' })).toBeNull();
    expect(readGathering({ ...row, title: null })).toBeNull();
    expect(readGathering({ ...row, duration_min: 5 })).toBeNull();
    expect(readGathering({ ...row, duration_min: 'abc' })).toBeNull();
    expect(readGathering({ ...row, recurrence: 'daily' })).toBeNull();
    expect(readGathering({ ...row, weekday: 7, weekdays: [7] })).toBeNull();
    expect(readGathering({ ...row, weekdays: [] })).toBeNull();
    expect(readGathering({ ...row, local_time: '25:00' })).toBeNull();
    expect(readGathering({ ...row, timezone: 'Nulle/Part' })).toBeNull();
    expect(readGathering({ ...row, recurrence: 'once', starts_at: 'hier' })).toBeNull();
    expect(readGathering({ ...row, participant_count: -1 })).toBeNull();
  });

  it('lit mes rendez-vous inscrits', () => {
    expect(
      readMyGathering({
        id: 'g1',
        group_id: 'grp',
        group_name: 'Fraternité de test',
        title: 'Chapelet',
        recurrence: 'weekly',
        weekday: 2,
        weekdays: [2],
        ends_on: null,
        local_time: '21:00',
        timezone: 'Europe/Paris',
        starts_at: null,
        duration_min: 30,
      }),
    ).toEqual({
      id: 'g1',
      groupId: 'grp',
      groupName: 'Fraternité de test',
      title: 'Chapelet',
      recurrence: 'weekly',
      weekdays: [2],
      localTime: '21:00',
      timezone: 'Europe/Paris',
      startsAt: null,
      endsOn: null,
      durationMin: 30,
      present: false,
    });
    expect(readMyGathering({ id: 'g1', title: 'Chapelet' })).toBeNull();
  });
});

describe('rappels à programmer', () => {
  const mine = (id: string, schedule: Schedule): MyGathering => ({
    ...schedule,
    id,
    groupId: 'grp',
    groupName: 'Fraternité de test',
    title: 'Chapelet',
    present: false,
  });
  const now = new Date('2026-10-19T12:00:00Z');

  it('programme les 2 prochaines occurrences, avec un identifiant préfixé et le titre « Chapelet — Fraternité de test »', () => {
    const planned = planReminders([mine('abc', weekly(2, '21:00', 'Europe/Paris'))], now);
    expect(planned.map((p) => p.at.toISOString())).toEqual(['2026-10-20T19:00:00.000Z', '2026-10-27T20:00:00.000Z']);
    expect(planned[0].identifier).toBe(`gathering-abc-${Date.parse('2026-10-20T19:00:00Z')}`);
    expect(planned[0].title).toBe('Chapelet — Fraternité de test');
    expect(planned[0].groupId).toBe('grp');
    expect(reminderTitle({ title: 'Chapelet', groupName: 'Fraternité de test' })).toBe('Chapelet — Fraternité de test');
  });

  it('ignore un ponctuel passé et ne garde que les 15 rendez-vous les plus proches', () => {
    const many = Array.from({ length: 20 }, (_, i) => mine(`m${i}`, weekly(i % 7, `${String(8 + i).padStart(2, '0')}:00`, 'Europe/Paris')));
    const planned = planReminders([...many, mine('old', once('2026-10-01T10:00:00Z'))], now);
    expect(new Set(planned.map((p) => p.identifier.split('-')[1])).size).toBe(MAX_REMINDED);
    expect(planned.length).toBe(MAX_REMINDED * 2);
    expect(planned.some((p) => p.identifier.startsWith('gathering-old-'))).toBe(false);
  });
});

describe('mise à jour optimiste d’une carte', () => {
  const card = (id: string, over: Partial<Gathering> = {}): Gathering => ({
    ...weekly(2, '21:00', 'Europe/Paris'),
    id,
    title: `RDV ${id}`,
    description: '',
    nextStart: null,
    currentStart: null,
    participantCount: 3,
    participating: false,
    presentCount: 0,
    present: false,
    prayerKind: 'libre',
    ...over,
  });

  it('« Je participe » ne change que la carte touchée, et le nombre d’inscrits', () => {
    const list = [card('a'), card('b')];
    const next = withParticipation(list, 'a', true);
    expect(next[0]).toMatchObject({ participating: true, participantCount: 4 });
    expect(next[1]).toBe(list[1]);
    expect(withParticipation(next, 'a', true)).toEqual(next);
    expect(withParticipation(next, 'a', false)[0]).toMatchObject({ participating: false, participantCount: 3 });
  });

  it('ne descend jamais sous zéro inscrit', () => {
    const list = [card('a', { participating: true, participantCount: 0 })];
    expect(withParticipation(list, 'a', false)[0].participantCount).toBe(0);
  });

  it('« Je suis là » ajoute un présent seulement dans la fenêtre et une seule fois', () => {
    const live = card('a', { currentStart: '2026-10-20T19:00:00Z', presentCount: 2 });
    const next = withPresence([live, card('b')], 'a');
    expect(next[0]).toMatchObject({ present: true, presentCount: 3 });
    expect(withPresence(next, 'a')).toEqual(next);
    expect(withPresence([card('b')], 'b')[0]).toMatchObject({ present: false, presentCount: 0 });
  });

  it('restoreGathering remet la carte d’avant sans toucher aux autres', () => {
    const before = card('a');
    const list = withParticipation([before, card('b', { participating: true })], 'a', true);
    const back = restoreGathering(list, before);
    expect(back[0]).toBe(before);
    expect(back[1]).toBe(list[1]);
  });

  it('mergeServer prend le serveur, sauf pour les cartes dont une action est en vol', () => {
    const local = [card('a', { participating: true, participantCount: 4 }), card('b')];
    const server = [card('b', { participantCount: 9 }), card('a', { participantCount: 3 }), card('c')];
    expect(mergeServer(local, server, new Set())).toBe(server);
    const merged = mergeServer(local, server, new Set(['a']));
    expect(merged.map((g) => g.id)).toEqual(['b', 'a', 'c']);
    expect(merged[0].participantCount).toBe(9);
    expect(merged[1]).toBe(local[0]);
  });
});

describe('prochains rendez-vous', () => {
  const mine = (id: string, schedule: Schedule, title = id): MyGathering => ({
    ...schedule,
    id,
    groupId: `g-${id}`,
    groupName: 'Groupe',
    title,
    present: false,
  });
  const now = new Date('2026-10-20T19:05:00Z'); // mardi 21 h 05 à Paris

  it('reconnaît l’occurrence en cours, dès 10 minutes avant le début jusqu’à la fin', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris', 30);
    expect(currentOccurrence(tuesday, now)?.toISOString()).toBe('2026-10-20T19:00:00.000Z');
    expect(currentOccurrence(tuesday, new Date('2026-10-20T18:50:00Z'))?.toISOString()).toBe('2026-10-20T19:00:00.000Z');
    expect(currentOccurrence(tuesday, new Date('2026-10-20T18:49:59Z'))).toBeNull();
    expect(currentOccurrence(tuesday, new Date('2026-10-20T19:30:00Z'))).toBeNull();
    expect(currentOccurrence(once('2026-10-20T19:00:00Z'), now)?.toISOString()).toBe('2026-10-20T19:00:00.000Z');
  });

  it('met ceux en cours d’abord, puis par date, et garde les 3 premiers', () => {
    const list = [
      mine('thu', weekly(4, '08:00', 'Europe/Paris')),
      mine('live', weekly(2, '21:00', 'Europe/Paris', 30)),
      mine('wed', weekly(3, '08:00', 'Europe/Paris')),
      mine('later', once('2026-12-01T10:00:00Z')),
      mine('past', once('2026-10-01T10:00:00Z')),
    ];
    const upcoming = upcomingGatherings(list, now);
    expect(upcoming.map((u) => u.gathering.id)).toEqual(['live', 'wed', 'thu']);
    expect(upcoming.map((u) => u.current)).toEqual([true, false, false]);
    expect(upcoming[0].at.toISOString()).toBe('2026-10-20T19:00:00.000Z');
    expect(upcomingGatherings([], now)).toEqual([]);
  });
});

describe('plusieurs jours de la semaine et une fin', () => {
  // Mardis, jeudis et samedis à 10 h, heure de Paris.
  const trio = (endsOn: string | null = null) => weekly([2, 4, 6], '10:00', 'Europe/Paris', 15, endsOn);

  it('renvoie les occurrences de chaque jour, dans l’ordre', () => {
    expect(iso(nextOccurrences(trio(), new Date('2026-10-16T12:00:00Z'), 4))).toEqual([
      '2026-10-17T08:00:00.000Z', // samedi 17
      '2026-10-20T08:00:00.000Z', // mardi 20
      '2026-10-22T08:00:00.000Z', // jeudi 22
      '2026-10-24T08:00:00.000Z', // samedi 24
    ]);
  });

  it('passage à l’heure d’hiver (25 octobre 2026) : 10 h reste 10 h à Paris', () => {
    expect(iso(nextOccurrences(trio(), new Date('2026-10-24T12:00:00Z'), 3))).toEqual([
      '2026-10-27T09:00:00.000Z', // mardi 27, UTC+1
      '2026-10-29T09:00:00.000Z',
      '2026-10-31T09:00:00.000Z',
    ]);
  });

  it('une fin incluse : le jour de la fin compte, le lendemain non', () => {
    // Fin le mardi 3 novembre 2026.
    const ended = trio('2026-11-03');
    expect(iso(nextOccurrences(ended, new Date('2026-11-01T12:00:00Z'), 5))).toEqual(['2026-11-03T09:00:00.000Z']);
    expect(nextOccurrences(ended, new Date('2026-11-03T09:00:00Z'), 5)).toEqual([]);
    expect(nextOccurrences(ended, new Date('2026-11-04T00:00:00Z'), 5)).toEqual([]);
  });

  it('une fin exclue : le jour d’après la fin n’a plus d’occurrence', () => {
    // Fin le lundi 2 novembre : le dernier est le samedi 31 octobre.
    const ended = trio('2026-11-02');
    expect(iso(nextOccurrences(ended, new Date('2026-10-30T12:00:00Z'), 5))).toEqual(['2026-10-31T09:00:00.000Z']);
  });

  it('la fin se lit dans le fuseau du rendez-vous, pas dans celui du serveur', () => {
    // Samedi 31 octobre 2026, 1 h à Paris (UTC+1 depuis le 25 : minuit UTC) ; fin le 31.
    const night = weekly(6, '01:00', 'Europe/Paris', 30, '2026-10-31');
    expect(iso(nextOccurrences(night, new Date('2026-10-29T00:00:00Z'), 3))).toEqual(['2026-10-31T00:00:00.000Z']);
    // Même rendez-vous, fin la veille : plus rien le 31.
    expect(nextOccurrences(weekly(6, '01:00', 'Europe/Paris', 30, '2026-10-30'), new Date('2026-10-29T00:00:00Z'), 3)).toEqual([]);
  });

  it('chaque jour de la semaine', () => {
    const daily = weekly([0, 1, 2, 3, 4, 5, 6], '07:00', 'Europe/Paris', 15);
    expect(nextOccurrences(daily, new Date('2026-10-16T12:00:00Z'), 3)).toHaveLength(3);
    expect(iso(nextOccurrences(daily, new Date('2026-10-16T12:00:00Z'), 2))).toEqual([
      '2026-10-17T05:00:00.000Z',
      '2026-10-18T05:00:00.000Z',
    ]);
  });

  it('refuse des jours invalides sans planter', () => {
    expect(nextOccurrences(weekly([], '10:00', 'Europe/Paris'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(weekly([2, 2], '10:00', 'Europe/Paris'), new Date(), 2)).toEqual([]);
    expect(nextOccurrences(weekly([1, 8], '10:00', 'Europe/Paris'), new Date(), 2)).toEqual([]);
  });

  it('la dernière occurrence : le dernier jour voulu avant la fin', () => {
    expect(lastOccurrence(trio('2026-11-30'))?.toISOString()).toBe('2026-11-28T09:00:00.000Z');
    expect(lastOccurrence(trio())).toBeNull();
    expect(lastOccurrence(weekly([1], '10:00', 'Europe/Paris', 15, '2026-11-30'))?.toISOString()).toBe('2026-11-30T09:00:00.000Z');
  });

  it('les libellés : « Les mardis, jeudis et samedis de 10 h à 10 h 15 »', () => {
    const from = new Date('2026-10-16T12:00:00Z');
    expect(whenLabel(trio(), from, 'Europe/Paris')).toBe('Les mardis, jeudis et samedis de 10 h à 10 h 15');
    expect(whenLabel(weekly([1, 2, 3, 4, 5, 6, 0], '10:00', 'Europe/Paris', 15), from, 'Europe/Paris')).toBe(
      'Chaque jour de 10 h à 10 h 15',
    );
    expect(whenLabel(weekly([5], '10:00', 'Europe/Paris', 15), from, 'Europe/Paris')).toBe('Chaque vendredi de 10 h à 10 h 15');
    expect(whenLabel(weekly([2, 4], '10:00', 'Europe/Paris', 15), from, 'Europe/Paris')).toBe('Les mardis et jeudis de 10 h à 10 h 15');
  });

  it('« jusqu’au 30 novembre » quand il y a une fin', () => {
    const from = new Date('2026-10-16T12:00:00Z');
    expect(whenLabel(weekly([1, 3], '10:00', 'Europe/Paris', 15, '2026-11-30'), from, 'Europe/Paris')).toBe(
      'Les lundis et mercredis de 10 h à 10 h 15, jusqu’au 30 novembre',
    );
    // La fin tombe un dimanche, sans occurrence : on écrit le dernier jour qui a lieu (samedi 28).
    expect(whenLabel(trio('2026-11-29'), from, 'Europe/Paris')).toBe(
      'Les mardis, jeudis et samedis de 10 h à 10 h 15, jusqu’au 28 novembre',
    );
    expect(untilLabel(new Date('2026-12-01T10:00:00Z'), 'Europe/Paris')).toBe('jusqu’au 1er décembre');
  });

  it('les jours suivent le téléphone : mardi et jeudi 1 h à Paris sont lundi et mercredi à Toronto', () => {
    const from = new Date('2026-10-18T00:00:00Z');
    const early = weekly([2, 4], '01:00', 'Europe/Paris', 30);
    expect(whenLabel(early, from, 'America/Toronto')).toBe('Les lundis et mercredis de 19 h à 19 h 30');
    expect(weekdaysInZone([2, 4], new Date('2026-10-19T23:00:00Z'), 'Europe/Paris', 'America/Toronto')).toEqual([1, 3]);
  });

  it('weekdaysPhrase met le lundi d’abord et le dimanche à la fin', () => {
    expect(weekdaysPhrase([0, 6, 1])).toBe('Les lundis, samedis et dimanches');
    expect(weekdaysPhrase([3])).toBe('Chaque mercredi');
    expect(weekdaysPhrase([])).toBe('');
  });

  it('les rappels suivent les jours et la fin', () => {
    const planned = planReminders(
      [
        {
          id: 'm',
          groupId: 'g',
          groupName: 'Fraternité',
          title: 'Chapelet',
          present: false,
          ...trio('2026-10-21'),
        },
      ],
      new Date('2026-10-16T12:00:00Z'),
    );
    // Samedi 17 et mardi 20 : la fin du 21 laisse le jeudi 22 de côté.
    expect(iso(planned.map((p) => p.at))).toEqual(['2026-10-17T08:00:00.000Z', '2026-10-20T08:00:00.000Z']);
    expect(
      planReminders(
        [{ id: 'm', groupId: 'g', groupName: 'Fraternité', title: 'Chapelet', present: false, ...trio('2026-10-15') }],
        new Date('2026-10-16T12:00:00Z'),
      ),
    ).toEqual([]);
  });

  it('une occurrence « en cours » s’arrête après la fin', () => {
    // Le jeudi 22 octobre 10 h 05, mais la fin est le mardi 20 : plus rien en cours.
    expect(currentOccurrence(trio('2026-10-20'), new Date('2026-10-22T08:05:00Z'))).toBeNull();
    expect(currentOccurrence(trio('2026-10-22'), new Date('2026-10-22T08:05:00Z'))?.toISOString()).toBe('2026-10-22T08:00:00.000Z');
  });
});

describe('« Pendant » : la fin choisie', () => {
  it('ajoute des mois en ramenant le jour au dernier du mois', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-16', 3)).toBe('2027-01-16');
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15');
    expect(addMonths('2026-10-16', 12)).toBe('2027-10-16');
  });

  it('le dernier jour d’une durée', () => {
    const choice = (id: string) => ENDS_CHOICES.find((c) => c.id === id) as (typeof ENDS_CHOICES)[number];
    expect(lastDayFor(choice('none'), '2026-10-16')).toBeNull();
    expect(lastDayFor(choice('w1'), '2026-10-16')).toBe('2026-10-22');
    expect(lastDayFor(choice('w2'), '2026-10-16')).toBe('2026-10-29');
    expect(lastDayFor(choice('m1'), '2026-10-16')).toBe('2026-11-15');
    expect(lastDayFor(choice('m3'), '2026-10-16')).toBe('2027-01-15');
    expect(lastDayFor(choice('y1'), '2026-10-16')).toBe('2027-10-15');
  });

  it('refuse une fin passée, à plus d’un an, ou sans occurrence', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    const today = '2026-10-16';
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, null), today, now)).toBeNull();
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, '2026-10-15'), today, now)).toBe('Choisis une fin à venir.');
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, '2027-10-17'), today, now)).toBe('La fin est dans un an au plus.');
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, '2027-10-16'), today, now)).toBeNull();
    // La fin le lundi 19 ne laisse aucun mardi (le prochain est le 20) ; le 20 en laisse un.
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, '2026-10-19'), today, now)).toBe(
      'Aucun rendez-vous n’a lieu avant cette fin.',
    );
    expect(endsOnProblem(weekly([2], '10:00', 'Europe/Paris', 15, '2026-10-20'), today, now)).toBeNull();
  });
});
