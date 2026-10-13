import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { currentUserId, ensureSession, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

/** Doit être identique à l'adresse enregistrée dans Supabase. */
const REDIRECT = 'manne://auth/callback';

export type AccountPhase = { kind: 'ready' } | { kind: 'link'; email: string };

const NONCE_KEY = 'manne/auth/pending-nonce';

/**
 * Le nonce déposé vaut aussi longtemps que le lien du mail (une heure par défaut chez Supabase). Plus court,
 * le lien marcherait mais ce que l'anonyme avait fait ne pourrait plus être repris.
 */
const NONCE_TTL = 60 * 60 * 1000;
let pendingNonce: string | null = null;

/** Ce que l'écran fournit pour se déconnecter sans rien perdre ni rien laisser sur l'appareil. */
export type SignOutHooks = {
  /** Envoie une dernière fois la progression ; faux si le cloud ne l'a pas reçue. */
  flush: () => Promise<boolean>;
  /** Efface de l'appareil le chemin du compte quitté. */
  reset: () => void;
};

type AuthErrorLike = { code?: string; message?: string } | null;

/** Session affichée sur le compte. `configured` est faux tant que Supabase n'est pas branché. */
export function useAccount() {
  const configured = supabase != null;
  const [anonymous, setAnonymous] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [phase, setPhase] = useState<AccountPhase>({ kind: 'ready' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let alive = true;
    void client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      applySession(data.session?.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
      if (session?.user?.is_anonymous === false) setPhase({ kind: 'ready' });
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };

    function applySession(user: { is_anonymous?: boolean; email?: string | null } | null) {
      setAnonymous(user?.is_anonymous !== false);
      setEmail(user?.email ?? null);
    }
  }, []);

  const run = async (body: () => Promise<{ error: string | null; name?: string | null }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await body();
      if (result.error) setError(result.error);
      return result.name ?? null;
    } catch {
      setError('La connexion a échoué. Réessaie dans un instant.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    configured,
    anonymous,
    email,
    phase,
    error,
    busy,
    apple: Platform.OS === 'ios',
    sendEmail: (value: string) =>
      run(async () => {
        const sent = await sendEmail(value.trim());
        if (sent.error) return sent;
        setPhase({ kind: 'link', email: value.trim() });
        return { error: null };
      }),
    linkApple: () => run(() => linkApple()),
    linkGoogle: () => run(() => linkGoogle()),
    signOut: (hooks: SignOutHooks) =>
      run(async () => {
        if (!(await hooks.flush())) return { error: 'Ton chemin n’a pas pu être enregistré. Réessaie avec du réseau.' };
        await signOut(hooks.reset);
        setPhase({ kind: 'ready' });
        return { error: null };
      }),
  };
}

/** Le service d'e-mail intégré de Supabase n'en envoie que deux par heure pour tout le projet. */
let mailBlockedUntil = 0;

async function sendEmail(email: string): Promise<{ error: string | null }> {
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
    return { error: null };
  }
  if (error.code === 'email_exists' || error.code === 'user_already_exists') {
    const nonce = await depositNonce();
    if (!nonce) return { error: 'Impossible de préparer la connexion.' };
    pendingNonce = nonce;
    await AsyncStorage.setItem(NONCE_KEY, nonce);
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: REDIRECT },
    });
    if (limited(otpError)) return blockMail();
    if (otpError) {
      await clearNonce();
      return { error: otpError.message };
    }
    return { error: null };
  }
  return { error: error.message ?? 'L’envoi a échoué.' };
}

const MAIL_LIMIT =
  'Supabase n’envoie que deux e-mails par heure. Le lien déjà reçu reste valable. Sinon, réessaie dans une heure, ou ajoute un serveur SMTP dans le projet.';

function limited(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === 'over_email_send_rate_limit' || /rate limit/i.test(error.message ?? '');
}

function blockMail(): { error: string } {
  mailBlockedUntil = Date.now() + 60 * 60 * 1000;
  return { error: MAIL_LIMIT };
}

async function clearNonce() {
  pendingNonce = null;
  await AsyncStorage.removeItem(NONCE_KEY);
}

/** Reprend ce que l'anonyme avait fait. Les messages du serveur ('nonce', 'auth') ne sont pas faits pour l'écran. */
async function adopt(client: SupabaseClient, nonce: string): Promise<string | null> {
  const { error } = await client.rpc('adopt_account', { p_nonce: nonce });
  if (!error) return null;
  if (error.message.includes('nonce'))
    return 'Te voilà connecté, mais ce que tu avais fait avant n’a pas pu être repris : le lien est trop ancien.';
  if (error.message.includes('auth')) return 'La session a expiré. Réessaie.';
  return error.message;
}

