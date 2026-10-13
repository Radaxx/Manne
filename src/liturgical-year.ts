import { daysSince, shiftDay, weekday } from './dates';

// L'année liturgique, calculée sur le téléphone (sans réseau) pour le calendrier romain en France :
// les temps, les semaines, l'année A, B ou C, et les grandes fêtes. Les saints du jour et les
// mémoires viennent de l'AELF quand on est en ligne.

export type Season = 'avent' | 'noel' | 'ordinaire' | 'careme' | 'triduum' | 'paques';

/** Clés de LITURGICAL_COLORS (aelf.ts), comme la couleur que renvoie l'AELF. */
export type LiturgicalColor = 'vert' | 'violet' | 'blanc' | 'rouge' | 'rose';

export const SEASONS: Record<Season, { name: string; color: LiturgicalColor; blurb: string }> = {
  avent: {
    name: 'Avent',
    color: 'violet',
    blurb: 'Quatre semaines pour attendre et préparer la venue du Seigneur, à Noël et à la fin des temps.',
  },
  noel: {
    name: 'Temps de Noël',
    color: 'blanc',
    blurb: 'De la Nativité au Baptême du Seigneur : Dieu se fait l’un de nous et se manifeste au monde.',
  },
  ordinaire: {
    name: 'Temps ordinaire',
    color: 'vert',
    blurb: 'Le temps de la croissance : semaine après semaine, on suit Jésus dans sa vie publique.',
  },
  careme: {
    name: 'Carême',
    color: 'violet',
    blurb: 'Quarante jours de prière, de jeûne et de partage pour se convertir et préparer Pâques.',
  },
  triduum: {
    name: 'Triduum pascal',
    color: 'rouge',
    blurb: 'Les trois jours saints : la Cène, la Passion et le grand silence du tombeau, avant la Résurrection.',
  },
  paques: {
    name: 'Temps pascal',
    color: 'blanc',
    blurb: 'Cinquante jours de fête, de la Résurrection à la Pentecôte.',
  },
};

export type FeastRank = 'solennite' | 'fete' | 'jour';

export type Feast = { date: string; name: string; rank: FeastRank; color: LiturgicalColor };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Le dimanche qui précède une date, ou la date elle-même si c'est un dimanche. */
const sundayOnOrBefore = (date: string) => shiftDay(date, -weekday(date));

/** Pâques (calendrier grégorien, algorithme de Meeus). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Premier dimanche de l'Avent : trois semaines avant le dernier dimanche avant Noël. */
export const adventStart = (year: number) => shiftDay(sundayOnOrBefore(iso(year, 12, 24)), -21);

/** Épiphanie, fêtée en France le dimanche entre le 2 et le 8 janvier. */
export const epiphany = (year: number) => shiftDay(iso(year, 1, 2), (7 - weekday(iso(year, 1, 2))) % 7);

/** Baptême du Seigneur : le dimanche après l'Épiphanie, ou le lundi si l'Épiphanie tombe le 7 ou le 8. */
export function baptism(year: number): string {
  const e = epiphany(year);
  return shiftDay(e, Number(e.slice(8)) >= 7 ? 1 : 7);
}

/** Les bornes de l'année liturgique qui contient une date : du 1er dimanche de l'Avent à la veille du suivant. */
function yearOf(date: string) {
  const y = Number(date.slice(0, 4));
  const startYear = date >= adventStart(y) ? y : y - 1;
  const e = easter(startYear + 1);
  return {
    startYear,
    start: adventStart(startYear),
    end: shiftDay(adventStart(startYear + 1), -1),
    baptism: baptism(startYear + 1),
    ashes: shiftDay(e, -46),
    easter: e,
    pentecost: shiftDay(e, 49),
    christKing: shiftDay(adventStart(startYear + 1), -7),
  };
}

