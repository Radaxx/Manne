// Dates du calendrier local (AAAA-MM-JJ) et leur écriture en français.

export const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** AAAA-MM-JJ du jour local : le jour change à minuit ici, pas à minuit UTC. */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** « 13 octobre 2026 » */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Décale une date AAAA-MM-JJ d'un nombre de jours, en calendrier UTC pour éviter les changements d'heure. */
export function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Nombre de jours de `start` à `end` (négatif si `end` est avant). */
export function daysSince(start: string, end: string) {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Jour de la semaine d'une date AAAA-MM-JJ (0 = dimanche). */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** « dimanche 29 novembre » */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[weekday(iso)]} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
}

const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 29 nov. » */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${SHORT_MONTHS[m - 1]}`;
}
