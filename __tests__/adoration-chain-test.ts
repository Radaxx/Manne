import { durationFromParam } from '../src/adoration';
import {
  type AdorationChain,
  adorersLabel,
  type ChainSchedule,
  canReserve,
  chainSections,
  chainSpans,
  coverage,
  coverageLong,
  coverageShort,
  coverageTag,
  currentOrNext,
  currentSlot,
  defaultOpenKey,
  gapLabel,
  gaps,
  gapsLabel,
  groupByDay,
  hourLine,
  isChainSlot,
  localInstant,
  MAX_PER_SLOT,
  MAX_SLOTS_PER_PERSON,
  type MyAdorationSlot,
  myHourTitle,
  myUpcomingSlots,
  nextSlotsToRemind,
  nowLine,
  OCCURRENCES_MAX,
  type Occurrence,
  occurrenceCountOf,
  occurrenceMinutes,
  occurrencesInWindow,
  originMention,
  periodLabel,
  periodProblem,
  rangeLabel,
  readChain,
  readMySlot,
  recurrenceLabel,
  reminderAt,
  type Slot,
  type Span,
  sectionPhase,
  slotCountOf,
  slotDateLabel,
  slotLabel,
  slotPhase,
  slotStartsOf,
  slotState,
  slotSummary,
  spansSeveralDays,
  type WeeklyPattern,
  weeklyOccurrences,
  weeklyProblem,
  withOccurrence,
  withRefresh,
  withWindow,
} from '../src/adoration-chain';
import {
  ADORATION_REMINDERS_MAX,
  adorationChainIdFromUrl,
  planAdorationReminders,
  reminderBody,
  reminderTitle,
} from '../src/adoration-reminders';
import { GATHERING_REMINDERS_MAX, groupIdFromUrl } from '../src/gathering-reminders';
import { NOVENA_REMINDERS_MAX, novenaIdFromUrl } from '../src/novena-reminders';
import { DAILY_REMINDERS_MAX } from '../src/reminder';
import { ROSARY_REMINDERS_MAX } from '../src/rosary-reminders';

const PARIS = 'Europe/Paris';
const at = (iso: string) => new Date(iso);
const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

const onceSchedule = (startsAt: string, endsAt: string, slotMinutes: 30 | 60 = 60): ChainSchedule => ({
  recurrence: 'once',
  slotMinutes,
  timezone: PARIS,
  startsAt,
  endsAt,
  weekdays: [],
  localStart: null,
  localEnd: null,
  firstOn: null,
  lastOn: null,
});

/** La nuit du 24 au 25 octobre 2026 (retour à l'heure d'hiver à 3 h, le 25), 21 h -> 7 h à Paris : 11 créneaux d'une heure. */
const NIGHT = onceSchedule('2026-10-24T19:00:00.000Z', '2026-10-25T06:00:00.000Z');

/** Une chaîne de 10 h sans changement d'heure : 21 h -> 7 h les 14 et 15 octobre 2026 à Paris, créneaux de 60 min. */
const QUIET = onceSchedule('2026-10-14T19:00:00.000Z', '2026-10-15T05:00:00.000Z');

/** « Adoration du vendredi » : tous les vendredis de 21 h à 22 h à Paris, du 23 octobre au 18 décembre 2026, créneaux de 30 min. */
const FRIDAYS: ChainSchedule = {
  recurrence: 'weekly',
  slotMinutes: 30,
  timezone: PARIS,
  startsAt: '2026-10-23T19:00:00.000Z',
  endsAt: '2026-12-18T21:00:00.000Z',
  weekdays: [5],
  localStart: '21:00',
  localEnd: '22:00',
  firstOn: '2026-10-23',
  lastOn: '2026-12-18',
};

/** Tous les samedis de 21 h à 7 h (une nuit), du 17 au 31 octobre 2026 : la nuit du 24 passe à l'heure d'hiver. */
const SATURDAY_NIGHTS: ChainSchedule = {
  ...FRIDAYS,
  slotMinutes: 60,
  startsAt: '2026-10-17T19:00:00.000Z',
  endsAt: '2026-11-01T06:00:00.000Z',
  weekdays: [6],
  localStart: '21:00',
  localEnd: '07:00',
  firstOn: '2026-10-17',
  lastOn: '2026-10-31',
};

const pattern = (schedule: ChainSchedule): WeeklyPattern => ({
  weekdays: schedule.weekdays,
  localStart: schedule.localStart as string,
  localEnd: schedule.localEnd as string,
  timezone: schedule.timezone,
  firstOn: schedule.firstOn as string,
  lastOn: schedule.lastOn as string,
});

const slotsOf = (span: Span, slotMinutes: number, counts: number[] = [], mine: number[] = []): Slot[] =>
  slotStartsOf(span, slotMinutes).map((start, i) => ({
    start,
    end: new Date(start.getTime() + slotMinutes * 60_000),
    count: counts[i] ?? 0,
    mine: mine.includes(i),
    handles: [],
    hidden: 0,
  }));

type Patch = Partial<AdorationChain> & { counts?: number[]; mineIdx?: number[]; window?: [string, number] };

/** Une chaîne de test : les occurrences de la fenêtre demandée (toutes pour une ponctuelle), `counts` et `mineIdx` pour la première. */
function chain(schedule: ChainSchedule, patch: Patch = {}): AdorationChain {
  const { counts, mineIdx, window, ...rest } = patch;
  const spans = window ? occurrencesInWindow(schedule, window[0], window[1]) : chainSpans(schedule);
  const occurrences: Occurrence[] = spans.map((span, i) => ({
    ...span,
    slots: slotsOf(span, schedule.slotMinutes, i === 0 ? counts : [], i === 0 ? mineIdx : []),
  }));
  return {
    ...schedule,
    id: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    groupName: 'Fraternité de test',
    groupEnded: false,
    canManage: false,
    title: 'Nuit d’adoration',
    intention: '',
    place: '',
    occurrenceCount: chainSpans(schedule).length,
    mySlots: [],
    reserved: false,
    hasMore: false,
    windowTo: null,
    occurrences,
    ...rest,
  };
}

