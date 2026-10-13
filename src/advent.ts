import { ADVENT_DAYS, ADVENT_LAST_DAYS, ADVENT_WEEKS, type AdventDay } from './data/advent';
import { daysSince, shiftDay } from './dates';
import { adventStart, baptism } from './liturgical-year';

export type Advent = {
  /** Clé de la progression : « avent-2026 ». */
  id: string;
  year: number;
  start: string;
  /** La veille de Noël, dernier jour du parcours. */
  end: string;
  /** Toutes les dates du parcours, dans l'ordre. */
  dates: string[];
};

export function adventOf(year: number): Advent {
  const start = adventStart(year);
  const end = `${year}-12-24`;
  const dates = Array.from({ length: daysSince(start, end) + 1 }, (_, i) => shiftDay(start, i));
  return { id: `avent-${year}`, year, start, end, dates };
}

/** L'Avent en cours ou le prochain ; jusqu'au Baptême du Seigneur, on garde celui qui vient de finir. */
export function currentAdvent(date: string): Advent {
  const year = Number(date.slice(0, 4));
  return date <= baptism(year) ? adventOf(year - 1) : adventOf(year);
}

export type AdventPhase = 'avant' | 'pendant' | 'noel';

export const adventPhase = (advent: Advent, date: string): AdventPhase =>
  date < advent.start ? 'avant' : date <= advent.end ? 'pendant' : 'noel';

/** Le contenu d'un jour du parcours, et la semaine (0 à 3) à laquelle il appartient. */
export function adventDay(advent: Advent, date: string): { day: AdventDay; week: number } {
  const dayOfMonth = Number(date.slice(8));
  if (date.slice(5, 7) === '12' && dayOfMonth >= 17) return { day: ADVENT_LAST_DAYS[dayOfMonth], week: 3 };
  const index = daysSince(advent.start, date);
  return { day: ADVENT_DAYS[index], week: Math.floor(index / 7) };
}

export const weekTheme = (week: number) => ADVENT_WEEKS[week];
