// Construit les Bibles embarquées pour une lecture hors ligne : un fichier JSON par livre et un index par traduction.
//  - lsg : Louis Segond 1910, depuis api.getbible.net (module CrossWire).
//  - crampon : Bible Crampon 1923 (domaine public), traduction catholique avec les livres deutérocanoniques,
//    depuis Wikisource (« Bible Crampon 1923 », relue sur le fac-similé), sans les notes ni les sommaires.
// Usage : node scripts/build-bible.mjs                      les deux traductions
//         node scripts/build-bible.mjs lsg [ls1910.json]    la Segond, depuis un fichier déjà téléchargé
//         node scripts/build-bible.mjs crampon [dossier]    la Crampon ; les pages Wikisource sont gardées dans le dossier
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Numéros de livres de l'app : 1-66 dans l'ordre de la Louis Segond, puis les deutérocanoniques (67-73).
// Ils servent de clés partout (marque-pages, plans, favoris) : ne jamais les renuméroter.
// Noms catholiques usuels : ceux de la Louis Segond, sauf Isaïe.
const CRAMPON_NAMES = [
  'Genèse',
  'Exode',
  'Lévitique',
  'Nombres',
  'Deutéronome',
  'Josué',
  'Juges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Rois',
  '2 Rois',
  '1 Chroniques',
  '2 Chroniques',
  'Esdras',
  'Néhémie',
  'Esther',
  'Job',
  'Psaumes',
  'Proverbes',
  'Ecclésiaste',
  'Cantique des Cantiques',
  'Isaïe',
  'Jérémie',
  'Lamentations',
  'Ézéchiel',
  'Daniel',
  'Osée',
  'Joël',
  'Amos',
  'Abdias',
  'Jonas',
  'Michée',
  'Nahum',
  'Habacuc',
  'Sophonie',
  'Aggée',
  'Zacharie',
  'Malachie',
  'Matthieu',
  'Marc',
  'Luc',
  'Jean',
  'Actes des Apôtres',
  'Romains',
  '1 Corinthiens',
  '2 Corinthiens',
  'Galates',
  'Éphésiens',
  'Philippiens',
  'Colossiens',
  '1 Thessaloniciens',
  '2 Thessaloniciens',
  '1 Timothée',
  '2 Timothée',
  'Tite',
  'Philémon',
  'Hébreux',
  'Jacques',
  '1 Pierre',
  '2 Pierre',
  '1 Jean',
  '2 Jean',
  '3 Jean',
  'Jude',
  'Apocalypse',
  'Tobie',
  'Judith',
  '1 Maccabées',
  '2 Maccabées',
  'Sagesse',
  'Siracide',
  'Baruch',
];

const root = new URL('../src/data/bible/', import.meta.url);