const openingUrls = new Map<string, Promise<string | null>>();

/** Termine la connexion quand on ouvre le lien reçu par e-mail. */
export function openAuthUrl(url: string): Promise<string | null> {
  const existing = openingUrls.get(url);
  if (existing) return existing;
  const task = finishEmailLink(url).then((error) => {
    if (error) openingUrls.delete(url);
    return error;
  });
  openingUrls.set(url, task);
  return task;
}

async function finishEmailLink(url: string): Promise<string | null> {
  const outcome = await finishRedirect(url);
  if (outcome !== 'linked') return outcome === 'exists' ? 'Ce lien ne correspond pas à une connexion.' : outcome;
  const nonce = pendingNonce ?? (await AsyncStorage.getItem(NONCE_KEY));
  await clearNonce();
  if (!nonce || !supabase) return null;
  return adopt(supabase, nonce);
}

async function linkApple(): Promise<{ error: string | null; name?: string | null }> {
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

async function linkGoogle(): Promise<{ error: string | null }> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  const { data, error } = await client.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error?.message ?? 'Google est indisponible.' };
  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
  if (result.type === 'cancel' || result.type === 'dismiss') return { error: null };
  if (result.type !== 'success') return { error: 'La connexion Google a été interrompue.' };
  const outcome = await finishRedirect(result.url);
  if (outcome === 'linked') return { error: null };
  if (outcome === 'exists') return signInGoogle();
  return { error: outcome };
}

async function signInGoogle(): Promise<{ error: string | null }> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.' };
  const nonce = await depositNonce();
  if (!nonce) return { error: 'Impossible de préparer la connexion.' };
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error?.message ?? 'Google est indisponible.' };
  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
  if (result.type !== 'success') return { error: result.type === 'cancel' ? null : 'La connexion Google a été interrompue.' };
  const outcome = await finishRedirect(result.url);
  if (outcome !== 'linked') return { error: outcome === 'exists' ? 'Ce compte Google est déjà utilisé.' : outcome };
  return { error: await adopt(client, nonce) };
}

/**
 * `linked` si la session est en place, `exists` si l'identité appartient déjà à quelqu'un.
 * Seul un code est accepté : il ne s'échange que contre le secret PKCE gardé par ce téléphone. Un lien
 * porteur de jetons (access_token) ou d'un token_hash ouvrirait la session de qui l'a forgé.
 */
async function finishRedirect(url: string): Promise<'linked' | 'exists' | string> {
  const client = supabase;
  if (!client) return 'Supabase n’est pas configuré.';
  const params = readParams(url);
  const code = String(params.error_code ?? '');
  if (code === 'identity_already_exists' || code === 'email_exists') return 'exists';
  if (params.error_description) return String(params.error_description);
  if (typeof params.code === 'string') {
    const flowId = params.sb_flow_id;
    const { error } = await client.auth.exchangeCodeForSession(params.code, flowId ? { flowId } : undefined);
    return error ? error.message : 'linked';
  }
  return 'Ce lien ne correspond à aucune connexion démarrée depuis ce téléphone.';
}

function readParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const write = (query: string) => {
    for (const part of query.split('&')) {
      if (!part) continue;
      const [key, value = ''] = part.split('=');
      out[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  };
  const [before, hash] = url.split('#');
  const query = before.split('?')[1];
  if (query) write(query);
  if (hash) write(hash);
  return out;
}

async function depositNonce(): Promise<string | null> {
  const client = supabase;
  if (!client) return null;
  const fromUser = await currentUserId();
  if (!fromUser) return null;
  const nonce = Crypto.randomUUID();
  const { error } = await client.from('account_adoptions').insert({
    nonce,
    from_user: fromUser,
    expires_at: new Date(Date.now() + NONCE_TTL).toISOString(),
  });
  return error ? null : nonce;
}

/**
 * Ferme la session de ce téléphone seulement : les autres appareils du compte restent connectés. Le chemin
 * local est effacé avant la nouvelle session anonyme, pour qu'elle ne l'emporte pas avec elle.
 */
async function signOut(reset: () => void) {
  const client = supabase;
  if (!client) return;
  await client.auth.signOut({ scope: 'local' });
  reset();
  // Laisse l'état effacé arriver jusqu'à la synchro avant que la nouvelle session ne la déclenche.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await ensureSession();
}

function userGone(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === 'user_not_found' || /does not exist/i.test(error.message ?? '');
}

function taken(error: AuthErrorLike): boolean {
  return error?.code === 'identity_already_exists' || error?.code === 'email_exists' || error?.code === 'user_already_exists';
}

function isAppleCancel(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}
