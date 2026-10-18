// Préférences d'affichage : le thème de l'app, sa couleur d'accent, la matière du chapelet, le fond de la lecture.
// Le sombre actuel reste le point de départ ; « système » suit le téléphone.

import type { LiturgicalColor } from './liturgical-year';

export type SchemePreference = 'light' | 'dark' | 'system';
export type RosaryColorId = 'olive' | 'or' | 'rose' | 'nacre' | 'ebene' | 'lapis';
export type ReadingThemeId = 'livre' | 'nuit' | 'parchemin' | 'sepia' | 'aube' | 'encre';
/** L'accent suit la couleur liturgique du jour, ou reste doré. */
export type AccentPreference = 'liturgique' | 'or';

export type AppearanceSettings = {
  scheme: SchemePreference;
  accent: AccentPreference;
  rosary: RosaryColorId;
  reading: ReadingThemeId;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  scheme: 'dark',
  accent: 'liturgique',
  rosary: 'olive',
  reading: 'livre',
};

export const ACCENT_OPTIONS: { id: AccentPreference; label: string }[] = [
  { id: 'liturgique', label: 'Couleur liturgique' },
  { id: 'or', label: 'Doré' },
];

export const SCHEME_OPTIONS: { id: SchemePreference; label: string }[] = [
  { id: 'light', label: 'Clair' },
  { id: 'dark', label: 'Sombre' },
  { id: 'system', label: 'Système' },
];

export type Palette = {
  bg: string;
  card: string;
  cardHi: string;
  text: string;
  muted: string;
  faint: string;
  gold: string;
  /** Texte et icônes posés sur un fond doré. */
  onGold: string;
  red: string;
  line: string;
  /** Fond des barres de progression. */
  track: string;
  /** Fond d'un interrupteur éteint (opaque). */
  switchOff: string;
  /** Pastille d'un interrupteur. */
  switchThumb: string;
  /** Fond d'un passage mis en avant (verset cité, chapitre lu). */
  highlight: string;
  /** Carte translucide posée sur une scène (le chapelet 3D). */
  overlay: string;
  /** Ombre portée d'une bulle posée au-dessus de l'écran. */
  shadow: string;
  tabBar: string;
  tabInactive: string;
  /** Couleur du contenu de la barre de statut (clair sur fond sombre). */
  statusBar: 'light' | 'dark';
};

export const DARK: Palette = {
  bg: '#0d0e12',
  card: '#17191f',
  cardHi: '#1f222a',
  shadow: '#000000',
  text: '#ece8df',
  muted: 'rgba(236,232,223,0.6)',
  faint: 'rgba(236,232,223,0.35)',
  gold: '#ffd166',
  onGold: '#0d0e12',
  red: '#e07a6b',
  line: 'rgba(255,255,255,0.08)',
  track: 'rgba(255,255,255,0.08)',
  switchOff: '#3a3d47',
  switchThumb: '#ffffff',
  highlight: 'rgba(255,209,102,0.16)',
  overlay: 'rgba(23,25,31,0.92)',
  tabBar: '#08090c',
  tabInactive: 'rgba(255,255,255,0.5)',
  statusBar: 'light',
};

export const LIGHT: Palette = {
  bg: '#f7f3ea',
  card: '#fffdf8',
  cardHi: '#f0e9db',
  shadow: '#3b2a12',
  text: '#1c1915',
  muted: 'rgba(28,25,21,0.62)',
  faint: 'rgba(28,25,21,0.4)',
  gold: '#7a4f0e',
  onGold: '#fffaf3',
  red: '#b42318',
  line: 'rgba(28,25,21,0.1)',
  track: 'rgba(28,25,21,0.08)',
  switchOff: '#c4bba8',
  switchThumb: '#ffffff',
  highlight: 'rgba(122,79,14,0.12)',
  overlay: 'rgba(255,253,248,0.94)',
  tabBar: '#fffdf8',
  tabInactive: 'rgba(28,25,21,0.45)',
  statusBar: 'dark',
};