describe('créneaux d’une occurrence', () => {
  it('découpe la période en créneaux de la durée choisie', () => {
    const span = chainSpans(QUIET)[0];
    expect(slotCountOf(span, 60)).toBe(10);
    expect(slotCountOf(span, 30)).toBe(20);
    expect(slotStartsOf(span, 60)[0].toISOString()).toBe('2026-10-14T19:00:00.000Z');
    expect(slotStartsOf(span, 60)[9].toISOString()).toBe('2026-10-15T04:00:00.000Z');
    expect(slotStartsOf(span, 30)[3].toISOString()).toBe('2026-10-14T20:30:00.000Z');
  });

  it('une fin qui coupe un créneau ne compte pas de créneau de plus', () => {
    const span = { start: at('2026-10-14T19:00:00Z'), end: at('2026-10-14T20:30:00Z') };
    expect(slotCountOf(span, 60)).toBe(1);
    expect(slotCountOf(span, 30)).toBe(3);
    expect(slotCountOf({ start: span.start, end: span.start }, 30)).toBe(0);
  });

  it('une chaîne de 7 jours en créneaux de 30 min a 336 créneaux', () => {
    const week = { start: at('2026-10-14T19:00:00Z'), end: at('2026-10-21T19:00:00Z') };
    expect(slotCountOf(week, 30)).toBe(336);
  });

  it('un changement d’heure ne change jamais la durée d’un créneau : la nuit du 24 au 25 octobre 2026 à Paris compte 11 h', () => {
    const slots = slotsOf(chainSpans(NIGHT)[0], 60);
    expect(slots).toHaveLength(11);
    for (const slot of slots) expect(slot.end.getTime() - slot.start.getTime()).toBe(3_600_000);
    // Heure du mur à Paris : 21 h (été), puis 2 h deux fois (l'heure de 2 h à 3 h existe deux fois), puis 3 h en heure d'hiver.
    expect(rangeLabel(slots[0].start, slots[0].end, PARIS)).toBe('21 h – 22 h');
    expect(rangeLabel(slots[4].start, slots[4].end, PARIS)).toBe('1 h – 2 h');
    expect(rangeLabel(slots[6].start, slots[6].end, PARIS)).toBe('2 h – 3 h');
    expect(rangeLabel(slots[7].start, slots[7].end, PARIS)).toBe('3 h – 4 h');
    expect(rangeLabel(slots[10].start, slots[10].end, PARIS)).toBe('6 h – 7 h');
  });

  it('un créneau à 30 min a la bonne heure de départ des deux côtés du changement d’heure', () => {
    const slots = slotsOf(chainSpans({ ...NIGHT, slotMinutes: 30 })[0], 30);
    expect(slots).toHaveLength(22);
    expect(slotLabel(slots[0].start, slots[0].end, PARIS)).toBe('samedi 21 h – 21 h 30');
    expect(slotLabel(slots[21].start, slots[21].end, PARIS)).toBe('dimanche 6 h 30 – 7 h');
  });

  it('écrit les libellés dans le fuseau demandé', () => {
    const [first, , , fourth] = slotsOf(chainSpans(QUIET)[0], 60);
    expect(rangeLabel(first.start, first.end, 'America/Toronto')).toBe('15 h – 16 h');
    expect(slotLabel(first.start, first.end, PARIS)).toBe('mercredi 21 h – 22 h');
    expect(slotLabel(fourth.start, fourth.end, PARIS)).toBe('jeudi 0 h – 1 h');
    expect(slotDateLabel(first.start, first.end, PARIS)).toBe('Mercredi 14 octobre · 21 h – 22 h');
  });

  it('range les créneaux par jour du téléphone', () => {
    const days = groupByDay(slotsOf(chainSpans(QUIET)[0], 60), PARIS);
    expect(days.map((d) => [d.date, d.label, d.slots.length])).toEqual([
      ['2026-10-14', 'Mercredi 14 octobre', 3],
      ['2026-10-15', 'Jeudi 15 octobre', 7],
    ]);
  });
});

describe('occurrences hebdomadaires', () => {
  it('tous les vendredis de 21 h à 22 h pendant 2 mois : 9 occurrences, 21 h du mur avant et après le changement d’heure', () => {
    const found = weeklyOccurrences(pattern(FRIDAYS));
    expect(found).toHaveLength(9);
    expect(iso(found.map((o) => o.start)).slice(0, 3)).toEqual([
      '2026-10-23T19:00:00.000Z',
      '2026-10-30T20:00:00.000Z',
      '2026-11-06T20:00:00.000Z',
    ]);
    expect(found[0].end.toISOString()).toBe('2026-10-23T20:00:00.000Z');
    expect(found[8].start.toISOString()).toBe('2026-12-18T20:00:00.000Z');
    expect(occurrenceCountOf(pattern(FRIDAYS))).toBe(9);
    expect(chainSpans(FRIDAYS)).toHaveLength(9);
  });

  it('plusieurs jours : mardis et jeudis', () => {
    const found = weeklyOccurrences({ ...pattern(FRIDAYS), weekdays: [2, 4], firstOn: '2026-10-20', lastOn: '2026-10-29' });
    expect(iso(found.map((o) => o.start))).toEqual([
      '2026-10-20T19:00:00.000Z',
      '2026-10-22T19:00:00.000Z',
      '2026-10-27T20:00:00.000Z', // UTC+1 depuis le 25
      '2026-10-29T20:00:00.000Z',
    ]);
  });

  it('une occurrence de nuit 21 h -> 7 h finit le lendemain, et la nuit du changement d’heure dure 11 h', () => {
    const found = weeklyOccurrences(pattern(SATURDAY_NIGHTS));
    expect(found).toHaveLength(3);
    expect(found.map((o) => (o.end.getTime() - o.start.getTime()) / 3_600_000)).toEqual([10, 11, 10]);
    expect(found[1].start.toISOString()).toBe('2026-10-24T19:00:00.000Z');
    expect(found[1].end.toISOString()).toBe('2026-10-25T06:00:00.000Z');
    expect(slotCountOf(found[1], 60)).toBe(11);
  });

  it('des heures égales font 24 h, la fin est toujours le lendemain si elle n’est pas après le début', () => {
    expect(occurrenceMinutes('21:00', '22:00')).toBe(60);
    expect(occurrenceMinutes('21:00', '07:00')).toBe(600);
    expect(occurrenceMinutes('21:00', '21:00')).toBe(1440);
    expect(occurrenceMinutes('00:00', '23:30')).toBe(1410);
    expect(occurrenceMinutes('21:00', null)).toBeNull();
    expect(occurrenceMinutes('25:00', '07:00')).toBeNull();
    const day = weeklyOccurrences({ ...pattern(FRIDAYS), localEnd: '21:00', firstOn: '2026-10-23', lastOn: '2026-10-23' });
    expect(day[0].end.toISOString()).toBe('2026-10-24T19:00:00.000Z');
  });

  it('jamais d’erreur sur des données abîmées', () => {
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), timezone: 'Nulle/Part' })).toEqual([]);
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), weekdays: [] })).toEqual([]);
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), weekdays: [7] })).toEqual([]);
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), localStart: 'abc' })).toEqual([]);
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), firstOn: 'hier' })).toEqual([]);
    expect(weeklyOccurrences({ ...pattern(FRIDAYS), lastOn: '2026-10-01' })).toEqual([]);
  });

  it('plafond de 400 occurrences : jamais plus de 401 calculées, un an au plus entre le premier et le dernier jour', () => {
    expect(OCCURRENCES_MAX).toBe(400);
    const everyDay = { ...pattern(FRIDAYS), weekdays: [0, 1, 2, 3, 4, 5, 6], firstOn: '2026-10-17', lastOn: '2027-10-17' };
    // 366 jours d'écart au plus : 366 ou 367 occurrences, sous le plafond.
    expect(occurrenceCountOf(everyDay)).toBe(366);
    expect(occurrenceCountOf({ ...everyDay, lastOn: '2027-10-18' })).toBe(367);
    expect(weeklyProblem({ pattern: { ...everyDay, lastOn: '2027-10-18' }, slotMinutes: 30, now: at('2026-10-16T10:00:00Z') })).toBeNull();
    // Au-delà d'un an : refus, et le calcul s'arrête au lieu de s'emballer.
    const tooLong = { ...everyDay, lastOn: '2029-10-17' };
    expect(weeklyOccurrences(tooLong)).toEqual([]);
    expect(weeklyProblem({ pattern: tooLong, slotMinutes: 30, now: at('2026-10-16T10:00:00Z') })).toBe('Une chaîne dure un an au plus.');
  });
});

