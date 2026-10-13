import { planById, planChapters, planStatus } from '../src/plans';
import { sessionLabel } from '../src/rosary';

const plan = planById('evangiles-30');
if (!plan) throw new Error('plan evangiles-30 introuvable');
const total = planChapters(plan).length; // 89 chapitres sur 30 jours

describe('planStatus', () => {
  it('prévoit la portion du premier jour', () => {
    const s = planStatus(plan, { start: '2026-01-01', pos: 0, verse: 1 }, '2026-01-01');
    expect(s.day).toBe(0);
    expect(s.today).toHaveLength(Math.floor(total / plan.days));
    expect(s.todayComplete).toBe(false);
    expect(s.next?.key).toBe('40:1');
  });

  it('compte le retard sur les jours passés', () => {
    const s = planStatus(plan, { start: '2026-01-01', pos: 10, verse: 1 }, '2026-01-06');
    expect(s.day).toBe(5);
    expect(s.behind).toBe(Math.floor((5 * total) / plan.days) - 10);
    expect(s.todayComplete).toBe(false);
  });

  it('compte l’avance et la fin du plan', () => {
    const ahead = planStatus(plan, { start: '2026-01-01', pos: 20, verse: 1 }, '2026-01-01');
    expect(ahead.todayComplete).toBe(true);
    expect(ahead.ahead).toBe(20 - Math.floor(total / plan.days));

    const done = planStatus(plan, { start: '2026-01-01', pos: total, verse: 1 }, '2026-03-01');
    expect(done.finished).toBe(true);
    expect(done.next).toBeNull();
    expect(done.day).toBe(plan.days - 1);
  });
});

describe('sessionLabel du chapelet', () => {
  const session = { set: 0, decade: null, fatima: true, intention: '', day: '2026-01-01' };

  it('place le Gloria de l’introduction dans l’introduction', () => {
    expect(sessionLabel({ ...session, step: 6 })).toContain('introduction');
  });

  it('annonce la conclusion après la dernière dizaine', () => {
    // 7 étapes d'introduction, puis 5 dizaines de 14 étapes avec Fatima : le Salve Regina est la 78ᵉ.
    expect(sessionLabel({ ...session, step: 76 })).toContain('dizaine 5 sur 5');
    expect(sessionLabel({ ...session, step: 77 })).toContain('conclusion');
  });
});
