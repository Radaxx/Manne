import { adventStart, baptism, easter, epiphany, liturgicalDay, liturgicalYear, upcomingFeasts } from '../src/liturgical-year';

describe('dates de l’année liturgique', () => {
  it('calcule Pâques', () => {
    expect(easter(2024)).toBe('2024-03-31');
    expect(easter(2025)).toBe('2025-04-20');
    expect(easter(2026)).toBe('2026-04-05');
    expect(easter(2027)).toBe('2027-03-28');
    expect(easter(2038)).toBe('2038-04-25');
  });

  it('place le premier dimanche de l’Avent', () => {
    expect(adventStart(2025)).toBe('2025-11-30');
    expect(adventStart(2026)).toBe('2026-11-29');
    expect(adventStart(2022)).toBe('2022-11-27'); // le 24 décembre est un samedi : Avent le plus long
    expect(adventStart(2023)).toBe('2023-12-03'); // le 24 décembre est un dimanche : Avent le plus court
  });

  it('fête l’Épiphanie le dimanche et déplace le Baptême au lundi quand il le faut', () => {
    expect(epiphany(2027)).toBe('2027-01-03');
    expect(baptism(2027)).toBe('2027-01-10');
    expect(epiphany(2024)).toBe('2024-01-07');
    expect(baptism(2024)).toBe('2024-01-08');
  });
});

describe('liturgicalDay', () => {
  it('reconnaît les temps et leurs semaines', () => {
    expect(liturgicalDay('2026-10-13')).toMatchObject({ season: 'ordinaire', week: 28, color: 'vert', sundayCycle: 'A' });
    expect(liturgicalDay('2026-11-22')).toMatchObject({ season: 'ordinaire', week: 34, label: '34e dimanche du temps ordinaire' });
    expect(liturgicalDay('2026-11-22').feast?.name).toBe('Le Christ, Roi de l’univers');
    expect(liturgicalDay('2026-11-29')).toMatchObject({
      season: 'avent',
      week: 1,
      label: '1er dimanche de l’Avent',
      sundayCycle: 'B',
      weekdayCycle: 'I',
    });
    expect(liturgicalDay('2026-12-13')).toMatchObject({ season: 'avent', week: 3, color: 'rose' });
    expect(liturgicalDay('2026-12-25')).toMatchObject({ season: 'noel', label: 'Nativité du Seigneur' });
    expect(liturgicalDay('2027-01-11')).toMatchObject({ season: 'ordinaire', week: 1 });
    expect(liturgicalDay('2027-01-17')).toMatchObject({ season: 'ordinaire', week: 2, label: '2e dimanche du temps ordinaire' });
    expect(liturgicalDay('2027-02-10')).toMatchObject({ season: 'careme', label: 'Mercredi des Cendres' });
    expect(liturgicalDay('2027-03-07')).toMatchObject({ season: 'careme', week: 4, color: 'rose' });
    expect(liturgicalDay('2027-03-21')).toMatchObject({ season: 'careme', label: 'Dimanche des Rameaux et de la Passion', color: 'rouge' });
    expect(liturgicalDay('2027-03-26')).toMatchObject({ season: 'triduum', label: 'Vendredi saint', color: 'rouge' });
    expect(liturgicalDay('2027-03-28')).toMatchObject({ season: 'paques', label: 'Dimanche de Pâques' });
    expect(liturgicalDay('2027-05-16')).toMatchObject({ season: 'paques', label: 'Pentecôte', color: 'rouge' });
    expect(liturgicalDay('2027-05-17')).toMatchObject({ season: 'ordinaire', week: 7 });
  });

  it('reconnaît les grandes fêtes et leurs déplacements', () => {
    expect(liturgicalDay('2026-11-01').feast?.name).toBe('Toussaint');
    expect(liturgicalDay('2026-12-08').feast?.name).toBe('Immaculée Conception');
    expect(liturgicalDay('2024-03-25').feast).toBeNull(); // Lundi saint : l'Annonciation est repoussée
    expect(liturgicalDay('2024-04-08').feast?.name).toBe('Annonciation du Seigneur');
    expect(liturgicalDay('2027-03-19').feast?.name).toBe('Saint Joseph');
  });
});

describe('liturgicalYear', () => {
  it('enchaîne les temps sans trou de l’Avent à l’Avent', () => {
    const { start, end, spans } = liturgicalYear('2026-12-10');
    expect(start).toBe('2026-11-29');
    expect(end).toBe('2027-11-27');
    expect(spans[0].from).toBe(start);
    expect(spans[spans.length - 1].to).toBe(end);
    for (let i = 1; i < spans.length; i++) {
      const next = new Date(`${spans[i - 1].to}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      expect(spans[i].from).toBe(next.toISOString().slice(0, 10));
    }
  });

  it('annonce les prochaines fêtes dans l’ordre', () => {
    expect(upcomingFeasts('2026-10-13', 3).map((f) => f.name)).toEqual([
      'Toussaint',
      'Commémoraison des fidèles défunts',
      'Le Christ, Roi de l’univers',
    ]);
  });
});