describe('créneau valide', () => {
  it('un instant n’est un créneau que s’il tombe exactement sur le découpage d’une occurrence', () => {
    // Vendredis 21 h -> 22 h à Paris, créneaux de 30 min : 19:00Z et 19:30Z le 23 octobre.
    expect(isChainSlot(FRIDAYS, at('2026-10-23T19:00:00Z'))).toBe(true);
    expect(isChainSlot(FRIDAYS, at('2026-10-23T19:30:00Z'))).toBe(true);
    expect(isChainSlot(FRIDAYS, at('2026-10-23T20:00:00Z'))).toBe(false); // la fin de l'occurrence
    expect(isChainSlot(FRIDAYS, at('2026-10-23T19:15:00Z'))).toBe(false); // pas sur le découpage
    expect(isChainSlot(FRIDAYS, at('2026-10-23T18:30:00Z'))).toBe(false); // avant
    expect(isChainSlot(FRIDAYS, at('2026-10-24T19:00:00Z'))).toBe(false); // un samedi
    expect(isChainSlot(FRIDAYS, at('2026-10-23T19:00:00.500Z'))).toBe(false);
    expect(isChainSlot(FRIDAYS, new Date(Number.NaN))).toBe(false);
  });

  it('suit l’heure du mur après le changement d’heure', () => {
    // Le 6 novembre, 21 h à Paris = 20:00Z.
    expect(isChainSlot(FRIDAYS, at('2026-11-06T20:30:00Z'))).toBe(true);
    expect(isChainSlot(FRIDAYS, at('2026-11-06T19:30:00Z'))).toBe(false);
    expect(isChainSlot(FRIDAYS, at('2026-11-06T21:00:00Z'))).toBe(false);
  });

  it('respecte le premier et le dernier jour', () => {
    expect(isChainSlot({ ...FRIDAYS, firstOn: '2026-10-30' }, at('2026-10-23T19:00:00Z'))).toBe(false);
    expect(isChainSlot({ ...FRIDAYS, firstOn: '2026-10-30' }, at('2026-10-30T20:00:00Z'))).toBe(true);
    expect(isChainSlot({ ...FRIDAYS, lastOn: '2026-12-11' }, at('2026-12-18T20:00:00Z'))).toBe(false);
    expect(isChainSlot(FRIDAYS, at('2026-12-18T20:30:00Z'))).toBe(true);
  });

  it('une occurrence de nuit 21 h -> 7 h : les créneaux après minuit appartiennent à la veille', () => {
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-24T19:00:00Z'))).toBe(true);
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T00:00:00Z'))).toBe(true); // 2 h, première fois (UTC+2)
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T01:00:00Z'))).toBe(true); // 2 h, seconde fois (UTC+1)
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T05:00:00Z'))).toBe(true); // 6 h – 7 h, le dernier
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T06:00:00Z'))).toBe(false); // 7 h : fini
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T00:30:00Z'))).toBe(false); // pas sur l'heure
    expect(isChainSlot({ ...SATURDAY_NIGHTS, slotMinutes: 30 }, at('2026-10-25T00:30:00Z'))).toBe(true);
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-25T19:00:00Z'))).toBe(false); // le dimanche soir : pas de nuit
    expect(isChainSlot(SATURDAY_NIGHTS, at('2026-10-31T20:00:00Z'))).toBe(true); // dernière nuit, UTC+1
  });

  it('une chaîne ponctuelle : dans la période, sur le découpage, créneau entier', () => {
    expect(isChainSlot(QUIET, at('2026-10-14T19:00:00Z'))).toBe(true);
    expect(isChainSlot(QUIET, at('2026-10-15T04:00:00Z'))).toBe(true);
    expect(isChainSlot(QUIET, at('2026-10-15T05:00:00Z'))).toBe(false);
    expect(isChainSlot(QUIET, at('2026-10-14T19:30:00Z'))).toBe(false);
    expect(isChainSlot(QUIET, at('2026-10-14T18:00:00Z'))).toBe(false);
  });
});

describe('fenêtre d’occurrences', () => {
  const starts = (spans: Span[]) => iso(spans.map((s) => s.start));

  it('4 semaines à partir du premier jour : 4 vendredis', () => {
    expect(starts(occurrencesInWindow(FRIDAYS, '2026-10-23', 4))).toEqual([
      '2026-10-23T19:00:00.000Z',
      '2026-10-30T20:00:00.000Z',
      '2026-11-06T20:00:00.000Z',
      '2026-11-13T20:00:00.000Z',
    ]);
  });

  it('la fenêtre suivante commence là où la précédente finit', () => {
    expect(starts(occurrencesInWindow(FRIDAYS, '2026-11-20', 4))).toEqual([
      '2026-11-20T20:00:00.000Z',
      '2026-11-27T20:00:00.000Z',
      '2026-12-04T20:00:00.000Z',
      '2026-12-11T20:00:00.000Z',
    ]);
    expect(starts(occurrencesInWindow(FRIDAYS, '2026-12-18', 4))).toEqual(['2026-12-18T20:00:00.000Z']);
    expect(occurrencesInWindow(FRIDAYS, '2027-01-01', 4)).toEqual([]);
  });

  it('un jour de fenêtre inclut l’occurrence de la veille qui n’a pas fini', () => {
    // Dimanche 25 octobre à minuit : la nuit du samedi 24 (qui finit à 7 h) en fait partie, pas celle du 17.
    expect(starts(occurrencesInWindow(SATURDAY_NIGHTS, '2026-10-25', 4))).toEqual(['2026-10-24T19:00:00.000Z', '2026-10-31T20:00:00.000Z']);
  });

  it('une chaîne ponctuelle montre toujours son unique occurrence', () => {
    expect(occurrencesInWindow(QUIET, '2030-01-01', 4)).toHaveLength(1);
  });

  it('la fenêtre se compte en semaines du fuseau de la chaîne, au changement d’heure compris', () => {
    // Fenêtre d'une semaine du 24 au 31 octobre : le vendredi 30 y est, le 23 et le 6 novembre non.
    expect(starts(occurrencesInWindow(FRIDAYS, '2026-10-24', 1))).toEqual(['2026-10-30T20:00:00.000Z']);
  });
});

