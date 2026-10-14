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

import type { NewsItem } from './news';

export type Card =
  | { key: string; kind: 'verse'; verse: Verse }
  | { key: string; kind: 'news'; item: NewsItem }
  | { key: string; kind: 'fact'; fact: Fact }
  | { key: string; kind: 'quiz'; quiz: Quiz }
  | { key: string; kind: 'person'; person: Person }
  | { key: string; kind: 'reflection'; prompt: string }
  | { key: string; kind: 'pause'; count: number };

/** Une carte « pause » toutes les N cartes : on scrolle, mais en conscience. */
export const PAUSE_EVERY = 15;

const EXTRA_KINDS = ['fact', 'quiz', 'person', 'reflection'] as const;

export class FeedGenerator {
  private index = 0;
  private recent: string[] = [];
  private cursors = { fact: 0, quiz: 0, person: 0, reflection: 0 };

  private newsShown = new Set<string>();

  /** `getNews` : les titres du jour à glisser dans le fil (chacun une seule fois). */
  constructor(
    private getScores: () => Partial<Record<Theme, number>>,
    private getNews: () => NewsItem[] = () => [],
  ) {
    // Point de départ aléatoire pour ne pas toujours ouvrir sur le même contenu.
    for (const k of EXTRA_KINDS) this.cursors[k] = Math.floor(Math.random() * 10);
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
