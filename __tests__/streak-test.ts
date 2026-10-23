import { prepareStored } from '../src/storage';
import { type DayLog, dayActive, dayComplete, EMPTY_DAY, streakFrom, weekStrip } from '../src/today';

const log = (patch: Partial<DayLog> = {}): DayLog => ({ ...EMPTY_DAY, ...patch });

describe('dayActive', () => {
  it('compte un seul geste', () => {
    expect(dayActive(undefined)).toBe(false);
    expect(dayActive(log())).toBe(false);
    expect(dayActive(log({ verses: 12 }))).toBe(false);
    expect(dayActive(log({ gospel: true }))).toBe(true);
    expect(dayActive(log({ reading: true }))).toBe(true);
    expect(dayActive(log({ office: true }))).toBe(true);
    expect(dayActive(log({ rosary: true }))).toBe(true);
    expect(dayActive(log({ adoration: true }))).toBe(true);
  });

  it('reste distinct de la journée complète', () => {
    expect(dayComplete(log({ gospel: true }))).toBe(false);
    expect(dayComplete(log({ gospel: true, reading: true, rosary: true }))).toBe(true);
  });
});

describe('streakFrom', () => {
  const days = {
    '2026-03-01': log({ gospel: true }),
    '2026-03-02': log({ rosary: true }),
    '2026-03-03': log({ reading: true }),
  };

  it('compte les jours à un seul geste', () => {
    expect(streakFrom(days, '2026-03-03')).toBe(3);
  });

  it('une journée vide casse la série', () => {
    expect(streakFrom({ ...days, '2026-03-02': log({ verses: 5 }) }, '2026-03-03')).toBe(1);
    expect(streakFrom({ '2026-03-01': log({ gospel: true }), '2026-03-03': log({ gospel: true }) }, '2026-03-03')).toBe(1);
  });

  it('aujourd’hui sans geste garde la série jusqu’à hier', () => {
    expect(streakFrom(days, '2026-03-04')).toBe(3);
    expect(streakFrom(days, '2026-03-05')).toBe(0);
  });
});

describe('semaine', () => {
  it('ne colore que les journées complètes', () => {
    const p = prepareStored({
      day: '2026-03-03',
      days: {
        '2026-03-02': { verses: 0, gospel: true, office: false, rosary: false, adoration: false, reading: false },
        '2026-03-01': { verses: 30, gospel: true, office: false, rosary: true, adoration: false, reading: true },
      },
    });
    const week = weekStrip(p);
    expect(week.find((c) => c.date === '2026-03-01')?.complete).toBe(true);
    expect(week.find((c) => c.date === '2026-03-02')?.complete).toBe(false);
  });
});

describe('série enregistrée', () => {
  it('est recalculée au chargement avec la règle d’un geste', () => {
    const p = prepareStored({
      day: '2026-03-03',
      streak: 0,
      days: {
        '2026-03-01': { verses: 0, gospel: true, office: false, rosary: false, adoration: false, reading: false },
        '2026-03-02': { verses: 0, gospel: true, office: false, rosary: false, adoration: false, reading: false },
      },
    });
    expect(p.streak).toBe(2);
  });
});