describe('où en est un créneau', () => {
  const start = at('2026-10-14T19:00:00Z');
  const end = at('2026-10-14T20:00:00Z');

  it('passé, en cours, bientôt (10 minutes avant), plus tard', () => {
    expect(slotPhase(start, end, at('2026-10-14T20:00:00Z'))).toBe('past');
    expect(slotPhase(start, end, at('2026-10-14T19:59:59Z'))).toBe('live');
    expect(slotPhase(start, end, at('2026-10-14T19:00:00Z'))).toBe('live');
    expect(slotPhase(start, end, at('2026-10-14T18:50:00Z'))).toBe('soon');
    expect(slotPhase(start, end, at('2026-10-14T18:49:59Z'))).toBe('later');
  });

  it('trouve le créneau en cours parmi les occurrences chargées', () => {
    const c = chain(QUIET);
    expect(currentSlot(c, at('2026-10-14T18:59:00Z'))).toBeNull();
    expect(currentSlot(c, at('2026-10-14T19:00:00Z'))?.start.toISOString()).toBe('2026-10-14T19:00:00.000Z');
    expect(currentSlot(c, at('2026-10-14T21:30:00Z'))?.start.toISOString()).toBe('2026-10-14T21:00:00.000Z');
    expect(currentSlot(c, at('2026-10-15T04:59:00Z'))?.start.toISOString()).toBe('2026-10-15T04:00:00.000Z');
    expect(currentSlot(c, at('2026-10-15T05:00:00Z'))).toBeNull();
    // Chaîne qui se répète : le créneau en cours du vendredi 30.
    const weekly = chain(FRIDAYS, { window: ['2026-10-23', 4] });
    expect(currentSlot(weekly, at('2026-10-30T20:40:00Z'))?.start.toISOString()).toBe('2026-10-30T20:30:00.000Z');
    expect(currentSlot(weekly, at('2026-10-28T20:40:00Z'))).toBeNull();
  });

  it('l’état d’un créneau : passé, à moi, couvert, libre', () => {
    const c = chain(QUIET, { counts: [1, 0, 2, 0, 0, 0, 0, 0, 0, 0], mineIdx: [2] });
    const slots = c.occurrences[0].slots;
    const now = at('2026-10-14T19:30:00Z');
    expect(slotState(slots[0], now)).toBe('covered');
    expect(slotState(slots[1], now)).toBe('free');
    expect(slotState(slots[2], now)).toBe('mine');
    expect(slotState(slots[0], at('2026-10-14T20:00:00Z'))).toBe('past');
  });

  it('un créneau en cours se réserve, un créneau terminé non', () => {
    const now = at('2026-10-14T20:30:00Z');
    const c = chain(QUIET);
    const slots = c.occurrences[0].slots;
    expect(canReserve(c, slots[0], now)).toBe(false);
    expect(canReserve(c, slots[1], now)).toBe(true);
    expect(canReserve({ ...c, groupEnded: true }, slots[2], now)).toBe(false);
    const full = chain(QUIET, { counts: [0, 0, MAX_PER_SLOT, 0, 0, 0, 0, 0, 0, 0] });
    expect(canReserve(full, full.occurrences[0].slots[2], now)).toBe(false);
    const mineAlready = chain(QUIET, { counts: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0], mineIdx: [2] });
    expect(canReserve(mineAlready, mineAlready.occurrences[0].slots[2], now)).toBe(false);
  });

  it('douze créneaux non terminés à soi au plus, toutes occurrences confondues', () => {
    // Douze vendredis de suite, un créneau chacun : 12 créneaux à venir sur 12 occurrences différentes.
    const long = { ...FRIDAYS, endsAt: '2027-01-08T21:00:00.000Z', lastOn: '2027-01-08' };
    const spans = chainSpans(long);
    expect(spans).toHaveLength(12);
    const mySlots = spans.map((s) => s.start);
    const full = chain(long, { window: ['2026-10-23', 12], mySlots });
    const now = at('2026-10-20T09:00:00Z');
    expect(myUpcomingSlots(full, now)).toHaveLength(MAX_SLOTS_PER_PERSON);
    expect(canReserve(full, full.occurrences[2].slots[1], now)).toBe(false);
    // Un créneau déjà terminé ne compte plus.
    const later = at('2026-10-23T20:30:00Z');
    expect(myUpcomingSlots(full, later)).toHaveLength(11);
    expect(canReserve(full, full.occurrences[2].slots[1], later)).toBe(true);
  });
});

