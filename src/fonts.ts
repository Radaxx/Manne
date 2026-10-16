// Les polices de l'app : Newsreader (serif : titres, Évangile, prières) et Figtree (texte courant).
// Sur téléphone, chaque graisse et chaque italique est une police à part : `fontWeight` et `fontStyle` ne suffisent pas.
// Le composant `Text` (src/text.tsx) choisit la bonne police d'après le style, comme le ferait un navigateur.

/** Le nom « logique » du serif, celui qu'on met dans `fontFamily` (voir `SERIF` dans cards.tsx). */
export const SERIF_FAMILY = 'Newsreader';

export type FontBase = 'serif' | 'sans';

/** Ce qu'on lit dans un style de texte pour choisir la police. */
export type FontStyleInput = { fontFamily?: string; fontWeight?: string | number; fontStyle?: string };

const SANS_WEIGHTS = [
  [800, 'Figtree_800ExtraBold'],
  [700, 'Figtree_700Bold'],
  [600, 'Figtree_600SemiBold'],
  [500, 'Figtree_500Medium'],
  [0, 'Figtree_400Regular'],
] as const;

const weightOf = (w: FontStyleInput['fontWeight']): number => {
  if (w === undefined || w === 'normal') return 400;
  if (w === 'bold') return 700;
  const n = Number(w);
  return Number.isFinite(n) && n > 0 ? n : 400;
};

/** Le nom de la police pour une famille, une graisse et un italique. */
export function fontFace(base: FontBase, weight: FontStyleInput['fontWeight'], italic: boolean): string {
  const w = weightOf(weight);
  if (base === 'serif') return `Newsreader_${w >= 600 ? '700Bold' : '400Regular'}${italic ? '_Italic' : ''}`;
  if (italic) return w >= 600 ? 'Figtree_700Bold_Italic' : 'Figtree_400Regular_Italic';
  return (SANS_WEIGHTS.find(([min]) => w >= min) ?? SANS_WEIGHTS[SANS_WEIGHTS.length - 1])[1];
}

/**
 * La police d'un texte d'après son style : `null` s'il faut la laisser telle quelle (une autre police est demandée, ou
 * c'est un texte emboîté qui ne dit rien de sa police et hérite donc de celle du parent).
 * `inherited` : la famille du texte parent, `null` hors d'un texte.
 */
export function resolveText(style: FontStyleInput | undefined, inherited: FontBase | null): { base: FontBase; face: string } | null {
  const flat = style ?? {};
  const hasFamilyKey = 'fontFamily' in flat;
  const hasFace = hasFamilyKey || flat.fontWeight !== undefined || flat.fontStyle !== undefined;
  if (inherited && !hasFace) return null;
  let base: FontBase;
  if (flat.fontFamily === SERIF_FAMILY) base = 'serif';
  // `fontFamily: undefined` écrit exprès : on revient au texte courant, même dans un texte serif.
  else if (flat.fontFamily === undefined) base = hasFamilyKey ? 'sans' : (inherited ?? 'sans');
  else return null;
  return { base, face: fontFace(base, flat.fontWeight, flat.fontStyle === 'italic') };
}
