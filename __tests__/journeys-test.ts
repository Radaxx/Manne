import { bookMeta, loadPassage } from '../src/bible';
import { ADVENT_DAYS, ADVENT_LAST_DAYS } from '../src/data/advent';
import { LENT_DAYS } from '../src/data/lent';
import { adventOf, currentJourney, featuredJourney, journeyDay, journeyPhase, lentOf } from '../src/journeys';

describe('parcours de l’Avent', () => {
  it('a un jour pour chaque date de l’Avent, quelle que soit sa longueur', () => {
    for (let year = 2020; year <= 2045; year++) {
      const advent = adventOf(year);
      expect(advent.dates.length).toBeGreaterThanOrEqual(22);
      expect(advent.dates.length).toBeLessThanOrEqual(28);
      expect(advent.dates[advent.dates.length - 1]).toBe(`${year}-12-24`);
      for (const date of advent.dates) {
        const { day, week } = journeyDay(advent, date);
        expect(day).toBeDefined();
        expect(week).toBeGreaterThanOrEqual(0);
        expect(week).toBeLessThanOrEqual(3);
      }
    }
  });

  it('suit les dimanches pour les semaines et la date à partir du 17 décembre', () => {
    const advent = adventOf(2026); // du 29 novembre au 24 décembre
    expect(journeyDay(advent, '2026-11-29')).toMatchObject({ week: 0, day: ADVENT_DAYS[0] });
    expect(journeyDay(advent, '2026-12-13')).toMatchObject({ week: 2, day: ADVENT_DAYS[14] }); // Gaudete
    expect(journeyDay(advent, '2026-12-17').day.title).toBe('Ô Sagesse');
    expect(journeyDay(advent, '2026-12-24').day.title).toBe('Une grande lumière');
  });
});

describe('parcours de Carême', () => {
  it('va du mercredi des Cendres au Samedi saint, 46 jours, chaque année', () => {
    expect(LENT_DAYS).toHaveLength(46);
    const lent = lentOf(2027);
    expect(lent.start).toBe('2027-02-10');
    expect(lent.end).toBe('2027-03-27');
    for (let year = 2020; year <= 2045; year++) {
      const { dates } = lentOf(year);
      expect(dates).toHaveLength(46);
      for (const date of dates) expect(journeyDay(lentOf(year), date).day).toBeDefined();
    }
  });

  it('cale ses semaines sur les dimanches', () => {
    const lent = lentOf(2027);
    expect(journeyDay(lent, '2027-02-10')).toMatchObject({ week: 0, day: LENT_DAYS[0] }); // Cendres
    expect(journeyDay(lent, '2027-02-14')).toMatchObject({ week: 1, day: LENT_DAYS[4] }); // 1er dimanche
    expect(journeyDay(lent, '2027-03-07').week).toBe(4); // Laetare
    expect(journeyDay(lent, '2027-03-21')).toMatchObject({ week: 6, day: LENT_DAYS[39] }); // Rameaux
    expect(journeyDay(lent, '2027-03-26').day.title).toBe('Tout est accompli'); // Vendredi saint
  });
});

describe('les parcours', () => {
  it('lisent des passages qui existent, découpés pareil dans les deux traductions', () => {
    for (const day of [...ADVENT_DAYS, ...Object.values(ADVENT_LAST_DAYS), ...LENT_DAYS]) {
      const [book, chapter, from, to] = day.passage;
      expect(bookMeta(book, 'lsg').verses[chapter - 1]).toBe(bookMeta(book, 'crampon').verses[chapter - 1]);
      for (const t of ['lsg', 'crampon'] as const) expect(loadPassage(book, chapter, from, to, t)).toHaveLength(to - from + 1);
    }
  });

  it('gardent le parcours fini jusqu’à la fin de son temps, puis passent au suivant', () => {
    expect(currentJourney('avent', '2026-10-13').id).toBe('avent-2026');
    expect(journeyPhase(currentJourney('avent', '2026-12-01'), '2026-12-01')).toBe('pendant');
    expect(currentJourney('avent', '2027-01-05').id).toBe('avent-2026');
    expect(journeyPhase(currentJourney('avent', '2027-01-05'), '2027-01-05')).toBe('apres');
    expect(currentJourney('avent', '2027-01-20').id).toBe('avent-2027');
    expect(currentJourney('careme', '2026-10-13').id).toBe('careme-2027');
    expect(currentJourney('careme', '2027-04-10').id).toBe('careme-2027'); // temps pascal : on peut relire
    expect(currentJourney('careme', '2027-06-01').id).toBe('careme-2028');
  });

  it('mettent en avant le parcours en cours, ou celui qui commence dans trois semaines', () => {
    expect(featuredJourney('2026-10-13')).toBeNull();
    expect(featuredJourney('2026-11-10')?.id).toBe('avent-2026');
    expect(featuredJourney('2026-12-25')).toBeNull();
    expect(featuredJourney('2027-01-25')?.id).toBe('careme-2027');
    expect(featuredJourney('2027-03-01')?.id).toBe('careme-2027');
  });
});
