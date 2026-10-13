import AsyncStorage from '@react-native-async-storage/async-storage';
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
    signOut: () =>
      run(async () => {
        await signOut();
        setPhase({ kind: 'ready' });
        return { error: null };
      }),
  };
}

async function sendEmail(email: string): Promise<{ error: string | null; existing: boolean }> {
  const client = supabase;
  if (!client) return { error: 'Supabase n’est pas configuré.', existing: false };
  if (!email.includes('@')) return { error: 'Cette adresse ne convient pas.', existing: false };
  if (!(await ensureSession())) return { error: 'La session n’a pas pu être ouverte. Réessaie.', existing: false };
  let { error } = await client.auth.updateUser({ email }, { emailRedirectTo: REDIRECT });
  if (error && userGone(error)) {
    await client.auth.signOut({ scope: 'local' });
    if (!(await ensureSession())) return { error: 'La session n’a pas pu être ouverte. Réessaie.', existing: false };
    ({ error } = await client.auth.updateUser({ email }, { emailRedirectTo: REDIRECT }));
  }
  if (!error) return { error: null, existing: false };
  if (error.code === 'email_exists' || error.code === 'user_already_exists') {
    const nonce = await depositNonce();
    if (!nonce) return { error: 'Impossible de préparer la connexion.', existing: true };
    pendingNonce = nonce;
    await AsyncStorage.setItem(NONCE_KEY, nonce);
    const { error: otpError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: REDIRECT },
    });
    if (otpError) return { error: otpError.message, existing: true };
    return { error: null, existing: true };
  }
  return { error: error.message, existing: false };
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
  pendingNonce = null;
  await AsyncStorage.removeItem(NONCE_KEY);
  if (!nonce || !supabase) return null;
  const { error } = await supabase.rpc('adopt_account', { p_nonce: nonce });
  return error?.message ?? null;
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
  const { error } = await client.rpc('adopt_account', { p_nonce: nonce });
  return { error: error?.message ?? null, name: name || null };
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
  const { error: adoptError } = await client.rpc('adopt_account', { p_nonce: nonce });
  return { error: adoptError?.message ?? null };
}

/** `linked` si la session est en place, `exists` si l'identité appartient déjà à quelqu'un. */
async function finishRedirect(url: string): Promise<'linked' | 'exists' | string> {
  const client = supabase;
  if (!client) return 'Supabase n’est pas configuré.';
  const params = readParams(url);
  const code = String(params.error_code ?? '');
  if (code === 'identity_already_exists' || code === 'email_exists') return 'exists';
  if (params.error_description) return String(params.error_description);
  if (typeof params.token_hash === 'string' && typeof params.type === 'string') {
    const { error } = await client.auth.verifyOtp({ token_hash: params.token_hash, type: params.type as 'email_change' });
    return error ? error.message : 'linked';
  }
  if (typeof params.code === 'string') {
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    return error ? error.message : 'linked';
  }
  if (typeof params.access_token === 'string' && typeof params.refresh_token === 'string') {
    const { error } = await client.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    return error ? error.message : 'linked';
  }
  return 'La redirection n’a pas renvoyé de session.';
}

let pendingNonce: string | null = null;

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
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  return error ? null : nonce;
}

async function signOut() {
  const client = supabase;
  if (!client) return;
  await client.auth.signOut();
  await client.auth.signInAnonymously();
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