describe('couverture et trous (par occurrence)', () => {
  it('compte les créneaux couverts', () => {
    const slots = [1, 0, 2, 0, 3].map((count): Pick<Slot, 'count'> => ({ count }));
    expect(coverage(slots)).toEqual({ covered: 3, total: 5 });
    expect(coverageShort({ covered: 18, total: 24 })).toBe('18/24 créneaux couverts');
    expect(coverageTag({ covered: 3, total: 4 })).toBe('3/4 couverts');
    expect(coverageTag({ covered: 1, total: 2 })).toBe('1/2 couverts');
    expect(coverageTag({ covered: 0, total: 1 })).toBe('0/1 couvert');
    expect(coverageLong({ covered: 18, total: 24 })).toBe('18 créneaux sur 24 couverts');
    expect(coverageLong({ covered: 1, total: 24 })).toBe('1 créneau sur 24 couvert');
    expect(coverageLong({ covered: 0, total: 24 })).toBe('0 créneau sur 24 couvert');
  });

  it('la couverture est celle de chaque occurrence, pas de la chaîne', () => {
    const c = chain(FRIDAYS, { window: ['2026-10-23', 4] });
    c.occurrences[0].slots[0].count = 1;
    expect(c.occurrences.map((o) => coverageTag(coverage(o.slots)))).toEqual([
      '1/2 couverts',
      '0/2 couverts',
      '0/2 couverts',
      '0/2 couverts',
    ]);
  });

  it('regroupe les trous en plages', () => {
    const slots = slotsOf(chainSpans(QUIET)[0], 60, [1, 1, 0, 0, 0, 1, 0, 0, 1, 0]);
    const before = at('2026-10-14T18:00:00Z');
    expect(gaps(slots, before)).toEqual([
      { from: 2, to: 4 },
      { from: 6, to: 7 },
      { from: 9, to: 9 },
    ]);
    expect(gapLabel(slots, { from: 2, to: 4 }, PARIS)).toBe('mer. 23 h – jeu. 2 h');
  });

  it('écrit « Trous : 11 h – 13 h » pour une occurrence d’un seul jour', () => {
    const day = onceSchedule('2026-10-14T07:00:00.000Z', '2026-10-14T15:00:00.000Z');
    const slots = slotsOf(chainSpans(day)[0], 60, [1, 1, 0, 0, 1, 1, 1, 1]);
    expect(spansSeveralDays(slots[0].start, slots[slots.length - 1].end, PARIS)).toBe(false);
    // 07:00Z = 9 h à Paris : le trou des créneaux 2 et 3 va de 11 h à 13 h.
    expect(gapsLabel(slots, at('2026-10-14T06:00:00Z'), PARIS)).toBe('Trous : 11 h – 13 h');
  });

  it('ajoute le jour quand l’occurrence passe minuit', () => {
    const slots = slotsOf(chainSpans(QUIET)[0], 60, [1, 1, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(spansSeveralDays(slots[0].start, slots[9].end, PARIS)).toBe(true);
    expect(gapsLabel(slots, at('2026-10-14T18:00:00Z'), PARIS)).toBe('Trous : mer. 23 h – jeu. 2 h');
  });

  it('les trous d’une occurrence de vendredi soir ne mentionnent pas de jour', () => {
    const slots = slotsOf(chainSpans(FRIDAYS)[0], 30, [1, 0]);
    expect(gapsLabel(slots, at('2026-10-20T00:00:00Z'), PARIS)).toBe('Trous : 21 h 30 – 22 h');
  });

  it('un trou passé n’est plus un trou, et rien à signaler quand tout est couvert', () => {
    const slots = slotsOf(chainSpans(QUIET)[0], 60, [0, 0, 0, 1, 1, 1, 1, 1, 1, 1]);
    expect(gaps(slots, at('2026-10-14T20:30:00Z'))).toEqual([{ from: 1, to: 2 }]);
    const covered = slotsOf(
      chainSpans(QUIET)[0],
      60,
      Array.from({ length: 10 }, () => 1),
    );
    expect(gapsLabel(covered, at('2026-10-14T18:00:00Z'), PARIS)).toBeNull();
  });
});

describe('sections repliables', () => {
  it('une chaîne ponctuelle : une section par jour', () => {
    const sections = chainSections(chain(QUIET), PARIS);
    expect(sections.map((s) => [s.key, s.title, s.range, s.slots.length])).toEqual([
      ['day-2026-10-14', 'Mercredi 14 octobre', '21 h – 0 h', 3],
      ['day-2026-10-15', 'Jeudi 15 octobre', '0 h – 7 h', 7],
    ]);
  });

  it('une chaîne qui se répète : une section par occurrence, avec sa couverture', () => {
    const c = chain(FRIDAYS, { window: ['2026-10-23', 4], counts: [1, 0] });
    const sections = chainSections(c, PARIS);
    expect(sections.map((s) => [s.title, s.range, coverageTag(s.coverage)])).toEqual([
      ['Vendredi 23 octobre', '21 h – 22 h', '1/2 couverts'],
      ['Vendredi 30 octobre', '21 h – 22 h', '0/2 couverts'],
      ['Vendredi 6 novembre', '21 h – 22 h', '0/2 couverts'],
      ['Vendredi 13 novembre', '21 h – 22 h', '0/2 couverts'],
    ]);
    expect(new Set(sections.map((s) => s.key)).size).toBe(4);
  });

  it('une occurrence de nuit reste une seule section', () => {
    const sections = chainSections(chain(SATURDAY_NIGHTS), PARIS);
    expect(sections).toHaveLength(3);
    expect(sections[1].range).toBe('21 h – 7 h');
    expect(sections[1].slots).toHaveLength(11);
  });

  it('dépliée par défaut : la section en cours, sinon la prochaine ; les passées et les autres repliées', () => {
    const sections = chainSections(chain(FRIDAYS, { window: ['2026-10-23', 4] }), PARIS);
    expect(defaultOpenKey(sections, at('2026-10-20T10:00:00Z'))).toBe(sections[0].key);
    // Pendant l'occurrence du 30 octobre (21 h – 22 h, UTC+1 depuis le 25) : celle-ci.
    expect(defaultOpenKey(sections, at('2026-10-30T20:10:00Z'))).toBe(sections[1].key);
    // Entre deux occurrences : la prochaine.
    expect(defaultOpenKey(sections, at('2026-10-31T10:00:00Z'))).toBe(sections[2].key);
    // Tout est passé : rien de déplié.
    expect(defaultOpenKey(sections, at('2026-11-20T10:00:00Z'))).toBeNull();
    expect(defaultOpenKey([], at('2026-11-20T10:00:00Z'))).toBeNull();
  });

  it('la phase d’une section : passée, en cours, à venir', () => {
    const [first] = chainSections(chain(FRIDAYS, { window: ['2026-10-23', 1] }), PARIS);
    expect(sectionPhase(first, at('2026-10-23T18:00:00Z'))).toBe('upcoming');
    expect(sectionPhase(first, at('2026-10-23T19:00:00Z'))).toBe('live');
    expect(sectionPhase(first, at('2026-10-23T20:00:00Z'))).toBe('past');
  });
});

describe('fenêtre et mises à jour', () => {
  it('remplace seulement l’occurrence touchée et met à jour mes créneaux', () => {
    const base = chain(FRIDAYS, { window: ['2026-10-23', 4], hasMore: true, windowTo: '2026-11-20' });
    const slot = base.occurrences[1].slots[0];
    const update = chain(FRIDAYS, { window: ['2026-10-30', 1], mySlots: [slot.start], reserved: true });
    update.occurrences = [
      { ...update.occurrences[0], slots: [{ ...update.occurrences[0].slots[0], count: 1, mine: true }, update.occurrences[0].slots[1]] },
    ];
    const next = withOccurrence(base, update);
    expect(next.occurrences).toHaveLength(4);
    expect(next.occurrences[1].slots[0].mine).toBe(true);
    expect(next.occurrences[0]).toBe(base.occurrences[0]);
    expect(iso(next.mySlots)).toEqual([slot.start.toISOString()]);
    expect(next.hasMore).toBe(true);
    expect(next.reserved).toBe(true);
  });

  it('ajoute la fenêtre suivante sans doublon, dans l’ordre', () => {
    const first = chain(FRIDAYS, { window: ['2026-10-23', 4], hasMore: true, windowTo: '2026-11-20' });
    const second = chain(FRIDAYS, { window: ['2026-11-13', 4], hasMore: true, windowTo: '2026-12-11' });
    const all = withWindow(first, second);
    expect(all.occurrences.map((o) => o.start.toISOString())).toEqual(
      chainSpans(FRIDAYS)
        .slice(0, 7)
        .map((s) => s.start.toISOString()),
    );
    expect(all.windowTo).toBe('2026-12-11');
    expect(all.hasMore).toBe(true);
    const last = withWindow(all, chain(FRIDAYS, { window: ['2026-12-11', 4], hasMore: false, windowTo: '2027-01-08' }));
    expect(last.occurrences).toHaveLength(9);
    expect(last.hasMore).toBe(false);
  });

  it('une relecture de la première fenêtre garde les semaines suivantes déjà chargées', () => {
    const loaded = withWindow(
      chain(FRIDAYS, { window: ['2026-10-23', 4], hasMore: true, windowTo: '2026-11-20' }),
      chain(FRIDAYS, { window: ['2026-11-20', 4], hasMore: true, windowTo: '2026-12-18' }),
    );
    const fresh = chain(FRIDAYS, {
      window: ['2026-10-23', 4],
      hasMore: true,
      windowTo: '2026-11-20',
      mySlots: [at('2026-10-23T19:00:00Z')],
    });
    fresh.occurrences[0].slots[0].count = 3;
    const merged = withRefresh(loaded, fresh);
    expect(merged.occurrences).toHaveLength(8);
    expect(merged.occurrences[0].slots[0].count).toBe(3);
    expect(merged.windowTo).toBe('2026-12-18');
    expect(merged.mySlots).toHaveLength(1);
  });
});

describe('libellés', () => {
  it('écrit la période d’une chaîne ponctuelle', () => {
    expect(periodLabel(QUIET, PARIS)).toBe('Du mercredi 14 octobre à 21 h au jeudi 15 octobre à 7 h');
    expect(periodLabel(onceSchedule('2026-10-14T12:00:00.000Z', '2026-10-14T15:00:00.000Z'), PARIS)).toBe(
      'Le mercredi 14 octobre, de 14 h à 17 h',
    );
    expect(slotSummary({ ...QUIET, occurrenceCount: 1 })).toBe('10 créneaux de 60 min');
    expect(slotSummary({ ...FRIDAYS, occurrenceCount: 9 })).toBe('9 plages · créneaux de 30 min');
  });

  it('la récurrence : « Chaque vendredi de 21 h à 22 h, jusqu’au 18 décembre »', () => {
    expect(recurrenceLabel(FRIDAYS, PARIS)).toBe('Chaque vendredi de 21 h à 22 h, jusqu’au 18 décembre');
    expect(recurrenceLabel({ ...FRIDAYS, weekdays: [2, 4, 6] }, PARIS)).toBe(
      'Les mardis, jeudis et samedis de 21 h à 22 h, jusqu’au 17 décembre',
    );
    expect(recurrenceLabel({ ...FRIDAYS, weekdays: [0, 1, 2, 3, 4, 5, 6] }, PARIS)).toBe(
      'Chaque jour de 21 h à 22 h, jusqu’au 18 décembre',
    );
    expect(recurrenceLabel(SATURDAY_NIGHTS, PARIS)).toBe('Chaque samedi de 21 h à 7 h, jusqu’au 31 octobre');
    // Le dernier jour choisi est un samedi : la dernière plage a lieu le vendredi d'avant.
    expect(recurrenceLabel({ ...FRIDAYS, lastOn: '2027-01-16' }, PARIS)).toBe('Chaque vendredi de 21 h à 22 h, jusqu’au 15 janvier');
    expect(recurrenceLabel(QUIET, PARIS)).toBe('');
  });

  it('la récurrence suit le téléphone : le vendredi 21 h de Paris est un vendredi 15 h à Toronto', () => {
    expect(recurrenceLabel(FRIDAYS, 'America/Toronto')).toBe('Chaque vendredi de 15 h à 16 h, jusqu’au 18 décembre');
    // Samedi 1 h à Paris = vendredi 19 h à Toronto.
    expect(
      recurrenceLabel({ ...FRIDAYS, weekdays: [6], localStart: '01:00', localEnd: '02:00', lastOn: '2026-12-19' }, 'America/Toronto'),
    ).toBe('Chaque vendredi de 19 h à 20 h, jusqu’au 18 décembre');
  });

  it('mentionne l’heure d’origine quand elle diffère de celle du téléphone', () => {
    const c = chain(QUIET);
    expect(originMention(c, 'America/Toronto')).toBe('Début à 21 h, heure de Paris');
    expect(originMention(c, PARIS)).toBeNull();
    expect(originMention(c, 'Europe/Berlin')).toBeNull();
    expect(originMention({ ...c, timezone: 'UTC' }, PARIS)).toBe('Début à 19 h (UTC)');
    expect(originMention(chain(FRIDAYS), 'America/Toronto')).toBe('Début à 21 h, heure de Paris');
  });

  it('nomme les adorateurs : toi, les pseudos, un membre bloqué', () => {
    expect(adorersLabel({ mine: false, handles: ['marie', 'paul'], hidden: 0 })).toBe('@marie, @paul');
    expect(adorersLabel({ mine: true, handles: ['marie'], hidden: 1 })).toBe('Toi, @marie, Un membre');
    expect(adorersLabel({ mine: false, handles: [], hidden: 2 })).toBe('2 membres');
    expect(adorersLabel({ mine: false, handles: [], hidden: 0 })).toBe('');
  });

  it('« En ce moment : @marie, @paul » pendant la chaîne seulement', () => {
    const c = chain(QUIET, { counts: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0] });
    c.occurrences[0].slots[1].handles = ['marie', 'paul'];
    expect(nowLine(c, at('2026-10-14T20:15:00Z'))).toBe('En ce moment : @marie, @paul');
    expect(nowLine(c, at('2026-10-14T21:15:00Z'))).toBe('En ce moment : personne');
    expect(nowLine(c, at('2026-10-14T18:00:00Z'))).toBeNull();
    expect(nowLine(c, at('2026-10-15T05:00:00Z'))).toBeNull();
  });
});

describe('mon heure d’adoration', () => {
  const mySlot = (patch: Partial<MyAdorationSlot> = {}): MyAdorationSlot => ({
    chainId: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    groupName: 'Fraternité de test',
    title: 'Nuit d’adoration',
    place: '',
    timezone: PARIS,
    slotMinutes: 60,
    startsAt: '2026-10-15T01:00:00.000Z',
    endsAt: '2026-10-15T02:00:00.000Z',
    ...patch,
  });

  it('les titres « bientôt » et « pendant »', () => {
    expect(myHourTitle('soon')).toBe('C’est bientôt ton heure d’adoration');
    expect(myHourTitle('live')).toBe('C’est ton heure d’adoration');
    expect(myHourTitle('later')).toBeNull();
  });

  it('la ligne de l’accueil', () => {
    const slots = [mySlot()];
    expect(hourLine(slots, at('2026-10-14T12:00:00Z'), PARIS)).toBe('Ton heure d’adoration : jeudi 3 h – 4 h · Fraternité de test');
    expect(hourLine(slots, at('2026-10-15T00:55:00Z'), PARIS)).toBe('C’est bientôt ton heure d’adoration · Fraternité de test');
    expect(hourLine(slots, at('2026-10-15T01:30:00Z'), PARIS)).toBe('C’est ton heure d’adoration · Fraternité de test');
    expect(hourLine(slots, at('2026-10-15T02:00:00Z'), PARIS)).toBeNull();
    expect(hourLine([], at('2026-10-15T01:30:00Z'), PARIS)).toBeNull();
  });

  it('au-delà d’une semaine, la ligne écrit la date : une chaîne qui se répète a le même jour chaque semaine', () => {
    const friday = mySlot({ slotMinutes: 30, startsAt: '2026-11-06T20:00:00.000Z', endsAt: '2026-11-06T20:30:00.000Z' });
    expect(hourLine([friday], at('2026-10-20T12:00:00Z'), PARIS)).toBe(
      'Ton heure d’adoration : Vendredi 6 novembre · 21 h – 21 h 30 · Fraternité de test',
    );
    expect(hourLine([friday], at('2026-11-03T12:00:00Z'), PARIS)).toBe(
      'Ton heure d’adoration : vendredi 21 h – 21 h 30 · Fraternité de test',
    );
  });

  it('prend le créneau en cours ou le plus proche', () => {
    const early = mySlot({ startsAt: '2026-10-14T21:00:00.000Z', endsAt: '2026-10-14T22:00:00.000Z' });
    const late = mySlot();
    const found = currentOrNext([late, early], at('2026-10-14T21:30:00Z'));
    expect(found?.slot.startsAt).toBe(early.startsAt);
    expect(found?.phase).toBe('live');
    expect(currentOrNext([late, early], at('2026-10-14T22:30:00Z'))?.slot.startsAt).toBe(late.startsAt);
  });

  it('rappelle mes 3 prochains créneaux, 10 minutes avant, sans ceux dont le rappel est passé', () => {
    const slots = [0, 1, 2, 3, 4].map((i) =>
      mySlot({
        startsAt: new Date(Date.parse('2026-10-14T19:00:00Z') + i * 3_600_000).toISOString(),
        endsAt: new Date(Date.parse('2026-10-14T20:00:00Z') + i * 3_600_000).toISOString(),
      }),
    );
    const now = at('2026-10-14T18:30:00Z');
    expect(nextSlotsToRemind(slots, now).map((s) => s.startsAt)).toEqual(slots.slice(0, 3).map((s) => s.startsAt));
    // À 18 h 55, le rappel du premier créneau (18 h 50) est passé.
    expect(nextSlotsToRemind(slots, at('2026-10-14T18:55:00Z')).map((s) => s.startsAt)).toEqual(slots.slice(1, 4).map((s) => s.startsAt));
    expect(reminderAt(slots[0]).toISOString()).toBe('2026-10-14T18:50:00.000Z');
    const planned = planAdorationReminders(slots, now, PARIS);
    expect(planned).toHaveLength(3);
    expect(planned.map((p) => p.at.toISOString())).toEqual([
      '2026-10-14T18:50:00.000Z',
      '2026-10-14T19:50:00.000Z',
      '2026-10-14T20:50:00.000Z',
    ]);
    // L'identifiant est celui du créneau : la chaîne et l'instant de son début.
    expect(planned[0].identifier).toBe(`adoration-11111111-1111-4111-8111-111111111111-${Date.parse('2026-10-14T19:00:00Z')}`);
    expect(new Set(planned.map((p) => p.identifier)).size).toBe(3);
    expect(planned.every((p) => p.identifier.startsWith('adoration-'))).toBe(true);
    expect(planned[0].title).toBe(reminderTitle(slots[0]));
    expect(planned[0].title).toBe('Nuit d’adoration — Fraternité de test');
    expect(planned[0].body).toBe(reminderBody(slots[0], PARIS));
    expect(planned[0].body).toBe('C’est bientôt ton heure d’adoration : 21 h – 22 h. Touche pour ouvrir la chaîne.');
  });

  it('les créneaux de deux vendredis d’une même chaîne ont deux rappels distincts', () => {
    const a = mySlot({ slotMinutes: 30, startsAt: '2026-10-23T19:00:00.000Z', endsAt: '2026-10-23T19:30:00.000Z' });
    const b = mySlot({ slotMinutes: 30, startsAt: '2026-10-30T19:00:00.000Z', endsAt: '2026-10-30T19:30:00.000Z' });
    const planned = planAdorationReminders([b, a], at('2026-10-20T00:00:00Z'), PARIS);
    expect(planned.map((p) => p.at.toISOString())).toEqual(['2026-10-23T18:50:00.000Z', '2026-10-30T18:50:00.000Z']);
    expect(planned[0].identifier).not.toBe(planned[1].identifier);
  });

  it('aucun rappel sans créneau à venir', () => {
    expect(planAdorationReminders([], at('2026-10-14T18:30:00Z'), PARIS)).toEqual([]);
    expect(planAdorationReminders([mySlot()], at('2026-10-16T18:30:00Z'), PARIS)).toEqual([]);
  });

  it('budget iOS : quotidien 15 + rendez-vous 30 + neuvaines 9 + Rosaire vivant 3 + adoration 3 = 60, dans 64', () => {
    expect(ADORATION_REMINDERS_MAX).toBe(3);
    const total = DAILY_REMINDERS_MAX + GATHERING_REMINDERS_MAX + NOVENA_REMINDERS_MAX + ROSARY_REMINDERS_MAX + ADORATION_REMINDERS_MAX;
    expect(total).toBe(60);
    expect(total).toBeLessThanOrEqual(64);
  });

  it('lit l’adresse d’une notification de chaîne sans confondre avec un groupe ou une neuvaine', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(adorationChainIdFromUrl(`/adoration-chaine/${id}`)).toBe(id);
    expect(adorationChainIdFromUrl(`/groupe/${id}`)).toBeNull();
    expect(adorationChainIdFromUrl(`/neuvaine/${id}`)).toBeNull();
    expect(adorationChainIdFromUrl('/adoration-chaine/../x')).toBeNull();
    expect(adorationChainIdFromUrl(42)).toBeNull();
    expect(groupIdFromUrl(`/adoration-chaine/${id}`)).toBeNull();
    expect(novenaIdFromUrl(`/adoration-chaine/${id}`)).toBeNull();
  });

  it('la durée du créneau passée à l’adoration guidée', () => {
    expect(durationFromParam('60')).toBe(60);
    expect(durationFromParam('30')).toBe(30);
    expect(durationFromParam(['45'])).toBe(45);
    expect(durationFromParam('61')).toBeNull();
    expect(durationFromParam('abc')).toBeNull();
    expect(durationFromParam(undefined)).toBeNull();
  });
});

