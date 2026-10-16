// Pointe le développement local vers la base Supabase lancée par `supabase start`.
// La première fois, copie l'URL et les clés de production (alors dans .env / .env.local)
// vers .env.production.local, puis réécrit .env pour la base locale.
// Le téléphone joint le Mac par son adresse Wi-Fi : 127.0.0.1 ne marche pas depuis l'appareil.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const PROD_REF = 'xvrdrrtqzfjeqznsxjjd';

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

function lanIp() {
  const candidates = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const net of addrs ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      candidates.push(net.address);
    }
  }
  return candidates.find((ip) => ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) ?? candidates[0] ?? null;
}

function writeEnv(path, lines) {
  writeFileSync(path, `${lines.join('\n')}\n`, { mode: 0o600 });
}

if (!existsSync('.env.production.local')) {
  const current = parseEnv(existsSync('.env') ? readFileSync('.env', 'utf8') : '');
  const local = parseEnv(existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '');
  const url = current.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url.includes(PROD_REF)) {
    console.error('Le .env actuel ne pointe pas vers la production : .env.production.local n’a pas été créé.');
    process.exit(1);
  }
  if (!current.EXPO_PUBLIC_SUPABASE_ANON_KEY || !local.SUPABASE_SERVICE_ROLE_KEY || !local.SEED_EMAIL) {
    console.error('Il manque la clé anon (.env), la clé service ou SEED_EMAIL (.env.local).');
    process.exit(1);
  }
  const lines = [
    '# Projet de production. Lu par les builds release et par npm run seed:reviewer.',
    '# npm run seed ne charge pas ce fichier.',
    `EXPO_PUBLIC_SUPABASE_URL=${url}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${current.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${local.SUPABASE_SERVICE_ROLE_KEY}`,
    `SEED_EMAIL=${local.SEED_EMAIL}`,
  ];
  if (local.REVIEWER_PASSWORD) lines.push(`REVIEWER_PASSWORD=${local.REVIEWER_PASSWORD}`);
  writeEnv('.env.production.local', lines);
  console.log('Conservé : .env.production.local (production)');
}

let status = '';
try {
  status = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  console.error('La base locale ne répond pas. Lancez npm run db:local.');
  process.exit(1);
}
const keys = parseEnv(status);
const anon = keys.ANON_KEY || keys.SUPABASE_ANON_KEY;
const service = keys.SERVICE_ROLE_KEY || keys.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl = keys.API_URL || keys.SUPABASE_URL;
if (!anon || !service || !apiUrl) {
  console.error(`supabase status n’a pas renvoyé les clés attendues (clés reçues : ${Object.keys(keys).join(', ')}).`);
  process.exit(1);
}

const ip = lanIp();
if (!ip) {
  console.error('Aucune adresse IPv4 locale : le téléphone ne pourra pas joindre la base.');
  process.exit(1);
}
const api = new URL(apiUrl);
api.hostname = ip;
const url = api.toString().replace(/\/$/, '');

const preserved = parseEnv(existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '');
const prod = parseEnv(readFileSync('.env.production.local', 'utf8'));
const seedEmail = preserved.SEED_EMAIL || prod.SEED_EMAIL;
if (!seedEmail) {
  console.error('SEED_EMAIL est absent de .env.local et de .env.production.local.');
  process.exit(1);
}

writeEnv('.env', [
  '# Base locale. Le téléphone joint le Mac sur le Wi-Fi. Régénéré par npm run db:local.',
  `EXPO_PUBLIC_SUPABASE_URL=${url}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
]);
writeEnv('.env.local', [
  '# Clé service de la base LOCALE. npm run seed refuse la production.',
  `SUPABASE_SERVICE_ROLE_KEY=${service}`,
  `SEED_EMAIL=${seedEmail}`,
]);

console.log(`Base locale : ${url}`);
console.log('Metro lit .env. Les builds release lisent .env.production.local.');
