import fs from 'node:fs';
import path from 'node:path';
import { GUIDE_SECTIONS, TAB_ICONS, TOUR_PAGES } from '../src/guide';

const APP = path.join(__dirname, '..', 'src', 'app');

/** Les routes statiques de `src/app/` : sans extension, sans groupe `(tabs)`, `index` ramené à son dossier. */
function routes(dir = APP, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const group = /^\(.*\)$/.test(entry.name);
      found.push(...routes(path.join(dir, entry.name), group ? prefix : `${prefix}/${entry.name}`));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.startsWith('_')) {
      const name = entry.name.replace(/\.tsx?$/, '');
      found.push(name === 'index' ? prefix || '/' : `${prefix}/${name}`);
    }
  }
  return found;
}

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];

describe('guide', () => {
  it('ne mène qu’à des écrans qui existent', () => {
    const existing = new Set(routes());
    for (const section of GUIDE_SECTIONS) {
      for (const entry of section.entries) {
        if (!entry.route) continue;
        expect(entry.route).not.toMatch(/[[\]]/);
        expect({ section: section.id, route: entry.route, exists: existing.has(entry.route) }).toEqual({
          section: section.id,
          route: entry.route,
          exists: true,
        });
      }
    }
  });

  it('a des identifiants uniques et des entrées', () => {
    const ids = GUIDE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pageIds = TOUR_PAGES.map((p) => p.id);
    expect(new Set(pageIds).size).toBe(pageIds.length);
    for (const section of GUIDE_SECTIONS) {
      expect(section.entries.length).toBeGreaterThan(0);
      const titles = section.entries.map((e) => e.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('reprend les icônes des onglets pour les pages de la visite', () => {
    const layout = fs.readFileSync(path.join(APP, '(tabs)', '_layout.tsx'), 'utf8');
    const tabs = [...layout.matchAll(/name="(\w+)" options=\{\{ title: '[^']+', tabBarIcon: icon\('([\w-]+)-outline', '([\w-]+)'\)/g)];
    expect(tabs.length).toBe(5);
    for (const [, tab, , focused] of tabs) {
      expect(TAB_ICONS[tab as keyof typeof TAB_ICONS]).toBe(focused);
    }
    const byId = (id: string) => TOUR_PAGES.find((p) => p.id === id)?.icon;
    expect(byId('accueil')).toBe(TAB_ICONS.index);
    expect(byId('lecture')).toBe(TAB_ICONS.lecture);
    expect(byId('prieres')).toBe(TAB_ICONS.prieres);
    expect(byId('decouvrir')).toBe(TAB_ICONS.decouvrir);
    expect(byId('communaute')).toBe(TAB_ICONS.communaute);
    for (const section of GUIDE_SECTIONS.slice(0, 5))
      expect(section.icon).toBe(TAB_ICONS[section.id === 'accueil' ? 'index' : (section.id as keyof typeof TAB_ICONS)]);
  });

  it('a une visite complète et aucun texte vide', () => {
    expect(TOUR_PAGES.length).toBeGreaterThanOrEqual(5);
    for (const page of TOUR_PAGES) expect(page.lines.length).toBeGreaterThan(0);
    for (const text of strings([TOUR_PAGES, GUIDE_SECTIONS])) expect(text.trim()).not.toBe('');
  });

  it('annonce le compte et le pseudo sur la page Communauté', () => {
    const page = TOUR_PAGES.find((p) => p.id === 'communaute');
    expect(strings(page).join(' ')).toMatch(/compte/);
    expect(strings(page).join(' ')).toMatch(/pseudo/);
  });

  it('écrit les apostrophes à la française', () => {
    for (const text of strings([TOUR_PAGES, GUIDE_SECTIONS])) expect(text).not.toContain("'");
  });
});
