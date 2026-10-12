import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

// Verrouillage biométrique (empreinte, Face ID) des espaces privés, avec repli sur le code du téléphone.

export const lockSupported = Platform.OS !== 'web';

export const biometricName = Platform.OS === 'ios' ? 'Face ID' : 'empreinte ou visage';

/** Ce que le téléphone permet : biométrie, code seul, ou rien du tout (aucun verrouillage configuré). */
export async function lockAvailability(): Promise<'biometric' | 'passcode' | 'none'> {
  if (!lockSupported) return 'none';
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) return 'none';
  if (level === LocalAuthentication.SecurityLevel.SECRET) return 'passcode';
  return 'biometric';
}

/** Demande l'empreinte (ou le code) ; renvoie true si l'utilisateur est bien le propriétaire. */
export async function authenticate(reason: string): Promise<boolean> {
  if (!lockSupported) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Annuler',
    fallbackLabel: 'Utiliser le code',
  });
  return result.success;
}
