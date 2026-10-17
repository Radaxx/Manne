import { failureMessage as communityFailure } from '../src/community';
import { SUSPENDED_TEXT } from '../src/moderation';
import { failureMessage as profileFailure } from '../src/profile';
import {
  actionLabel,
  authorLabel,
  durationLabel,
  failureText,
  groupNote,
  KIND_LABELS,
  kindLabel,
  logSubject,
  MOD_KINDS,
  pendingLabel,
  readLogEntry,
  readModItem,
  readMySuspension,
  readSuspension,
  removeCopy,
  reportsLabel,
  SUSPENSION_APPEAL,
  SUSPENSION_CONTACT,
  SUSPENSION_DURATIONS,
  stamp,
  stateLabel,
  suspensionTitle,
  untilDay,
  untilPhrase,
} from '../src/publisher-moderation';

const NOW = new Date(2026, 9, 17, 10, 0);
const at = (month: number, day: number, hour = 12, minute = 5, year = 2026) => new Date(year, month - 1, day, hour, minute).toISOString();

describe('lecteurs de la file', () => {
  const row = {
    kind: 'echo',
    id: 'e1',
    body: 'Un écho',
    handle: 'marie',
    group_name: null,
    hidden: true,
    suspended: false,
    reports: 3,
    insulte: 2,
    inapproprie: 0,
    spam: 1,
    autre: 0,
    first_reported_at: '2026-10-10T08:00:00Z',
    last_reported_at: '2026-10-12T08:00:00Z',
  };

  it('lit une ligne complète', () => {
    expect(readModItem(row)).toEqual({
      kind: 'echo',
      id: 'e1',
      body: 'Un écho',
      handle: 'marie',
      groupName: null,
      hidden: true,
      suspended: false,
      reports: 3,
      reasons: { insulte: 2, inapproprie: 0, spam: 1, autre: 0 },
      firstReportedAt: '2026-10-10T08:00:00Z',
      lastReportedAt: '2026-10-12T08:00:00Z',
    });
  });

  it('garde « compte sans profil » (pseudo nul) et le nom du groupe', () => {
    const item = readModItem({ ...row, kind: 'groupe', handle: null, group_name: 'Les amis' });
    expect(item?.handle).toBeNull();
    expect(item?.groupName).toBe('Les amis');
    expect(authorLabel(item?.handle ?? null)).toBe('Compte sans profil');
  });

  it('refuse un type inconnu, un identifiant manquant ou une ligne qui n’en est pas une', () => {
    expect(readModItem({ ...row, kind: 'autre-chose' })).toBeNull();
    expect(readModItem({ ...row, id: '' })).toBeNull();
    expect(readModItem(null)).toBeNull();
    expect(readModItem('x')).toBeNull();
  });

  it('prend la somme des motifs si le total est trop bas, et des zéros pour le reste', () => {
    const item = readModItem({ kind: 'profil', id: 'marie', reports: 1, insulte: 2, spam: '1' });
    expect(item?.reports).toBe(3);
    expect(item?.reasons).toEqual({ insulte: 2, inapproprie: 0, spam: 1, autre: 0 });
    expect(item?.body).toBe('');
    expect(item?.hidden).toBe(false);
  });

  it('connaît cinq types, chacun avec son libellé', () => {
    expect(MOD_KINDS).toEqual(['echo', 'intention', 'profil', 'priere', 'groupe']);
    expect(Object.keys(KIND_LABELS).sort()).toEqual([...MOD_KINDS].sort());
    expect(kindLabel('priere')).toBe('Prière de vitrine');
    expect(kindLabel('inconnu')).toBe('inconnu');
  });

  it('dit où en est l’élément', () => {
    expect(stateLabel({ kind: 'echo', hidden: false })).toBe('Encore visible pour les autres.');
    expect(stateLabel({ kind: 'echo', hidden: true })).toBe('Masqué pour les autres.');
    expect(stateLabel({ kind: 'intention', hidden: true })).toBe('Retirée du fil commun.');
    expect(stateLabel({ kind: 'profil', hidden: true })).toBe('Bio et paroisse masquées pour les autres.');
    expect(stateLabel({ kind: 'groupe', hidden: true })).toBe('Masquée pour les membres du groupe.');
  });

  it('écrit les compteurs et la mention du groupe', () => {
    expect(reportsLabel(1)).toBe('1 signalement');
    expect(reportsLabel(4)).toBe('4 signalements');
    expect(pendingLabel(0)).toBe('Rien à traiter');
    expect(pendingLabel(1)).toBe('1 élément à traiter');
    expect(pendingLabel(12)).toBe('12 éléments à traiter');
    expect(groupNote('Les amis')).toBe('Groupe « Les amis » · géré par le groupe');
  });

  it('demande confirmation avant de retirer, avec des mots propres à chaque type', () => {
    expect(removeCopy('echo').label).toBe('Supprimer');
    expect(removeCopy('profil').title).toBe('Effacer la bio et la paroisse ?');
    for (const kind of MOD_KINDS) {
      const copy = removeCopy(kind);
      expect(copy.title && copy.message && copy.label).toBeTruthy();
    }
  });
});

