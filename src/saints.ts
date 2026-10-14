import { SAINTS, type Saint, type SaintRank } from './data/saints';
import { dayLabel, daysSince, shiftDay, weekday } from './dates';
import { easter, liturgicalDay, upcomingFeasts } from './liturgical-year';

export type { Saint, SaintRank };

export const RANKS: Record<SaintRank, string> = {
  solennite: 'Solennité',
  fete: 'Fête',
  memoire: 'Mémoire',
  facultative: 'Mémoire facultative',
  commemoraison: 'Commémoraison',
  // Un saint fêté ce jour-là, sans célébration à la messe : on ne lui donne pas de rang.
  martyrologe: '',
};

// Les mémoires qui suivent Pâques et la Pentecôte : elles n'ont pas de date fixe.
const MOVABLE: { after: number; saint: Saint }[] = [
  {
    after: 50,
    saint: {
      name: 'Bienheureuse Vierge Marie, Mère de l’Église',
      rank: 'memoire',
      life: 'Le lendemain de la Pentecôte, l’Église se tourne vers Marie, présente au Cénacle avec les apôtres quand l’Esprit est descendu. Paul VI lui a donné ce titre en 1964, à la fin d’une session du concile Vatican II.',
    },
  },
  {
    after: 69,
    saint: {
      name: 'Cœur immaculé de Marie',
      rank: 'memoire',
      life: 'Le lendemain du Sacré-Cœur, l’Église contemple le cœur de Marie, qui « gardait toutes ces choses » et les méditait (Luc 2, 19). Une invitation à accueillir la Parole comme elle.',
    },
  },
];

export type SaintOfDay = {
  date: string;
  saints: Saint[];
  /** Pourquoi le premier saint n'est pas célébré à la messe cette année, s'il ne l'est pas. */
  note: string | null;
};

/** Ce qui, cette année, prend la place d'une mémoire ou d'une fête de saint. */
function precedence(date: string, saint: Saint): string | null {
  if (saint.rank === 'martyrologe' || saint.rank === 'commemoraison' || saint.lord) return null;
  const year = Number(date.slice(0, 4));
  // Saint Joseph, l'Annonciation et l'Immaculée Conception changent de jour quand ils tombent mal.
  if (saint.feast) {
    const moved = upcomingFeasts(`${year}-01-01`, 40).find((f) => f.name === saint.feast)?.date;
    return moved && moved !== date ? `Cette année, la solennité est célébrée le ${dayLabel(moved)}.` : null;
  }
  if (saint.rank === 'solennite') return null;
  const e = easter(year);
  const day = liturgicalDay(date);
  const what = saint.rank === 'fete' ? 'sa fête' : 'sa mémoire';
  if (day.feast && day.feast.rank !== 'jour') {
    return `Cette année, la ${day.feast.rank === 'solennite' ? 'solennité' : 'fête'} « ${day.feast.name} » passe avant ${what}.`;
  }
  if (weekday(date) === 0) return `Cette année, le dimanche passe avant ${what}.`;
  if (date === shiftDay(e, -46)) return `Cette année, le mercredi des Cendres passe avant ${what}.`;
  if (date >= shiftDay(e, -6) && date < e) return `Cette année, la Semaine sainte passe avant ${what}.`;
  if (date > e && date <= shiftDay(e, 7)) return `Cette année, l’octave de Pâques passe avant ${what}.`;
  if (saint.rank === 'fete') return null;
  if (day.season === 'careme') return `En Carême, ${what} devient une simple commémoraison.`;
  if (date.slice(5) >= '12-17' && date.slice(5) <= '12-24') return `Du 17 au 24 décembre, ${what} devient une simple commémoraison.`;
  return null;
}

/** Les saints fêtés à une date AAAA-MM-JJ : le premier est celui qu'on met en avant. */
export function saintOfDay(date: string): SaintOfDay {
  const e = easter(Number(date.slice(0, 4)));
  const movable = MOVABLE.filter((m) => daysSince(e, date) === m.after).map((m) => m.saint);
  const fixed = SAINTS[date.slice(5)] ?? [];
  // Une mémoire mobile passe devant les mémoires facultatives du jour, pas devant une fête.
  const saints =
    movable.length && !fixed.some((s) => s.rank === 'fete' || s.rank === 'solennite') ? [...movable, ...fixed] : [...fixed, ...movable];
  return { date, saints, note: saints[0] ? precedence(date, saints[0]) : null };
}

/** « Saint du jour », ou « Fête du jour » pour une fête du Seigneur ou de Marie, suivi du rang s'il y en a un. */
export function saintKicker(saint: Saint): string {
  const head =
    saint.rank === 'commemoraison'
      ? 'Aujourd’hui'
      : /^(Saint|Sainte|Saints|Saintes|Bienheureux|Bienheureuse|Les saints|Les sept saints|Les premiers martyrs)\b/.test(saint.name)
        ? 'Saint du jour'
        : 'Fête du jour';
  return RANKS[saint.rank] ? `${head} · ${RANKS[saint.rank]}` : head;
}
