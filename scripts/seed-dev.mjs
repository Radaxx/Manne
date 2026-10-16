// Données de test pour le développement : comptes, profils, abonnements, vitrine et intentions,
// écrits directement dans le projet Supabase DISTANT avec la clé service_role (qui contourne la RLS).
// À n'utiliser que sur un projet de dev : `seed` crée de vrais comptes auth.
//
// Variables (chargées par les scripts npm via --env-file) :
//   EXPO_PUBLIC_SUPABASE_URL     dans .env
//   SUPABASE_SERVICE_ROLE_KEY    dans .env.local (gitignoré), jamais dans .env
//   SEED_EMAIL                   dans .env.local : votre adresse ; les comptes de test en dérivent
//                                (a@b.fr -> a+manne-dev_marie@b.fr), les mails arrivent chez vous
//
// Usage : node scripts/seed-dev.mjs seed [--me <pseudo>]   crée ou met à jour les comptes de test
//         node scripts/seed-dev.mjs reset                  supprime les comptes de test
//         node scripts/seed-dev.mjs code <pseudo>          code de connexion d'un compte de test
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'dev_';

// Pseudos des comptes de test (préfixe `dev_` obligatoire : le reset ne touche que ceux-là).
const HANDLES = ['dev_marie', 'dev_pierre', 'dev_claire', 'dev_jean', 'dev_therese', 'dev_paul'];

// Numéros de livres de l'app (cf. scripts/build-bible.mjs) ; passages vérifiés dans les deux traductions.
// Un passage : [livre, chapitre, verset de début, verset de fin].
const PS23 = [19, 23, 1, 4];
const JN3 = [43, 3, 16, 16];
const MT5 = [40, 5, 3, 10];
const COR13 = [46, 13, 4, 7];
const PH4 = [50, 4, 6, 7];
const RM8 = [45, 8, 28, 28];

const PROFILES = {
  dev_marie: {
    bio: 'Maman de trois enfants, je prie le chapelet en marchant.',
    parish: 'Saint-Étienne-du-Mont, Paris',
    passages: [PS23, JN3],
    prayers: [
      {
        id: 'seed-matin',
        title: 'Prière du matin',
        body: 'Seigneur, merci pour ce jour qui commence.\nGarde-moi dans ta paix et rends mes mains disponibles pour ceux que tu mets sur ma route.\nAmen.',
      },
    ],
    intentions: [
      { body: 'Pour mes enfants, afin qu’ils grandissent dans la confiance et la joie.', shown: true },
      { body: 'Pour une amie qui traverse une période de fatigue.', shown: false },
    ],
  },
  dev_pierre: {
    bio: 'Menuisier, servant de messe depuis trente ans.',
    parish: 'Notre-Dame-de-Bon-Secours, Lyon',
    passages: [MT5, RM8, PH4],
    prayers: [
      {
        id: 'seed-travail',
        title: 'Offrande du travail',
        body: 'Seigneur, je te confie l’ouvrage de mes mains.\nQue chaque geste soit fait avec soin, pour le bien de ceux qui s’en serviront.\nAmen.',
      },
      {
        id: 'seed-soir',
        title: 'Merci pour la journée',
        body: 'Au terme de ce jour, je te rends grâce pour ce qui fut donné, et je te demande pardon pour ce qui fut manqué.\nAmen.',
      },
    ],
    intentions: [{ body: 'Pour les artisans et tous ceux qui travaillent dans l’ombre.', shown: true }],
  },
  dev_claire: {
    bio: 'Étudiante en médecine, je découvre la prière des psaumes.',
    parish: 'Saint-Sernin, Toulouse',
    passages: [PS23, COR13],
    prayers: [],
    intentions: [
      { body: 'Pour mes examens de janvier, que je les passe avec calme.', shown: true },
      { body: 'Pour les malades que je rencontrerai en stage.', shown: true },
    ],
  },
  dev_jean: {
    bio: 'Retraité, ancien instituteur. Lecteur à la messe du dimanche.',
    parish: 'Saint-Pierre, Strasbourg',
    passages: [JN3],
    prayers: [
      {
        id: 'seed-lecteur',
        title: 'Avant de lire la Parole',
        body: 'Seigneur, ouvre mes lèvres et mon cœur.\nQue ta Parole, par ma voix, atteigne ceux qui l’attendent.\nAmen.',
      },
    ],
    intentions: [{ body: 'Pour les personnes seules de notre paroisse.', shown: true }],
  },
  dev_therese: {
    bio: 'Je cherche la petite voie, un jour à la fois.',
    parish: 'Sainte-Thérèse, Lisieux',
    passages: [PH4, RM8],
    prayers: [],
    intentions: [{ body: 'Pour la paix dans ma famille.', shown: true }],
  },
  dev_paul: {
    bio: 'Nouveau dans la foi, merci pour votre patience.',
    parish: 'Saint-Paul, Bordeaux',
    passages: [MT5],
    prayers: [],
    intentions: [{ body: 'Pour trouver ma place dans une communauté.', shown: false }],
  },
};

