import { type Progress, prepareStored, readingPosition, today } from '../src/storage';
import { mergeProgress } from '../src/sync';
import { shiftDay } from '../src/today';

const NOW = Date.now();
const progress = (patch: Partial<Progress> = {}) => prepareStored(patch);

describe('mergeProgress', () => {
  it('additionne les listes des deux téléphones', () => {
    const merged = mergeProgress(progress({ liked: ['a'], chaptersRead: ['41:1'] }), progress({ liked: ['b'], chaptersRead: ['41:2'] }));
    expect(merged.liked.sort()).toEqual(['a', 'b']);
    expect(merged.chaptersRead.sort()).toEqual(['41:1', '41:2']);
  });

  it('laisse un retrait plus récent l’emporter sur la présence de l’autre côté', () => {
    const here = progress({ liked: [], stamps: { 'liked:a': NOW } });
    const there = progress({ liked: ['a'], stamps: { 'liked:a': NOW - 1000 } });
    expect(mergeProgress(here, there).liked).toEqual([]);
  });

  it('garde un élément ajouté après le retrait de l’autre côté', () => {
    const here = progress({ liked: [], stamps: { 'liked:a': NOW - 1000 } });
    const there = progress({ liked: ['a'], stamps: { 'liked:a': NOW } });
    expect(mergeProgress(here, there).liked).toEqual(['a']);
  });

  it('retire un plan arrêté plus récemment, garde le plus avancé sinon', () => {
    const start = today();
    const stopped = progress({ plans: {}, stamps: { 'plan:psaumes-30': NOW } });
    const running = progress({ plans: { 'psaumes-30': { start, pos: 3, verse: 1 } } });
    expect(mergeProgress(stopped, running).plans).toEqual({});

    const ahead = progress({ plans: { 'psaumes-30': { start, pos: 8, verse: 1 } } });
    expect(mergeProgress(running, ahead).plans['psaumes-30'].pos).toBe(8);
  });

  it('fait gagner un recul explicite du marque-page, sinon la position la plus avancée', () => {
    const back = progress({ positions: { 41: { chapter: 1, verse: 1 } }, stamps: { 'pos:41': NOW } });
    const far = progress({ positions: { 41: { chapter: 9, verse: 4 } } });
    expect(mergeProgress(back, far).positions[41]).toEqual({ chapter: 1, verse: 1 });

    const near = progress({ positions: { 41: { chapter: 2, verse: 1 } } });
    expect(mergeProgress(near, far).positions[41]).toEqual({ chapter: 9, verse: 4 });
  });

  it('ne fait jamais sortir la liste de confession du téléphone, mais garde la date la plus récente', () => {
    const here = progress({ confession: { items: [{ id: 'c1', text: 'secret', at: 1 }], lastConfession: '2026-01-01' } });
    const there = progress({ confession: { items: [], lastConfession: '2026-02-01' } });
    const merged = mergeProgress(here, there);
    expect(merged.confession.items.map((i) => i.id)).toEqual(['c1']);
    expect(merged.confession.lastConfession).toBe('2026-02-01');
  });

  it('fusionne le journal jour par jour et ignore les versets d’un autre jour', () => {
    const yesterday = shiftDay(today(), -1);
    const here = progress({
      days: { [yesterday]: { verses: 10, gospel: true, office: false, rosary: false, adoration: false, reading: false } },
    });
    const there = progress({
      day: yesterday,
      readToday: ['1:1:1'],
      days: { [yesterday]: { verses: 4, gospel: false, office: true, rosary: false, adoration: false, reading: false } },
    });
    const merged = mergeProgress(here, there);
    expect(merged.days[yesterday]).toMatchObject({ verses: 10, gospel: true, office: true });
    expect(merged.readToday).toEqual([]);
  });

  it('fait gagner le dernier choix de traduction', () => {
    const crampon = progress({ translation: 'crampon', stamps: { translation: NOW } });
    const lsg = progress({ translation: 'lsg', stamps: { translation: NOW - 1000 } });
    expect(mergeProgress(lsg, crampon).translation).toBe('crampon');
    expect(mergeProgress(crampon, lsg).translation).toBe('crampon');
  });

  it('additionne les jours vécus d’un parcours, sauf un retrait plus récent', () => {
    const here = progress({ journeys: { 'avent-2026': ['2026-11-29', '2026-11-30'] } });
    const there = progress({ journeys: { 'avent-2026': ['2026-12-01'] }, stamps: { 'journey:avent-2026:2026-11-30': NOW } });
    expect(mergeProgress(here, there).journeys).toEqual({ 'avent-2026': ['2026-11-29', '2026-12-01'] });
  });

  it('garde le plus grand nombre de chapelets', () => {
    const here = progress({ rosary: { ...progress().rosary, count: 3 } });
    const there = progress({ rosary: { ...progress().rosary, count: 5 } });
    expect(mergeProgress(here, there).rosary.count).toBe(5);
  });
});