describe('formulaire d’une chaîne ponctuelle', () => {
  const now = at('2026-10-14T10:00:00Z');
  const start = at('2026-10-15T19:00:00Z');
  const ok = { start, end: at('2026-10-16T05:00:00Z'), slotMinutes: 60, now };

  it('accepte une chaîne bien formée', () => {
    expect(periodProblem(ok)).toBeNull();
    expect(periodProblem({ ...ok, end: at('2026-10-15T20:30:00Z'), slotMinutes: 30 })).toBeNull();
  });

  it('refuse un début passé ou trop lointain', () => {
    expect(periodProblem({ ...ok, start: at('2026-10-14T09:00:00Z') })).toBe('Choisis un début à venir.');
    expect(periodProblem({ ...ok, start: at('2026-12-20T19:00:00Z'), end: at('2026-12-21T05:00:00Z') })).toBe(
      'Le début est dans les 60 prochains jours.',
    );
    // Une chaîne déjà commencée garde son début.
    expect(periodProblem({ ...ok, start: at('2026-10-14T09:00:00Z'), end: at('2026-10-14T19:00:00Z'), keepStart: true })).toBeNull();
  });

  it('refuse une durée hors de 1 h à 7 jours, ou une fin qui coupe un créneau', () => {
    expect(periodProblem({ ...ok, end: at('2026-10-15T19:30:00Z'), slotMinutes: 30 })).toBe('Une chaîne dure de 1 h à 7 jours.');
    expect(periodProblem({ ...ok, end: at('2026-10-22T19:30:00Z'), slotMinutes: 30 })).toBe('Une chaîne dure de 1 h à 7 jours.');
    expect(periodProblem({ ...ok, end: at('2026-10-22T19:00:00Z') })).toBeNull();
    expect(periodProblem({ ...ok, end: at('2026-10-15T20:30:00Z') })).toBe('La fin doit tomber sur un créneau entier de 60 min.');
    expect(periodProblem({ ...ok, end: null })).toBe('Choisis un début et une fin.');
  });

  it('dans un groupe éphémère, la fin ne dépasse pas la fin du groupe', () => {
    expect(periodProblem({ ...ok, groupEndsAt: '2026-10-16T04:00:00Z' })).toBe('Ce groupe se termine avant la fin de la chaîne.');
    expect(periodProblem({ ...ok, groupEndsAt: '2026-10-16T05:00:00Z' })).toBeNull();
  });

  it('construit un instant à l’heure du téléphone, secondes à zéro', () => {
    const local = localInstant(1, 21, 30, new Date(2026, 9, 14, 10, 15, 42));
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes(), local.getSeconds()]).toEqual([
      2026, 9, 15, 21, 30, 0,
    ]);
  });
});