function writeTranslation(id, label, books) {
  const dir = new URL(`${id}/`, root);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const meta = [];
  for (const book of books) {
    writeFileSync(new URL(`${book.n}.json`, dir), JSON.stringify(book.chapters));
    meta.push({ n: book.n, name: book.name, verses: book.chapters.map((c) => c.length) });
  }
  const loaders = meta.map((b) => `  ${b.n}: () => require('./${b.n}.json'),`).join('\n');
  writeFileSync(
    new URL('index.ts', dir),
    `// ${label} — généré par scripts/build-bible.mjs, ne pas modifier à la main.
import type { BookMeta } from '../types';

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
  console.log(`${id} : ${meta.length} livres, ${meta.reduce((n, b) => n + b.verses.length, 0)} chapitres`);
}

// ——— Louis Segond 1910 ———

async function buildLsg(src) {
  const bible = src ? JSON.parse(readFileSync(src, 'utf8')) : await (await fetch('https://api.getbible.net/v2/ls1910.json')).json();
  const books = bible.books.map((book) => ({
    n: book.nr,
    name: book.name,
    chapters: book.chapters.map((c) => c.verses.map((v) => v.text.trim().replace(/\s+/g, ' '))),
  }));
  writeTranslation('lsg', 'Louis Segond 1910', books);
}

// ——— Bible Crampon 1923 ———

// Les pages de Wikisource, une par livre (cinq pour les Psaumes), dans l'ordre de CRAMPON_NAMES.
const WIKISOURCE_PAGES = [
  'Genèse',
  'Exode',
  'Lévitique',
  'Nombres',
  'Deutéronome',
  'Josué',
  'Juges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Rois',
  '2 Rois',
  '1 Chroniques',
  '2 Chroniques',
  'Esdras',
  'Néhémie',
  'Esther',
  'Job',
  ['Psaumes 1', 'Psaumes 2', 'Psaumes 3', 'Psaumes 4', 'Psaumes 5'],
  'Proverbes',
  'Ecclésiaste',
  'Cantique',
  'Isaïe',
  'Jérémie',
  'Lamentations',
  'Ézéchiel',
  'Daniel',
  'Osée',
  'Joël',
  'Amos',
  'Abdias',
  'Jonas',
  'Michée',
  'Nahum',
  'Habacuc',
  'Sophonie',
  'Aggée',
  'Zacharie',
  'Malachie',
  'Matthieu',
  'Marc',
  'Luc',
  'Jean',
  'Actes',
  'Romains',
  '1 Corinthiens',
  '2 Corinthiens',
  'Galates',
  'Éphésiens',
  'Philippiens',
  'Colossiens',
  '1 Thessaloniciens',
  '2 Thessaloniciens',
  '1 Timothée',
  '2 Timothée',
  'Tite',
  'Philémon',
  'Hébreux',
  'Jacques',
  '1 Pierre',
  '2 Pierre',
  '1 Jean',
  '2 Jean',
  '3 Jean',
  'Jude',
  'Apocalypse',
  'Tobie',
  'Judith',
  '1 Machabées',
  '2 Machabées',
  'Sagesse',
  'Ecclésiastique',
  'Baruch',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le HTML d'une page de « Bible Crampon 1923 », gardé dans `cache` s'il est donné. Wikisource limite le débit : on patiente. */
async function wikisource(title, cache) {
  const file = cache && join(cache, `${title.replace(/ /g, '_')}.json`);
  if (file && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).parse.text;
  const url = `https://fr.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&page=${encodeURIComponent(`Bible Crampon 1923/${title}`)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'manne-build-bible (application de lecture de la Bible)' } });
    if (res.status === 429) {
      await sleep((Number(res.headers.get('retry-after')) || 15) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`Wikisource ${title} : ${res.status}`);
    const json = await res.text();
    if (file) writeFileSync(file, json);
    await sleep(2000);
    return JSON.parse(json).parse.text;
  }
  throw new Error(`Wikisource ${title} : trop de refus`);
}

// Un vrai repère de verset (certains sommaires contiennent un repère vide).
const VERSE = /verset-num[^>]*>\s*\d/;

function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', nbsp: ' ' })[e]);
}

/**
 * Un bloc sans verset qui n'est pas du texte biblique : sommaire, titre de partie, renvoi (« À lire après III, 13 »).
 * La Crampon écrit les nombres en toutes lettres : un chiffre trahit l'éditeur.
 */
function editorial(html) {
  if (VERSE.test(html)) return false;
  const text = decode(html.replace(/<[^>]+>/g, '')).trim();
  return /\d/.test(text) || /\b(?:Chap|Ps)[.,]\s/.test(text) || (/\p{Lu}/u.test(text) && text === text.toUpperCase());
}