// Abonnements entre comptes de test : [qui suit, qui est suivi]. Certains sont mutuels.
const FOLLOWS = [
  ['dev_marie', 'dev_pierre'],
  ['dev_pierre', 'dev_marie'],
  ['dev_claire', 'dev_marie'],
  ['dev_jean', 'dev_marie'],
  ['dev_pierre', 'dev_claire'],
  ['dev_therese', 'dev_claire'],
  ['dev_claire', 'dev_therese'],
  ['dev_paul', 'dev_jean'],
];

// Qui porte l'intention de qui : [pseudo qui porte, pseudo de l'auteur, rang de l'intention chez l'auteur].
const CARRIES = [
  ['dev_pierre', 'dev_marie', 0],
  ['dev_claire', 'dev_marie', 0],
  ['dev_jean', 'dev_marie', 1],
  ['dev_marie', 'dev_claire', 0],
  ['dev_marie', 'dev_claire', 1],
  ['dev_therese', 'dev_pierre', 0],
  ['dev_paul', 'dev_jean', 0],
];

// Qui suit l'utilisateur avec --me : tous sauf dev_therese (cas « profil fermé »). dev_paul sert au test du blocage.
const FOLLOW_ME = ['dev_marie', 'dev_pierre', 'dev_claire', 'dev_jean', 'dev_paul'];

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

