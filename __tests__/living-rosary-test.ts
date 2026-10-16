import { ADORATION_REMINDERS_MAX } from '../src/adoration-reminders';
import { MYSTERIES } from '../src/data/prayers';
import { GATHERING_REMINDERS_MAX } from '../src/gathering-reminders';
import {
  assignPlace,
  chapeletTarget,
  focusTeam,
  holderLabel,
  type LivingRosary,
  localDateIn,
  type MyRosary,
  monthsElapsed,
  myMysteryLabel,
  mysteryFor,
  mysteryIndex,
  mysteryName,
  mysteryOfMonth,
  mysteryOrdinalLabel,
  mysterySeries,
  nextMysteryLabel,
  nextReminderDays,
  readLivingRosary,
  readMyRosary,
  rosaryToday,
  teamProgressLabel,
  withDecadePrayed,
} from '../src/living-rosary';
import { NOVENA_REMINDERS_MAX } from '../src/novena-reminders';
import { DAILY_REMINDERS_MAX } from '../src/reminder';
import { planRosaryReminders, ROSARY_REMINDERS_MAX, reminderBody, reminderTitle, rosaryIdFromUrl } from '../src/rosary-reminders';

const at = (iso: string) => new Date(iso);
const paris = { startMonth: '2026-09-01', timezone: 'Europe/Paris' };

describe('mystère du mois', () => {
  it('(place + mois écoulés) mod 20, dans les deux sens', () => {
    expect(mysteryFor(0, 0)).toBe(0);
    expect(mysteryFor(19, 1)).toBe(0);
    expect(mysteryFor(5, 35)).toBe(0);
    expect(mysteryFor(3, 20)).toBe(3);
    expect(mysteryFor(0, -1)).toBe(19);
  });

  it('un tour complet de 20 mois ramène au même mystère', () => {
    for (let slot = 0; slot < 20; slot++) expect(mysteryFor(slot, 20)).toBe(slot);
  });

  it('chaque mois, les 20 places d’une équipe portent les 20 mystères une fois chacune', () => {
    for (let months = 0; months < 25; months++) {
      const seen = new Set(Array.from({ length: 20 }, (_, slot) => mysteryFor(slot, months)));
      expect(seen.size).toBe(20);
    }
  });
});

