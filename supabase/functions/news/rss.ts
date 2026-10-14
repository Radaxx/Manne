// Lecture des flux RSS des médias catholiques : du TypeScript sans dépendance, partagé par la fonction
// (Deno) et les tests (Jest). On ne garde que le titre, un court résumé, la date et le lien vers l'article :
// l'article lui-même se lit chez l'éditeur.

export type SourceId = 'vatican' | 'cef' | 'cath';

export type Source = { id: SourceId; name: string; url: string };

export const SOURCES: Source[] = [
  { id: 'vatican', name: 'Vatican News', url: 'https://www.vaticannews.va/fr.rss.xml' },
  { id: 'cef', name: 'Église catholique en France', url: 'https://eglise.catholique.fr/feed/' },
  { id: 'cath', name: 'cath.ch', url: 'https://www.cath.ch/feed/' },
];

export type NewsItem = {
  /** Le lien de l'article, qui sert aussi d'identifiant. */
  id: string;
  source: SourceId;
  sourceName: string;
  title: string;
  summary: string;
  link: string;
  /** Date de publication (ISO 8601). */
  published: string;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '’',
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  ndash: '–',
  mdash: '—',
};

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Le texte d'une balise : sans CDATA, sans HTML, sans entités, sur une ligne. */
function field(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decode(
    raw
      .replace(/<a\b[^>]*>\s*Tout lire\s*<\/a>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/<[^>]*$/, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coupe un résumé trop long à la fin d'un mot. */
export function shorten(text: string, max = 260): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Les articles d'un flux RSS 2.0 ; ceux sans titre, lien ou date lisible sont écartés. */
export function parseFeed(xml: string, source: Source): NewsItem[] {
  const items: NewsItem[] = [];
  for (const [item] of xml.matchAll(/<item\b[\s\S]*?<\/item>/g)) {
    const title = field(item, 'title');
    const link = field(item, 'link');
    const date = Date.parse(field(item, 'pubDate'));
    if (!title || !/^https:\/\//.test(link) || Number.isNaN(date)) continue;
    items.push({
      id: link,
      source: source.id,
      sourceName: source.name,
      title,
      summary: shorten(field(item, 'description')),
      link,
      published: new Date(date).toISOString(),
    });
  }
  return items;
}

/**
 * Tous les flux réunis : du plus récent au plus ancien, sans doublon, au plus `limit` articles.
 * Les articles datés dans le futur (une messe annoncée à l'avance) attendent leur date.
 */
export function mergeFeeds(feeds: NewsItem[][], now = Date.now(), limit = 60): NewsItem[] {
  const latest = new Date(now + 60 * 60 * 1000).toISOString();
  const byId = new Map<string, NewsItem>();
  for (const item of feeds.flat()) if (item.published <= latest && !byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0)).slice(0, limit);
}
