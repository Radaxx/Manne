// Découpe la Louis Segond 1910 (domaine public) en un fichier JSON par livre, pour une lecture hors ligne.
// Usage : node scripts/build-bible.mjs [chemin/vers/ls1910.json]  (sinon téléchargé depuis api.getbible.net)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
const bible = src ? JSON.parse(readFileSync(src, 'utf8')) : await (await fetch('https://api.getbible.net/v2/ls1910.json')).json();

const dir = new URL('../src/data/bible/', import.meta.url);
mkdirSync(dir, { recursive: true });

const meta = [];
for (const book of bible.books) {
  const chapters = book.chapters.map((c) => c.verses.map((v) => v.text.trim().replace(/\s+/g, ' ')));
  writeFileSync(new URL(`${book.nr}.json`, dir), JSON.stringify(chapters));
  meta.push({ n: book.nr, name: book.name, verses: chapters.map((c) => c.length) });
}

const loaders = meta.map((b) => `  ${b.n}: () => require('./${b.n}.json'),`).join('\n');
writeFileSync(
  new URL('index.ts', dir),
  `// Généré par scripts/build-bible.mjs — ne pas modifier à la main.
export type BookMeta = { n: number; name: string; verses: number[] };

export const BOOKS: BookMeta[] = ${JSON.stringify(meta)};

// require() paresseux : un livre n'est chargé en mémoire que lorsqu'on le lit.
const LOADERS: Record<number, () => string[][]> = {
${loaders}
};

const cache = new Map<number, string[][]>();
export function loadBook(n: number): string[][] {
  if (!cache.has(n)) cache.set(n, LOADERS[n]());
  return cache.get(n)!;
}
`,
);
console.log(`${meta.length} livres écrits`);
