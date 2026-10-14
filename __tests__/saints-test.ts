import { SAINTS } from '../src/data/saints';
import { shiftDay } from '../src/dates';
import { saintKicker, saintOfDay } from '../src/saints';

describe('saint du jour', () => {
  it('a un saint pour chaque jour, années bissextiles comprises', () => {
    for (let d = '2028-01-01'; d <= '2028-12-31'; d = shiftDay(d, 1)) {
      const { saints } = saintOfDay(d);
      expect(saints.length).toBeGreaterThan(0);
      for (const s of saints) expect(s.life.length).toBeGreaterThan(40);
    }
    expect(Object.keys(SAINTS)).toHaveLength(366);
  });

  it('écrit les notices avec l’apostrophe typographique', () => {
    for (const list of Object.values(SAINTS)) for (const s of list) expect(`${s.name} ${s.title ?? ''} ${s.life}`).not.toMatch(/'/);
  });

  it('dit quand le dimanche, le Carême ou la Semaine sainte passe avant', () => {
    expect(saintOfDay('2026-10-15').note).toBeNull();
    expect(saintOfDay('2026-10-18').note).toBe('Cette année, le dimanche passe avant sa fête.');
    expect(saintOfDay('2027-03-04').note).toBe('En Carême, sa mémoire devient une simple commémoraison.');
    expect(saintOfDay('2026-04-02').note).toBe('Cette année, la Semaine sainte passe avant sa mémoire.');
    expect(saintOfDay('2026-12-21').note).toBe('Du 17 au 24 décembre, sa mémoire devient une simple commémoraison.');
    // Les fêtes du Seigneur passent avant le dimanche, et les solennités ne s'effacent pas.
    expect(saintOfDay('2026-11-09').note).toBeNull();
    expect(saintOfDay('2026-11-01').note).toBeNull();
  });

  it('suit saint Joseph et l’Immaculée Conception quand ils changent de jour', () => {
    expect(saintOfDay('2028-03-19').note).toBe('Cette année, la solennité est célébrée le lundi 20 mars.');
    expect(saintOfDay('2024-12-08').note).toBe('Cette année, la solennité est célébrée le lundi 9 décembre.');
    expect(saintOfDay('2026-12-08').note).toBeNull();
  });

  it('met en avant les mémoires mariales qui suivent la Pentecôte et le Sacré-Cœur', () => {
    expect(saintOfDay('2026-05-25').saints[0].name).toBe('Bienheureuse Vierge Marie, Mère de l’Église');
    const june = saintOfDay('2026-06-13').saints.map((s) => s.name);
    expect(june).toEqual(['Cœur immaculé de Marie', 'Saint Antoine de Padoue']);
  });

  it('distingue les saints des fêtes', () => {
    expect(saintKicker(saintOfDay('2026-10-15').saints[0])).toBe('Saint du jour · Mémoire');
    expect(saintKicker(saintOfDay('2026-10-12').saints[0])).toBe('Saint du jour');
    expect(saintKicker(saintOfDay('2026-08-15').saints[0])).toBe('Fête du jour · Solennité');
  });
});