/** Les grandes fêtes d'une année civile, déplacées comme le veut le calendrier. */
function civilFeasts(y: number): Feast[] {
  const e = easter(y);
  const palms = shiftDay(e, -7);
  const holyWeek = (d: string) => d >= palms && d < e;
  const sunday = (d: string) => weekday(d) === 0;
  // Saint Joseph : un dimanche de Carême le repousse au lundi, la Semaine sainte au samedi d'avant.
  let joseph = iso(y, 3, 19);
  if (holyWeek(joseph)) joseph = shiftDay(palms, -1);
  else if (sunday(joseph)) joseph = shiftDay(joseph, 1);
  // Annonciation : la Semaine sainte ou l'octave de Pâques la repousse au lundi après le 2e dimanche de Pâques.
  let annunciation = iso(y, 3, 25);
  if (annunciation >= palms && annunciation <= shiftDay(e, 7)) annunciation = shiftDay(e, 8);
  else if (sunday(annunciation)) annunciation = shiftDay(annunciation, 1);
  const immaculate = sunday(iso(y, 12, 8)) ? iso(y, 12, 9) : iso(y, 12, 8);
  // Sainte Famille : le dimanche dans l'octave de Noël, ou le 30 décembre si Noël est un dimanche.
  const holyFamily = sunday(iso(y, 12, 25)) ? iso(y, 12, 30) : shiftDay(iso(y, 12, 25), 7 - weekday(iso(y, 12, 25)));
  const feasts: Feast[] = [
    { date: iso(y, 1, 1), name: 'Sainte Marie, Mère de Dieu', rank: 'solennite', color: 'blanc' },
    { date: epiphany(y), name: 'Épiphanie du Seigneur', rank: 'solennite', color: 'blanc' },
    { date: baptism(y), name: 'Baptême du Seigneur', rank: 'fete', color: 'blanc' },
    { date: iso(y, 2, 2), name: 'Présentation du Seigneur au Temple', rank: 'fete', color: 'blanc' },
    { date: shiftDay(e, -46), name: 'Mercredi des Cendres', rank: 'jour', color: 'violet' },
    { date: joseph, name: 'Saint Joseph', rank: 'solennite', color: 'blanc' },
    { date: annunciation, name: 'Annonciation du Seigneur', rank: 'solennite', color: 'blanc' },
    { date: palms, name: 'Dimanche des Rameaux et de la Passion', rank: 'jour', color: 'rouge' },
    { date: shiftDay(e, -3), name: 'Jeudi saint', rank: 'jour', color: 'blanc' },
    { date: shiftDay(e, -2), name: 'Vendredi saint', rank: 'jour', color: 'rouge' },
    { date: e, name: 'Pâques, Résurrection du Seigneur', rank: 'solennite', color: 'blanc' },
    { date: shiftDay(e, 39), name: 'Ascension du Seigneur', rank: 'solennite', color: 'blanc' },
    { date: shiftDay(e, 49), name: 'Pentecôte', rank: 'solennite', color: 'rouge' },
    { date: shiftDay(e, 56), name: 'Sainte Trinité', rank: 'solennite', color: 'blanc' },
    { date: shiftDay(e, 63), name: 'Saint-Sacrement', rank: 'solennite', color: 'blanc' },
    { date: shiftDay(e, 68), name: 'Sacré-Cœur de Jésus', rank: 'solennite', color: 'blanc' },
    { date: iso(y, 6, 24), name: 'Nativité de saint Jean-Baptiste', rank: 'solennite', color: 'blanc' },
    { date: iso(y, 6, 29), name: 'Saints Pierre et Paul', rank: 'solennite', color: 'rouge' },
    { date: iso(y, 8, 6), name: 'Transfiguration du Seigneur', rank: 'fete', color: 'blanc' },
    { date: iso(y, 8, 15), name: 'Assomption de la Vierge Marie', rank: 'solennite', color: 'blanc' },
    { date: iso(y, 9, 14), name: 'La Croix glorieuse', rank: 'fete', color: 'rouge' },
    { date: iso(y, 11, 1), name: 'Toussaint', rank: 'solennite', color: 'blanc' },
    { date: iso(y, 11, 2), name: 'Commémoraison des fidèles défunts', rank: 'jour', color: 'violet' },
    { date: shiftDay(adventStart(y), -7), name: 'Le Christ, Roi de l’univers', rank: 'solennite', color: 'blanc' },
    { date: adventStart(y), name: '1er dimanche de l’Avent', rank: 'jour', color: 'violet' },
    { date: immaculate, name: 'Immaculée Conception', rank: 'solennite', color: 'blanc' },
    { date: iso(y, 12, 25), name: 'Nativité du Seigneur', rank: 'solennite', color: 'blanc' },
    { date: holyFamily, name: 'Sainte Famille', rank: 'fete', color: 'blanc' },
  ];
  return feasts.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Les grandes fêtes à partir d'une date (incluse). */
export function upcomingFeasts(date: string, count: number): Feast[] {
  const y = Number(date.slice(0, 4));
  return [...civilFeasts(y), ...civilFeasts(y + 1)].filter((f) => f.date >= date).slice(0, count);
}

const ordinal = (n: number) => (n === 1 ? '1re' : `${n}e`);
const sundayOrdinal = (n: number) => (n === 1 ? '1er' : `${n}e`);

export type LiturgicalDay = {
  date: string;
  season: Season;
  /** « 3e semaine de l'Avent », « 28e dimanche du temps ordinaire », « Jeudi saint »… */
  label: string;
  /** Couleur prévue par le calendrier (sans les mémoires des saints, que seule l'AELF connaît). */
  color: LiturgicalColor;
  week: number | null;
  /** Année des lectures du dimanche : A (Matthieu), B (Marc) ou C (Luc). */
  sundayCycle: 'A' | 'B' | 'C';
  /** Année des lectures de semaine : I (années impaires) ou II. */
  weekdayCycle: 'I' | 'II';
  feast: Feast | null;
};

/** Le jour liturgique d'une date AAAA-MM-JJ. */
export function liturgicalDay(date: string): LiturgicalDay {
  const y = yearOf(date);
  const isSunday = weekday(date) === 0;
  const feast = civilFeasts(Number(date.slice(0, 4))).find((f) => f.date === date) ?? null;
  let season: Season;
  let week: number | null = null;
  let label: string;
  let color: LiturgicalColor;

  if (date <= `${y.startYear}-12-24`) {
    season = 'avent';
    week = Math.floor(daysSince(y.start, date) / 7) + 1;
    label = isSunday ? `${sundayOrdinal(week)} dimanche de l’Avent` : `${ordinal(week)} semaine de l’Avent`;
    color = isSunday && week === 3 ? 'rose' : 'violet';
  } else if (date <= y.baptism) {
    season = 'noel';
    label =
      date === `${y.startYear}-12-25` ? 'Nativité du Seigneur' : date < `${y.startYear + 1}-01-01` ? 'Octave de Noël' : 'Temps de Noël';
    color = 'blanc';
  } else if (date < y.ashes) {
    season = 'ordinaire';
    week = Math.floor(daysSince(sundayOnOrBefore(y.baptism), date) / 7) + 1;
    label = isSunday ? `${week}e dimanche du temps ordinaire` : `${week}e semaine du temps ordinaire`;
    color = 'vert';
  } else if (date < shiftDay(y.easter, -3)) {
    season = 'careme';
    const firstSunday = shiftDay(y.ashes, 4);
    if (date < firstSunday) {
      label = date === y.ashes ? 'Mercredi des Cendres' : 'Après les Cendres';
      color = 'violet';
    } else {
      week = Math.floor(daysSince(firstSunday, date) / 7) + 1;
      if (week === 6) label = isSunday ? 'Dimanche des Rameaux et de la Passion' : 'Semaine sainte';
      else label = isSunday ? `${sundayOrdinal(week)} dimanche de Carême` : `${ordinal(week)} semaine de Carême`;
      color = isSunday && week === 4 ? 'rose' : isSunday && week === 6 ? 'rouge' : 'violet';
    }
  } else if (date < y.easter) {
    season = 'triduum';
    const days = ['Jeudi saint', 'Vendredi saint', 'Samedi saint'];
    label = days[daysSince(shiftDay(y.easter, -3), date)];
    color = label === 'Jeudi saint' ? 'blanc' : label === 'Vendredi saint' ? 'rouge' : 'violet';
  } else if (date <= y.pentecost) {
    season = 'paques';
    week = Math.floor(daysSince(y.easter, date) / 7) + 1;
    if (date === y.easter) label = 'Dimanche de Pâques';
    else if (date === y.pentecost) label = 'Pentecôte';
    else if (week === 1) label = 'Octave de Pâques';
    else label = isSunday ? `${week}e dimanche de Pâques` : `${week}e semaine du temps pascal`;
    color = date === y.pentecost ? 'rouge' : 'blanc';
  } else {
    season = 'ordinaire';
    week = 34 - Math.floor(daysSince(sundayOnOrBefore(date), y.christKing) / 7);
    label = isSunday ? `${week}e dimanche du temps ordinaire` : `${week}e semaine du temps ordinaire`;
    color = 'vert';
  }

  return {
    date,
    season,
    label,
    color: feast?.color ?? color,
    week,
    sundayCycle: (['C', 'A', 'B'] as const)[(y.startYear + 1) % 3],
    weekdayCycle: (y.startYear + 1) % 2 === 1 ? 'I' : 'II',
    feast,
  };
}

export type SeasonSpan = { season: Season; from: string; to: string };

/** Les temps de l'année liturgique qui contient une date, dans l'ordre. */
export function liturgicalYear(date: string) {
  const y = yearOf(date);
  const spans: SeasonSpan[] = [
    { season: 'avent', from: y.start, to: `${y.startYear}-12-24` },
    { season: 'noel', from: `${y.startYear}-12-25`, to: y.baptism },
    { season: 'ordinaire', from: shiftDay(y.baptism, 1), to: shiftDay(y.ashes, -1) },
    { season: 'careme', from: y.ashes, to: shiftDay(y.easter, -4) },
    { season: 'triduum', from: shiftDay(y.easter, -3), to: shiftDay(y.easter, -1) },
    { season: 'paques', from: y.easter, to: y.pentecost },
    { season: 'ordinaire', from: shiftDay(y.pentecost, 1), to: y.end },
  ];
  return { start: y.start, end: y.end, length: daysSince(y.start, y.end) + 1, spans };
}
