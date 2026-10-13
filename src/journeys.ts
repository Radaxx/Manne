import { ADVENT_DAYS, ADVENT_LAST_DAYS, ADVENT_WEEKS } from './data/advent';
import { LENT_DAYS, LENT_WEEKS } from './data/lent';
import { daysSince, shiftDay } from './dates';
import { adventStart, baptism, easter } from './liturgical-year';

// Les parcours des temps forts : l'Avent jusqu'à Noël, le Carême jusqu'à Pâques. Un passage de la Bible,
// une courte méditation et un geste pour chaque jour ; les jours vécus sont gardés dans la progression.

export type JourneyDay = {
  title: string;
  /** Livre, chapitre, premier et dernier verset, lus dans la traduction choisie. */
  passage: [number, number, number, number];
  meditation: string;
  gesture: string;
  /** Pour les derniers jours de l'Avent : l'antienne « Ô » des Vêpres (traduite du latin). */
  antiphon?: string;
};

export type JourneyWeek = { theme: string; blurb: string /** « 1re semaine », « Semaine sainte »… */; when: string };

export type JourneyKind = 'avent' | 'careme';

export const JOURNEY_KINDS: JourneyKind[] = ['avent', 'careme'];

export const JOURNEYS: Record<
  JourneyKind,
  { name: string; short: string; season: string; feast: string; arrival: string; weeks: JourneyWeek[] }
> = {
  avent: { name: 'Parcours de l’Avent', short: 'Avent', season: 'L’Avent', feast: 'Noël', arrival: 'Joyeux Noël !', weeks: ADVENT_WEEKS },
  careme: {
    name: 'Parcours de Carême',
    short: 'Carême',
    season: 'Le Carême',
    feast: 'Pâques',
    arrival: 'Christ est ressuscité !',
    weeks: LENT_WEEKS,
  },
};

export type Journey = {
  /** Clé de la progression : « avent-2026 », « careme-2027 ». */
  id: string;
  kind: JourneyKind;
  /** L'année civile du 1er dimanche de l'Avent, ou de Pâques. */
  year: number;
  start: string;
  end: string;
  /** Toutes les dates du parcours, dans l'ordre. */
  dates: string[];
};

function journey(kind: JourneyKind, year: number, start: string, end: string): Journey {
  const dates = Array.from({ length: daysSince(start, end) + 1 }, (_, i) => shiftDay(start, i));
  return { id: `${kind}-${year}`, kind, year, start, end, dates };
}

/** Du 1er dimanche de l'Avent à la veille de Noël (22 à 28 jours). */
export const adventOf = (year: number) => journey('avent', year, adventStart(year), `${year}-12-24`);

/** Du mercredi des Cendres au Samedi saint : toujours 46 jours (40 jours et 6 dimanches). */
export const lentOf = (year: number) => journey('careme', year, shiftDay(easter(year), -46), shiftDay(easter(year), -1));

/**
 * Le parcours en cours ou le prochain. Une fois fini, on le garde jusqu'à la fin de son temps
 * (le Baptême du Seigneur pour l'Avent, la Pentecôte pour le Carême) : on peut encore le relire.
 */
export function currentJourney(kind: JourneyKind, date: string): Journey {
  const year = Number(date.slice(0, 4));
  if (kind === 'avent') return date <= baptism(year) ? adventOf(year - 1) : adventOf(year);
  return date <= shiftDay(easter(year), 49) ? lentOf(year) : lentOf(year + 1);
}

export type JourneyPhase = 'avant' | 'pendant' | 'apres';

export const journeyPhase = (j: Journey, date: string): JourneyPhase => (date < j.start ? 'avant' : date <= j.end ? 'pendant' : 'apres');

/** Le contenu d'un jour du parcours, et la semaine à laquelle il appartient (index dans JOURNEYS[kind].weeks). */
export function journeyDay(j: Journey, date: string): { day: JourneyDay; week: number } {
  const index = daysSince(j.start, date);
  if (j.kind === 'careme') {
    // Les Cendres et les trois jours qui suivent, cinq semaines, puis la Semaine sainte.
    return { day: LENT_DAYS[index], week: index < 4 ? 0 : index < 39 ? 1 + Math.floor((index - 4) / 7) : 6 };
  }
  // L'Avent suit ses dimanches jusqu'au 16 décembre, puis la date et les grandes antiennes.
  const dayOfMonth = Number(date.slice(8));
  if (date.slice(5, 7) === '12' && dayOfMonth >= 17) return { day: ADVENT_LAST_DAYS[dayOfMonth], week: 3 };
  return { day: ADVENT_DAYS[index], week: Math.floor(index / 7) };
}

/** Le parcours à mettre en avant : celui qui est en cours, sinon celui qui commence dans les trois semaines. */
export function featuredJourney(date: string): Journey | null {
  const journeys = JOURNEY_KINDS.map((kind) => currentJourney(kind, date));
  return (
    journeys.find((j) => journeyPhase(j, date) === 'pendant') ??
    journeys.find((j) => journeyPhase(j, date) === 'avant' && daysSince(date, j.start) <= 21) ??
    null
  );
}
