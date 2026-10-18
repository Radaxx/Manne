import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * À qui appartient la progression gardée sur ce téléphone. Sert à ne jamais envoyer le chemin d'un compte relié dans
 * un autre compte (ni dans une session anonyme neuve) quand la session disparaît sans passer par « Se déconnecter ».
 */
export type Owner = { userId: string; linked: boolean };

const OWNER_KEY = 'manne/progress-owner/v1';

/**
 * Faut-il effacer la progression locale ? Seulement quand elle appartenait à un compte relié et que la session
 * courante est celle de quelqu'un d'autre. Un anonyme qui se relie (même utilisateur) ou qui se connecte à un compte
 * existant (reprise) garde ce qu'il a fait. `next` est le propriétaire à enregistrer ensuite.
 */
export function ownerDecision(stored: Owner | null, current: Owner): { reset: boolean; next: Owner } {
  const reset = !!stored?.linked && stored.userId !== current.userId;
  return { reset, next: { userId: current.userId, linked: current.linked } };
}

export function readOwner(raw: unknown): Owner | null {
  if (!raw || typeof raw !== 'object') return null;
  const { userId, linked } = raw as Record<string, unknown>;
  return typeof userId === 'string' && userId && typeof linked === 'boolean' ? { userId, linked } : null;
}

export async function loadOwner(): Promise<Owner | null> {
  try {
    const raw = await AsyncStorage.getItem(OWNER_KEY);
    return raw ? readOwner(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveOwner(owner: Owner): Promise<void> {
  await AsyncStorage.setItem(OWNER_KEY, JSON.stringify(owner)).catch(() => {});
}

/** Déconnexion ou suppression : la progression locale vient d'être effacée, elle n'appartient plus à personne. */
export async function clearOwner(): Promise<void> {
  await AsyncStorage.removeItem(OWNER_KEY).catch(() => {});
}
