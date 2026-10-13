// Génère src/data/verses.json à partir de la Louis Segond 1910 (domaine public) via api.getbible.net
import { writeFileSync } from 'node:fs';

// [livre, chapitre, premier verset, dernier verset, thème]
const REFS = [
  [19, 23, 1, 1, 'Paix'],
  [19, 46, 2, 2, 'Force'],
  [24, 29, 11, 11, 'Espoir'],
  [23, 40, 31, 31, 'Force'],
  [23, 41, 10, 10, 'Force'],
  [40, 11, 28, 28, 'Paix'],
  [43, 3, 16, 16, 'Amour'],
  [43, 14, 27, 27, 'Paix'],
  [45, 8, 28, 28, 'Espoir'],
  [45, 12, 2, 2, 'Sagesse'],
  [50, 4, 6, 7, 'Paix'],
  [50, 4, 13, 13, 'Force'],
  [46, 13, 4, 7, 'Amour'],
  [20, 3, 5, 6, 'Sagesse'],
  [20, 16, 3, 3, 'Sagesse'],
  [6, 1, 9, 9, 'Force'],
  [19, 119, 105, 105, 'Sagesse'],
  [19, 34, 19, 19, 'Espoir'],
  [40, 6, 34, 34, 'Paix'],
  [40, 5, 9, 9, 'Paix'],
  [40, 5, 14, 14, 'Foi'],
  [43, 8, 12, 12, 'Foi'],
  [43, 15, 13, 13, 'Amour'],
  [48, 5, 22, 23, 'Sagesse'],
  [49, 4, 32, 32, 'Pardon'],
  [51, 3, 13, 13, 'Pardon'],
  [58, 11, 1, 1, 'Foi'],
  [58, 13, 5, 5, 'Espoir'],
  [59, 1, 5, 5, 'Sagesse'],
  [62, 4, 18, 18, 'Amour'],
  [62, 1, 9, 9, 'Pardon'],
  [25, 3, 22, 23, 'Espoir'],
  [33, 6, 8, 8, 'Sagesse'],
  [21, 3, 1, 1, 'Sagesse'],
  [19, 37, 5, 5, 'Foi'],
  [19, 139, 14, 14, 'Gratitude'],
  [52, 5, 16, 18, 'Gratitude'],
  [55, 1, 7, 7, 'Force'],
  [45, 15, 13, 13, 'Espoir'],
  [23, 43, 2, 2, 'Force'],
  [40, 7, 7, 7, 'Foi'],
  [42, 6, 31, 31, 'Amour'],
  [20, 4, 23, 23, 'Sagesse'],
  [20, 15, 1, 1, 'Sagesse'],
  [19, 118, 24, 24, 'Gratitude'],
  [36, 3, 17, 17, 'Amour'],
  [5, 31, 8, 8, 'Force'],
  [4, 6, 24, 26, 'Paix'],
  [1, 1, 1, 1, 'Foi'],
  [66, 21, 4, 4, 'Espoir'],
  [43, 11, 35, 35, 'Amour'],
  [47, 12, 9, 9, 'Force'],
  [45, 5, 8, 8, 'Amour'],
  [19, 100, 4, 4, 'Gratitude'],
  [40, 18, 21, 22, 'Pardon'],
  [42, 15, 7, 7, 'Pardon'],
  [19, 103, 12, 12, 'Pardon'],
  [19, 107, 1, 1, 'Gratitude'],
  [51, 3, 17, 17, 'Gratitude'],
  [23, 26, 3, 3, 'Paix'],
];

const cache = new Map();
async function chapter(book, ch) {
  const key = `${book}/${ch}`;
  if (!cache.has(key)) {
    const res = await fetch(`https://api.getbible.net/v2/ls1910/${book}/${ch}.json`);
    if (!res.ok) throw new Error(`${key}: ${res.status}`);
    cache.set(key, await res.json());
  }
  return cache.get(key);
}

const out = [];
for (const [book, ch, from, to, theme] of REFS) {
  const data = await chapter(book, ch);
  const verses = data.verses.filter((v) => v.verse >= from && v.verse <= to);
  if (verses.length !== to - from + 1) throw new Error(`Versets manquants: ${book} ${ch}:${from}-${to}`);
  const text = verses
    .map((v) => v.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ');
  const reference = `${data.book_name} ${ch}:${from}${to > from ? `-${to}` : ''}`;
  out.push({ id: `${book}-${ch}-${from}`, book, bookName: data.book_name, chapter: ch, from, to, reference, text, theme });
}
writeFileSync(new URL('../src/data/verses.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`${out.length} passages écrits`);
