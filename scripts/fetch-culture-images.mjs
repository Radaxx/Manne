// Télécharge depuis Wikimedia Commons l'image de chaque œuvre de Découvrir (peinture, sculpture,
// architecture), en vignette de 800 px, dans assets/culture/, et écrit src/data/culture-images.ts
// avec l'auteur et la licence de chaque fichier. Seules les licences libres sont acceptées.
//
//   node scripts/fetch-culture-images.mjs            # les images manquantes
//   node scripts/fetch-culture-images.mjs --force    # tout retélécharger
//
// Après un téléchargement, les images sont recompressées avec `sips` (macOS).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets/culture');
const force = process.argv.includes('--force');
const UA = 'Manne/1.0 (app de prière ; alexis@paraboschi.fr)';

// Œuvres encore protégées par le droit d'auteur (artiste mort il y a moins de 70 ans) : pas d'image.
const PROTECTED = new Set(['christ-saint-jean-croix', 'miserere-rouault', 'arcabas', 'chagall-message', 'christ-redempteur', 'ronchamp']);

// Le fichier Commons à prendre quand l'image de l'article Wikipédia ne montre pas l'œuvre entière.
const FILES = JSON.parse(readFileSync(join(root, 'scripts/culture-files.json'), 'utf8'));

const source = readFileSync(join(root, 'src/data/culture.ts'), 'utf8');
const works = [...source.matchAll(/id: '([^']+)',\s*kind: '([^']+)',[\s\S]*?wiki: '([^']+)'/g)]
  .map(([, id, kind, wiki]) => ({ id, kind, wiki: wiki.replace(/\\'/g, "'") }))
  .filter((w) => ['peinture', 'sculpture', 'architecture'].includes(w.kind) && !PROTECTED.has(w.id));

const api = async (host, params) => {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
};

const text = (html) =>
  (html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, '’')
    .replace(/\s+/g, ' ')
    .trim();

const FREE = /^(public domain|domaine public|pd|cc0|cc by(-sa)? [\d.]+)/i;

mkdirSync(out, { recursive: true });
const credits = {};
for (const w of works) {
  let file = FILES[w.id];
  if (!file) {
    const page = await api('fr.wikipedia.org', { action: 'query', prop: 'pageimages', piprop: 'name', titles: w.wiki, redirects: '1' });
    file = page.query.pages[0]?.pageimage;
  }
  if (!file) {
    console.warn(`✗ ${w.id} : pas d'image pour « ${w.wiki} »`);
    continue;
  }
  const info = await api('commons.wikimedia.org', {
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|user|extmetadata',
    iiurlwidth: '900',
    titles: `File:${file}`,
  });
  const ii = info.query.pages[0]?.imageinfo?.[0];
  const meta = ii?.extmetadata ?? {};
  const license = text(meta.LicenseShortName?.value);
  if (!ii || !FREE.test(license)) {
    console.warn(`✗ ${w.id} : ${file} (${license || 'licence inconnue'})`);
    continue;
  }
  const dest = join(out, `${w.id}.jpg`);
  if (force || !existsSync(dest)) {
    const res = await fetch(ii.thumburl, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${ii.thumburl}`);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '60', '-Z', '800', dest, '--out', dest], { stdio: 'ignore' });
  }
  const pd = /public domain|domaine public|^pd|cc0/i.test(license);
  // Pour une photo prise par celui qui l'a versée, le champ « Artist » nomme parfois le sculpteur : on crédite le photographe.
  const ownWork = /own work|travail personnel/i.test(text(meta.Credit?.value));
  const author = text(meta.Attribution?.value) || (ownWork ? ii.user : text(meta.Artist?.value)) || 'Wikimedia Commons';
  credits[w.id] = { file, credit: pd ? 'Domaine public' : `${author}, ${license}` };
  console.log(`✓ ${w.id} : ${file} — ${credits[w.id].credit}`);
}

const lines = Object.entries(credits).map(
  ([id, c]) => `  '${id}': { image: require('../../assets/culture/${id}.jpg'), credit: ${JSON.stringify(c.credit)} },`,
);
writeFileSync(
  join(root, 'src/data/culture-images.ts'),
  `// Généré par scripts/fetch-culture-images.mjs : ne pas modifier à la main.
// Images de Wikimedia Commons, sous licence libre ; le crédit s'affiche sous l'œuvre.
import type { ImageSourcePropType } from 'react-native';

export const CULTURE_IMAGES: Record<string, { image: ImageSourcePropType; credit: string }> = {
${lines.join('\n')}
};
`,
);
console.log(`${Object.keys(credits).length}/${works.length} images`);
