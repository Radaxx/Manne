import { VERSES, type Verse } from './data/content';
import type { AdorationMode, AdorationSession } from './storage';

// L'adoration guidée : la suite des temps à vivre devant le Saint-Sacrement, selon que l'on choisit
// un parcours contemplatif (surtout du silence) ou guidé (la Parole, le merci, le pardon, l'intercession).
// La durée choisie est répartie entre les temps ; seuls les silences ont une minuterie, le reste va au
// rythme de la personne.

export type AdorationKind = 'presence' | 'adore' | 'ecoute' | 'parole' | 'merci' | 'pardon' | 'confie' | 'silence' | 'conclusion';

/** Ce que dit un silence : après la Parole, à l'ouverture, ou pour demeurer. */
export type SilenceTone = 'open' | 'word' | 'rest';

export type AdorationStep = {
  kind: AdorationKind;
  title: string;
  minutes: number; // durée suggérée
  tone?: SilenceTone;
};

export const DURATIONS = [15, 30, 45, 60];

export const MODES: { id: AdorationMode; name: string; hint: string; icon: 'moon-outline' | 'footsteps-outline' }[] = [
  { id: 'contemplative', name: 'Contemplatif', hint: 'Surtout du silence, avec quelques mots pour t’y poser.', icon: 'moon-outline' },
  { id: 'guided', name: 'Guidé', hint: 'Pas à pas : la Parole, le merci, le pardon, ceux que tu portes.', icon: 'footsteps-outline' },
];

const TITLES: Record<AdorationKind, string> = {
  presence: 'Se mettre en présence',
  adore: 'Adorer',
  ecoute: 'Écouter la Parole',
  parole: 'Un mot de la Parole',
  merci: 'Remercier',
  pardon: 'Demander pardon',
  confie: 'Confier',
  silence: 'Silence',
  conclusion: 'Rendre grâce',
};

/** Un silence ou un temps minuté : le seul où l'écran affiche une minuterie. */
export const isTimed = (kind: AdorationKind) => kind === 'silence' || kind === 'parole';

const step = (kind: AdorationKind, minutes: number, tone?: SilenceTone): AdorationStep => ({ kind, title: TITLES[kind], minutes, tone });

/** Les temps de l'adoration, avec leur durée suggérée ; le dernier silence absorbe l'arrondi. */
export function adorationSteps(mode: AdorationMode, minutes: number): AdorationStep[] {
  if (mode === 'contemplative') {
    const rest = Math.max(3, minutes - 5);
    const first = Math.round(rest * 0.4);
    const word = Math.min(10, Math.max(1, Math.round(rest * 0.25)));
    return [
      step('presence', 1),
      step('adore', 1),
      step('silence', first, 'open'),
      step('parole', word),
      step('silence', Math.max(1, rest - first - word), 'rest'),
      step('confie', 2),
      step('conclusion', 1),
    ];
  }
  const rest = Math.max(4, minutes - 4);
  const part = (share: number) => Math.max(1, Math.round(rest * share));
  const used = part(0.25) + part(0.15) + part(0.12) * 2 + part(0.16);
  return [
    step('presence', 1),
    step('adore', 2),
    step('ecoute', part(0.25)),
    step('silence', part(0.15), 'word'),
    step('merci', part(0.12)),
    step('pardon', part(0.12)),
    step('confie', part(0.16)),
    step('silence', Math.max(1, rest - used), 'rest'),
    step('conclusion', 1),
  ];
}

/** « Guidé · 30 min · étape 3 sur 9 » */
export function sessionLabel(s: AdorationSession) {
  const steps = adorationSteps(s.mode, s.minutes);
  const index = Math.min(s.step, steps.length - 1);
  return `${MODES.find((m) => m.id === s.mode)?.name} · ${s.minutes} min · ${steps[index].title.toLowerCase()} (${index + 1}/${steps.length})`;
}

// Des versets qui conviennent au silence : pas de consignes ni de promesses d'efficacité.
const WORD_THEMES = new Set(['Paix', 'Amour', 'Foi', 'Espoir', 'Gratitude', 'Pardon']);
const WORDS = VERSES.filter((v) => WORD_THEMES.has(v.theme));

/** Un verset par jour, le même toute la journée (on peut quitter et reprendre sans le perdre). */
export function wordOfTheDay(day: string): Verse {
  const n = Math.floor(Date.parse(day) / 86_400_000);
  return WORDS[((n % WORDS.length) + WORDS.length) % WORDS.length];
}