/**
 * L'accent aux couleurs du temps liturgique, à la place du doré : une teinte claire sur le thème sombre,
 * foncée sur le thème clair (contraste AA sur le fond et les cartes). Le blanc des fêtes garde le doré,
 * comme les ornements dorés de Noël et de Pâques.
 */
const LITURGICAL_ACCENTS: Partial<Record<LiturgicalColor, { dark: [string, string]; light: [string, string] }>> = {
  violet: { dark: ['#b9a0f0', 'rgba(185,160,240,0.16)'], light: ['#5e3399', 'rgba(94,51,153,0.12)'] },
  vert: { dark: ['#74cf95', 'rgba(116,207,149,0.16)'], light: ['#1e6b3c', 'rgba(30,107,60,0.12)'] },
  rouge: { dark: ['#f08a84', 'rgba(240,138,132,0.16)'], light: ['#a3202e', 'rgba(163,32,46,0.12)'] },
  rose: { dark: ['#f2a7c6', 'rgba(242,167,198,0.16)'], light: ['#a33a68', 'rgba(163,58,104,0.12)'] },
};

/** La palette du thème choisi ; `liturgical` (la couleur du jour) remplace l'accent doré quand c'est réglé ainsi. */
export function paletteFor(pref: SchemePreference, system: string | null | undefined, liturgical?: LiturgicalColor | null): Palette {
  const scheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
  const base = scheme === 'light' ? LIGHT : DARK;
  const accent = liturgical ? LITURGICAL_ACCENTS[liturgical]?.[scheme] : undefined;
  return accent ? { ...base, gold: accent[0], highlight: accent[1] } : base;
}

type Rgb = readonly [number, number, number];

/** Une matière de grains : le veinage 3D, et les deux teintes du chapelet dessiné. */
export type RosaryMaterial = {
  id: RosaryColorId;
  name: string;
  light: Rgb;
  mid: Rgb;
  shade: Rgb;
  vein: Rgb;
  bead: string;
  lit: string;
};

export const ROSARY_COLORS: RosaryMaterial[] = [
  {
    id: 'olive',
    name: 'Olivier',
    light: [222, 188, 132],
    mid: [188, 140, 82],
    shade: [156, 104, 56],
    vein: [58, 34, 19],
    bead: '#c4a46a',
    lit: '#ffd166',
  },
  {
    id: 'or',
    name: 'Or',
    light: [255, 230, 160],
    mid: [230, 180, 70],
    shade: [190, 140, 40],
    vein: [110, 72, 16],
    bead: '#e0b44a',
    lit: '#ffe7a8',
  },
  {
    id: 'rose',
    name: 'Bois de rose',
    light: [210, 140, 120],
    mid: [168, 90, 80],
    shade: [120, 56, 52],
    vein: [64, 28, 30],
    bead: '#a85c54',
    lit: '#f0c2b4',
  },
  {
    id: 'nacre',
    name: 'Nacre',
    light: [248, 244, 236],
    mid: [226, 220, 210],
    shade: [196, 188, 178],
    vein: [150, 142, 134],
    bead: '#e6dfd4',
    lit: '#fffaf3',
  },
  {
    id: 'ebene',
    name: 'Ébène',
    light: [90, 72, 60],
    mid: [48, 38, 32],
    shade: [28, 22, 20],
    vein: [10, 8, 8],
    bead: '#3a302a',
    lit: '#e6d3bc',
  },
  {
    id: 'lapis',
    name: 'Lapis',
    light: [90, 120, 190],
    mid: [46, 70, 140],
    shade: [28, 44, 100],
    vein: [16, 22, 48],
    bead: '#35548f',
    lit: '#d5e4ff',
  },
];

export function rosaryMaterial(id: RosaryColorId): RosaryMaterial {
  return ROSARY_COLORS.find((c) => c.id === id) ?? ROSARY_COLORS[0];
}