describe('formulaire d’une chaîne hebdomadaire', () => {
  const now = at('2026-10-16T10:00:00Z');
  const ok = { pattern: pattern(FRIDAYS), slotMinutes: 30, now };

  it('accepte « tous les vendredis de 21 h à 22 h pendant 2 mois »', () => {
    expect(weeklyProblem(ok)).toBeNull();
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: '07:00' }, slotMinutes: 60 })).toBeNull(); // une nuit
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: '21:00' } })).toBeNull(); // 24 h
  });

  it('refuse sans jour, sans heure valide, ou avec une plage hors de 30 min à 24 h', () => {
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, weekdays: [] } })).toBe('Choisis au moins un jour de la semaine.');
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, weekdays: [5, 5] } })).toBe('Choisis au moins un jour de la semaine.');
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: 'abc' } })).toBe('Choisis une heure de début et une heure de fin.');
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: '21:00', localStart: '21:00' }, slotMinutes: 60 })).toBeNull();
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: '21:30', localStart: '21:00' }, slotMinutes: 60 })).toBe(
      'Une plage d’adoration dure de 30 min à 24 h, en créneaux entiers de 60 min.',
    );
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, localEnd: '21:30', localStart: '21:00' } })).toBeNull();
  });

  it('refuse des jours incohérents, plus d’un an, ou aucune plage entre les deux jours', () => {
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, firstOn: '2026-10-24', lastOn: '2026-10-29' } })).toBe(
      'Aucune plage ne tombe entre ces deux jours.',
    );
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, lastOn: '2026-10-22', firstOn: '2026-10-23' } })).toBe(
      'Le dernier jour est avant le premier.',
    );
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, firstOn: 'x' } })).toBe('Choisis un premier et un dernier jour.');
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, lastOn: '2027-10-25' } })).toBe('Une chaîne dure un an au plus.');
    expect(weeklyProblem({ ...ok, pattern: { ...ok.pattern, lastOn: '2027-10-23' } })).toBeNull();
  });

  it('la première plage est à venir et dans les 60 prochains jours, sauf chaîne déjà commencée', () => {
    expect(weeklyProblem({ ...ok, now: at('2026-10-23T19:00:00Z') })).toBe('Choisis un début à venir.');
    expect(weeklyProblem({ ...ok, now: at('2026-10-23T19:00:00Z'), keepStart: true })).toBeNull();
    expect(weeklyProblem({ ...ok, now: at('2026-08-01T10:00:00Z') })).toBe('Le début est dans les 60 prochains jours.');
  });

  it('dans un groupe éphémère, la dernière plage finit avant la fin du groupe', () => {
    expect(weeklyProblem({ ...ok, groupEndsAt: '2026-12-18T20:30:00Z' })).toBe('Ce groupe se termine avant la fin de la chaîne.');
    expect(weeklyProblem({ ...ok, groupEndsAt: '2026-12-18T21:00:00Z' })).toBeNull();
  });
});