describe('prepareStored', () => {
  it('écarte un livre et des positions hors de la Bible', () => {
    const p = prepareStored({
      currentBook: 999,
      positions: { 41: { chapter: 3, verse: 2 }, 40: { chapter: 99, verse: 1 }, 0: { chapter: 1, verse: 1 } },
    });
    expect(p.currentBook).toBe(41);
    expect(p.positions).toEqual({ 41: { chapter: 3, verse: 2 } });
  });

  it('garde les livres deutérocanoniques et les chapitres d’une seule des traductions', () => {
    const p = prepareStored({
      currentBook: 67,
      positions: { 67: { chapter: 2, verse: 1 }, 29: { chapter: 4, verse: 3 }, 74: { chapter: 1, verse: 1 } },
    });
    expect(p.currentBook).toBe(67);
    expect(p.positions).toEqual({ 67: { chapter: 2, verse: 1 }, 29: { chapter: 4, verse: 3 } });
  });

  it('ramène dans le livre un marque-page venu de l’autre traduction', () => {
    const joel4 = { currentBook: 29, positions: { 29: { chapter: 4, verse: 3 } } };
    expect(readingPosition(prepareStored({ ...joel4, translation: 'lsg' }))).toEqual({ book: 29, chapter: 3, verse: 1 });
    expect(readingPosition(prepareStored({ ...joel4, translation: 'crampon' }))).toEqual({ book: 29, chapter: 4, verse: 3 });
  });

  it('ne garde que des dates dans les parcours', () => {
    const p = prepareStored({
      journeys: { 'avent-2026': ['2026-12-02', 'demain', '2026-12-01', '2026-12-01'], x: ['2026-12-01'] } as never,
    });
    expect(p.journeys).toEqual({ 'avent-2026': ['2026-12-01', '2026-12-02'] });
  });

  it('met l’accent liturgique par défaut et écarte une valeur inconnue', () => {
    expect(prepareStored({}).appearance.accent).toBe('liturgique');
    expect(prepareStored({ appearance: { ...progress().appearance, accent: 'or' } }).appearance.accent).toBe('or');
    expect(prepareStored({ appearance: { ...progress().appearance, accent: 'fluo' as never } }).appearance.accent).toBe('liturgique');
  });

  it('lit la Louis Segond quand la traduction est absente ou inconnue', () => {
    expect(prepareStored({}).translation).toBe('lsg');
    expect(prepareStored({ translation: 'tob' as never }).translation).toBe('lsg');
    expect(prepareStored({ translation: 'crampon' }).translation).toBe('crampon');
  });

  it('jette une session de chapelet ou d’adoration abîmée', () => {
    const p = prepareStored({
      rosary: { ...progress().rosary, session: { set: 12, decade: null, fatima: true, step: 0, intention: '', day: today() } },
      adoration: { ...progress().adoration, session: { mode: 'autre' as 'guided', minutes: 30, step: 0, day: today() } },
    });
    expect(p.rosary.session).toBeNull();
    expect(p.adoration.session).toBeNull();
  });

  it('ne garde que des prières personnelles bien formées', () => {
    const p = prepareStored({
      customPrayers: [{ id: 'perso-1', title: 'T', text: 'X', updatedAt: 1 }, { id: 2 } as never, null as never],
      pinnedPrayers: ['notre-pere', 3 as never],
    });
    expect(p.customPrayers.map((c) => c.id)).toEqual(['perso-1']);
    expect(p.pinnedPrayers).toEqual(['notre-pere']);
  });
});
