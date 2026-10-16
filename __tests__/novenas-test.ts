import { bookMeta, loadPassage, type TranslationId } from '../src/bible';
import { CUSTOM_TITLE, NOVENAS, novenaModelTitle, novenaTemplate, PASSAGE_SET_DATA, type Passage } from '../src/data/novenas';
import { prayerById } from '../src/data/prayers';
import { GATHERING_REMINDERS_MAX, groupIdFromUrl } from '../src/gathering-reminders';
import { NOVENA_REMINDERS_MAX, novenaIdFromUrl, planNovenaReminders, reminderBody, reminderTitle } from '../src/novena-reminders';
import {
  CUSTOM_PRAYER_MAX,
  customPrayerProblem,
  dayCountLabel,
  dayOfLabel,
  dayOpensAt,
  defaultDay,
  endsAfterGroup,
  finishersLabel,
  intentionProblem,
  isDayOpen,
  lockedLabel,
  type MyNovena,
  NOVENA_DAYS,
  NOVENA_MODELS,
  type Novena,
  nextReminderDays,
  novenaDates,
  novenaDay,
  novenaEnd,
  PASSAGE_SETS,
  prayedToday,
  prayedTodayLabel,
  readMyNovena,
  readNovena,
  reminderInstant,
  runningNovenas,
  startDateFor,
  startProblem,
  statusLabel,
  withDayPrayed,
} from '../src/novenas';
import { DAILY_REMINDERS_MAX } from '../src/reminder';
import { ROSARY_REMINDERS_MAX } from '../src/rosary-reminders';

const paris = { startDate: '2026-10-20', timezone: 'Europe/Paris' };
const at = (iso: string) => new Date(iso);

