import {
  canModerate,
  descriptionProblem,
  END_CHOICES,
  endDateFor,
  endLabel,
  endsAtProblem,
  firstParam,
  formatInviteCode,
  inviteLink,
  inviteMessage,
  isGoneMessage,
  isGroupEnded,
  isInviteCode,
  KIND_HELP,
  KIND_ORDER,
  kindLabel,
  memberCountLabel,
  nameProblem,
  normalizeInviteCode,
  readGroupCard,
  readGroupDetail,
  readGroupIntention,
  readInvitedGroup,
  readMember,
  readMyGroup,
  readRequest,
  roleLabel,
} from '../src/groups';

const NOW = new Date(2026, 9, 16, 10, 0, 0);

describe('libellés', () => {
  it('nomme les trois types et les trois rôles', () => {
    expect(kindLabel('fraternite')).toBe('Fraternité');
    expect(kindLabel('communaute')).toBe('Communauté');
    expect(kindLabel('ephemere')).toBe('Groupe éphémère');
    expect(roleLabel('owner')).toBe('Propriétaire');
    expect(roleLabel('moderator')).toBe('Modérateur');
    expect(roleLabel('member')).toBe('Membre');
  });

  it('explique chaque type en une phrase', () => {
    expect(KIND_ORDER).toEqual(['fraternite', 'communaute', 'ephemere']);
    for (const kind of KIND_ORDER) expect(KIND_HELP[kind].endsWith('.')).toBe(true);
    expect(KIND_HELP.fraternite).toMatch(/introuvable/);
    expect(KIND_HELP.communaute).toMatch(/demande/);
    expect(KIND_HELP.ephemere).toMatch(/lecture seule/);
  });

  it('accorde le nombre de membres', () => {
    expect(memberCountLabel(1)).toBe('1 membre');
    expect(memberCountLabel(0)).toBe('0 membres');
    expect(memberCountLabel(12)).toBe('12 membres');
  });

  it('seuls le propriétaire et les modérateurs modèrent', () => {
    expect(canModerate('owner')).toBe(true);
    expect(canModerate('moderator')).toBe(true);
    expect(canModerate('member')).toBe(false);
    expect(canModerate(null)).toBe(false);
  });
});

describe('nameProblem et descriptionProblem', () => {
  it('compte le nom après avoir retiré les espaces, de 3 à 60 caractères', () => {
    expect(nameProblem('  ab  ')).toMatch(/au moins 3/);
    expect(nameProblem('abc')).toBeNull();
    expect(nameProblem(` ${'a'.repeat(60)} `)).toBeNull();
    expect(nameProblem('a'.repeat(61))).toMatch(/60 caractères au plus/);
  });

  it('limite la description à 280 caractères', () => {
    expect(descriptionProblem('')).toBeNull();
    expect(descriptionProblem('a'.repeat(280))).toBeNull();
    expect(descriptionProblem('a'.repeat(281))).toMatch(/280/);
  });
});

