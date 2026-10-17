import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import { flushLikes, resetCommunity } from '../community';
import { forgetPushToken, unregisterPushToken } from '../push';
import { supabase } from '../supabase';
import { adopt, adoptPending, clearNonce, depositNonce, finishRedirect, REDIRECT, rememberNonce } from './adoption';
import {
  cleanCode,
  isAppleCancel,
  type LinkBranch,
  limited,
  MAIL_BLOCK_MS,
  MAIL_LIMIT,
  otpMessage,
  otpType,
  passwordMessage,
  readParams,
  taken,
  userGone,
} from './errors';
import { ensureSession } from './session';

WebBrowser.maybeCompleteAuthSession();

type Result = { error: string | null };

/** Après une limite d'envoi, on laisse passer un moment avant de réessayer. */
let mailBlockedUntil = 0;

function blockMail(): { error: string } {
  mailBlockedUntil = Date.now() + MAIL_BLOCK_MS;
  return { error: MAIL_LIMIT };
}

/** Envoie le lien et le code. `branch` dit lequel des deux parcours a été pris, pour valider le bon code ensuite. */
export async function sendEmail(email: string): Promise<{ error: string | null; branch?: LinkBranch }> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  if (!email.includes('@')) return { error: 'Cette adresse ne convient pas.' };
  if (Date.now() < mailBlockedUntil) return { error: MAIL_LIMIT };
  if (!(await ensureSession())) return { error: 'La session n’a pas pu être ouverte. Réessaie.' };
  let { error } = await client.auth.updateUser({ email }, { emailRedirectTo: REDIRECT });
  if (error && userGone(error)) {
    await client.auth.signOut({ scope: 'local' });
    if (!(await ensureSession())) return { error: 'La session n’a pas pu être ouverte. Réessaie.' };
    ({ error } = await client.auth.updateUser({ email }, { emailRedirectTo: REDIRECT }));
  }
  if (limited(error)) return blockMail();
  if (!error) {
    // Ce lien-ci n'adopte rien : un nonce resté d'un essai précédent ne doit pas s'y accrocher.
    await clearNonce();
    return { error: null, branch: 'new' };
  }
  if (error.code === 'email_exists' || error.code === 'user_already_exists') {
    const nonce = await depositNonce();
    if (!nonce) return { error: 'Impossible de préparer la connexion.' };
    await rememberNonce(nonce);
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: REDIRECT },
    });
    if (limited(otpError)) return blockMail();
    if (otpError) {
      await clearNonce();
      return { error: otpError.message };
    }
    return { error: null, branch: 'existing' };
  }
  return { error: error.message ?? 'L’envoi a échoué.' };
}

/**
 * Valide le code reçu par e-mail, comme le ferait le lien. Branche `existing` : on est maintenant connecté
 * au compte, et ce que l'anonyme avait fait est repris avec le nonce en attente.
 */
export async function verifyCode(email: string, input: string, branch: LinkBranch): Promise<Result> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  const token = cleanCode(input);
  if (!token) return { error: 'Recopie le code reçu par e-mail en entier.' };
  const { error } = await client.auth.verifyOtp({ email, token, type: otpType(branch) });
  if (error) return { error: otpMessage(error) };
  if (branch === 'new') return { error: null };
  return { error: await adoptPending() };
}

/**
 * Accès relecteur : connexion par adresse et mot de passe, pour le compte de démonstration que Google Play
 * teste (un code reçu par e-mail ne peut pas lui être donné). Reprend ce que l'anonyme avait fait, comme Google.
 */
export async function signInWithPassword(email: string, password: string): Promise<Result> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  if (!email.includes('@') || !password) return { error: 'Saisis l’adresse et le mot de passe.' };
  const nonce = await depositNonce();
  if (!nonce) return { error: 'Impossible de préparer la connexion.' };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { error: passwordMessage(error) };
  return { error: await adopt(client, nonce) };
}