/** Les versets d'une page, rangés par chapitre (un tableau creux si la page commence plus loin, comme les Psaumes). */
function parsePage(html) {
  const body = html
    .replace(/<ol class="references">[\s\S]*?<\/ol>/g, '')
    .replace(/<sup[^>]*class="reference"[\s\S]*?<\/sup>/g, '')
    .replace(/<h(\d)[\s\S]*?<\/h\1>/g, '')
    // Les sommaires des parties (« 1. Chap. i, 1-16 : … ») ; ils ne sont pas toujours bien fermés.
    .replace(/<div class="alineanegatif"[^>]*>((?:(?!<\/?div\b)[\s\S])*)/g, (all, inner) => (VERSE.test(inner) ? all : ''))
    .replace(/<(p|div)\b[^>]*>((?:(?!<\/?(?:p|div)\b)[\s\S])*?)<\/\1>/g, (all, _tag, inner) => (editorial(inner) ? '' : all))
    // Quelques versets n'ont qu'un numéro en marge : on en fait un repère comme les autres.
    .replace(/<span class="sidenote-left"[^>]*><small>(\d+)<\/small><\/span>/g, '<span id="marge"><sup class="verset-num">$1</sup></span>');
  // Les identifiants des repères ont parfois des fautes (« 3 », « 1-49 » au chapitre 32) : on suit l'ordre du
  // document, les numéros de chapitre (CHnn) et le numéro de verset affiché.
  const marks = [
    ...body.matchAll(/<span id="CH(\d+)"><\/span>|<span id="([^"]*)"><sup class="verset-num"[^>]*>\s*(\d+)[\s\S]*?<\/sup><\/span>/g),
  ];
  const verses = marks.filter((m) => m[1] === undefined);
  const chapters = [];
  let chapter = 0;
  let last = 0;
  let announced = null;
  for (const m of marks) {
    if (m[1] !== undefined) {
      announced = Number(m[1]);
      continue;
    }
    const verse = Number(m[3]);
    if (announced !== null) chapter = announced;
    else if (chapter === 0) chapter = Number(m[2].split('-')[0]);
    else if (verse === 1 && last > 1) chapter += 1;
    announced = null;
    last = verse;
    const next = verses[verses.indexOf(m) + 1];
    const text = decode(
      body
        .slice(m.index + m[0].length, next?.index ?? body.length)
        .split(/<div class="(?:footertemplate|mw-references-wrap|printfooter)/)[0]
        .replace(/<span id="CH\d+"><\/span><div[^>]*>[\s\S]*?<\/div>/g, '')
        // Dans les poèmes, un sous-titre de l'éditeur tient sur sa propre ligne.
        .split(/<br\s*\/?>/)
        .filter((line) => !editorial(line))
        .join(' ')
        .replace(/<[^>]+>/g, ''),
    )
      .replace(/\s+/g, ' ')
      .trim();
    chapters[chapter - 1] ??= [];
    if (chapters[chapter - 1][verse - 1] !== undefined) throw new Error(`Verset ${chapter}:${verse} en double`);
    chapters[chapter - 1][verse - 1] = text;
  }
  return chapters;
}

async function buildCrampon(cache) {
  if (cache) mkdirSync(cache, { recursive: true });
  const books = [];
  for (const [i, pages] of WIKISOURCE_PAGES.entries()) {
    const chapters = [];
    for (const title of [pages].flat()) {
      for (const [c, verses] of parsePage(await wikisource(title, cache)).entries()) if (verses) chapters[c] = verses;
    }
    const n = i + 1;
    for (let c = 0; c < chapters.length; c++) {
      if (!chapters[c]) throw new Error(`${CRAMPON_NAMES[n - 1]} : chapitre ${c + 1} absent`);
      for (let v = 0; v < chapters[c].length; v++) if (!chapters[c][v]) throw new Error(`${CRAMPON_NAMES[n - 1]} ${c + 1}:${v + 1} vide`);
    }
    books.push({ n, name: CRAMPON_NAMES[n - 1], chapters });
  }
  writeTranslation('crampon', 'Bible Crampon 1923', books);
}

const [which, src] = process.argv.slice(2);
if (!which || which === 'lsg') await buildLsg(which && src);
if (!which || which === 'crampon') await buildCrampon(which && src);