describe('lecteurs', () => {
  const slot = (start: string, over: Record<string, unknown> = {}) => ({ start, count: 0, mine: false, handles: [], hidden: 0, ...over });
  const onceRow = {
    id: '11111111-1111-4111-8111-111111111111',
    group_id: '22222222-2222-4222-8222-222222222222',
    group_name: 'Fraternité de test',
    group_ended: false,
    can_manage: true,
    title: 'Nuit d’adoration',
    intention: 'Pour les malades',
    place: 'Chapelle Saint-Joseph',
    recurrence: 'once',
    starts_at: '2026-10-14T19:00:00+00:00',
    ends_at: '2026-10-14T21:00:00+00:00',
    slot_minutes: 60,
    timezone: PARIS,
    weekdays: null,
    local_start: null,
    local_end: null,
    first_on: null,
    last_on: null,
    occurrence_count: 1,
    my_slots: ['2026-10-14T20:00:00+00:00', 'pas une date'],
    my_next_slot: '2026-10-14T20:00:00+00:00',
    reserved: true,
    has_more: false,
    occurrences: [
      {
        start: '2026-10-14T19:00:00+00:00',
        end: '2026-10-14T21:00:00+00:00',
        slots: [
          slot('2026-10-14T19:00:00+00:00', { count: 1, handles: ['marie'] }),
          slot('2026-10-14T20:00:00+00:00', { count: 2, mine: true, handles: ['paul'], hidden: 1 }),
          'pas une ligne',
        ],
      },
      'pas une occurrence',
    ],
  };
  const weeklyRow = {
    ...onceRow,
    recurrence: 'weekly',
    starts_at: '2026-10-23T19:00:00+00:00',
    ends_at: '2026-12-18T21:00:00+00:00',
    slot_minutes: 30,
    weekdays: [5],
    local_start: '21:00',
    local_end: '22:00',
    first_on: '2026-10-23',
    last_on: '2026-12-18',
    occurrence_count: 9,
    my_slots: [],
    has_more: true,
    window_from: '2026-10-23',
    window_to: '2026-11-20',
    occurrences: [
      {
        start: '2026-10-23T19:00:00+00:00',
        end: '2026-10-23T20:00:00+00:00',
        slots: [slot('2026-10-23T19:00:00+00:00'), slot('2026-10-23T19:30:00+00:00')],
      },
    ],
  };

  it('lit une chaîne ponctuelle et ses créneaux identifiés par leur début', () => {
    const c = readChain(onceRow);
    expect(c).not.toBeNull();
    expect(c?.recurrence).toBe('once');
    expect(c?.canManage).toBe(true);
    expect(c?.reserved).toBe(true);
    expect(c?.place).toBe('Chapelle Saint-Joseph');
    expect(c?.occurrenceCount).toBe(1);
    expect(iso(c?.mySlots ?? [])).toEqual(['2026-10-14T20:00:00.000Z']);
    expect(c?.occurrences).toHaveLength(1);
    const slots = c?.occurrences[0].slots ?? [];
    expect(slots.map((s) => [s.start.toISOString(), s.end.toISOString(), s.count, s.mine, s.handles, s.hidden])).toEqual([
      ['2026-10-14T19:00:00.000Z', '2026-10-14T20:00:00.000Z', 1, false, ['marie'], 0],
      ['2026-10-14T20:00:00.000Z', '2026-10-14T21:00:00.000Z', 2, true, ['paul'], 1],
    ]);
  });

  it('lit une chaîne hebdomadaire et sa fenêtre', () => {
    const c = readChain(weeklyRow);
    expect(c).toMatchObject({
      recurrence: 'weekly',
      slotMinutes: 30,
      weekdays: [5],
      localStart: '21:00',
      localEnd: '22:00',
      firstOn: '2026-10-23',
      lastOn: '2026-12-18',
      occurrenceCount: 9,
      hasMore: true,
      windowTo: '2026-11-20',
    });
    expect(c?.occurrences[0].slots).toHaveLength(2);
    expect(readChain({ ...weeklyRow, local_start: '21:00:00', weekdays: [5, 3, 5] })).toMatchObject({
      localStart: '21:00',
      weekdays: [3, 5],
    });
  });

  it('une réponse sans « recurrence » (serveur plus ancien) vaut ponctuelle', () => {
    const { recurrence: _recurrence, ...old } = onceRow;
    expect(readChain(old)?.recurrence).toBe('once');
  });

  it('ignore les lignes inutilisables', () => {
    expect(readChain({ ...onceRow, slot_minutes: 45 })).toBeNull();
    expect(readChain({ ...onceRow, ends_at: '2026-10-14T19:00:00+00:00' })).toBeNull();
    expect(readChain({ ...onceRow, timezone: 'Mars/Olympus' })).toBeNull();
    expect(readChain({ ...onceRow, title: '' })).toBeNull();
    expect(readChain({ ...onceRow, recurrence: 'daily' })).toBeNull();
    expect(readChain({ ...weeklyRow, weekdays: [] })).toBeNull();
    expect(readChain({ ...weeklyRow, weekdays: [7] })).toBeNull();
    expect(readChain({ ...weeklyRow, local_end: '25:00' })).toBeNull();
    expect(readChain({ ...weeklyRow, first_on: null })).toBeNull();
    expect(readChain(null)).toBeNull();
    expect(readChain('x')).toBeNull();
    expect(readChain({ ...onceRow, occurrences: undefined, my_slots: undefined })?.occurrences).toEqual([]);
  });

  it('lit un de mes créneaux', () => {
    const slot = readMySlot({
      chain_id: onceRow.id,
      group_id: onceRow.group_id,
      group_name: 'Fraternité de test',
      title: 'Nuit d’adoration',
      place: '',
      timezone: PARIS,
      slot_minutes: 30,
      starts_at: '2026-10-15T00:00:00+00:00',
      ends_at: '2026-10-15T00:30:00+00:00',
    });
    expect(slot?.slotMinutes).toBe(30);
    expect(slot?.startsAt).toBe('2026-10-15T00:00:00+00:00');
    expect(readMySlot({ chain_id: onceRow.id })).toBeNull();
    expect(
      readMySlot({
        chain_id: onceRow.id,
        group_id: onceRow.group_id,
        group_name: 'x',
        title: 'y',
        timezone: PARIS,
        slot_minutes: 30,
        starts_at: '2026-10-15T01:00:00+00:00',
        ends_at: '2026-10-15T00:00:00+00:00',
      }),
    ).toBeNull();
  });
});
