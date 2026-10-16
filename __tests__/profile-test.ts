import { handleProblem, initials, normalizeHandle, readCard, readFound, readOther, readProfile } from '../src/profile';

describe('normalizeHandle', () => {
  it('retire les espaces et le @, et passe en minuscules', () => {
    expect(normalizeHandle('  @Jean.Marie ')).toBe('jean.marie');
    expect(normalizeHandle('PAUL_7')).toBe('paul_7');
  });
});

describe('handleProblem', () => {
  it('accepte un pseudo valide, saisi avec @ ou des majuscules', () => {
    expect(handleProblem('jean.marie')).toBeNull();
    expect(handleProblem('@Paul_7')).toBeNull();
    expect(handleProblem('a.b')).toBeNull();
    expect(handleProblem('a'.repeat(20))).toBeNull();
  });

  it('refuse un pseudo trop court ou trop long', () => {
    expect(handleProblem('')).toMatch(/au moins 3/);
    expect(handleProblem('ab')).toMatch(/au moins 3/);
    expect(handleProblem('a'.repeat(21))).toMatch(/20 caractères au plus/);
  });

  it('refuse les caractères hors lettres minuscules, chiffres, point et tiret bas', () => {
    for (const bad of ['jean marie', 'jean-marie', 'élodie', 'jean!', 'jean@x']) {
      expect(handleProblem(bad)).toMatch(/lettres minuscules, des chiffres, le point et le tiret bas/);
    }
  });

  it('refuse un point au début ou à la fin', () => {
    expect(handleProblem('.jean')).toMatch(/point/);
    expect(handleProblem('jean.')).toMatch(/point/);
  });

  it('refuse les pseudos réservés, quelle que soit la casse', () => {
    for (const reserved of ['admin', 'Manne', 'support', 'moderation', 'EQUIPE']) {
      expect(handleProblem(reserved)).toBe('Ce pseudo est réservé.');
    }
  });
});

describe('initials', () => {
  it('prend la première et la dernière lettre ou chiffre, en majuscules', () => {
    expect(initials('jean.marie')).toBe('JE');
    expect(initials('paul_7')).toBe('P7');
    expect(initials('abc')).toBe('AC');
    expect(initials('@Zoe')).toBe('ZE');
  });

  it('ignore le point et le tiret bas aux extrémités', () => {
    expect(initials('_marie_')).toBe('ME');
    expect(initials('a.b')).toBe('AB');
  });

  it('gère un pseudo sans lettre ni chiffre, ou à un seul caractère', () => {
    expect(initials('')).toBe('');
    expect(initials('._.')).toBe('');
    expect(initials('x')).toBe('X');
  });
});

describe('lecteurs de lignes', () => {
  it('lit une carte et rejette les lignes invalides', () => {
    expect(readCard({ handle: 'paul' })).toEqual({ handle: 'paul' });
    expect(readCard({ handle: 'paul' })).toEqual({ handle: 'paul' });
    expect(readCard({ display_name: 'Paul' })).toBeNull();
    expect(readCard({ handle: '' })).toBeNull();
    expect(readCard(null)).toBeNull();
    expect(readCard('paul')).toBeNull();
  });

  it('lit une recherche avec son état d’abonnement', () => {
    expect(readFound({ handle: 'paul', following: true })).toEqual({
      handle: 'paul',
      following: true,
    });
    expect(readFound({ handle: 'paul', following: 'oui' })).toBeNull();
  });

  it('lit mon profil, avec bio et paroisse vides ramenées à null', () => {
    expect(readProfile({ handle: 'paul', bio: '', parish: ' ', followers: '3', following_count: 2 })).toEqual({
      handle: 'paul',
      bio: null,
      parish: null,
      followers: 3,
      following: 2,
    });
    expect(readProfile({ handle: 'paul', followers: 'x', following_count: 2 })).toBeNull();
    expect(readProfile({ handle: 'paul', followers: -1, following_count: 2 })).toBeNull();
  });

  it('lit le profil d’un autre et masque les détails tant qu’il n’est pas visible', () => {
    const base = { handle: 'paul', i_follow: false, follows_me: false };
    const hidden = readOther({ ...base, visible: false, bio: 'secret', parish: 'Notre-Dame', followers: 4, following_count: 1 });
    expect(hidden).toEqual({
      handle: 'paul',
      bio: null,
      parish: null,
      followers: null,
      following: null,
      iFollow: false,
      followsMe: false,
      visible: false,
    });
    const shown = readOther({
      ...base,
      follows_me: true,
      visible: true,
      bio: 'Salut',
      parish: 'Notre-Dame',
      followers: 4,
      following_count: 1,
    });
    expect(shown).toMatchObject({ bio: 'Salut', parish: 'Notre-Dame', followers: 4, following: 1, visible: true, followsMe: true });
    expect(readOther({ ...base, visible: 'oui' })).toBeNull();
    expect(readOther({ handle: 'paul', visible: true })).toBeNull();
  });
});
