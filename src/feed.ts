import {
  FACTS,
  type Fact,
  PERSONS,
  type Person,
  QUIZZES,
  type Quiz,
  REFLECTIONS,
  THEMES,
  type Theme,
  VERSES,
  type Verse,
} from './data/content';
import { CULTURE, CULTURE_KINDS, type Culture, type CultureSeason } from './data/culture';
import { liturgicalDay } from './liturgical-year';

import type { NewsItem } from './news';

export type Card =
  | { key: string; kind: 'verse'; verse: Verse }
  | { key: string; kind: 'news'; item: NewsItem }
  | { key: string; kind: 'fact'; fact: Fact }
  | { key: string; kind: 'quiz'; quiz: Quiz }
  | { key: string; kind: 'person'; person: Person }
  | { key: string; kind: 'culture'; culture: Culture; why?: string }
  | { key: string; kind: 'reflection'; prompt: string }
  | { key: string; kind: 'pause'; count: number };

/** Une carte « pause » toutes les N cartes : on scrolle, mais en conscience. */
export const PAUSE_EVERY = 15;

const EXTRA_KINDS = ['fact', 'quiz', 'person', 'reflection'] as const;

/** Les œuvres, une catégorie après l'autre : jamais deux peintures d'affilée. */
export function cultureOrder(items: Culture[] = CULTURE): Culture[] {
  const byKind = CULTURE_KINDS.map((k) => items.filter((c) => c.kind === k));
  const order: Culture[] = [];
  for (let n = 0; order.length < items.length; n++) for (const list of byKind) if (n < list.length) order.push(list[n]);
  return order;
}

const CULTURE_ORDER = cultureOrder();

/** Une œuvre mise en avant ce jour-là, et pourquoi (« Aujourd’hui, saint Matthieu »). */
export type CultureMatch = { culture: Culture; why: string };

/** Les œuvres liées à une date : d'abord la fête ou le saint du jour, puis le temps liturgique. */
export function cultureForDay(date: string, items: Culture[] = CULTURE): CultureMatch[] {
  const day = liturgicalDay(date);
  const monthDay = date.slice(5);
  const season: CultureSeason | null =
    day.season === 'triduum' || (day.season === 'careme' && day.week === 6)
      ? 'semaine-sainte'
      : day.season === 'ordinaire'
        ? null
        : day.season;
  const today: CultureMatch[] = [];
  const during: CultureMatch[] = [];
  for (const culture of items) {
    const when = culture.when ?? [];
    const exact = when.find((o) => ('day' in o && o.day === monthDay) || ('feast' in o && o.feast === day.feast?.name));
    const inSeason = when.find((o) => 'season' in o && o.season === season);
    if (exact) today.push({ culture, why: exact.why });
    else if (inSeason) during.push({ culture, why: inSeason.why });
  }
  return [...today, ...during];
}

/** L'article Wikipédia : la recherche ouvre directement l'article quand le titre existe. */
export const wikiUrl = (c: Culture) => `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(c.wiki)}`;

/** Une recherche de l'œuvre à écouter. */
export const listenUrl = (c: Culture) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${c.title} ${c.author}`)}`;

export class FeedGenerator {
  private index = 0;
  private recent: string[] = [];
  private cursors = { fact: 0, quiz: 0, person: 0, reflection: 0, culture: 0 };

  private newsShown = new Set<string>();
  private cultureShown = new Set<string>();

  /**
   * `getNews` : les titres du jour à glisser dans le fil (chacun une seule fois).
   * `getCalendar` : les œuvres du jour, qui passent avant les autres (chacune une seule fois).
   */
  constructor(
    private getScores: () => Partial<Record<Theme, number>>,
    private getNews: () => NewsItem[] = () => [],
    private getCalendar: () => CultureMatch[] = () => [],
  ) {
    // Point de départ aléatoire pour ne pas toujours ouvrir sur le même contenu.
    for (const k of EXTRA_KINDS) this.cursors[k] = Math.floor(Math.random() * 10);
    this.cursors.culture = Math.floor(Math.random() * CULTURE_ORDER.length);
  }

  next(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) cards.push(this.nextCard());
    return cards;
  }

  private nextCard(): Card {
    const i = ++this.index;
    const key = `c${i}`;
    if (i % PAUSE_EVERY === 0) return { key, kind: 'pause', count: i };
    // Une œuvre de la culture chrétienne toutes les 8 cartes, entre deux autres surprises.
    if (i % 8 === 6) return { key, kind: 'culture', ...this.nextCulture() };
    if (i % 4 === 0) {
      // Une case sur deux revient à l'actualité du jour, tant qu'il reste des titres à montrer.
      const news = (i / 4) % 2 === 1 ? this.getNews().find((n) => !this.newsShown.has(n.id)) : undefined;
      if (news) {
        this.newsShown.add(news.id);
        return { key, kind: 'news', item: news };
      }
      const kind = EXTRA_KINDS[(i / 4) % EXTRA_KINDS.length];
      const n = this.cursors[kind]++;
      switch (kind) {
        case 'fact':
          return { key, kind, fact: FACTS[n % FACTS.length] };
        case 'quiz':
          return { key, kind, quiz: QUIZZES[n % QUIZZES.length] };
        case 'person':
          return { key, kind, person: PERSONS[n % PERSONS.length] };
        case 'reflection':
          return { key, kind, prompt: REFLECTIONS[n % REFLECTIONS.length] };
      }
    }
    return { key, kind: 'verse', verse: this.pickVerse() };
  }

  /** L'œuvre suivante : celles du jour d'abord, puis les autres, sans resservir tout de suite une œuvre du jour. */
  private nextCulture(): { culture: Culture; why?: string } {
    const match = this.getCalendar().find((m) => !this.cultureShown.has(m.culture.id));
    if (match) {
      this.cultureShown.add(match.culture.id);
      return match;
    }
    let culture = CULTURE_ORDER[this.cursors.culture++ % CULTURE_ORDER.length];
    for (let k = 0; k < CULTURE_ORDER.length && this.cultureShown.has(culture.id); k++) {
      culture = CULTURE_ORDER[this.cursors.culture++ % CULTURE_ORDER.length];
    }
    return { culture };
  }

  /** Tirage pondéré : les thèmes que l'utilisateur aime remontent, sans jamais exclure les autres. */
  private pickVerse(): Verse {
    const scores = this.getScores();
    const recent = new Set(this.recent);
    const candidates = VERSES.filter((v) => !recent.has(v.id));
    const weights = candidates.map((v) => 1 + Math.min(scores[v.theme] ?? 0, 8) * 0.6);
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let chosen = candidates[candidates.length - 1];
    for (let k = 0; k < candidates.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        chosen = candidates[k];
        break;
      }
    }
    this.recent = [chosen.id, ...this.recent].slice(0, Math.floor(VERSES.length * 0.6));
    return chosen;
  }
}

export function topThemes(scores: Partial<Record<Theme, number>>): Theme[] {
  return THEMES.filter((t) => (scores[t] ?? 0) > 0)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, 3);
}
