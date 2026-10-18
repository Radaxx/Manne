import AsyncStorage from '@react-native-async-storage/async-storage';

// La visite de bienvenue ne s'affiche qu'une fois par téléphone. Le drapeau reste sur l'appareil, dans sa propre clé et hors de
// la progression : il n'est pas synchronisé.

const KEY = 'manne/tour/v1';

/** Vrai si la visite a déjà été montrée. Une lecture qui échoue compte comme « vue » : mieux vaut ne rien montrer que harceler. */
export async function tourSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) !== null;
  } catch {
    return true;
  }
}

/** Note la visite comme vue. Une écriture qui échoue est ignorée. */
export async function markTourSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {}
}
