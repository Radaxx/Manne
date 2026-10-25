import {
  CONTACT_MAX,
  draftProblem,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_MAX,
  FEEDBACK_PLACEHOLDERS,
  feedbackAuthor,
  feedbackDevice,
  feedbackFailure,
  feedbackKindLabel,
  openFeedbackLabel,
  readFeedback,
  sendFeedback,
  systemLabel,
} from '../src/feedback';
import { SUSPENDED_TEXT } from '../src/moderation';

const draft = (body: string, contact = '') => ({ kind: 'bug' as const, body, contact });

describe('brouillon de retour', () => {
  it('demande un message', () => {
    expect(draftProblem(draft(''))).toBe('Écris ton message.');
    expect(draftProblem(draft('   \n '))).toBe('Écris ton message.');
    expect(draftProblem(draft('Le chapelet se fige'))).toBeNull();
  });

  it('borne le message et l’adresse', () => {
    expect(draftProblem(draft('a'.repeat(FEEDBACK_MAX)))).toBeNull();
    expect(draftProblem(draft('a'.repeat(FEEDBACK_MAX + 1)))).toContain(String(FEEDBACK_MAX));
    expect(draftProblem(draft('ok', 'a'.repeat(CONTACT_MAX)))).toBeNull();
    expect(draftProblem(draft('ok', 'a'.repeat(CONTACT_MAX + 1)))).toContain(String(CONTACT_MAX));
  });

  it('ne compte pas les espaces autour du message', () => {
    expect(draftProblem(draft(`  ${'a'.repeat(FEEDBACK_MAX)}  `))).toBeNull();
  });

  it('chaque type a un libellé et une invite', () => {
    for (const kind of FEEDBACK_KINDS) {
      expect(FEEDBACK_KIND_LABELS[kind]).toBeTruthy();
      expect(FEEDBACK_PLACEHOLDERS[kind]).toBeTruthy();
      expect(feedbackKindLabel(kind)).toBe(FEEDBACK_KIND_LABELS[kind]);
    }
    expect(feedbackKindLabel('inconnu')).toBe('inconnu');
  });
});

describe('envoi', () => {
  const device = { appVersion: '1.5.2', platform: 'android', osVersion: '35' };

  it('refuse un brouillon vide sans appeler le serveur', async () => {
    await expect(sendFeedback(draft(' '), device)).resolves.toEqual({ ok: false, message: 'Écris ton message.' });
  });

  it('sans projet Supabase, dit que les retours ne sont pas reliés', async () => {
    await expect(sendFeedback(draft('Un bug'), device)).resolves.toEqual({
      ok: false,
      message: 'Les retours ne sont pas reliés pour le moment.',
    });
  });
});

describe('messages du serveur', () => {
  it('traduit les erreurs des retours', () => {
    expect(feedbackFailure('trop_de_retours')).toContain('plus tard');
    expect(feedbackFailure('retour_vide')).toBe('Écris ton message.');
    expect(feedbackFailure('kind_invalide')).toBe('Choisis le type de retour.');
    expect(feedbackFailure('longueur')).toContain('trop long');
  });

  it('reprend les messages de la modération pour le reste', () => {
    expect(feedbackFailure('interdit')).toBe('Cette action est réservée aux modérateurs de l’éditeur.');
    expect(feedbackFailure('compte_suspendu')).toBe(SUSPENDED_TEXT);
  });
});

describe('lecture côté modération', () => {
  const row = {
    id: 'f1',
    created_at: '2026-10-24T10:05:00Z',
    kind: 'idee',
    body: 'Un mode hors ligne pour la messe',
    contact: 'marie@exemple.fr',
    app_version: '1.5.2',
    platform: 'ios',
    os_version: '18.2',
    handle: 'marie',
    anonymous: false,
    resolved_at: null,
  };

  it('lit une ligne complète', () => {
    expect(readFeedback(row)).toEqual({
      id: 'f1',
      createdAt: '2026-10-24T10:05:00Z',
      kind: 'idee',
      body: 'Un mode hors ligne pour la messe',
      contact: 'marie@exemple.fr',
      appVersion: '1.5.2',
      platform: 'ios',
      osVersion: '18.2',
      handle: 'marie',
      anonymous: false,
      resolvedAt: null,
    });
  });

  it('écarte une ligne sans identifiant, sans date ou d’un type inconnu', () => {
    expect(readFeedback(null)).toBeNull();
    expect(readFeedback({ ...row, id: '' })).toBeNull();
    expect(readFeedback({ ...row, created_at: 'hier' })).toBeNull();
    expect(readFeedback({ ...row, kind: 'plainte' })).toBeNull();
  });

  it('les champs facultatifs vides deviennent nuls', () => {
    const item = readFeedback({ ...row, contact: '  ', app_version: null, platform: undefined, handle: '', anonymous: 'oui' });
    expect(item).toMatchObject({ contact: null, appVersion: null, platform: null, handle: null, anonymous: false });
  });

  it('désigne l’auteur', () => {
    expect(feedbackAuthor({ handle: 'marie', anonymous: false })).toBe('@marie');
    expect(feedbackAuthor({ handle: null, anonymous: true })).toBe('Session anonyme');
    expect(feedbackAuthor({ handle: null, anonymous: false })).toBe('Compte sans profil');
  });

  it('décrit l’appareil', () => {
    expect(feedbackDevice({ appVersion: '1.5.2', platform: 'android', osVersion: '35' })).toBe('Manne 1.5.2 · Android (API 35)');
    expect(feedbackDevice({ appVersion: '1.5.2', platform: 'ios', osVersion: '18.2' })).toBe('Manne 1.5.2 · iOS 18.2');
    expect(feedbackDevice({ appVersion: null, platform: 'web', osVersion: '' })).toBe('Web');
    expect(feedbackDevice({ appVersion: null, platform: null, osVersion: null })).toBe('');
    expect(systemLabel('ios', null)).toBe('iOS');
  });

  it('compte les retours à lire', () => {
    expect(openFeedbackLabel(0)).toBe('Aucun retour à lire');
    expect(openFeedbackLabel(1)).toBe('1 retour à lire');
    expect(openFeedbackLabel(4)).toBe('4 retours à lire');
  });
});
