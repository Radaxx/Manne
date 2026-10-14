import { bookMeta, loadPassage } from '../src/bible';
import { VERSES } from '../src/data/content';
import { FeedGenerator } from '../src/feed';
import { headlines, type NewsItem, publishedAgo } from '../src/news';
import { mergeFeeds, parseFeed, SOURCES, shorten } from '../supabase/functions/news/rss';

const vatican = SOURCES[0];

const FEED = `<?xml version="1.0"?><rss><channel><title>Vatican News</title>
<item>
  <title><![CDATA[Le Pape reçoit les familles]]></title>
  <description><![CDATA[<p>Une rencontre &laquo;&nbsp;joyeuse&nbsp;&raquo; au Vatican.</p><p><a href="https://example.org">Tout lire</a></p>]]></description>
  <link>https://www.vaticannews.va/fr/pape/news/familles.html</link>
  <pubDate>Tue, 13 Oct 2026 19:58:00 +0200</pubDate>
</item>
<item><title>Sans lien</title><pubDate>Tue, 13 Oct 2026 10:00:00 +0200</pubDate></item>
<item><title>Lien non sécurisé</title><link>http://example.org/a</link><pubDate>Tue, 13 Oct 2026 10:00:00 +0200</pubDate></item>
</channel></rss>`;

const item = (id: string, source: NewsItem['source'], published: string): NewsItem => ({
  id,
  source,
  sourceName: source,
  title: id,
  summary: '',
  link: `https://example.org/${id}`,
  published,
});

describe('flux RSS', () => {
  it('garde le titre, un résumé sans HTML, le lien et la date', () => {
    const [first, ...rest] = parseFeed(FEED, vatican);
    expect(rest).toHaveLength(0);
    expect(first).toEqual({
      id: 'https://www.vaticannews.va/fr/pape/news/familles.html',
      source: 'vatican',
      sourceName: 'Vatican News',
      title: 'Le Pape reçoit les familles',
      summary: 'Une rencontre « joyeuse » au Vatican.',
      link: 'https://www.vaticannews.va/fr/pape/news/familles.html',
      published: '2026-10-13T17:58:00.000Z',
    });
  });

  it('coupe les résumés trop longs à la fin d’un mot', () => {
    const text = 'mot '.repeat(100);
    const short = shorten(text, 30);
    expect(short.length).toBeLessThanOrEqual(31);
    expect(short.endsWith('mot…')).toBe(true);
  });

  it('réunit les flux du plus récent au plus ancien, sans doublon ni article daté dans le futur', () => {
    const now = Date.parse('2026-10-13T20:00:00Z');
    const merged = mergeFeeds(
      [
        [item('a', 'vatican', '2026-10-13T10:00:00Z'), item('futur', 'cath', '2026-10-18T08:00:00Z')],
        [item('b', 'cef', '2026-10-13T12:00:00Z'), item('a', 'vatican', '2026-10-13T10:00:00Z')],
      ],
      now,
    );
    expect(merged.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('L’Église aujourd’hui dans Découvrir', () => {
  const now = Date.parse('2026-10-13T20:00:00Z');
  const items = [
    item('v1', 'vatican', '2026-10-13T19:00:00Z'),
    item('v2', 'vatican', '2026-10-13T18:00:00Z'),
    item('v3', 'vatican', '2026-10-13T17:00:00Z'),
    item('c1', 'cef', '2026-10-13T16:00:00Z'),
    item('h1', 'cath', '2026-10-13T15:00:00Z'),
    item('vieux', 'cath', '2026-10-01T15:00:00Z'),
  ];

  it('choisit au plus cinq titres récents, une source après l’autre', () => {
    expect(headlines(items, now).map((i) => i.id)).toEqual(['v1', 'c1', 'h1', 'v2', 'v3']);
  });

  it('glisse chaque titre une seule fois dans le fil', () => {
    const generator = new FeedGenerator(
      () => ({}),
      () => headlines(items, now),
    );
    const news = generator
      .next(80)
      .filter((c) => c.kind === 'news')
      .map((c) => (c.kind === 'news' ? c.item.id : ''));
    expect(news).toEqual(['v1', 'c1', 'h1', 'v2', 'v3']);
  });

  it('dit depuis quand l’article est paru', () => {
    expect(publishedAgo('2026-10-13T17:00:00Z', now)).toBe('il y a 3 h');
    expect(publishedAgo('2026-10-12T17:00:00Z', now)).toBe('hier');
  });
});

describe('versets de Découvrir', () => {
  it('existent dans les deux traductions, découpés pareil, sans doublon', () => {
    expect(VERSES.length).toBeGreaterThan(250);
    expect(new Set(VERSES.map((v) => v.id)).size).toBe(VERSES.length);
    for (const v of VERSES) {
      for (const t of ['lsg', 'crampon'] as const) expect(loadPassage(v.book, v.chapter, v.from, v.to, t)).toHaveLength(v.to - v.from + 1);
      if (v.book <= 66) expect(bookMeta(v.book, 'lsg').verses[v.chapter - 1]).toBe(bookMeta(v.book, 'crampon').verses[v.chapter - 1]);
    }
  });
});