/** Le fond de la lecture suivie. « livre » garde le dégradé de chaque partie de la Bible. */
export type ReadingChrome = {
  id: ReadingThemeId;
  name: string;
  blurb: string;
  colors: [string, string, string] | null;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
  onAccent: string;
  scrim: [string, string, string];
  bar: string;
  barLine: string;
  selected: string;
  track: string;
  preview: [string, string];
  previewInk: string;
  /** Contenu de la barre de statut posée sur ce fond. */
  statusBar: 'light' | 'dark';
};

const NIGHT_INK = {
  ink: '#ffffff',
  muted: 'rgba(255,255,255,0.75)',
  faint: 'rgba(255,255,255,0.5)',
  accent: '#ffd166',
  onAccent: '#1a1306',
  scrim: ['rgba(6,7,10,0.98)', 'rgba(6,7,10,0.97)', 'rgba(6,7,10,0)'] as [string, string, string],
  bar: 'rgba(12,13,18,0.94)',
  barLine: 'rgba(255,255,255,0.18)',
  selected: 'rgba(255,209,102,0.2)',
  track: 'rgba(255,255,255,0.2)',
  previewInk: '#ffffff',
  statusBar: 'light' as const,
};

export const READING_THEMES: ReadingChrome[] = [
  {
    id: 'livre',
    name: 'Le livre',
    blurb: 'Une couleur par partie de la Bible',
    colors: null,
    preview: ['#1d3557', '#74471d'],
    ...NIGHT_INK,
  },
  {
    id: 'nuit',
    name: 'Nuit',
    blurb: 'Encre claire, fond noir',
    colors: ['#0c0d12', '#12141a', '#181b22'],
    preview: ['#0c0d12', '#181b22'],
    ...NIGHT_INK,
  },
  {
    id: 'parchemin',
    name: 'Parchemin',
    blurb: 'Papier chaud',
    colors: ['#f6ead0', '#edd9b0', '#e4c896'],
    ink: '#2a2116',
    muted: 'rgba(42,33,22,0.72)',
    faint: 'rgba(42,33,22,0.48)',
    accent: '#8a5a12',
    onAccent: '#fffaf2',
    scrim: ['rgba(246,234,208,0.98)', 'rgba(246,234,208,0.94)', 'rgba(246,234,208,0)'],
    bar: 'rgba(255,250,240,0.96)',
    barLine: 'rgba(42,33,22,0.12)',
    selected: 'rgba(138,90,18,0.16)',
    track: 'rgba(42,33,22,0.12)',
    preview: ['#f6ead0', '#e4c896'],
    previewInk: '#2a2116',
    statusBar: 'dark',
  },
  {
    id: 'sepia',
    name: 'Sépia',
    blurb: 'Brun doux',
    colors: ['#3a2a1c', '#5a4030', '#6e4e38'],
    ink: '#f6ead7',
    muted: 'rgba(246,234,215,0.75)',
    faint: 'rgba(246,234,215,0.5)',
    accent: '#e7c27a',
    onAccent: '#2a1c10',
    scrim: ['rgba(42,30,20,0.96)', 'rgba(42,30,20,0.9)', 'rgba(42,30,20,0)'],
    bar: 'rgba(42,30,20,0.94)',
    barLine: 'rgba(246,234,215,0.16)',
    selected: 'rgba(231,194,122,0.22)',
    track: 'rgba(246,234,215,0.2)',
    preview: ['#5a4030', '#3a2a1c'],
    previewInk: '#f6ead7',
    statusBar: 'light',
  },
  {
    id: 'aube',
    name: 'Aube',
    blurb: 'Clair, presque blanc',
    colors: ['#f7f4ee', '#efe8dc', '#e7dfd2'],
    ink: '#1e1a16',
    muted: 'rgba(30,26,22,0.68)',
    faint: 'rgba(30,26,22,0.45)',
    accent: '#8d6230',
    onAccent: '#fffaf5',
    scrim: ['rgba(247,244,238,0.98)', 'rgba(247,244,238,0.94)', 'rgba(247,244,238,0)'],
    bar: 'rgba(255,252,248,0.96)',
    barLine: 'rgba(30,26,22,0.1)',
    selected: 'rgba(141,98,48,0.14)',
    track: 'rgba(30,26,22,0.1)',
    preview: ['#f7f4ee', '#e7dfd2'],
    previewInk: '#1e1a16',
    statusBar: 'dark',
  },
  {
    id: 'encre',
    name: 'Encre',
    blurb: 'Bleu de nuit',
    colors: ['#101820', '#1a2836', '#243848'],
    ink: '#e7eef4',
    muted: 'rgba(231,238,244,0.72)',
    faint: 'rgba(231,238,244,0.48)',
    accent: '#9ec4e0',
    onAccent: '#101820',
    scrim: ['rgba(12,18,26,0.97)', 'rgba(12,18,26,0.92)', 'rgba(12,18,26,0)'],
    bar: 'rgba(12,18,26,0.94)',
    barLine: 'rgba(231,238,244,0.16)',
    selected: 'rgba(158,196,224,0.2)',
    track: 'rgba(231,238,244,0.18)',
    preview: ['#101820', '#243848'],
    previewInk: '#e7eef4',
    statusBar: 'light',
  },
];

