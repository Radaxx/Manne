import { adventDay, adventOf, adventPhase, currentAdvent } from '../src/advent';
import { bookMeta, loadPassage } from '../src/bible';
import { ADVENT_DAYS, ADVENT_LAST_DAYS } from '../src/data/advent';

describe('parcours de l’Avent', () => {
  it('a un jour pour chaque date de l’Avent, quelle que soit sa longueur', () => {
    for (let year = 2020; year <= 2045; year++) {
      const advent = adventOf(year);
      expect(advent.dates.length).toBeGreaterThanOrEqual(22);
      expect(advent.dates.length).toBeLessThanOrEqual(28);
      expect(advent.dates[advent.dates.length - 1]).toBe(`${year}-12-24`);
      for (const date of advent.dates) {
        const { day, week } = adventDay(advent, date);
        expect(day).toBeDefined();
        expect(week).toBeGreaterThanOrEqual(0);
        expect(week).toBeLessThanOrEqual(3);
      }
    }
  });

  it('suit les dimanches pour les semaines et la date à partir du 17 décembre', () => {
    const advent = adventOf(2026); // du 29 novembre au 24 décembre
    expect(adventDay(advent, '2026-11-29')).toMatchObject({ week: 0, day: ADVENT_DAYS[0] });
    expect(adventDay(advent, '2026-12-13')).toMatchObject({ week: 2, day: ADVENT_DAYS[14] }); // Gaudete
    expect(adventDay(advent, '2026-12-17').day.title).toBe('Ô Sagesse');
    expect(adventDay(advent, '2026-12-24').day.title).toBe('Une grande lumière');
  });

  it('lit des passages qui existent, découpés pareil dans les deux traductions', () => {
    for (const day of [...ADVENT_DAYS, ...Object.values(ADVENT_LAST_DAYS)]) {
      const [book, chapter, from, to] = day.passage;
      expect(bookMeta(book, 'lsg').verses[chapter - 1]).toBe(bookMeta(book, 'crampon').verses[chapter - 1]);
      for (const t of ['lsg', 'crampon'] as const) expect(loadPassage(book, chapter, from, to, t)).toHaveLength(to - from + 1);
    }
  });

  it('garde l’Avent qui vient de finir jusqu’au Baptême du Seigneur', () => {
    expect(currentAdvent('2026-10-13').id).toBe('avent-2026');
    expect(adventPhase(currentAdvent('2026-10-13'), '2026-10-13')).toBe('avant');
    expect(adventPhase(currentAdvent('2026-12-01'), '2026-12-01')).toBe('pendant');
    expect(currentAdvent('2027-01-05').id).toBe('avent-2026');
    expect(adventPhase(currentAdvent('2027-01-05'), '2027-01-05')).toBe('noel');
    expect(currentAdvent('2027-01-20').id).toBe('avent-2027');
  });
});
