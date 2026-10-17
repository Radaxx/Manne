import { failureMessage as communityFailure } from '../src/community';
import { readGroupDetail, readMyGroup } from '../src/groups';
import {
  canActOnAuthor,
  type GroupReport,
  MASKED_NOTE,
  pendingReportsLabel,
  REASON_LABELS,
  REFUSED_TEXT,
  REPORT_REASONS,
  readGroupBan,
  readGroupReport,
  readReason,
  reasonLabel,
  reasonSummary,
} from '../src/moderation';
import { failureMessage as profileFailure, readProfile } from '../src/profile';
import { readPrayerRow, readShowcase } from '../src/showcase';

describe('motifs de signalement', () => {
  it('propose les quatre motifs, dans l’ordre, avec leur libellé', () => {
    expect(REPORT_REASONS).toEqual(['insulte', 'inapproprie', 'spam', 'autre']);
    expect(REPORT_REASONS.map(reasonLabel)).toEqual(['Propos blessants', 'Contenu inapproprié', 'Publicité ou spam', 'Autre raison']);
    expect(Object.keys(REASON_LABELS).sort()).toEqual([...REPORT_REASONS].sort());
  });

  it('ramène tout motif inconnu à « autre », comme le serveur', () => {
    expect(readReason('spam')).toBe('spam');
    expect(readReason('insulte')).toBe('insulte');
    expect(readReason('SPAM')).toBe('autre');
    expect(readReason(null)).toBe('autre');
    expect(readReason(12)).toBe('autre');
  });

  it('résume les motifs présents, les plus fréquents d’abord', () => {
    expect(reasonSummary({ insulte: 1, inapproprie: 0, spam: 2, autre: 0 })).toBe('Publicité ou spam ×2 · Propos blessants ×1');
    expect(reasonSummary({ insulte: 1, inapproprie: 1, spam: 0, autre: 1 })).toBe(
      'Propos blessants ×1 · Contenu inapproprié ×1 · Autre raison ×1',
    );
    expect(reasonSummary({ insulte: 0, inapproprie: 0, spam: 0, autre: 0 })).toBe('');
  });

  it('écrit le nombre de signalements à traiter', () => {
    expect(pendingReportsLabel(0)).toBe('');
    expect(pendingReportsLabel(1)).toBe('1 signalement à traiter');
    expect(pendingReportsLabel(3)).toBe('3 signalements à traiter');
  });
});

describe('file de signalements d’un groupe', () => {
  const row = {
    id: 'i1',
    body: 'Une intention',
    handle: 'dev_pierre',
    author_role: 'member',
    hidden: false,
    created_at: '2026-10-16T10:00:00Z',
    last_reported_at: '2026-10-16T11:00:00Z',
    reports: 2,
    insulte: 0,
    inapproprie: 0,
    spam: 2,
    autre: 0,
  };

  it('lit une ligne du serveur', () => {
    expect(readGroupReport(row)).toEqual({
      id: 'i1',
      body: 'Une intention',
      handle: 'dev_pierre',
      authorRole: 'member',
      hidden: false,
      createdAt: '2026-10-16T10:00:00Z',
      lastReportedAt: '2026-10-16T11:00:00Z',
      reports: 2,
      reasons: { insulte: 0, inapproprie: 0, spam: 2, autre: 0 },
    });
  });

  it('ignore une ligne illisible et tolère un auteur disparu', () => {
    expect(readGroupReport(null)).toBeNull();
    expect(readGroupReport({ ...row, id: '' })).toBeNull();
    expect(readGroupReport({ ...row, body: '' })).toBeNull();
    expect(readGroupReport({ ...row, created_at: 'hier' })).toBeNull();
    const gone = readGroupReport({ ...row, handle: '', author_role: null, hidden: true, last_reported_at: null });
    expect(gone).toMatchObject({ handle: '', authorRole: null, hidden: true, lastReportedAt: null });
  });

  it('compte au moins la somme des motifs', () => {
    expect(readGroupReport({ ...row, reports: 0 })?.reports).toBe(2);
    expect(readGroupReport({ ...row, spam: '2', insulte: -1 })?.reasons).toMatchObject({ spam: 2, insulte: 0 });
  });

  it('lit les personnes bannies', () => {
    expect(readGroupBan({ handle: 'dev_paul', banned_by: 'dev_marie', created_at: '2026-10-16T10:00:00Z' })).toEqual({
      handle: 'dev_paul',
      bannedBy: 'dev_marie',
      createdAt: '2026-10-16T10:00:00Z',
    });
    expect(readGroupBan({ handle: 'dev_paul', banned_by: null, created_at: '2026-10-16T10:00:00Z' })?.bannedBy).toBeNull();
    expect(readGroupBan({ handle: '', created_at: '2026-10-16T10:00:00Z' })).toBeNull();
    expect(readGroupBan({ handle: 'dev_paul', created_at: 'hier' })).toBeNull();
  });

  it('décide qui peut exclure ou bannir l’auteur, comme la page des membres', () => {
    const report = (authorRole: GroupReport['authorRole'], handle = 'dev_pierre'): GroupReport => ({
      ...(readGroupReport({ ...row, author_role: authorRole, handle }) as GroupReport),
    });
    expect(canActOnAuthor('owner', report('member'), 'dev_marie')).toBe(true);
    expect(canActOnAuthor('owner', report('moderator'), 'dev_marie')).toBe(true);
    expect(canActOnAuthor('owner', report('owner'), 'dev_marie')).toBe(false);
    expect(canActOnAuthor('moderator', report('member'), 'me')).toBe(true);
    expect(canActOnAuthor('moderator', report('moderator'), 'me')).toBe(false);
    expect(canActOnAuthor('moderator', report('owner'), 'me')).toBe(false);
    expect(canActOnAuthor('member', report('member'), 'me')).toBe(false);
    expect(canActOnAuthor('owner', report('member', 'dev_marie'), 'dev_marie')).toBe(false);
    expect(canActOnAuthor('owner', report(null), 'dev_marie')).toBe(false);
    expect(canActOnAuthor('owner', report('member', ''), 'dev_marie')).toBe(false);
  });
});

