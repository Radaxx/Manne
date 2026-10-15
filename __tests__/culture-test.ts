import { CULTURE, CULTURE_KINDS, CULTURE_LABELS } from '../src/data/culture';
import { cultureOrder, FeedGenerator, listenUrl, PAUSE_EVERY, wikiUrl } from '../src/feed';

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