function env(name, where) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} est absent. Ajoutez-le dans ${where}.`);
  return value;
}

function check(error, what) {
  if (error) fail(`${what} : ${error.message}`);
}

/** Adresse d'un compte de test : a@b.fr + dev_marie -> a+manne-dev_marie@b.fr */
function emailFor(base, handle) {
  const at = base.lastIndexOf('@');
  return `${base.slice(0, at)}+manne-${handle}${base.slice(at)}`;
}

/** Vrai pour les adresses de test dérivées de SEED_EMAIL, et seulement elles. */
function isSeedEmail(base, email) {
  const at = base.lastIndexOf('@');
  const head = `${base.slice(0, at)}+manne-${PREFIX}`.toLowerCase();
  const tail = base.slice(at).toLowerCase();
  const e = (email ?? '').toLowerCase();
  return e.startsWith(head) && e.endsWith(tail) && e.length > head.length + tail.length;
}

async function allUsers(admin) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    check(error, 'Liste des utilisateurs');
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function setup() {
  const url = env('EXPO_PUBLIC_SUPABASE_URL', '.env');
  const key = env('SUPABASE_SERVICE_ROLE_KEY', '.env.local (jamais dans .env)');
  const base = env('SEED_EMAIL', '.env.local');
  if (!/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(base)) {
    fail('SEED_EMAIL doit être une adresse simple, sans « + » (par exemple prenom@exemple.fr).');
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { admin, base, host: new URL(url).host };
}

async function seed(admin, base, meHandle) {
  let me = null;
  if (meHandle) {
    if (meHandle.startsWith(PREFIX)) fail(`--me doit être votre vrai pseudo, pas un compte de test (${PREFIX}…).`);
    const { data, error } = await admin.from('profiles').select('id, handle').eq('handle', meHandle).maybeSingle();
    check(error, 'Recherche de votre profil');
    if (!data) fail(`Aucun profil au pseudo « ${meHandle} ». Créez-le d’abord dans l’app (Profil).`);
    me = data;
  }

  // Comptes : on réutilise ceux qui existent déjà.
  const existing = new Map((await allUsers(admin)).map((u) => [u.email?.toLowerCase(), u]));
  const ids = {};
  for (const handle of HANDLES) {
    const email = emailFor(base, handle);
    let user = existing.get(email.toLowerCase());
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      check(error, `Création de ${email}`);
      user = data.user;
    }
    ids[handle] = user.id;
  }
  const idList = Object.values(ids);

  // Profils (le trigger force display_name = handle).
  const profiles = HANDLES.map((handle) => ({
    id: ids[handle],
    handle,
    display_name: handle,
    bio: PROFILES[handle].bio,
    parish: PROFILES[handle].parish,
    charter_accepted_at: new Date().toISOString(),
  }));
  check((await admin.from('profiles').upsert(profiles, { onConflict: 'id' })).error, 'Profils');

  // Vitrine : on repart de zéro pour ces comptes.
  check((await admin.from('profile_passages').delete().in('user_id', idList)).error, 'Nettoyage des passages');
  check((await admin.from('profile_prayers').delete().in('user_id', idList)).error, 'Nettoyage des prières');
  const passages = HANDLES.flatMap((handle) =>
    PROFILES[handle].passages.map(([book, chapter, verse_from, verse_to]) => ({
      user_id: ids[handle],
      book,
      chapter,
      verse_from,
      verse_to,
    })),
  );
  check((await admin.from('profile_passages').insert(passages)).error, 'Passages');
  const prayers = HANDLES.flatMap((handle) =>
    PROFILES[handle].prayers.map((p) => ({ user_id: ids[handle], prayer_id: p.id, title: p.title, body: p.body })),
  );
  if (prayers.length) check((await admin.from('profile_prayers').insert(prayers)).error, 'Prières');

  // Intentions : supprimées puis recréées (les carries et leurs compteurs partent avec elles).
  check((await admin.from('intentions').delete().in('user_id', idList)).error, 'Nettoyage des intentions');
  const now = Date.now();
  const rows = HANDLES.flatMap((handle, h) =>
    PROFILES[handle].intentions.map((it, rank) => ({
      user_id: ids[handle],
      body: it.body,
      shown_on_profile: it.shown,
      created_at: new Date(now - (h * 3 + rank + 1) * 3_600_000).toISOString(),
      _handle: handle,
      _rank: rank,
    })),
  );
  const { data: inserted, error: insErr } = await admin
    .from('intentions')
    .insert(rows.map(({ _handle, _rank, ...row }) => row))
    .select('id, user_id, body');
  check(insErr, 'Intentions');
  // On retrouve chaque intention par son auteur et son texte, sans compter sur l'ordre des lignes renvoyées.
  const byContent = new Map(inserted.map((row) => [`${row.user_id}:${row.body}`, row.id]));
  const intentionId = new Map(rows.map((r) => [`${r._handle}:${r._rank}`, byContent.get(`${r.user_id}:${r.body}`)]));
  const carries = CARRIES.map(([by, author, rank]) => ({
    user_id: ids[by],
    intention_id: intentionId.get(`${author}:${rank}`),
  }));
  check((await admin.from('carries').insert(carries)).error, 'Intentions portées');

  // Abonnements.
  const follows = FOLLOWS.map(([a, b]) => ({ follower_id: ids[a], followee_id: ids[b] }));
  if (me) for (const handle of FOLLOW_ME) follows.push({ follower_id: ids[handle], followee_id: me.id });
  check(
    (await admin.from('follows').upsert(follows, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true })).error,
    'Abonnements',
  );

  console.log('Comptes de test prêts :');
  for (const handle of HANDLES) console.log(`  ${handle.padEnd(12)} ${emailFor(base, handle)}`);
  if (me) {
    console.log(`\nIls suivent « ${me.handle} » (vous voyez leur vitrine) : ${FOLLOW_ME.join(', ')}.`);
    console.log('dev_therese ne vous suit pas (profil fermé) ; dev_paul sert à tester le blocage.');
    console.log('Aucun abonnement n’a été créé depuis votre compte : suivez-les depuis l’app.');
  } else {
    console.log('\nSans --me, personne ne suit votre compte. Relancez avec : -- --me votre_pseudo');
  }
}

async function reset(admin, base) {
  const targets = [];
  for (const user of await allUsers(admin)) {
    if (!isSeedEmail(base, user.email)) continue;
    // Double garde-fou : un profil existant doit porter un pseudo de test.
    const { data, error } = await admin.from('profiles').select('handle').eq('id', user.id).maybeSingle();
    check(error, 'Lecture des profils');
    if (data && !data.handle.startsWith(PREFIX)) continue;
    targets.push(user);
  }
  if (!targets.length) return console.log('Aucun compte de test à supprimer.');
  // daily_posts n'a pas de clé étrangère : on le vide à part.
  check(
    (
      await admin
        .from('daily_posts')
        .delete()
        .in(
          'user_id',
          targets.map((u) => u.id),
        )
    ).error,
    'Nettoyage de daily_posts',
  );
  for (const user of targets) {
    check((await admin.auth.admin.deleteUser(user.id)).error, `Suppression de ${user.email}`);
    console.log(`Supprimé : ${user.email}`);
  }
}

async function code(admin, base, handle) {
  if (!HANDLES.includes(handle)) fail(`Pseudo inconnu. Comptes de test : ${HANDLES.join(', ')}.`);
  const email = emailFor(base, handle);
  const exists = (await allUsers(admin)).some((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!exists) fail(`Le compte ${email} n’existe pas. Lancez d’abord « seed ».`);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  check(error, 'Génération du code');
  console.log(`Adresse : ${email}`);
  console.log(`Code    : ${data.properties.email_otp}`);
  console.log(
    '\nDans l’app : saisissez cette adresse, appuyez sur « Recevoir un lien », PUIS lancez cette commande\n' +
      'et tapez le code affiché. Le dernier code généré remplace le précédent.',
  );
}

function help() {
  console.log(`Usage : node scripts/seed-dev.mjs <commande>
  seed [--me <pseudo>]   crée ou met à jour les comptes de test (${HANDLES.join(', ')})
                         --me : ces comptes suivent votre profil (sauf dev_therese)
  reset                  supprime les comptes de test et tout ce qui s’y rattache
  code <pseudo>          code de connexion d’un compte de test
Via npm : npm run seed -- --me votre_pseudo   |   npm run seed:reset`);
}

const [command, ...args] = process.argv.slice(2);
if (!['seed', 'reset', 'code'].includes(command)) {
  help();
  process.exit(command ? 1 : 0);
}
const { admin, base, host } = setup();
console.log(`Projet : ${host}\n`);
if (command === 'seed') {
  const i = args.indexOf('--me');
  if (i !== -1 && !args[i + 1]) fail('--me demande un pseudo.');
  await seed(admin, base, i === -1 ? null : args[i + 1].toLowerCase());
} else if (command === 'reset') {
  await reset(admin, base);
} else {
  if (!args[0]) fail('code demande un pseudo (par exemple dev_marie).');
  await code(admin, base, args[0]);
}
