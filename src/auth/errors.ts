// Fonctions pures de l'authentification : aucun import natif, pour pouvoir les tester telles quelles.

export type AuthErrorLike = { code?: string; message?: string; status?: number } | null;

/** `new` : l'adresse est libre et se relie à l'anonyme. `existing` : elle a déjà un compte, on s'y connecte. */
export type LinkBranch = 'new' | 'existing';

export const MAIL_LIMIT =
  'Trop d’e-mails envoyés pour le moment. Le code ou le lien déjà reçu reste valable ; sinon réessaie un peu plus tard.';

/** Après une limite d'envoi, on n'insiste pas avant ce délai. */
export const MAIL_BLOCK_MS = 10 * 60 * 1000;

export function limited(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === 'over_email_send_rate_limit' || /rate limit/i.test(error.message ?? '');
}

export function userGone(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === 'user_not_found' || /does not exist/i.test(error.message ?? '');
}

export function taken(error: AuthErrorLike): boolean {
  return error?.code === 'identity_already_exists' || error?.code === 'email_exists' || error?.code === 'user_already_exists';
}

export function isAppleCancel(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

/** L'utilisateur de la session locale n'existe plus côté serveur. */
export function missingUser(error: AuthErrorLike): boolean {
  if (!error) return false;
  return error.code === 'user_not_found' || error.status === 404 || /does not exist/i.test(error.message ?? '');
}

/** Lit les paramètres d'un lien de retour, qu'ils soient dans la requête, dans le fragment ou dans les deux. */
export function readParams(url: string): Record<string, string> {
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

/** Les messages du serveur ('nonce', 'auth') ne sont pas faits pour l'écran. */
export function adoptionMessage(message: string): string {
  if (message.includes('nonce'))
    return 'Te voilà connecté, mais ce que tu avais fait avant n’a pas pu être repris : le lien est trop ancien.';
  if (message.includes('auth')) return 'La session a expiré. Réessaie.';
  return message;
}

/** Le type attendu par verifyOtp : le code d'une adresse reliée n'est pas celui d'une connexion. */
export function otpType(branch: LinkBranch): 'email_change' | 'email' {
  return branch === 'new' ? 'email_change' : 'email';
}

/** Supabase règle la longueur du code entre 6 et 10 chiffres selon le projet : on accepte toute la plage. */
export const CODE_MAX = 10;

/** Les chiffres du code, sans les espaces que le clavier ou le collage peuvent ajouter. Null si ce n'est pas un code. */
export function cleanCode(input: string): string | null {
  const code = input.replace(/\s/g, '');
  return /^\d{6,10}$/.test(code) ? code : null;
}

/** Message d'un code refusé par verifyOtp. */
export function otpMessage(error: AuthErrorLike): string {
  if (!error) return '';
  if (error.code === 'otp_expired' || /expired|invalid/i.test(error.message ?? ''))
    return 'Ce code est faux ou expiré. Vérifie-le, ou demande un nouvel e-mail avec « Changer d’adresse ».';
  if (limited(error) || error.code === 'over_request_rate_limit') return 'Trop d’essais. Réessaie dans un instant.';
  return 'Le code n’a pas pu être vérifié. Réessaie dans un instant.';
}

/** Message d'une connexion par mot de passe refusée (l'accès relecteur). */
export function passwordMessage(error: AuthErrorLike): string {
  if (!error) return '';
  if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message ?? '')) return 'Adresse ou mot de passe incorrect.';
  if (limited(error) || error.code === 'over_request_rate_limit') return 'Trop d’essais. Réessaie dans un instant.';
  return 'La connexion a échoué. Réessaie dans un instant.';
}