describe('date de fin', () => {
  it('refuse une absence de date, le passé et plus d’un an', () => {
    expect(endsAtProblem(null, NOW)).toMatch(/Choisis/);
    expect(endsAtProblem(new Date(NOW.getTime() - 1000), NOW)).toMatch(/futur/);
    expect(endsAtProblem(NOW, NOW)).toMatch(/futur/);
    expect(endsAtProblem(new Date(NOW.getTime() + 366 * 86_400_000), NOW)).toMatch(/un an/);
    expect(endsAtProblem(new Date(NOW.getTime() + 365 * 86_400_000), NOW)).toBeNull();
    expect(endsAtProblem(new Date('nope'), NOW)).toMatch(/Choisis/);
  });

  it('calcule la fin au soir du jour choisi, toujours valide', () => {
    expect(endDateFor('9j', NOW)).toEqual(new Date(2026, 9, 25, 23, 59));
    expect(endDateFor('40j', NOW)).toEqual(new Date(2026, 10, 25, 23, 59));
    expect(endDateFor('1m', NOW)).toEqual(new Date(2026, 10, 16, 23, 59));
    expect(endDateFor('3m', NOW)).toEqual(new Date(2027, 0, 16, 23, 59));
    for (const choice of END_CHOICES) expect(endsAtProblem(endDateFor(choice.id, NOW), NOW)).toBeNull();
  });

  it('dit si un groupe est terminé', () => {
    const now = NOW.getTime();
    expect(isGroupEnded(null, now)).toBe(false);
    expect(isGroupEnded(new Date(now + 1000).toISOString(), now)).toBe(false);
    expect(isGroupEnded(new Date(now).toISOString(), now)).toBe(true);
    expect(isGroupEnded(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isGroupEnded('pas une date', now)).toBe(false);
  });

  it('écrit la fin en français', () => {
    const now = NOW.getTime();
    expect(endLabel(null, now)).toBeNull();
    expect(endLabel(new Date(2026, 9, 25, 23, 59).toISOString(), now)).toBe('Se termine le 25 octobre 2026');
    expect(endLabel(new Date(2026, 9, 1, 12, 0).toISOString(), now)).toBe('Terminé le 1 octobre 2026');
  });
});

describe('code d’invitation', () => {
  it('tolère les minuscules, les espaces et les tirets', () => {
    expect(normalizeInviteCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('ab cd_ef.gh')).toBe('ABCDEFGH');
  });

  it('reconnaît la forme du serveur : 8 caractères, ni 0, ni O, ni 1, ni I', () => {
    expect(isInviteCode('ABCD-EFGH')).toBe(true);
    expect(isInviteCode('23456789')).toBe(true);
    expect(isInviteCode('ABCDEFG')).toBe(false);
    expect(isInviteCode('ABCDEFGHJ')).toBe(false);
    for (const bad of ['0BCDEFGH', 'OBCDEFGH', '1BCDEFGH', 'IBCDEFGH']) expect(isInviteCode(bad)).toBe(false);
  });

  it('formate, fait le lien et le message à partager', () => {
    expect(formatInviteCode('abcdefgh')).toBe('ABCD-EFGH');
    expect(formatInviteCode('ab')).toBe('AB');
    expect(inviteLink('abcd-efgh')).toBe('https://radaxx.github.io/Manne/rejoindre.html#ABCDEFGH');
    const message = inviteMessage('  Fraternité Saint-Joseph ', 'ABCDEFGH');
    expect(message).toContain('https://radaxx.github.io/Manne/rejoindre.html#ABCDEFGH');
    expect(message).toContain('ABCD-EFGH');
    expect(message).toContain('« Fraternité Saint-Joseph »');
  });

  it('lit le premier paramètre de route', () => {
    expect(firstParam('x')).toBe('x');
    expect(firstParam(['a', 'b'])).toBe('a');
    expect(firstParam(undefined)).toBe('');
  });
});

const card = {
  id: 'g1',
  name: 'Paroisse',
  description: 'Une communauté',
  kind: 'communaute',
  ends_at: null,
  ended: false,
  member_count: 12,
  my_status: 'none',
};

describe('readGroupCard', () => {
  it('lit une carte de groupe', () => {
    expect(readGroupCard(card)).toEqual({
      id: 'g1',
      name: 'Paroisse',
      description: 'Une communauté',
      kind: 'communaute',
      endsAt: null,
      ended: false,
      memberCount: 12,
      myStatus: 'none',
    });
  });

  it('ignore une ligne incomplète ou invalide', () => {
    expect(readGroupCard(null)).toBeNull();
    expect(readGroupCard({ ...card, id: '' })).toBeNull();
    expect(readGroupCard({ ...card, kind: 'secrete' })).toBeNull();
    expect(readGroupCard({ ...card, my_status: 'admin' })).toBeNull();
    expect(readGroupCard({ ...card, member_count: -1 })).toBeNull();
    expect(readGroupCard({ ...card, member_count: 'beaucoup' })).toBeNull();
  });

  it('exige une date de fin lisible pour un groupe éphémère, et marque un groupe passé comme terminé', () => {
    expect(readGroupCard({ ...card, kind: 'ephemere' })).toBeNull();
    expect(readGroupCard({ ...card, kind: 'ephemere', ends_at: 'demain' })).toBeNull();
    const past = readGroupCard({ ...card, kind: 'ephemere', ends_at: '2020-01-01T00:00:00Z' });
    expect(past?.ended).toBe(true);
    const future = readGroupCard({ ...card, kind: 'ephemere', ends_at: '2999-01-01T00:00:00Z' });
    expect(future?.ended).toBe(false);
  });
});

describe('readInvitedGroup', () => {
  it('ajoute si le groupe est complet', () => {
    expect(readInvitedGroup({ ...card, is_full: true })?.full).toBe(true);
    expect(readInvitedGroup(card)?.full).toBe(false);
    expect(readInvitedGroup({ ...card, kind: 'x' })).toBeNull();
  });
});

describe('readGroupDetail', () => {
  it('ne garde le code et les demandes que pour un membre', () => {
    const member = readGroupDetail({ ...card, my_status: 'member', my_role: 'moderator', invite_code: 'ABCDEFGH', pending_requests: 3 });
    expect(member?.inviteCode).toBe('ABCDEFGH');
    expect(member?.pendingRequests).toBe(3);
    const plain = readGroupDetail({ ...card, my_status: 'member', my_role: 'member', invite_code: 'ABCDEFGH', pending_requests: 3 });
    expect(plain?.inviteCode).toBe('ABCDEFGH');
    expect(plain?.pendingRequests).toBe(0);
    const stranger = readGroupDetail({ ...card, my_role: null, invite_code: 'ABCDEFGH', pending_requests: 3 });
    expect(stranger?.myRole).toBeNull();
    expect(stranger?.inviteCode).toBeNull();
    expect(stranger?.pendingRequests).toBe(0);
  });
});

describe('readMyGroup', () => {
  const row = { ...card, role: 'owner', pending_requests: 2 };

  it('lit mon rôle et les demandes en attente d’un propriétaire', () => {
    expect(readMyGroup(row)).toMatchObject({ id: 'g1', role: 'owner', memberCount: 12, pendingRequests: 2 });
  });

  it('ne compte pas de demandes pour un simple membre', () => {
    expect(readMyGroup({ ...row, role: 'member' })?.pendingRequests).toBe(0);
  });

  it('ignore une ligne sans rôle valide', () => {
    expect(readMyGroup({ ...row, role: 'chef' })).toBeNull();
    expect(readMyGroup({ ...row, name: '' })).toBeNull();
  });
});

describe('readMember et readRequest', () => {
  it('lisent un membre et une demande', () => {
    expect(readMember({ handle: 'marie', role: 'owner', joined_at: '2026-01-01T00:00:00Z', mine: true })).toEqual({
      handle: 'marie',
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00Z',
      mine: true,
    });
    expect(readRequest({ handle: 'paul', created_at: '2026-01-02T00:00:00Z' })).toEqual({
      handle: 'paul',
      createdAt: '2026-01-02T00:00:00Z',
    });
  });

  it('ignorent les lignes invalides', () => {
    expect(readMember({ handle: 'marie', role: 'roi', joined_at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(readMember({ handle: '', role: 'member', joined_at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(readMember({ handle: 'marie', role: 'member', joined_at: 'hier' })).toBeNull();
    expect(readRequest({ handle: 'paul' })).toBeNull();
    expect(readRequest(42)).toBeNull();
  });
});

describe('readGroupIntention', () => {
  const row = {
    id: 'i1',
    body: 'Pour la paix',
    created_at: '2026-01-01T00:00:00Z',
    mine: false,
    handle: 'marie',
    carries: 3,
    carrying: true,
    answered_at: null,
    thanks: 'ignoré',
    hidden: false,
  };

  it('lit une intention de groupe', () => {
    expect(readGroupIntention(row)).toEqual({
      id: 'i1',
      body: 'Pour la paix',
      createdAt: '2026-01-01T00:00:00Z',
      mine: false,
      handle: 'marie',
      carries: 3,
      carrying: true,
      answeredAt: null,
      thanks: null,
      hidden: false,
      gatheringTitle: null,
    });
  });

  it('garde le titre du rendez-vous où l’intention a été écrite', () => {
    expect(readGroupIntention({ ...row, gathering_title: 'Chapelet' })?.gatheringTitle).toBe('Chapelet');
    expect(readGroupIntention({ ...row, gathering_title: '  ' })?.gatheringTitle).toBeNull();
  });

  it('garde l’action de grâce d’une prière exaucée seulement', () => {
    const answered = readGroupIntention({ ...row, answered_at: '2026-01-05T00:00:00Z', thanks: 'Merci !' });
    expect(answered?.answeredAt).toBe('2026-01-05T00:00:00Z');
    expect(answered?.thanks).toBe('Merci !');
    expect(readGroupIntention({ ...row, answered_at: '2026-01-05T00:00:00Z', thanks: '  ' })?.thanks).toBeNull();
  });

  it('ignore une ligne sans texte, sans date ou sans compteur', () => {
    expect(readGroupIntention({ ...row, body: '' })).toBeNull();
    expect(readGroupIntention({ ...row, created_at: 'x' })).toBeNull();
    expect(readGroupIntention({ ...row, carries: null })).toBeNull();
    expect(readGroupIntention(undefined)).toBeNull();
  });
});

describe('isGoneMessage', () => {
  it('reconnaît un élément disparu ou un accès retiré, pas un échec passager', () => {
    expect(isGoneMessage('Cette neuvaine n’existe plus, ou tu n’as pas accès à ce groupe.')).toBe(true);
    expect(isGoneMessage('Ce groupe n’existe pas, ou tu n’en fais pas partie.')).toBe(true);
    expect(isGoneMessage('Tu n’as pas le droit de faire ça dans ce groupe.')).toBe(true);
    expect(isGoneMessage('Ça n’a pas pu partir. Réessaie quand tu as du réseau.')).toBe(false);
    expect(isGoneMessage('Les profils demandent un compte relié.')).toBe(false);
  });
});
