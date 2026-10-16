import { MAX_REMINDED, planReminders, reminderTitle } from '../src/gathering-reminders';
import {
  currentOccurrence,
  durationLabel,
  endTimeLabel,
  type Gathering,
  inPresenceWindow,
  isTimeZone,
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
  upcomingGatherings,
  whenLabel,
  withParticipation,
  withPresence,
  zoneMention,
} from '../src/gatherings';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

const weekly = (weekday: number, localTime: string, timezone: string, durationMin = 30): Schedule => ({
  recurrence: 'weekly',
  weekday,
  localTime,
  timezone,
  startsAt: null,
  durationMin,
});

const once = (startsAt: string, durationMin = 30): Schedule => ({
  recurrence: 'once',
  weekday: null,
  localTime: null,
  timezone: null,
  startsAt,
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

  it('hebdomadaire : « Chaque mardi à 21 h »', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    const from = new Date('2026-10-19T12:00:00Z');
    expect(whenLabel(tuesday, from, 'Europe/Paris')).toBe('Chaque mardi à 21 h');
    expect(whenLabel(weekly(0, '20:30', 'Europe/Paris'), from, 'Europe/Paris')).toBe('Chaque dimanche à 20 h 30');
  });

  it('ponctuel : « Mardi 20 octobre à 20 h 30 »', () => {
    const meeting = once('2026-10-20T18:30:00Z');
    expect(whenLabel(meeting, new Date('2026-10-16T10:00:00Z'), 'Europe/Paris')).toBe('Mardi 20 octobre à 20 h 30');
    expect(occurrenceLabel(new Date('2026-11-01T11:00:00Z'), 'Europe/Paris')).toBe('Dimanche 1er novembre à 12 h');
  });

  it('affiche l’heure du téléphone, et mentionne l’heure d’origine quand les fuseaux diffèrent', () => {
    const tuesday = weekly(2, '21:00', 'Europe/Paris');
    const from = new Date('2026-10-19T12:00:00Z');
    expect(whenLabel(tuesday, from, 'America/Toronto')).toBe('Chaque mardi à 15 h');
    expect(zoneMention(tuesday, from, 'America/Toronto')).toBe('21 h, heure de Paris');
    expect(zoneMention(weekly(2, '20:30', 'America/Argentina/Buenos_Aires'), from, 'Europe/Paris')).toBe('20 h 30, heure de Buenos Aires');
  });

  it('le jour affiché suit le téléphone', () => {
    // Mardi 1 h à Paris : lundi 19 h à Toronto.
    expect(whenLabel(weekly(2, '01:00', 'Europe/Paris'), new Date('2026-10-18T00:00:00Z'), 'America/Toronto')).toBe('Chaque lundi à 19 h');
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
      weekday: 2,
      localTime: '21:00',
      timezone: 'Europe/Paris',
      startsAt: null,
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
      local_time: null,
      timezone: null,
      starts_at: '2026-10-20T18:30:00Z',
    });
    expect(read).toMatchObject({ recurrence: 'once', startsAt: '2026-10-20T18:30:00Z', weekday: null, localTime: null, timezone: null });
  });

  it('ignore les lignes abîmées', () => {
    expect(readGathering(null)).toBeNull();
    expect(readGathering({ ...row, id: '' })).toBeNull();
    expect(readGathering({ ...row, title: null })).toBeNull();
    expect(readGathering({ ...row, duration_min: 5 })).toBeNull();
    expect(readGathering({ ...row, duration_min: 'abc' })).toBeNull();
    expect(readGathering({ ...row, recurrence: 'daily' })).toBeNull();
    expect(readGathering({ ...row, weekday: 7 })).toBeNull();
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
      weekday: 2,
      localTime: '21:00',
      timezone: 'Europe/Paris',
      startsAt: null,
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