describe('mois écoulés dans le fuseau du Rosaire', () => {
  it('0 le mois du lancement, +1 le 1er du mois à minuit heure de Paris (UTC+2 en octobre)', () => {
    expect(monthsElapsed(paris, at('2026-09-15T12:00:00Z'))).toBe(0);
    expect(monthsElapsed(paris, at('2026-09-30T21:59:00Z'))).toBe(0);
    expect(monthsElapsed(paris, at('2026-09-30T22:00:00Z'))).toBe(1);
    expect(monthsElapsed(paris, at('2026-10-31T22:59:00Z'))).toBe(1);
  });

  it('suit le fuseau du Rosaire, pas celui du téléphone', () => {
    const toronto = { startMonth: '2026-09-01', timezone: 'America/Toronto' };
    // 1er octobre 00:00 à Toronto (UTC-4) = 04:00 UTC ; à Paris c'est déjà le 1er octobre depuis 22:00 UTC.
    expect(monthsElapsed(toronto, at('2026-10-01T03:59:00Z'))).toBe(0);
    expect(monthsElapsed(toronto, at('2026-10-01T04:00:00Z'))).toBe(1);
    expect(monthsElapsed(paris, at('2026-10-01T03:59:00Z'))).toBe(1);
  });

  it('le retour à l’heure d’hiver (25 octobre, jour de 25 h) ne décale ni les jours ni le 1er novembre', () => {
    expect(rosaryToday(paris, at('2026-10-24T21:59:00Z'))).toBe('2026-10-24');
    expect(rosaryToday(paris, at('2026-10-24T22:00:00Z'))).toBe('2026-10-25');
    // Après le changement d'heure (UTC+1) : minuit local = 23:00 UTC.
    expect(rosaryToday(paris, at('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(rosaryToday(paris, at('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
    expect(monthsElapsed(paris, at('2026-10-31T22:59:00Z'))).toBe(1);
    expect(monthsElapsed(paris, at('2026-10-31T23:00:00Z'))).toBe(2);
  });

  it('passe le 31 décembre à janvier et ne devient jamais négatif', () => {
    const nov = { startMonth: '2026-11-01', timezone: 'Europe/Paris' };
    expect(monthsElapsed(nov, at('2026-12-15T12:00:00Z'))).toBe(1);
    expect(monthsElapsed(nov, at('2027-01-15T12:00:00Z'))).toBe(2);
    expect(monthsElapsed(nov, at('2026-10-15T12:00:00Z'))).toBe(0);
  });

  it('un fuseau inconnu ne fait pas échouer : 0 mois', () => {
    expect(monthsElapsed({ startMonth: '2026-09-01', timezone: 'Mars/Olympus' }, at('2026-12-15T12:00:00Z'))).toBe(0);
    expect(() => localDateIn(0, 'Europe/Paris')).not.toThrow();
  });
});

describe('mystères et libellés', () => {
  it('suit l’ordre de MYSTERIES : joyeux 1 à 5, lumineux 6 à 10, douloureux 11 à 15, glorieux 16 à 20', () => {
    expect(MYSTERIES.map((s) => s.adjective)).toEqual(['joyeux', 'lumineux', 'douloureux', 'glorieux']);
    expect(mysterySeries(0)).toEqual({ serie: 0, dizaine: 1 });
    expect(mysterySeries(4)).toEqual({ serie: 0, dizaine: 5 });
    expect(mysterySeries(5)).toEqual({ serie: 1, dizaine: 1 });
    expect(mysterySeries(19)).toEqual({ serie: 3, dizaine: 5 });
    expect(mysteryName(1)).toBe('La Visitation');
    expect(mysteryName(5)).toBe('Le Baptême de Jésus');
    expect(mysteryName(19)).toBe('Le Couronnement de Marie');
    expect(mysteryOrdinalLabel(0)).toBe('1ᵉʳ mystère joyeux');
    expect(mysteryOrdinalLabel(11)).toBe('2ᵉ mystère douloureux');
  });

  it('mysteryIndex est l’inverse de mysterySeries', () => {
    for (let m = 0; m < 20; m++) {
      const { serie, dizaine } = mysterySeries(m);
      expect(mysteryIndex(serie, dizaine)).toBe(m);
    }
    expect(mysteryIndex(4, 1)).toBeNull();
    expect(mysteryIndex(0, 0)).toBeNull();
    expect(mysteryIndex(0, 6)).toBeNull();
    expect(mysteryIndex(0.5, 1)).toBeNull();
  });

  it('lit les paramètres du chapelet, ou null s’ils sont invalides', () => {
    expect(chapeletTarget('1', '3')).toEqual({ set: 1, decade: 2 });
    expect(chapeletTarget('0', '1')).toEqual({ set: 0, decade: 0 });
    expect(chapeletTarget('', '1')).toBeNull();
    expect(chapeletTarget('4', '1')).toBeNull();
    expect(chapeletTarget('0', '6')).toBeNull();
    expect(chapeletTarget('a', '1')).toBeNull();
    expect(chapeletTarget('-1', '1')).toBeNull();
  });

  it('écrit « Ton mystère en octobre : la Visitation » puis « En novembre : la Nativité »', () => {
    const now = at('2026-10-16T10:00:00Z');
    // Lancé en septembre : 1 mois écoulé en octobre. Place 0 -> mystère 1 (la Visitation), puis 2 (la Nativité).
    expect(mysteryOfMonth(paris, 0, now)).toBe(1);
    expect(myMysteryLabel(paris, 0, now)).toBe('Ton mystère en octobre : la Visitation');
    expect(nextMysteryLabel(paris, 0, now)).toBe('En novembre : la Nativité');
  });

  it('les noms avec élision et les pluriels gardent un article correct', () => {
    // Place 18 en octobre (1 mois) : mystère 19, le Couronnement de Marie ; le mois suivant : mystère 0, l'Annonciation.
    const now = at('2026-10-16T10:00:00Z');
    expect(myMysteryLabel(paris, 18, now)).toBe('Ton mystère en octobre : le Couronnement de Marie');
    expect(nextMysteryLabel(paris, 18, now)).toBe('En novembre : l’Annonciation');
    // Place 3 : mystère 4 puis 5 (le Baptême de Jésus).
    expect(nextMysteryLabel(paris, 4, now)).toBe('En novembre : les Noces de Cana');
  });

  it('décembre est suivi de janvier', () => {
    const now = at('2026-12-16T10:00:00Z');
    expect(nextMysteryLabel(paris, 0, now).startsWith('En janvier : ')).toBe(true);
  });

  it('la progression du jour', () => {
    expect(teamProgressLabel(14)).toBe('14 dizaines sur 20 aujourd’hui');
    expect(teamProgressLabel(1)).toBe('1 dizaine sur 20 aujourd’hui');
    expect(teamProgressLabel(0)).toBe('0 dizaine sur 20 aujourd’hui');
  });
});

describe('attribution d’une place', () => {
  const place = (team: number, slot: number) => ({ team, slot });

  it('un Rosaire vide : le plus petit mystère libre CE MOIS-CI dans l’équipe 1', () => {
    expect(assignPlace([], 0)).toEqual({ team: 1, slot: 0 });
    // 3 mois écoulés : le mystère 0 est tenu par la place 17.
    expect(assignPlace([], 3)).toEqual({ team: 1, slot: 17 });
  });

  it('saute les mystères déjà pris, pas les places', () => {
    // Mois 3 : la place 17 tient le mystère 0 ; elle est prise, le prochain libre est le mystère 1 (place 18).
    expect(assignPlace([place(1, 17)], 3)).toEqual({ team: 1, slot: 18 });
  });

  it('ouvre l’équipe 2 quand la 1 est pleine, puis la 3…', () => {
    const full = (team: number) => Array.from({ length: 20 }, (_, slot) => place(team, slot));
    expect(assignPlace(full(1), 4)).toEqual({ team: 2, slot: 16 });
    expect(assignPlace([...full(1), ...full(2)], 0)).toEqual({ team: 3, slot: 0 });
    const all = [1, 2, 3, 4, 5].flatMap(full);
    expect(assignPlace(all, 0)).toBeNull();
  });

  it('une place libérée est reprise en premier', () => {
    const taken = Array.from({ length: 20 }, (_, slot) => place(1, slot)).filter((p) => p.slot !== 7);
    expect(assignPlace(taken, 0)).toEqual({ team: 1, slot: 7 });
  });

  it('un mystère précis : libre dans l’équipe 1, sinon dans la suivante', () => {
    // Mois 2, mystère 5 -> place 3.
    expect(assignPlace([], 2, 5)).toEqual({ team: 1, slot: 3 });
    expect(assignPlace([place(1, 3)], 2, 5)).toEqual({ team: 2, slot: 3 });
    // Le mystère voulu garde sa place de base quand le mois change.
    expect(mysteryFor(3, 2)).toBe(5);
  });
});

describe('rappels', () => {
  const base = { ...paris, slot: 0, prayedToday: false, reminderTime: '08:00' };

  it('trois jours à l’heure du mur du téléphone, les heures passées étant écartées', () => {
    // 07:00 à Paris : le rappel de 08:00 d'aujourd'hui est encore devant.
    const days = nextReminderDays(base, at('2026-10-16T05:00:00Z'), 3, 'Europe/Paris');
    expect(days.map((d) => d.at.toISOString())).toEqual([
      '2026-10-16T06:00:00.000Z',
      '2026-10-17T06:00:00.000Z',
      '2026-10-18T06:00:00.000Z',
    ]);
    // 09:00 à Paris : on commence demain.
    const later = nextReminderDays(base, at('2026-10-16T07:00:00Z'), 3, 'Europe/Paris');
    expect(later[0].at.toISOString()).toBe('2026-10-17T06:00:00.000Z');
  });

  it('le jour déjà prié n’est pas rappelé', () => {
    const days = nextReminderDays({ ...base, prayedToday: true }, at('2026-10-16T05:00:00Z'), 3, 'Europe/Paris');
    expect(days.map((d) => d.at.toISOString().slice(0, 10))).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
  });

  it('chaque rappel porte le mystère du mois où il tombe (le 1er novembre change de mystère)', () => {
    const days = nextReminderDays(base, at('2026-10-30T05:00:00Z'), 3, 'Europe/Paris');
    expect(days.map((d) => d.mystery)).toEqual([1, 1, 2]);
    expect(reminderBody(1)).toBe('Ta dizaine : la Visitation. Touche pour prier.');
  });

  it('suit le fuseau du Rosaire pour savoir quel jour est prié', () => {
    const toronto = { ...base, timezone: 'America/Toronto', prayedToday: true };
    // Téléphone à Paris : 07:00 le 16, soit 01:00 le 16 à Toronto. Le rappel de 08:00 Paris tombe le 16 à Toronto (02:00) : déjà prié.
    const days = nextReminderDays(toronto, at('2026-10-16T05:00:00Z'), 3, 'Europe/Paris');
    expect(days.map((d) => d.at.toISOString().slice(0, 10))).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
  });

  it('sans heure réglée ou avec une heure illisible : aucun rappel', () => {
    expect(nextReminderDays({ ...base, reminderTime: null }, at('2026-10-16T05:00:00Z'), 3, 'Europe/Paris')).toEqual([]);
    expect(nextReminderDays({ ...base, reminderTime: '25:99' }, at('2026-10-16T05:00:00Z'), 3, 'Europe/Paris')).toEqual([]);
  });

  const mine = (over: Partial<MyRosary> = {}): MyRosary => ({
    ...paris,
    id: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    groupName: 'Fraternité de test',
    team: 1,
    slot: 0,
    today: '2026-10-16',
    prayedToday: false,
    reminderTime: '08:00',
    ...over,
  });

  it('planRosaryReminders : préfixe rosary-, adresse /rosaire/<id>, au plus 3, titre du groupe', () => {
    const planned = planRosaryReminders([mine()], at('2026-10-16T05:00:00Z'), 'Europe/Paris');
    expect(planned).toHaveLength(ROSARY_REMINDERS_MAX);
    for (const p of planned) {
      expect(p.identifier.startsWith('rosary-')).toBe(true);
      expect(p.rosaryId).toBe('11111111-1111-4111-8111-111111111111');
      expect(p.title).toBe(reminderTitle(mine()));
    }
    expect(new Set(planned.map((p) => p.identifier)).size).toBe(planned.length);
    expect(reminderTitle(mine())).toBe('Rosaire vivant — Fraternité de test');
  });

  it('un seul Rosaire est rappelé à la fois, même si le serveur en renvoyait deux', () => {
    const two = [mine(), mine({ id: '33333333-3333-4333-8333-333333333333' })];
    const planned = planRosaryReminders(two, at('2026-10-16T05:00:00Z'), 'Europe/Paris');
    expect(planned).toHaveLength(ROSARY_REMINDERS_MAX);
    expect(new Set(planned.map((p) => p.rosaryId)).size).toBe(1);
  });

  it('pas de rappel sans heure', () => {
    expect(planRosaryReminders([mine({ reminderTime: null })], at('2026-10-16T05:00:00Z'), 'Europe/Paris')).toEqual([]);
  });

  it('budget iOS : quotidien 15 + rendez-vous 30 + neuvaines 9 + Rosaire vivant 3 + adoration 3 = 60, dans 64', () => {
    const total = DAILY_REMINDERS_MAX + GATHERING_REMINDERS_MAX + NOVENA_REMINDERS_MAX + ROSARY_REMINDERS_MAX + ADORATION_REMINDERS_MAX;
    expect(ROSARY_REMINDERS_MAX).toBe(3);
    expect(total).toBe(60);
    expect(total).toBeLessThanOrEqual(64);
  });

  it('lit l’adresse d’une notification de Rosaire vivant', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(rosaryIdFromUrl(`/rosaire/${id}`)).toBe(id);
    expect(rosaryIdFromUrl(`/neuvaine/${id}`)).toBeNull();
    expect(rosaryIdFromUrl('/rosaire/../x')).toBeNull();
    expect(rosaryIdFromUrl(undefined)).toBeNull();
  });
});

describe('lecteurs', () => {
  const cell = (mystery: number, over: Record<string, unknown> = {}) => ({
    mystery,
    taken: false,
    mine: false,
    prayed: false,
    handle: null,
    hidden: false,
    ...over,
  });
  const team = (n: number, over: Record<number, Record<string, unknown>> = {}) => ({
    team: n,
    taken_count: 0,
    prayed_count: 0,
    mysteries: Array.from({ length: 20 }, (_, i) => cell(i, over[i])),
  });
  const row = (over: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    group_id: '22222222-2222-4222-8222-222222222222',
    group_name: 'Fraternité de test',
    group_ended: false,
    can_manage: true,
    start_month: '2026-09-01',
    timezone: 'Europe/Paris',
    today: '2026-10-16',
    months_elapsed: 1,
    reminder_time: '08:00:00',
    me: { team: 1, slot: 3, mystery: 4, next_mystery: 5, prayed_today: true },
    open_team: 1,
    participant_count: 3,
    teams: [
      team(1, {
        4: { taken: true, mine: true, prayed: true },
        7: { taken: true, handle: 'dev_marie', prayed: false },
        9: { taken: true, hidden: true, handle: 'secret' },
      }),
    ],
    ...over,
  });

  it('lit un Rosaire complet', () => {
    const r = readLivingRosary(row());
    expect(r).not.toBeNull();
    expect(r?.reminderTime).toBe('08:00');
    expect(r?.me).toEqual({ team: 1, slot: 3, mystery: 4, nextMystery: 5, prayedToday: true });
    expect(r?.teams[0].mysteries).toHaveLength(20);
    expect(r?.teams[0].takenCount).toBe(3);
    expect(r?.teams[0].prayedCount).toBe(1);
  });

  it('un mystère tenu par une personne bloquée n’expose aucun pseudo, même si le serveur en envoyait un', () => {
    const r = readLivingRosary(row());
    const hidden = r?.teams[0].mysteries[9];
    expect(hidden?.handle).toBeNull();
    expect(hidden && holderLabel(hidden)).toBe('Un membre');
    const marie = r?.teams[0].mysteries[7];
    expect(marie && holderLabel(marie)).toBe('@dev_marie');
    const me = r?.teams[0].mysteries[4];
    expect(me && holderLabel(me)).toBe('Toi');
    const free = r?.teams[0].mysteries[0];
    expect(free && holderLabel(free)).toBeNull();
  });

  it('un Rosaire sans participation : me est null ; un me abîmé aussi', () => {
    expect(readLivingRosary(row({ me: null }))?.me).toBeNull();
    expect(readLivingRosary(row({ me: { team: 9, slot: 3 } }))?.me).toBeNull();
  });

  it('ignore une équipe incomplète ou en double, et refuse un Rosaire sans équipe lisible', () => {
    const broken = { ...team(2), mysteries: team(2).mysteries.slice(0, 19) };
    const r = readLivingRosary(row({ teams: [team(1), broken] }));
    expect(r?.teams.map((t) => t.team)).toEqual([1]);
    const dup = { ...team(1), mysteries: [...team(1).mysteries.slice(0, 19), cell(0)] };
    expect(readLivingRosary(row({ teams: [dup] }))).toBeNull();
    expect(readLivingRosary(row({ teams: [] }))).toBeNull();
    expect(readLivingRosary(row({ teams: 'x' }))).toBeNull();
  });

  it('refuse un fuseau inconnu, un mois de départ qui n’est pas le 1er, un identifiant manquant, null', () => {
    expect(readLivingRosary(row({ timezone: 'Mars/Olympus' }))).toBeNull();
    expect(readLivingRosary(row({ start_month: '2026-09-15' }))).toBeNull();
    expect(readLivingRosary(row({ id: null }))).toBeNull();
    expect(readLivingRosary(null)).toBeNull();
    expect(readLivingRosary('x')).toBeNull();
  });

  it('trie les équipes et retrouve celle à montrer', () => {
    const r = readLivingRosary(row({ teams: [team(2), team(1)], me: null, open_team: 2 })) as LivingRosary;
    expect(r.teams.map((t) => t.team)).toEqual([1, 2]);
    expect(focusTeam(r)?.team).toBe(2);
    const joined = readLivingRosary(
      row({ teams: [team(2), team(1)], me: { team: 1, slot: 0, mystery: 0, next_mystery: 1, prayed_today: false } }),
    ) as LivingRosary;
    expect(focusTeam(joined)?.team).toBe(1);
  });

  it('lit mes Rosaires, en ignorant les lignes inattendues', () => {
    const ok = {
      id: '11111111-1111-4111-8111-111111111111',
      group_id: '22222222-2222-4222-8222-222222222222',
      group_name: 'Fraternité de test',
      start_month: '2026-09-01',
      timezone: 'Europe/Paris',
      team: 1,
      slot: 7,
      today: '2026-10-16',
      prayed_today: true,
      reminder_time: '20:30',
    };
    expect(readMyRosary(ok)).toMatchObject({ slot: 7, prayedToday: true, reminderTime: '20:30' });
    expect(readMyRosary({ ...ok, slot: 20 })).toBeNull();
    expect(readMyRosary({ ...ok, team: 6 })).toBeNull();
    expect(readMyRosary({ ...ok, reminder_time: null })?.reminderTime).toBeNull();
    expect(readMyRosary(undefined)).toBeNull();
  });

  it('cocher ou décocher met à jour ma couronne sans toucher aux autres', () => {
    const r = readLivingRosary(row({ me: { team: 1, slot: 3, mystery: 4, next_mystery: 5, prayed_today: false } })) as LivingRosary;
    const on = withDecadePrayed(r, true);
    expect(on.me?.prayedToday).toBe(true);
    expect(on.teams[0].prayedCount).toBe(r.teams[0].prayedCount + 1);
    expect(on.teams[0].mysteries[4].prayed).toBe(true);
    expect(withDecadePrayed(on, true)).toBe(on);
    const off = withDecadePrayed(on, false);
    expect(off.teams[0].prayedCount).toBe(r.teams[0].prayedCount);
    const none = readLivingRosary(row({ me: null })) as LivingRosary;
    expect(withDecadePrayed(none, true)).toBe(none);
  });
});