export async function linkApple(): Promise<{ error: string | null; name?: string | null }> {
  const client = supabase;
  if (!client || Platform.OS !== 'ios') return { error: null };
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) return { error: 'Apple n’est pas disponible sur cet appareil.' };
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (error) {
    if (isAppleCancel(error)) return { error: null };
    return { error: 'Apple a interrompu la connexion.' };
  }
  if (!credential.identityToken) return { error: 'Apple n’a pas renvoyé de jeton.' };
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  const linked = await client.auth.linkIdentity({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (!linked.error) return { error: null, name: name || null };
  if (!taken(linked.error)) return { error: linked.error.message };
  const nonce = await depositNonce();
  if (!nonce) return { error: 'Impossible de rattacher ce compte Apple.' };
  const signed = await client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (signed.error) return { error: signed.error.message };
  return { error: await adopt(client, nonce), name: name || null };
}

// La connexion Google se termine DANS l'app (openAuthSessionAsync), mais sur Android le retour manne://auth/callback
// arrive aussi au routeur, qui ouvre l'écran auth/callback. Cet écran ne doit ni échanger le code une seconde fois
// (le premier échange consomme le secret PKCE : le second échouerait), ni envoyer ailleurs : il attend la connexion
// en cours, puis revient là où l'on était.
let googleFlow: Promise<Result> | null = null;
/** Codes de retour Google déjà traités par l'app : l'écran auth/callback les ignore s'il s'ouvre après coup. */
const handledCodes = new Set<string>();

/** La connexion Google en cours, s'il y en a une. */
export function googleFlowInProgress(): Promise<Result> | null {
  return googleFlow;
}

/** Vrai si ce lien de retour a déjà été traité par la connexion Google de l'app. */
export function handledInApp(url: string): boolean {
  const code = readParams(url).code;
  return typeof code === 'string' && handledCodes.has(code);
}

function remember(url: string) {
  const code = readParams(url).code;
  if (typeof code === 'string') handledCodes.add(code);
}

/**
 * Ouvre la page Google et rend l'adresse de retour, ou null si on a fermé la page. Sur Android, la session peut se
 * terminer sur « dismiss » alors que le retour est bien arrivé à l'app : on le récupère alors par Linking.
 */
async function openGoogle(url: string): Promise<{ url: string } | { closed: true } | { failed: true }> {
  let received: string | null = null;
  const sub = Linking.addEventListener('url', (event) => {
    if (event.url.startsWith(REDIRECT)) {
      received = event.url;
      remember(event.url);
    }
  });
  try {
    const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT);
    if (result.type === 'success') {
      remember(result.url);
      return { url: result.url };
    }
    if (received) return { url: received };
    return result.type === 'cancel' || result.type === 'dismiss' ? { closed: true } : { failed: true };
  } finally {
    sub.remove();
  }
}

function track(run: () => Promise<Result>): Promise<Result> {
  const task = run();
  googleFlow = task;
  return task.finally(() => {
    if (googleFlow === task) googleFlow = null;
  });
}

export function linkGoogle(): Promise<Result> {
  return track(async () => {
    const client = supabase;
    if (!client) return { error: 'Supabase n’est pas configuré.' };
    const { data, error } = await client.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { error: error?.message ?? 'Google est indisponible.' };
    const opened = await openGoogle(data.url);
    if ('closed' in opened) return { error: null };
    if ('failed' in opened) return { error: 'La connexion Google a été interrompue.' };
    const outcome = await finishRedirect(opened.url);
    if (outcome === 'linked') return { error: null };
    if (outcome === 'exists') return signInGoogle();
    return { error: outcome };
  });
}

async function signInGoogle(): Promise<Result> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  const nonce = await depositNonce();
  if (!nonce) return { error: 'Impossible de préparer la connexion.' };
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error?.message ?? 'Google est indisponible.' };
  const opened = await openGoogle(data.url);
  if ('closed' in opened) return { error: null };
  if ('failed' in opened) return { error: 'La connexion Google a été interrompue.' };
  const outcome = await finishRedirect(opened.url);
  if (outcome !== 'linked') return { error: outcome === 'exists' ? 'Ce compte Google est déjà utilisé.' : outcome };
  return { error: await adopt(client, nonce) };
}

/** Efface ce qui appartenait au compte quitté, puis ouvre la nouvelle session anonyme. */
async function startOver(reset: () => void) {
  await resetCommunity().catch(() => {});
  reset();
  // Laisse l'état effacé arriver jusqu'à la synchro avant que la nouvelle session ne la déclenche.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await ensureSession();
}

/**
 * Ferme la session de ce téléphone seulement : les autres appareils du compte restent connectés. Le chemin
 * local est effacé avant la nouvelle session anonyme, pour qu'elle ne l'emporte pas avec elle.
 */
export async function signOut(reset: () => void) {
  const client = supabase;
  if (!client) return;
  // Les j'aime en attente partent encore sous le compte ; ceux qui ne passent pas sont abandonnés.
  await flushLikes().catch(() => {});
  // Le jeton de notification de ce téléphone quitte le compte tant que la session existe encore.
  await unregisterPushToken().catch(() => {});
  await client.auth.signOut({ scope: 'local' });
  await startOver(reset);
}

/**
 * Supprime le compte côté serveur (progression, j'aime, échos, intentions), puis agit comme une déconnexion.
 * Rien n'est envoyé avant : ce serait écrire pour un compte qui n'existe plus.
 */
export async function deleteAccount(reset: () => void): Promise<Result> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  if (!(await ensureSession())) return { error: 'La session n’a pas pu être ouverte. Réessaie.' };
  const { error } = await client.rpc('delete_my_account');
  if (error) {
    if (error.message.includes('auth')) return { error: 'La session a expiré. Réessaie.' };
    return { error: 'Ton compte n’a pas pu être supprimé. Réessaie avec du réseau.' };
  }
  await clearNonce();
  // Le serveur a déjà effacé les jetons du compte avec lui ; il reste à oublier celui que l'app garde en mémoire.
  forgetPushToken();
  await client.auth.signOut({ scope: 'local' });
  await startOver(reset);
  return { error: null };
}
