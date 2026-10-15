import { CULTURE, CULTURE_KINDS, CULTURE_LABELS } from '../src/data/culture';
import { CULTURE_IMAGES } from '../src/data/culture-images';
import { SAINTS } from '../src/data/saints';
import { cultureForDay, cultureOrder, FeedGenerator, listenUrl, PAUSE_EVERY, wikiUrl } from '../src/feed';
import { upcomingFeasts } from '../src/liturgical-year';

describe('culture chrétienne dans Découvrir', () => {
  it('a des œuvres de chaque catégorie, sans doublon, avec un article à ouvrir', () => {
    expect(new Set(CULTURE.map((c) => c.id)).size).toBe(CULTURE.length);
    for (const kind of CULTURE_KINDS) {
      expect(CULTURE.filter((c) => c.kind === kind).length).toBeGreaterThanOrEqual(4);
      expect(CULTURE_LABELS[kind]).toBeDefined();
    }
    for (const c of CULTURE) {
      expect(c.title && c.author && c.date && c.wiki).toBeTruthy();
      expect(wikiUrl(c)).toMatch(/^https:\/\/fr\.wikipedia\.org\/w\/index\.php\?search=/);
    }
  });

  it('tient sur un écran de téléphone', () => {
    for (const c of CULTURE) {
      expect({ id: c.id, text: c.text.length <= 340 }).toEqual({ id: c.id, text: true });
      expect({ id: c.id, detail: c.detail.length <= 170 }).toEqual({ id: c.id, detail: true });
    }
  });

  it('alterne les catégories : jamais deux œuvres du même genre d’affilée tant qu’il y a le choix', () => {
    const order = cultureOrder();
    expect(order).toHaveLength(CULTURE.length);
    expect(new Set(order).size).toBe(CULTURE.length);
    expect(order.slice(0, CULTURE_KINDS.length).map((c) => c.kind)).toEqual(CULTURE_KINDS);
  });

  it('glisse une œuvre toutes les 8 cartes, sans prendre la place de la pause', () => {
    const cards = new FeedGenerator(() => ({})).next(64);
    const positions = cards.flatMap((c, i) => (c.kind === 'culture' ? [i + 1] : []));
    expect(positions).toEqual([6, 14, 22, 38, 46, 54, 62]);
    expect(cards[PAUSE_EVERY * 2 - 1].kind).toBe('pause');
  });

  it('propose d’écouter les œuvres musicales', () => {
    const messiah = CULTURE.find((c) => c.id === 'messie-haendel');
    expect(messiah && listenUrl(messiah)).toBe('https://www.youtube.com/results?search_query=Le%20Messie%20Georg%20Friedrich%20Haendel');
  });
});

describe('œuvres montrées dans l’app', () => {
  it('ont une image et un crédit, sauf les œuvres encore protégées', () => {
    const ids = new Set(CULTURE.map((c) => c.id));
    for (const [id, art] of Object.entries(CULTURE_IMAGES)) {
      expect(ids.has(id)).toBe(true);
      expect(art.credit).toMatch(/^Domaine public$|, CC (0|BY)/);
    }
    for (const c of CULTURE.filter((w) => ['peinture', 'sculpture', 'architecture'].includes(w.kind))) {
      const protectedWork = ['christ-saint-jean-croix', 'miserere-rouault', 'arcabas', 'chagall-message', 'christ-redempteur', 'ronchamp'];
      expect({ id: c.id, image: c.id in CULTURE_IMAGES }).toEqual({ id: c.id, image: !protectedWork.includes(c.id) });
    }
  });
});

describe('œuvres au fil du calendrier', () => {
  it('se rattachent à des fêtes et des jours qui existent', () => {
    const feasts = new Set(upcomingFeasts('2026-01-01', 80).map((f) => f.name));
    for (const c of CULTURE) {
      for (const o of c.when ?? []) {
        if ('feast' in o) expect({ id: c.id, feast: feasts.has(o.feast) }).toEqual({ id: c.id, feast: true });
        if ('day' in o) expect({ id: c.id, day: o.day in SAINTS }).toEqual({ id: c.id, day: true });
        expect(o.why.length).toBeLessThanOrEqual(48);
      }
    }
  });

  it('met en avant le saint du jour', () => {
    expect(cultureForDay('2026-10-15').map((m) => m.culture.id)).toEqual(['extase-therese', 'chateau-interieur']);
    expect(cultureForDay('2026-10-15')[0].why).toBe('Aujourd’hui, sainte Thérèse d’Avila');
    expect(cultureForDay('2026-07-08')).toEqual([]);
  });

  it('suit les fêtes mobiles, avant le temps liturgique', () => {
    // Pâques 2027 tombe le 28 mars : le 26 est le Vendredi saint.
    const ids = cultureForDay('2027-03-26').map((m) => m.culture.id);
    expect(ids.slice(0, 3).sort()).toEqual(['cristo-velazquez', 'issenheim', 'stabat-pergolese']);
    expect(ids).toEqual(expect.arrayContaining(['cene-vinci', 'passion-matthieu', 'pieta']));
    expect(cultureForDay('2027-03-10').map((m) => m.culture.id)).toEqual(['fils-prodigue']);
  });

  it('sert les œuvres du jour en premier, sans les répéter ensuite', () => {
    const matches = cultureForDay('2026-10-15');
    const ids = new FeedGenerator(
      () => ({}),
      () => [],
      () => matches,
    )
      .next(8 * CULTURE.length)
      .flatMap((c) => (c.kind === 'culture' ? [c.culture.id] : []));
    expect(ids.slice(0, 2)).toEqual(['extase-therese', 'chateau-interieur']);
    expect(ids.slice(2, CULTURE.length)).not.toContain('extase-therese');
  });
});