describe('suspensions', () => {
  it('propose 1, 7, 30 jours ou sans fin', () => {
    expect(SUSPENSION_DURATIONS.map((d) => d.days)).toEqual([1, 7, 30, null]);
    expect(SUSPENSION_DURATIONS.map((d) => d.label)).toEqual(['1 jour', '7 jours', '30 jours', 'Sans fin']);
    expect(durationLabel(1)).toBe('1 jour');
    expect(durationLabel(7)).toBe('7 jours');
    expect(durationLabel(null)).toBe('Sans fin');
  });

  it('écrit la fin de la suspension en français', () => {
    expect(untilDay(at(10, 24), NOW)).toBe('24 octobre');
    expect(untilDay(at(11, 1), NOW)).toBe('1er novembre');
    expect(untilDay(at(1, 5, 12, 0, 2027), NOW)).toBe('5 janvier 2027');
    expect(untilPhrase(at(10, 24), NOW)).toBe('jusqu’au 24 octobre');
    expect(untilPhrase(null, NOW)).toBe('pour une durée indéterminée');
    expect(suspensionTitle(at(10, 24), NOW)).toBe('Ton compte est suspendu jusqu’au 24 octobre');
    expect(suspensionTitle(null, NOW)).toBe('Ton compte est suspendu pour une durée indéterminée');
  });

  it('donne l’adresse à laquelle écrire', () => {
    expect(SUSPENSION_CONTACT).toBe('radaxx.studio@gmail.com');
    expect(SUSPENSION_APPEAL).toBe('Si tu penses que c’est une erreur, écris à radaxx.studio@gmail.com.');
  });

  it('lit ma suspension : une ligne, ou aucune', () => {
    expect(readMySuspension([{ until: '2026-10-24T10:00:00Z', reason: 'Propos blessants' }])).toEqual({
      until: '2026-10-24T10:00:00Z',
      reason: 'Propos blessants',
    });
    expect(readMySuspension([{ until: null, reason: 'Récidive' }])).toEqual({ until: null, reason: 'Récidive' });
    expect(readMySuspension([])).toBeNull();
    expect(readMySuspension(null)).toBeNull();
  });

  it('lit une suspension de la liste', () => {
    expect(
      readSuspension({
        id: 's1',
        handle: null,
        until: null,
        reason: 'Spam',
        suspended_by: 'mod',
        created_at: '2026-10-10T08:00:00Z',
      }),
    ).toEqual({ id: 's1', handle: null, until: null, reason: 'Spam', suspendedBy: 'mod', createdAt: '2026-10-10T08:00:00Z' });
    expect(readSuspension({ id: 's1' })).toBeNull();
  });
});