describe('novenaDay', () => {
  it('change à minuit dans le fuseau de la neuvaine (heure d’été de Paris, UTC+2)', () => {
    expect(novenaDay(paris, at('2026-10-19T21:59:00Z'))).toBe(0);
    expect(novenaDay(paris, at('2026-10-19T22:00:00Z'))).toBe(1);
    expect(novenaDay(paris, at('2026-10-20T21:59:00Z'))).toBe(1);
    expect(novenaDay(paris, at('2026-10-20T22:00:00Z'))).toBe(2);
  });

  it('suit un autre fuseau que celui du téléphone', () => {
    const toronto = { startDate: '2026-10-20', timezone: 'America/Toronto' };
    expect(novenaDay(toronto, at('2026-10-20T03:59:00Z'))).toBe(0);
    expect(novenaDay(toronto, at('2026-10-20T04:00:00Z'))).toBe(1);
    // À la même seconde, c'est déjà le jour 1 à Paris et pas encore à Toronto.
    expect(novenaDay(paris, at('2026-10-20T03:59:00Z'))).toBe(1);
  });

  it('le retour à l’heure d’hiver (25 octobre, jour de 25 h) ne décale pas les jours', () => {
    // Jour 6 = dimanche 25 octobre : de 00:00 (UTC+2) à 24:00 (UTC+1).
    expect(novenaDay(paris, at('2026-10-24T21:59:00Z'))).toBe(5);
    expect(novenaDay(paris, at('2026-10-24T22:00:00Z'))).toBe(6);
    expect(novenaDay(paris, at('2026-10-25T22:59:00Z'))).toBe(6);
    expect(novenaDay(paris, at('2026-10-25T23:00:00Z'))).toBe(7);
  });

  it('le passage à l’heure d’été (jour de 23 h) ne décale pas non plus les jours', () => {
    const spring = { startDate: '2027-03-26', timezone: 'Europe/Paris' };
    // Jour 3 = dimanche 28 mars 2027 : 00:00 (UTC+1) jusqu'à 24:00 (UTC+2), soit 23 h.
    expect(novenaDay(spring, at('2027-03-27T22:59:00Z'))).toBe(2);
    expect(novenaDay(spring, at('2027-03-27T23:00:00Z'))).toBe(3);
    expect(novenaDay(spring, at('2027-03-28T21:59:00Z'))).toBe(3);
    expect(novenaDay(spring, at('2027-03-28T22:00:00Z'))).toBe(4);
  });

  it('vaut 10 une fois le jour 9 passé, et 9 jours se suivent', () => {
    expect(novenaDay(paris, at('2026-10-28T22:59:00Z'))).toBe(9);
    expect(novenaDay(paris, at('2026-10-28T23:00:00Z'))).toBe(10);
    expect(novenaEnd(paris).toISOString()).toBe('2026-10-28T23:00:00.000Z');
    expect(novenaDates('2026-10-30')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
    expect(dayOpensAt(paris, 4).toISOString()).toBe('2026-10-22T22:00:00.000Z');
  });

  it('un fuseau inconnu donne le jour 0 sans erreur', () => {
    expect(novenaDay({ startDate: '2026-10-20', timezone: 'Nulle/Part' }, new Date())).toBe(0);
  });
});

describe('rattrapage', () => {
  it('le jour en cours et les jours passés s’ouvrent, jamais un jour futur', () => {
    const now = at('2026-10-23T10:00:00Z'); // jour 4
    expect(isDayOpen(paris, 4, now)).toBe(true);
    expect(isDayOpen(paris, 1, now)).toBe(true);
    expect(isDayOpen(paris, 5, now)).toBe(false);
    expect(isDayOpen(paris, 9, now)).toBe(false);
  });

  it('avant le début tout est fermé ; après la fin tout est ouvert (rattrapage)', () => {
    expect(isDayOpen(paris, 1, at('2026-10-19T10:00:00Z'))).toBe(false);
    expect(isDayOpen(paris, 9, at('2026-11-30T10:00:00Z'))).toBe(true);
    expect(isDayOpen(paris, 10, at('2026-11-30T10:00:00Z'))).toBe(false);
    expect(isDayOpen(paris, 0, at('2026-11-30T10:00:00Z'))).toBe(false);
  });

  it('le jour affiché par défaut reste entre 1 et 9', () => {
    expect([0, 1, 4, 9, 10].map(defaultDay)).toEqual([1, 1, 4, 9, 9]);
  });
});

const base: Novena = {
  id: '11111111-1111-4111-8111-111111111111',
  groupId: '22222222-2222-4222-8222-222222222222',
  groupName: 'Fraternité de test',
  groupEnded: false,
  canManage: true,
  model: 'esprit-saint',
  title: 'Neuvaine à l’Esprit Saint',
  intention: 'Pour la paix.',
  customPrayer: null,
  passageSet: null,
  ...paris,
  currentDay: 4,
  dayCounts: [3, 3, 2, 1, 0, 0, 0, 0, 0],
  myDays: [1, 2],
  reminderTime: null,
  finisherCount: 0,
  memberCount: 5,
};

describe('mises à jour optimistes', () => {
  it('cocher un jour ajoute la case et le compteur ; décocher les retire', () => {
    const on = withDayPrayed(base, 4, true);
    expect(on.myDays).toEqual([1, 2, 4]);
    expect(on.dayCounts[3]).toBe(2);
    const off = withDayPrayed(on, 4, false);
    expect(off.myDays).toEqual([1, 2]);
    expect(off.dayCounts[3]).toBe(1);
  });

  it('sans effet si l’état est déjà celui-là, ou hors des jours 1 à 9', () => {
    expect(withDayPrayed(base, 1, true)).toBe(base);
    expect(withDayPrayed(base, 3, false)).toBe(base);
    expect(withDayPrayed(base, 10, true)).toBe(base);
    expect(withDayPrayed(base, 0, true)).toBe(base);
  });

  it('le compteur ne passe jamais sous zéro', () => {
    // Un compteur en retard sur mes cases (lecture d'un autre moment) ne devient pas négatif.
    const odd = { ...base, dayCounts: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    expect(withDayPrayed(odd, 1, false).dayCounts[0]).toBe(0);
    expect(withDayPrayed(odd, 1, false).myDays).toEqual([2]);
  });

  it('prier le dernier jour manquant compte un priant de plus jusqu’au bout, et décocher le retire', () => {
    const almost = { ...base, myDays: [1, 2, 3, 4, 5, 6, 7, 8], finisherCount: 2 };
    const done = withDayPrayed(almost, 9, true);
    expect(done.finisherCount).toBe(3);
    expect(withDayPrayed(done, 9, false).finisherCount).toBe(2);
    expect(withDayPrayed(done, 5, false).finisherCount).toBe(2);
  });
});

describe('rappels', () => {
  const mine = (patch: Partial<MyNovena> = {}): MyNovena => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    groupId: base.groupId,
    groupName: 'Fraternité de test',
    title: 'Neuvaine à l’Esprit Saint',
    model: 'esprit-saint',
    ...paris,
    currentDay: 4,
    myDays: [1, 2, 3],
    reminderTime: '08:30',
    ...patch,
  });
  const iso = (days: { at: Date }[]) => days.map((d) => d.at.toISOString());

  it('l’heure du rappel est celle du mur du téléphone, à la date du jour', () => {
    expect(reminderInstant(paris, 1, '08:30', 'Europe/Paris')?.toISOString()).toBe('2026-10-20T06:30:00.000Z');
    // Après le retour à l'heure d'hiver : UTC+1.
    expect(reminderInstant(paris, 7, '08:30', 'Europe/Paris')?.toISOString()).toBe('2026-10-26T07:30:00.000Z');
    expect(reminderInstant(paris, 10, '08:30', 'Europe/Paris')).toBeNull();
    expect(reminderInstant(paris, 1, 'pas une heure', 'Europe/Paris')).toBeNull();
  });

  it('un téléphone plus à l’est n’annonce pas un jour que le serveur n’ouvre pas encore', () => {
    // 06:00 à Tokyo le 20 octobre = 21:00 UTC le 19, avant minuit à Paris (22:00 UTC) : repoussé à l'ouverture du jour 1.
    expect(reminderInstant(paris, 1, '06:00', 'Asia/Tokyo')?.toISOString()).toBe('2026-10-19T22:00:00.000Z');
  });

  it('les 3 prochains jours non priés, à venir', () => {
    // Jour 4 (23 octobre) à 06:00 UTC : 08:30 de Paris est à 06:30 UTC, encore devant nous.
    const now = at('2026-10-23T06:00:00Z');
    const days = nextReminderDays(mine({ myDays: [1, 2, 3] }), now, 3, 'Europe/Paris');
    expect(days.map((d) => d.day)).toEqual([4, 5, 6]);
    expect(iso(days)[0]).toBe('2026-10-23T06:30:00.000Z');
  });

  it('saute les jours déjà priés et ceux dont l’heure est passée', () => {
    const now = at('2026-10-23T09:00:00Z'); // 11 h à Paris : le rappel du jour 4 est passé
    const days = nextReminderDays(mine({ myDays: [5] }), now, 3, 'Europe/Paris');
    expect(days.map((d) => d.day)).toEqual([6, 7, 8]);
  });

  it('s’arrête au jour 9 et ne rappelle rien sans heure réglée', () => {
    const now = at('2026-10-27T06:00:00Z'); // jour 8, rappel de 8 h 30 encore devant nous
    expect(nextReminderDays(mine({ myDays: [] }), now, 3, 'Europe/Paris').map((d) => d.day)).toEqual([8, 9]);
    expect(nextReminderDays(mine({ reminderTime: null }), now, 3, 'Europe/Paris')).toEqual([]);
    expect(nextReminderDays(mine(), at('2026-11-30T06:00:00Z'), 3, 'Europe/Paris')).toEqual([]);
  });

  it('planNovenaReminders : identifiants novena-…, 3 neuvaines au plus, 3 jours chacune', () => {
    const list = Array.from({ length: 5 }, (_, i) =>
      mine({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`, startDate: `2026-10-${20 + i}`, myDays: [] }),
    );
    const planned = planNovenaReminders(list, at('2026-10-19T12:00:00Z'), 'Europe/Paris');
    expect(planned).toHaveLength(NOVENA_REMINDERS_MAX);
    expect(new Set(planned.map((p) => p.novenaId)).size).toBe(3);
    expect(planned.every((p) => p.identifier.startsWith('novena-'))).toBe(true);
    expect(planned.every((p) => p.identifier === `novena-${p.novenaId}-${p.day}`)).toBe(true);
    // Les plus proches d'abord.
    expect(planned.map((p) => p.novenaId)).toEqual(list.slice(0, 3).flatMap((n) => [n.id, n.id, n.id]));
    expect(planned[0].title).toBe(reminderTitle(list[0]));
    expect(planned[0].body).toBe(reminderBody(1));
    expect(reminderBody(4)).toBe('Jour 4 sur 9. Touche pour prier.');
  });

  it('planNovenaReminders ignore les neuvaines sans rappel ou sans jour à rappeler', () => {
    const now = at('2026-10-23T06:00:00Z');
    expect(planNovenaReminders([mine({ reminderTime: null })], now, 'Europe/Paris')).toEqual([]);
    expect(planNovenaReminders([mine({ myDays: [1, 2, 3, 4, 5, 6, 7, 8, 9] })], now, 'Europe/Paris')).toEqual([]);
  });

  it('budget iOS : rappel quotidien + rendez-vous + neuvaines + Rosaire vivant tiennent dans 64', () => {
    expect(DAILY_REMINDERS_MAX).toBe(15);
    expect(GATHERING_REMINDERS_MAX).toBe(30);
    expect(NOVENA_REMINDERS_MAX).toBe(9);
    expect(ROSARY_REMINDERS_MAX).toBe(3);
    const total = DAILY_REMINDERS_MAX + GATHERING_REMINDERS_MAX + NOVENA_REMINDERS_MAX + ROSARY_REMINDERS_MAX;
    expect(total).toBe(57);
    expect(total).toBeLessThanOrEqual(64);
  });

  it('lit l’adresse d’une notification de neuvaine sans confondre avec un groupe', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(novenaIdFromUrl(`/neuvaine/${id}`)).toBe(id);
    expect(novenaIdFromUrl(`/groupe/${id}`)).toBeNull();
    expect(groupIdFromUrl(`/neuvaine/${id}`)).toBeNull();
    expect(groupIdFromUrl(`/groupe/${id}`)).toBe(id);
    expect(novenaIdFromUrl('/neuvaine/../x')).toBeNull();
    expect(novenaIdFromUrl(undefined)).toBeNull();
  });
});

describe('libellés', () => {
  it('statusLabel', () => {
    expect(statusLabel(paris, at('2026-10-23T10:00:00Z'))).toBe('Jour 4 sur 9');
    expect(statusLabel(paris, at('2026-10-19T10:00:00Z'))).toBe('Commence demain');
    expect(statusLabel(paris, at('2026-10-15T10:00:00Z'))).toBe('Commence dans 5 jours');
    expect(statusLabel(paris, at('2026-11-30T10:00:00Z'))).toBe('Terminée');
    expect(dayOfLabel(4)).toBe('Jour 4 sur 9');
  });

  it('compteurs anonymes', () => {
    expect(prayedTodayLabel(7)).toBe('7 ont prié aujourd’hui');
    expect(prayedTodayLabel(1)).toBe('1 a prié aujourd’hui');
    expect(prayedTodayLabel(0)).toBe('Personne n’a encore prié aujourd’hui');
    expect(dayCountLabel(12)).toBe('12 ont prié');
    expect(dayCountLabel(1)).toBe('1 a prié');
    expect(finishersLabel(12)).toBe('12 membres l’ont priée jusqu’au bout');
    expect(finishersLabel(1)).toBe('1 membre l’a priée jusqu’au bout');
    expect(finishersLabel(0)).toBe('Personne ne l’a encore priée jusqu’au bout');
  });

  it('jour verrouillé', () => {
    expect(lockedLabel(paris, 5)).toBe('Ce jour s’ouvre le samedi 24 octobre');
  });

  it('prié aujourd’hui, et neuvaines en cours', () => {
    const now = at('2026-10-23T10:00:00Z'); // jour 4
    const todo = { ...paris, myDays: [1, 2, 3] };
    const done = { ...paris, myDays: [4] };
    expect(prayedToday(todo, now)).toBe(false);
    expect(prayedToday(done, now)).toBe(true);
    expect(prayedToday(todo, at('2026-10-10T10:00:00Z'))).toBeNull();
    const mk = (id: string, startDate: string, myDays: number[]): MyNovena => ({
      id,
      groupId: base.groupId,
      groupName: 'G',
      title: 'T',
      model: 'saint-joseph',
      startDate,
      timezone: 'Europe/Paris',
      currentDay: 4,
      myDays,
      reminderTime: null,
    });
    const list = [
      mk('prie', '2026-10-20', [4]),
      mk('a-prier', '2026-10-21', []),
      mk('future', '2026-11-01', []),
      mk('finie', '2026-10-01', []),
    ];
    expect(runningNovenas(list, now).map((n) => n.id)).toEqual(['a-prier', 'prie']);
  });
});

describe('formulaire', () => {
  it('début : aujourd’hui ou dans les 30 prochains jours, dans le fuseau donné', () => {
    const now = at('2026-10-20T10:00:00Z');
    expect(startProblem('2026-10-20', 'Europe/Paris', now)).toBeNull();
    expect(startProblem('2026-11-19', 'Europe/Paris', now)).toBeNull();
    expect(startProblem('2026-11-20', 'Europe/Paris', now)).not.toBeNull();
    expect(startProblem('2026-10-19', 'Europe/Paris', now)).not.toBeNull();
    // Il est déjà le 21 à Auckland.
    expect(startProblem('2026-10-20', 'Pacific/Auckland', at('2026-10-20T20:00:00Z'))).not.toBeNull();
  });

  it('startDateFor décale depuis le jour du téléphone', () => {
    expect(startDateFor(0, new Date(2026, 9, 20, 12))).toBe('2026-10-20');
    expect(startDateFor(1, new Date(2026, 9, 31, 12))).toBe('2026-11-01');
    expect(startDateFor(30, new Date(2026, 9, 20, 12))).toBe('2026-11-19');
  });

  it('intention (1 à 280) et prière personnalisée (1 à 2000)', () => {
    expect(intentionProblem('')).not.toBeNull();
    expect(intentionProblem('   ')).not.toBeNull();
    expect(intentionProblem('Pour la paix.')).toBeNull();
    expect(intentionProblem('a'.repeat(280))).toBeNull();
    expect(intentionProblem('a'.repeat(281))).not.toBeNull();
    expect(customPrayerProblem('')).not.toBeNull();
    expect(customPrayerProblem('a'.repeat(CUSTOM_PRAYER_MAX))).toBeNull();
    expect(customPrayerProblem('a'.repeat(CUSTOM_PRAYER_MAX + 1))).not.toBeNull();
  });

  it('un groupe éphémère ne peut pas finir avant la neuvaine', () => {
    // Le jour 9 finit le 28 octobre à 23:00 UTC.
    expect(endsAfterGroup(paris, null)).toBe(false);
    expect(endsAfterGroup(paris, '2026-10-28T23:00:00Z')).toBe(false);
    expect(endsAfterGroup(paris, '2026-10-28T22:59:00Z')).toBe(true);
  });
});

describe('lecteurs', () => {
  const row = {
    id: base.id,
    group_id: base.groupId,
    group_name: 'Fraternité de test',
    group_ended: false,
    can_manage: true,
    model: 'esprit-saint',
    title: 'Neuvaine à l’Esprit Saint',
    intention: 'Pour la paix.',
    custom_prayer: null,
    passage_set: null,
    start_date: '2026-10-20',
    timezone: 'Europe/Paris',
    current_day: 4,
    day_counts: [3, 3, 2, 1, 0, 0, 0, 0, 0],
    my_days: [2, 1, 2, 11, 'x'],
    reminder_time: '08:30',
    finisher_count: 0,
    member_count: 5,
  };

  it('lit une ligne complète (jours dédoublonnés, triés, bornés ; heure en HH:MM)', () => {
    const n = readNovena(row);
    expect(n).toMatchObject({ id: base.id, model: 'esprit-saint', currentDay: 4, myDays: [1, 2], reminderTime: '08:30', canManage: true });
    expect(n?.dayCounts).toHaveLength(9);
    expect(readNovena({ ...row, reminder_time: '08:30:00' })?.reminderTime).toBe('08:30');
    expect(readNovena({ ...row, reminder_time: null })?.reminderTime).toBeNull();
  });

  it('ignore une ligne inattendue sans lever d’erreur', () => {
    expect(readNovena(null)).toBeNull();
    expect(readNovena('x')).toBeNull();
    expect(readNovena({ ...row, model: 'inconnu' })).toBeNull();
    expect(readNovena({ ...row, day_counts: [1, 2] })).toBeNull();
    expect(readNovena({ ...row, day_counts: [1, 2, 3, 4, 5, 6, 7, 8, 'x'] })).toBeNull();
    expect(readNovena({ ...row, timezone: 'Nulle/Part' })).toBeNull();
    expect(readNovena({ ...row, start_date: '2026-02-30' })).toBeNull();
    expect(readNovena({ ...row, current_day: 12 })).toBeNull();
    expect(readNovena({ ...row, intention: '' })).toBeNull();
    expect(readNovena({ ...row, id: undefined })).toBeNull();
  });

  it('une neuvaine personnalisée demande sa prière ; un modèle intégré n’en garde pas', () => {
    expect(readNovena({ ...row, model: 'personnalisee', custom_prayer: null })).toBeNull();
    const custom = readNovena({ ...row, model: 'personnalisee', custom_prayer: 'Seigneur, écoute-nous.', passage_set: 'psaumes' });
    expect(custom).toMatchObject({ customPrayer: 'Seigneur, écoute-nous.', passageSet: 'psaumes' });
    expect(readNovena({ ...row, model: 'personnalisee', custom_prayer: 'x', passage_set: 'autre' })?.passageSet).toBeNull();
    expect(readNovena({ ...row, custom_prayer: 'x', passage_set: 'psaumes' })).toMatchObject({ customPrayer: null, passageSet: null });
  });

  it('lit mes neuvaines pour la synchro', () => {
    const mineRow = {
      id: base.id,
      group_id: base.groupId,
      group_name: 'G',
      title: 'T',
      model: 'notre-dame',
      start_date: '2026-10-20',
      timezone: 'Europe/Paris',
      current_day: 0,
      my_days: [],
      reminder_time: '20:00',
    };
    expect(readMyNovena(mineRow)).toMatchObject({ model: 'notre-dame', reminderTime: '20:00', myDays: [] });
    expect(readMyNovena({ ...mineRow, group_name: undefined })).toBeNull();
    expect(readMyNovena({ ...mineRow, timezone: 'Nulle/Part' })).toBeNull();
    expect(readMyNovena(42)).toBeNull();
  });
});

/** Échoue avec un message qui dit quel jour ou quel passage est en cause (expect n'accepte pas de message). */
function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const wordCount = (text: string) => text.trim().split(/\s+/).length;

describe('contenu des neuvaines', () => {
  const translations: TranslationId[] = ['lsg', 'crampon'];

  const checkPassage = (label: string, [book, chapter, from, to]: Passage) => {
    for (const t of translations) {
      const meta = bookMeta(book, t);
      must(!!meta, `${label} : livre ${book} inconnu (${t})`);
      must(chapter >= 1 && chapter <= meta.verses.length, `${label} : chapitre ${chapter} inexistant (${t})`);
      must(from >= 1 && to >= from, `${label} : versets ${from}-${to} invalides`);
      must(to <= meta.verses[chapter - 1], `${label} : verset ${to} inexistant (${t})`);
      const verses = loadPassage(book, chapter, from, to, t);
      must(verses.length === to - from + 1, `${label} : ${verses.length} versets lus (${t})`);
      must(
        verses.every((v) => v.trim().length > 0),
        `${label} : verset vide (${t})`,
      );
    }
  };

  it('quatre modèles intégrés, plus la neuvaine personnalisée', () => {
    expect(NOVENAS.map((n) => n.id)).toEqual(['esprit-saint', 'saint-joseph', 'sacre-coeur', 'notre-dame']);
    expect(NOVENA_MODELS).toEqual([...NOVENAS.map((n) => n.id), 'personnalisee']);
    for (const model of NOVENA_MODELS) {
      expect(novenaTemplate(model) === undefined).toBe(model === 'personnalisee');
      expect(novenaModelTitle(model).length).toBeGreaterThanOrEqual(3);
      expect(novenaModelTitle(model).length).toBeLessThanOrEqual(60);
    }
    expect(novenaModelTitle('personnalisee')).toBe(CUSTOM_TITLE);
  });

  for (const novena of NOVENAS) {
    describe(novena.title, () => {
      it('a un titre, une présentation et neuf jours', () => {
        expect(novena.title.length).toBeGreaterThan(3);
        expect(novena.short.length).toBeGreaterThan(20);
        expect(novena.days).toHaveLength(NOVENA_DAYS);
      });

      it('chaque passage existe dans la Louis Segond et dans la Crampon, sans doublon', () => {
        for (const [i, day] of novena.days.entries()) checkPassage(`${novena.id} jour ${i + 1}`, day.passage);
        const keys = novena.days.map((d) => d.passage.join(':'));
        expect(new Set(keys).size).toBe(NOVENA_DAYS);
      });

      it('chaque jour a un titre, une méditation de 60 à 110 mots et une prière', () => {
        novena.days.forEach((day, i) => {
          must(day.title.trim().length > 3, `jour ${i + 1} : titre`);
          const words = wordCount(day.meditation);
          must(words >= 60 && words <= 110, `jour ${i + 1} : méditation de ${words} mots`);
          const prayerWords = wordCount(day.prayer);
          must(prayerWords >= 25 && prayerWords <= 90, `jour ${i + 1} : prière de ${prayerWords} mots`);
          must(day.prayer.trim().endsWith('Amen.'), `jour ${i + 1} : la prière finit par Amen.`);
        });
        expect(new Set(novena.days.map((d) => d.meditation)).size).toBe(NOVENA_DAYS);
      });

      it('les prières répétées existent dans le recueil et ont un texte', () => {
        for (const day of novena.days) {
          expect(day.repeated.length).toBeGreaterThan(0);
          for (const ref of day.repeated) {
            must(!!prayerById(ref.id)?.text, `prière ${ref.id} absente du recueil`);
            must(ref.times >= 1 && ref.times <= 3, `prière ${ref.id} : ${ref.times} fois`);
          }
        }
      });
    });
  }

  it('les suites de passages d’une neuvaine personnalisée ont neuf passages valides chacune', () => {
    expect(Object.keys(PASSAGE_SET_DATA).sort()).toEqual([...PASSAGE_SETS].sort());
    for (const id of PASSAGE_SETS) {
      expect(PASSAGE_SET_DATA[id].passages).toHaveLength(NOVENA_DAYS);
      for (const [i, p] of PASSAGE_SET_DATA[id].passages.entries()) checkPassage(`${id} jour ${i + 1}`, p);
    }
  });
});
