import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthProvider';
import type { LinkBranch } from './errors';
import { deleteAccount, linkApple, linkGoogle, sendEmail, signOut, verifyCode } from './providers';

/** `link` : l'e-mail est parti ; `branch` dit si l'adresse est nouvelle ou déjà un compte, pour valider le bon code. */
export type AccountPhase = { kind: 'ready' } | { kind: 'link'; email: string; branch: LinkBranch };

/** Ce que l'écran fournit pour se déconnecter sans rien perdre ni rien laisser sur l'appareil. */
export type SignOutHooks = {
  /** Envoie une dernière fois la progression ; faux si le cloud ne l'a pas reçue. */
  flush: () => Promise<boolean>;
  /** Efface de l'appareil le chemin du compte quitté. */
  reset: () => void;
};

/** Session affichée sur le compte (lue dans AuthProvider), avec l'état de l'action en cours. */
export function useAccount() {
  const { configured, status, email } = useAuth();
  const [phase, setPhase] = useState<AccountPhase>({ kind: 'ready' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Connecté : le lien ou le code a abouti, plus rien n'est en attente.
  useEffect(() => {
    if (status === 'signedIn') setPhase({ kind: 'ready' });
  }, [status]);

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
    anonymous: status !== 'signedIn',
    email,
    phase,
    error,
    busy,
    apple: Platform.OS === 'ios',
    sendEmail: (value: string) =>
      run(async () => {
        const sent = await sendEmail(value.trim());
        if (sent.error || !sent.branch) return { error: sent.error ?? 'L’envoi a échoué.' };
        setPhase({ kind: 'link', email: value.trim(), branch: sent.branch });
        return { error: null };
      }),
    verifyCode: (code: string) =>
      run(async () => {
        if (phase.kind !== 'link') return { error: null };
        return verifyCode(phase.email, code, phase.branch);
      }),
    /** Revient à la saisie de l'adresse. */
    changeEmail: () => {
      setError(null);
      setPhase({ kind: 'ready' });
    },
    linkApple: () => run(() => linkApple()),
    linkGoogle: () => run(() => linkGoogle()),
    signOut: (hooks: SignOutHooks) =>
      run(async () => {
        if (!(await hooks.flush())) return { error: 'Ton chemin n’a pas pu être enregistré. Réessaie avec du réseau.' };
        await signOut(hooks.reset);
        setPhase({ kind: 'ready' });
        return { error: null };
      }),
    deleteAccount: (reset: () => void) =>
      run(async () => {
        const result = await deleteAccount(reset);
        if (!result.error) setPhase({ kind: 'ready' });
        return result;
      }),
  };
}