describe('journal', () => {
  it('lit une ligne, y compris d’un compte supprimé', () => {
    expect(
      readLogEntry({
        id: 12,
        created_at: '2026-10-10T08:00:00Z',
        moderator: null,
        action: 'remove',
        kind: 'echo',
        target_ref: 'e1',
        target_handle: 'marie',
        note: '',
      }),
    ).toEqual({
      id: '12',
      createdAt: '2026-10-10T08:00:00Z',
      moderator: null,
      action: 'remove',
      kind: 'echo',
      targetRef: 'e1',
      targetHandle: 'marie',
      note: '',
    });
    expect(readLogEntry({ id: 1 })).toBeNull();
  });

  it('nomme chaque action, celles des groupes comprises', () => {
    expect(actionLabel('restore')).toBe('Rétabli');
    expect(actionLabel('dismiss')).toBe('Laissé visible');
    expect(actionLabel('remove')).toBe('Retiré');
    expect(actionLabel('suspend')).toBe('Compte suspendu');
    expect(actionLabel('unsuspend')).toBe('Suspension levée');
    expect(actionLabel('group_ban')).toBe('Banni du groupe');
    expect(actionLabel('group_unban')).toBe('Bannissement levé');
    expect(actionLabel('group_remove')).toBe('Retiré par le groupe');
    expect(actionLabel('inconnue')).toBe('inconnue');
  });

  it('dit ce que la ligne désigne', () => {
    expect(logSubject({ action: 'remove', kind: 'echo', targetHandle: 'marie' })).toBe('Écho de @marie');
    expect(logSubject({ action: 'remove', kind: 'echo', targetHandle: null })).toBe('Écho');
    expect(logSubject({ action: 'suspend', kind: 'compte', targetHandle: 'marie' })).toBe('Compte de @marie');
    expect(logSubject({ action: 'suspend', kind: 'compte', targetHandle: null })).toBe('Compte sans profil');
    expect(logSubject({ action: 'suspend', kind: 'echo', targetHandle: 'marie' })).toBe('Compte de @marie');
    expect(logSubject({ action: 'unsuspend', kind: 'compte', targetHandle: 'marie' })).toBe('Compte de @marie');
    expect(logSubject({ action: 'group_ban', kind: 'groupe', targetHandle: 'pierre' })).toBe('Membre @pierre');
  });

  it('écrit la date et l’heure locales', () => {
    expect(stamp(at(10, 12, 9, 5), NOW)).toBe('12 octobre à 9 h 05');
    expect(stamp(at(12, 1, 14, 30, 2025), NOW)).toBe('1er décembre 2025 à 14 h 30');
  });
});

describe('messages', () => {
  it('refuse une publication de compte suspendu, en clair', () => {
    expect(SUSPENDED_TEXT).toBe('Ton compte est suspendu : tu ne peux pas publier pour le moment.');
    expect(profileFailure('compte_suspendu')).toBe(SUSPENDED_TEXT);
    expect(communityFailure('compte_suspendu')).toBe(SUSPENDED_TEXT);
    expect(failureText('compte_suspendu')).toBe(SUSPENDED_TEXT);
  });

  it('traduit les refus de la modération éditeur', () => {
    expect(failureText('interdit')).toBe('Cette action est réservée aux modérateurs de l’éditeur.');
    expect(failureText('duree_invalide')).toBe('La durée va de 1 jour à dix ans, ou sans fin.');
    expect(failureText('motif_invalide')).toBe('Écris un motif de 280 caractères au plus.');
    expect(failureText('kind_invalide')).toBe('Ce type d’élément n’existe pas.');
    expect(failureText('introuvable')).toBe('Cet élément n’existe plus : la liste va se mettre à jour.');
    expect(failureText('autre chose')).toBe('Ça n’a pas pu partir. Réessaie quand tu as du réseau.');
  });
});