describe('compteurs et masquages lus sur le serveur', () => {
  const group = {
    id: 'g1',
    name: 'Fraternité de test',
    description: '',
    kind: 'fraternite',
    ends_at: null,
    ended: false,
    member_count: 4,
    my_status: 'member',
    my_role: 'moderator',
    invite_code: 'ABCDEFGH',
    pending_requests: 1,
    pending_reports: 2,
  };

  it('ne donne le nombre de signalements qu’au propriétaire et aux modérateurs', () => {
    expect(readGroupDetail(group)?.pendingReports).toBe(2);
    expect(readGroupDetail({ ...group, my_role: 'member' })?.pendingReports).toBe(0);
    expect(readGroupDetail({ ...group, pending_reports: undefined })?.pendingReports).toBe(0);
    expect(readMyGroup({ ...group, role: 'owner' })?.pendingReports).toBe(2);
    expect(readMyGroup({ ...group, role: 'member' })?.pendingReports).toBe(0);
  });

  it('lit « masqué » sur mon profil et sur mes prières de vitrine', () => {
    const profile = { handle: 'dev_marie', bio: 'Bonjour', parish: null, followers: 1, following_count: 2 };
    expect(readProfile(profile)?.flagged).toBe(false);
    expect(readProfile({ ...profile, flagged: true })?.flagged).toBe(true);
    const prayer = { prayer_id: 'p1', title: 'Matin', body: 'Seigneur' };
    expect(readPrayerRow(prayer)).toEqual({ id: 'p1', title: 'Matin', text: 'Seigneur' });
    expect(readPrayerRow({ ...prayer, hidden: false })).toEqual({ id: 'p1', title: 'Matin', text: 'Seigneur' });
    expect(readPrayerRow({ ...prayer, hidden: true })).toEqual({ id: 'p1', title: 'Matin', text: 'Seigneur', hidden: true });
    expect(readShowcase({ prayers: [{ ...prayer, hidden: true }] }).prayers[0]?.hidden).toBe(true);
    expect(MASKED_NOTE).toBe('Masqué après plusieurs signalements');
  });
});

describe('messages d’erreur', () => {
  it('traduit le refus du filtre en une phrase de la charte', () => {
    const text = 'Ce texte contient un mot que la charte n’accepte pas. Reformule-le, s’il te plaît.';
    expect(REFUSED_TEXT).toBe(text);
    expect(profileFailure('contenu_refuse')).toBe(text);
    expect(communityFailure('contenu_refuse')).toBe(text);
    expect(profileFailure('Error: contenu_refuse')).toBe(text);
  });

  it('garde le message neutre d’un bannissement et les autres messages de groupe', () => {
    expect(profileFailure('Tu ne peux pas rejoindre ce groupe.')).toBe('Tu ne peux pas rejoindre ce groupe.');
    expect(profileFailure('Cette personne ne peut pas rejoindre ce groupe.')).toBe('Cette personne ne peut pas rejoindre ce groupe.');
    expect(profileFailure('Ce groupe a déjà banni 200 personnes')).toBe('Ce groupe a déjà banni 200 personnes');
    expect(profileFailure('interdit')).toBe('Tu n’as pas le droit de faire ça dans ce groupe.');
  });

  it('explique un signalement déjà fait, une prière retirée et un profil inconnu', () => {
    expect(profileFailure('Déjà signalé')).toBe('Tu as déjà fait ce signalement.');
    expect(communityFailure('Déjà signalé')).toBe('Déjà signalé');
    expect(profileFailure('priere_inconnue')).toBe('Cette prière n’est plus affichée sur ce profil.');
    expect(profileFailure('introuvable')).toBe('Ce profil n’existe pas.');
  });
});
