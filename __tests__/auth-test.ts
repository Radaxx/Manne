import {
  adoptionMessage,
  cleanCode,
  isAppleCancel,
  limited,
  MAIL_BLOCK_MS,
  missingUser,
  otpMessage,
  otpType,
  passwordMessage,
  readParams,
  taken,
  userGone,
} from '../src/auth/errors';

describe('readParams', () => {
  it('lit la requête', () => {
    expect(readParams('manne://auth/callback?code=abc&sb_flow_id=f1')).toEqual({ code: 'abc', sb_flow_id: 'f1' });
  });

  it('lit le fragment', () => {
    expect(readParams('manne://auth/callback#access_token=t&type=magiclink')).toEqual({ access_token: 't', type: 'magiclink' });
  });

  it('lit la requête et le fragment ensemble', () => {
    expect(readParams('manne://auth/callback?code=abc#error_code=email_exists')).toEqual({ code: 'abc', error_code: 'email_exists' });
  });

  it('traduit + en espace et décode les pourcentages', () => {
    const params = readParams('manne://auth/callback?error_description=Email+d%C3%A9j%C3%A0+pris%26co&a%20b=1');
    expect(params.error_description).toBe('Email déjà pris&co');
    expect(params['a b']).toBe('1');
  });

  it('ignore les parties vides et accepte une clé sans valeur', () => {
    expect(readParams('manne://x?&a=&b&')).toEqual({ a: '', b: '' });
    expect(readParams('manne://auth/callback')).toEqual({});
  });
});

describe('erreurs du serveur', () => {
  it('reconnaît la limite d’envoi', () => {
    expect(limited({ code: 'over_email_send_rate_limit' })).toBe(true);
    expect(limited({ message: 'Email rate limit exceeded' })).toBe(true);
    expect(limited({ code: 'other', message: 'boom' })).toBe(false);
    expect(limited(null)).toBe(false);
  });

  it('bloque l’envoi dix minutes', () => {
    expect(MAIL_BLOCK_MS).toBe(10 * 60 * 1000);
  });

  it('reconnaît une identité déjà prise', () => {
    expect(taken({ code: 'identity_already_exists' })).toBe(true);
    expect(taken({ code: 'email_exists' })).toBe(true);
    expect(taken({ code: 'user_already_exists' })).toBe(true);
    expect(taken({ code: 'validation_failed' })).toBe(false);
    expect(taken(null)).toBe(false);
  });

  it('reconnaît un utilisateur supprimé côté serveur', () => {
    expect(userGone({ code: 'user_not_found' })).toBe(true);
    expect(userGone({ message: 'User from sub claim in JWT does not exist' })).toBe(true);
    expect(userGone({ code: 'other' })).toBe(false);
    expect(userGone(null)).toBe(false);
  });

  it('missingUser accepte aussi un 404', () => {
    expect(missingUser({ status: 404 })).toBe(true);
    expect(missingUser({ code: 'user_not_found' })).toBe(true);
    expect(missingUser({ status: 500, message: 'oops' })).toBe(false);
    expect(missingUser(null)).toBe(false);
  });

  it('reconnaît l’annulation d’Apple', () => {
    expect(isAppleCancel({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleCancel({ code: 'ERR_OTHER' })).toBe(false);
    expect(isAppleCancel(null)).toBe(false);
    expect(isAppleCancel('ERR_REQUEST_CANCELED')).toBe(false);
  });
});

describe('adoptionMessage', () => {
  it('traduit le nonce périmé et la session expirée', () => {
    expect(adoptionMessage('nonce')).toMatch(/trop ancien/);
    expect(adoptionMessage('auth')).toBe('La session a expiré. Réessaie.');
  });

  it('laisse passer les autres messages', () => {
    expect(adoptionMessage('network down')).toBe('network down');
  });
});

describe('code reçu par e-mail', () => {
  it('choisit le type verifyOtp selon la branche', () => {
    expect(otpType('new')).toBe('email_change');
    expect(otpType('existing')).toBe('email');
  });

  it('accepte de 6 à 10 chiffres, espaces ignorés', () => {
    expect(cleanCode('123456')).toBe('123456');
    expect(cleanCode('12345678')).toBe('12345678');
    expect(cleanCode('1234 5678')).toBe('12345678');
    expect(cleanCode('1234567890')).toBe('1234567890');
    expect(cleanCode(' 123 456 ')).toBe('123456');
  });

  it('refuse le reste', () => {
    expect(cleanCode('12345')).toBeNull();
    expect(cleanCode('12345678901')).toBeNull();
    expect(cleanCode('12a456')).toBeNull();
    expect(cleanCode('')).toBeNull();
  });

  it('explique un code faux ou expiré', () => {
    expect(otpMessage({ code: 'otp_expired' })).toMatch(/faux ou expiré/);
    expect(otpMessage({ message: 'Token has expired or is invalid' })).toMatch(/faux ou expiré/);
    expect(otpMessage({ code: 'over_request_rate_limit' })).toMatch(/Trop d’essais/);
    expect(otpMessage({ message: 'boom' })).toMatch(/n’a pas pu être vérifié/);
  });
});

describe('connexion par mot de passe', () => {
  it('dit que l’adresse ou le mot de passe est faux', () => {
    expect(passwordMessage({ code: 'invalid_credentials' })).toBe('Adresse ou mot de passe incorrect.');
    expect(passwordMessage({ message: 'Invalid login credentials' })).toBe('Adresse ou mot de passe incorrect.');
  });

  it('dit d’attendre quand les essais sont limités', () => {
    expect(passwordMessage({ code: 'over_request_rate_limit' })).toBe('Trop d’essais. Réessaie dans un instant.');
  });

  it('ne montre pas le message du serveur', () => {
    expect(passwordMessage({ message: 'boom' })).toBe('La connexion a échoué. Réessaie dans un instant.');
    expect(passwordMessage(null)).toBe('');
  });
});