/**
 * L'accent liturgique sur les fonds de lecture : une teinte pâle sur les fonds sombres et colorés (au moins
 * aussi lisible que le doré sur les dégradés du « livre »), foncée sur Parchemin et Aube. Le blanc garde le doré.
 */
const READING_ACCENTS: Partial<Record<LiturgicalColor, { night: string; day: string }>> = {
  violet: { night: '#e2d6fc', day: '#5e3399' },
  vert: { night: '#c2efd0', day: '#1e6b3c' },
  rouge: { night: '#fcd0cc', day: '#a3202e' },
  rose: { night: '#fbd9e8', day: '#a33a68' },
};

const rgba = (hex: string, alpha: number) => `rgba(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(',')},${alpha})`;

/** Le fond de lecture ; `liturgical` (la couleur du jour) remplace son accent quand l'accent liturgique est choisi. */
export function readingTheme(id: ReadingThemeId, liturgical?: LiturgicalColor | null): ReadingChrome {
  const base = READING_THEMES.find((t) => t.id === id) ?? READING_THEMES[0];
  const tint = liturgical ? READING_ACCENTS[liturgical] : undefined;
  if (!tint) return base;
  const night = base.statusBar === 'light';
  const accent = night ? tint.night : tint.day;
  return { ...base, accent, onAccent: night ? '#1a1306' : '#fffaf3', selected: rgba(accent, night ? 0.22 : 0.16) };
}

const SCHEMES: SchemePreference[] = ['light', 'dark', 'system'];
const ACCENTS: AccentPreference[] = ACCENT_OPTIONS.map((a) => a.id);
const ROSARY_IDS: RosaryColorId[] = ROSARY_COLORS.map((c) => c.id);
const READING_IDS: ReadingThemeId[] = READING_THEMES.map((t) => t.id);

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Remet des réglages lus du disque ou du cloud dans la forme actuelle. */
export function normalizeAppearance(raw: unknown): AppearanceSettings {
  const o = raw && typeof raw === 'object' ? (raw as Partial<AppearanceSettings>) : {};
  return {
    scheme: oneOf(o.scheme, SCHEMES, DEFAULT_APPEARANCE.scheme),
    accent: oneOf(o.accent, ACCENTS, DEFAULT_APPEARANCE.accent),
    rosary: oneOf(o.rosary, ROSARY_IDS, DEFAULT_APPEARANCE.rosary),
    reading: oneOf(o.reading, READING_IDS, DEFAULT_APPEARANCE.reading),
  };
}
