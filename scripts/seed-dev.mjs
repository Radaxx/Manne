// Données de test pour le développement : comptes, profils, abonnements, vitrine, intentions, groupes de prière, rendez-vous, neuvaines et Rosaire vivant de groupe,
// écrits avec la clé service_role (qui contourne la RLS).
// `seed`, `reset` et `code` visent la base LOCALE (`npm run db:local`). Ils refusent le projet de production.
// `reviewer` et `reviewer-remove` visent uniquement la production (compte Play), via `.env.production.local`.
//
// Variables (chargées par les scripts npm via --env-file) :
//   seed / reset / code : EXPO_PUBLIC_SUPABASE_URL dans .env, SUPABASE_SERVICE_ROLE_KEY et SEED_EMAIL dans .env.local
//   reviewer            : les trois dans .env.production.local
//   SEED_EMAIL          : votre adresse ; les comptes de test en dérivent (a@b.fr -> a+manne-dev_marie@b.fr)
//
// Usage : node scripts/seed-dev.mjs seed [--me <pseudo>] [--rdv-in <minutes>]   crée ou met à jour les comptes de test
//         (avec --me, seed fait aussi de votre compte un MODÉRATEUR ÉDITEUR, sur la base locale seulement : table app_moderators)
//         node scripts/seed-dev.mjs reset                  supprime les comptes et les groupes de test
//         node scripts/seed-dev.mjs code <pseudo>          code de connexion d'un compte de test
//         node scripts/seed-dev.mjs reviewer               crée ou met à jour le compte de démonstration de Google Play
//         node scripts/seed-dev.mjs reviewer-remove        le supprime
import { randomBytes, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'dev_';

// Hôte public du projet de production. `seed` / `reset` / `code` refusent de l'écrire.
const PRODUCTION_HOST = 'xvrdrrtqzfjeqznsxjjd.supabase.co';

// Compte de démonstration pour la validation Google Play : il se connecte avec « Accès relecteur » (adresse et mot de passe).
// Son pseudo n'a pas le préfixe `dev_` : `reset` ne le touche pas, seule `reviewer-remove` le supprime.
const REVIEWER_HANDLE = 'relecteur';
const REVIEWER_PROFILE = {
  bio: 'Compte de démonstration pour la validation de l’application.',
  parish: 'Paroisse de démonstration',
  passages: [[43, 3, 16, 16]],
  intention: 'Pour la paix dans le monde.',
};

// Délai avant le début du rendez-vous ponctuel « Prière de test » (option --rdv-in, en minutes).
const RDV_IN_DEFAULT = 15;
const RDV_IN_MIN = 2;
const RDV_IN_MAX = 240;

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
      {
        body: 'Pour mes enfants, afin qu’ils grandissent dans la confiance et la joie.',
        shown: true,
      },
      {
        body: 'Pour une amie qui traverse une période de fatigue.',
        shown: false,
      },
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
    intentions: [
      {
        body: 'Pour les artisans et tous ceux qui travaillent dans l’ombre.',
        shown: true,
      },
    ],
  },
  dev_claire: {
    bio: 'Étudiante en médecine, je découvre la prière des psaumes.',
    parish: 'Saint-Sernin, Toulouse',
    passages: [PS23, COR13],
    prayers: [],
    intentions: [
      {
        body: 'Pour mes examens de janvier, que je les passe avec calme.',
        shown: true,
      },
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
    intentions: [
      { body: 'Pour trouver ma place dans une communauté.', shown: false },
      // Intention signalée pour spam par deux comptes de test : elle attend dans la file de modération éditeur (SPAM_REPORTS).
      { body: 'Bougies bénies à prix cassés, commandez vite sur mon site !', shown: false },
    ],
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

// Signalements en attente pour la file de modération éditeur (écran Modération, réglages). Un écho signalé trois fois
// (donc masqué : « Rétablir »), l'intention de dev_paul signalée deux fois (encore visible : « Laisser visible »), le profil
// de dev_paul signalé une fois. Les signalements des intentions partent avec elles à chaque seed ; ceux des échos aussi.
const ECHO_REPORT = {
  author: 'dev_pierre',
  target: '19:23:1-4',
  body: 'Écho de test à modérer : cet exemple est signalé par trois comptes de test.',
  by: [
    ['dev_claire', 'insulte'],
    ['dev_marie', 'insulte'],
    ['dev_jean', 'autre'],
  ],
};
const INTENTION_REPORT = {
  author: 'dev_paul',
  rank: 1,
  by: [
    ['dev_claire', 'spam'],
    ['dev_jean', 'spam'],
  ],
};
const PROFILE_REPORT = { target: 'dev_paul', by: [['dev_claire', 'inapproprie']] };

// Hôtes sur lesquels `seed --me` accorde le rôle de modérateur éditeur : la base locale, jamais un projet distant.
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]'];

// Qui suit l'utilisateur avec --me : tous sauf dev_therese (cas « profil fermé »). dev_paul sert au test du blocage.
const FOLLOW_ME = ['dev_marie', 'dev_pierre', 'dev_claire', 'dev_jean', 'dev_paul'];

// Groupes de test (recréés à chaque `seed`, supprimés par `reset`). Les pseudos sont ceux de HANDLES.
//   members : [pseudo, rôle] ; `me` s'ajoute aux groupes où `includeMe` est vrai (la fraternité et la neuvaine, option --me), simple membre sauf si `meRole` dit autre chose : MODÉRATEUR de la fraternité, pour voir la file de signalements.
//   reports : signalements en attente. { rank, by, reason } : l'intention de rang `rank` est signalée par ces pseudos pour ce motif (insulte, inapproprie, spam ou autre) ; trois signalements la masqueraient, deux la laissent visible.
//   requests : demandes en attente. intentions : [auteur, texte, { thanks }] ; `thanks` présent = exaucée.
//   carries : [qui porte, rang de l'intention dans la liste du groupe].
//   gatherings : rendez-vous de prière (hebdomadaire `weekly` ou ponctuel `once`, qui commence dans --rdv-in minutes) ; `prayerKind` : libre (défaut), chapelet, office ou adoration ; `roomPresent` / `roomIntentions` (ponctuel seulement) : présents et intentions déjà dans la salle ; `participants` : pseudos
//   inscrits, ou `me` (option --me, seulement dans un groupe où `includeMe` est vrai).
//   novenas : neuvaines de groupe. `startDaysAgo` : jours écoulés depuis le jour 1 (négatif : commence dans le futur,
//   -1 = demain), dans `timezone` ; `prayed` : pseudo -> jours priés (jamais un jour futur) ; modèle `personnalisee` :
//   `customPrayer` (texte écrit pour le test) et `passageSet` facultatif. Rien n'est écrit au nom de `me` (ni jour prié, ni rappel).
//   rosaries : Rosaire vivant du groupe (un seul actif). `startMonthsAgo` : mois écoulés depuis le mois de départ, dans `timezone` ;
//   `places` : pseudo -> [équipe, place de base 0 à 19] (le mystère du mois est (place + mois écoulés) mod 20) ; `prayedToday` :
//   pseudos qui ont coché leur dizaine aujourd'hui (jour de `timezone`). `me` n'a JAMAIS de place : à prendre depuis l'app.
//   adorations : chaînes d'adoration. `tonight: { startHour, endHour }` : commence ce soir à `startHour` (heure du mur de `timezone` ;
//   demain soir si cette heure est déjà passée) et finit à `endHour` le lendemain ; `startsInMin` + `durationMin` : commence dans
//   ce nombre de minutes après le seed. `slotMinutes` : 30 ou 60 ; `reservations` : pseudo -> index de créneaux (0 = premier).
//   `me` n'a JAMAIS de réservation : à prendre depuis l'app.
const DAY = 86_400_000;
const GROUPS = [
  {
    name: 'Fraternité de test',
    description: 'Un petit groupe privé : on y entre avec le code.',
    kind: 'fraternite',
    members: [
      ['dev_marie', 'owner'],
      ['dev_pierre', 'member'],
      ['dev_claire', 'member'],
    ],
    includeMe: true,
    meRole: 'moderator',
    requests: [],
    intentions: [
      ['dev_marie', 'Pour notre fraternité, que nous restions fidèles à nous retrouver chaque mois.'],
      ['dev_pierre', 'Pour mon père, hospitalisé cette semaine.'],
      [
        'dev_claire',
        'Pour mes examens de janvier, que je les passe avec calme.',
        { thanks: 'Merci : je les ai réussis, et vos prières m’ont portée !' },
      ],
    ],
    carries: [
      ['dev_pierre', 0],
      ['dev_claire', 0],
      ['dev_marie', 1],
      ['dev_claire', 1],
    ],
    // Un signalement en attente : l'intention de dev_pierre, signalée pour spam par dev_claire et dev_marie.
    reports: [{ rank: 1, by: ['dev_claire', 'dev_marie'], reason: 'spam' }],
    gatherings: [
      {
        title: 'Chapelet',
        description: 'Une dizaine chacun, en visio ou chacun chez soi.',
        durationMin: 30,
        prayerKind: 'chapelet',
        weekly: { weekdays: [2], localTime: '21:00', timezone: 'Europe/Paris' },
        participants: ['dev_marie', 'dev_pierre', 'me'],
      },
      {
        // Plusieurs jours de la semaine et une fin : « Les mardis, jeudis et samedis de 10 h à 10 h 15, jusqu’au … » (dans 60 jours).
        title: 'Chapelet du matin',
        description: 'Un quart d’heure, trois fois par semaine, pendant deux mois.',
        durationMin: 15,
        prayerKind: 'chapelet',
        weekly: { weekdays: [2, 4, 6], localTime: '10:00', timezone: 'Europe/Paris', endsInDays: 60 },
        participants: ['dev_marie', 'dev_claire'],
      },
      {
        // Commence --rdv-in minutes (15 par défaut) après le lancement du seed : pour tester le rappel, puis « Je suis là »
        // (10 minutes avant le début).
        title: 'Prière de test',
        description: 'Un rendez-vous ponctuel qui commence quelques minutes après le seed.',
        durationMin: 30,
        once: true,
        prayerKind: 'chapelet',
        // Salle de prière : dev_marie et dev_claire sont déclarées présentes à cette occurrence et y ont écrit une intention.
        // Elles ne sont pas « en ligne » (pas de connexion Realtime) : seul votre téléphone apparaît dans « Dans la salle ».
        roomPresent: ['dev_marie', 'dev_claire'],
        roomIntentions: [
          ['dev_marie', 'Pour ceux qui prient avec nous ce soir.'],
          ['dev_claire', 'Pour la paix dans les familles que nous portons.'],
        ],
        participants: ['dev_marie', 'dev_claire', 'me'],
      },
    ],
    novenas: [
      {
        model: 'personnalisee',
        title: 'Neuvaine du groupe',
        intention: 'Pour les familles de la fraternité, que chacune trouve la paix.',
        customPrayer:
          'Seigneur, nous te confions les familles de notre fraternité.\nDonne-leur la paix, la patience et la joie de se retrouver.\nAmen.',
        passageSet: 'psaumes',
        startDaysAgo: -1,
        timezone: 'Europe/Paris',
        prayed: {},
      },
    ],
    rosaries: [
      {
        timezone: 'Europe/Paris',
        startMonthsAgo: 1,
        places: { dev_marie: [1, 1], dev_pierre: [1, 5], dev_claire: [1, 12] },
        prayedToday: ['dev_marie', 'dev_claire'],
      },
    ],
    adorations: [
      {
        // Ce soir 21 h -> 7 h demain (heure de Paris), 10 créneaux de 60 min (11 la nuit du changement d'heure). Trous : les créneaux 3 à 5 et le créneau 9.
        title: 'Nuit d’adoration',
        intention: 'Pour les malades de notre paroisse, et pour ceux qui veillent près d’eux.',
        place: 'Chapelle Saint-Joseph',
        timezone: 'Europe/Paris',
        slotMinutes: 60,
        tonight: { startHour: 21, endHour: 7 },
        reservations: { dev_marie: [0, 1, 6], dev_pierre: [1, 2, 6], dev_claire: [2, 7, 8] },
      },
      {
        // Commence 20 minutes après le seed : « C'est bientôt ton heure d'adoration » arrive 10 minutes plus tard, et le rappel
        // aussi si vous réservez le premier créneau (où dev_marie adore déjà).
        title: 'Adoration de test',
        intention: '',
        place: '',
        timezone: 'Europe/Paris',
        slotMinutes: 30,
        startsInMin: 20,
        durationMin: 120,
        reservations: { dev_marie: [0] },
      },
      {
        // Récurrente : tous les vendredis de 21 h à 22 h (Paris) pendant 2 mois, créneaux de 30 min. Le premier vendredi est
        // demain ou dans la semaine ; `reservations` : [numéro de l'occurrence (0 = la première), numéro du créneau]. Aucune au
        // nom de --me.
        title: 'Adoration du vendredi',
        intention: 'Pour les vocations, chaque vendredi soir.',
        place: 'Chapelle Saint-Joseph',
        timezone: 'Europe/Paris',
        slotMinutes: 30,
        weekly: { weekdays: [5], localStart: '21:00', localEnd: '22:00', months: 2 },
        reservations: {
          dev_marie: [
            [0, 0],
            [1, 0],
            [2, 1],
          ],
          dev_pierre: [
            [0, 0],
            [1, 1],
          ],
          dev_claire: [
            [0, 1],
            [3, 0],
          ],
        },
      },
    ],
  },
  {
    name: 'Paroisse de test',
    description: 'Une communauté trouvable par son nom : on envoie une demande.',
    kind: 'communaute',
    members: [
      ['dev_jean', 'owner'],
      ['dev_therese', 'moderator'],
      ['dev_marie', 'member'],
    ],
    includeMe: false,
    requests: ['dev_paul'],
    intentions: [
      ['dev_jean', 'Pour la préparation de la fête paroissiale.'],
      ['dev_therese', 'Pour les familles qui ont perdu un proche cette année.'],
    ],
    carries: [
      ['dev_marie', 0],
      ['dev_jean', 1],
    ],
    gatherings: [
      {
        title: 'Chapelet de la paroisse',
        description: '',
        durationMin: 60,
        prayerKind: 'chapelet',
        weekly: { weekdays: [0], localTime: '18:30', timezone: 'Europe/Paris' },
        participants: ['dev_jean', 'dev_marie'],
      },
      {
        // Autre fuseau : sert à voir la mention « heure de Toronto » sur un téléphone réglé sur l'heure de Paris.
        title: 'Adoration des Canadiens',
        description: 'Une heure d’adoration avec les membres de Toronto.',
        durationMin: 60,
        prayerKind: 'adoration',
        weekly: { weekdays: [4], localTime: '19:00', timezone: 'America/Toronto' },
        participants: ['dev_therese'],
      },
    ],
  },
  {
    name: 'Neuvaine de test',
    description: 'Neuf jours de prière ensemble, puis le groupe se termine.',
    kind: 'ephemere',
    endsInDays: 9,
    members: [
      ['dev_claire', 'owner'],
      ['dev_pierre', 'member'],
      ['dev_paul', 'member'],
    ],
    // Avec --me, on y entre aussi : c'est là qu'une neuvaine est déjà en cours (jour 4).
    includeMe: true,
    requests: [],
    intentions: [
      ['dev_claire', 'Pour l’unité des chrétiens, pendant ces neuf jours.'],
      ['dev_paul', 'Pour trouver ma place dans une communauté.'],
    ],
    carries: [
      ['dev_pierre', 0],
      ['dev_pierre', 1],
    ],
    gatherings: [
      {
        title: 'Prière du soir',
        description: 'Vingt minutes pour la neuvaine.',
        durationMin: 20,
        prayerKind: 'office',
        weekly: { weekdays: [5], localTime: '20:00', timezone: 'Europe/Paris' },
        participants: ['dev_claire', 'dev_pierre'],
      },
    ],
    novenas: [
      {
        model: 'esprit-saint',
        title: 'Neuvaine à l’Esprit Saint',
        intention: 'Pour l’unité des chrétiens, pendant ces neuf jours.',
        startDaysAgo: 3,
        timezone: 'Europe/Paris',
        prayed: { dev_claire: [1, 2, 3, 4], dev_pierre: [1, 2, 4], dev_paul: [1, 3] },
      },
    ],
  },
];
const GROUP_NAMES = GROUPS.map((g) => g.name);
// 8 caractères sans 0, O, 1 ni I : l'alphabet du serveur (cf. new_invite_code, migration 008).
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const inviteCode = () => Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');

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
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    check(error, 'Liste des utilisateurs');
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function setup() {
  const reviewer = process.argv[2] === 'reviewer' || process.argv[2] === 'reviewer-remove';
  const where = reviewer ? '.env.production.local' : '.env.local (jamais dans .env)';
  const url = env('EXPO_PUBLIC_SUPABASE_URL', reviewer ? '.env.production.local' : '.env');
  const key = env('SUPABASE_SERVICE_ROLE_KEY', where);
  const base = env('SEED_EMAIL', where);
  if (!/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(base)) {
    fail('SEED_EMAIL doit être une adresse simple, sans « + » (par exemple prenom@exemple.fr).');
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, base, host: new URL(url).host };
}

/** `seed`, `reset` et `code` restent sur la base locale. Le compte Play reste sur la production. */
function assertTarget(command, host) {
  const prod = host.split(':')[0] === PRODUCTION_HOST;
  const reviewer = command === 'reviewer' || command === 'reviewer-remove';
  if (prod && !reviewer) {
    fail(`« ${command} » refuse le projet de production. Lancez npm run db:local, puis réessayez.`);
  }
  if (!prod && reviewer) {
    fail(`« ${command} » n’écrit que sur ${PRODUCTION_HOST}. Le script charge .env.production.local.`);
  }
}

async function seed(admin, base, meHandle, rdvIn, host) {
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
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
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
    PROFILES[handle].prayers.map((p) => ({
      user_id: ids[handle],
      prayer_id: p.id,
      title: p.title,
      body: p.body,
    })),
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

  const moderation = await seedModeration(admin, ids, intentionId, me, host);

  // Abonnements.
  const follows = FOLLOWS.map(([a, b]) => ({
    follower_id: ids[a],
    followee_id: ids[b],
  }));
  if (me) for (const handle of FOLLOW_ME) follows.push({ follower_id: ids[handle], followee_id: me.id });
  check(
    (
      await admin.from('follows').upsert(follows, {
        onConflict: 'follower_id,followee_id',
        ignoreDuplicates: true,
      })
    ).error,
    'Abonnements',
  );

  const groupSummary = await seedGroups(admin, ids, me, rdvIn);

  console.log('Modération éditeur (file globale) :');
  for (const line of moderation) console.log(`  ${line}`);
  console.log('');

  console.log('Comptes de test prêts :');
  for (const handle of HANDLES) console.log(`  ${handle.padEnd(12)} ${emailFor(base, handle)}`);
  if (me) {
    console.log(`\nIls suivent « ${me.handle} » (vous voyez leur vitrine) : ${FOLLOW_ME.join(', ')}.`);
    console.log('dev_therese ne vous suit pas (profil fermé) ; dev_paul sert à tester le blocage.');
    console.log('Aucun abonnement n’a été créé depuis votre compte : suivez-les depuis l’app.');
  } else {
    console.log('\nSans --me, personne ne suit votre compte. Relancez avec : -- --me votre_pseudo');
  }

  console.log('\nGroupes de test (supprimés et recréés à chaque seed) :');
  for (const line of groupSummary) console.log(`  ${line}`);
  if (me) {
    console.log(
      `\nÉcritures à votre nom : votre adhésion à « ${GROUPS[0].name} » (en tant que MODÉRATEUR, pour voir la file de signalements : une intention de dev_pierre y est signalée pour spam par dev_claire et dev_marie) et à « ${GROUPS[2].name} » (simple membre), et votre inscription aux rendez-vous de « ${GROUPS[0].name} » (« Je participe »). Aucun jour de neuvaine n’est coché, aucun rappel de neuvaine réglé et aucune place prise dans le Rosaire vivant à votre nom. Vous n’êtes pas dans « ${GROUPS[1].name} » : demandez à la rejoindre depuis la recherche.`,
    );
  } else {
    console.log('\nSans --me, vous n’êtes membre d’aucun groupe de test.');
  }
}

/**
 * Signalements en attente pour la file de modération éditeur : un écho, une intention du fil et un profil de test. Avec --me
 * et une base LOCALE, votre compte devient aussi modérateur éditeur (app_moderators). Renvoie les lignes du résumé.
 */
async function seedModeration(admin, ids, intentionId, me, host) {
  const idList = Object.values(ids);
  const lines = [];

  // Échos de test : supprimés puis recréés (leurs signalements partent avec eux).
  check((await admin.from('echoes').delete().in('user_id', idList)).error, 'Nettoyage des échos');
  const { data: echo, error: echoError } = await admin
    .from('echoes')
    .insert({ user_id: ids[ECHO_REPORT.author], target: ECHO_REPORT.target, body: ECHO_REPORT.body })
    .select('id')
    .single();
  check(echoError, 'Écho de test');
  check(
    (await admin.from('reports').insert(ECHO_REPORT.by.map(([by, reason]) => ({ user_id: ids[by], echo_id: echo.id, reason })))).error,
    'Signalements de l’écho',
  );
  lines.push(`un écho de ${ECHO_REPORT.author} signalé ${ECHO_REPORT.by.length} fois (masqué)`);

  const target = intentionId.get(`${INTENTION_REPORT.author}:${INTENTION_REPORT.rank}`);
  check(
    (await admin.from('reports').insert(INTENTION_REPORT.by.map(([by, reason]) => ({ user_id: ids[by], intention_id: target, reason }))))
      .error,
    'Signalements de l’intention',
  );
  lines.push(`une intention de ${INTENTION_REPORT.author} signalée ${INTENTION_REPORT.by.length} fois (visible)`);

  check((await admin.from('profile_reports').delete().in('reporter_id', idList)).error, 'Nettoyage des signalements de profil');
  check(
    (
      await admin.from('profile_reports').insert(
        PROFILE_REPORT.by.map(([by, reason]) => ({
          reporter_id: ids[by],
          target_id: ids[PROFILE_REPORT.target],
          subject: 'profil',
          reason,
        })),
      )
    ).error,
    'Signalement du profil',
  );
  lines.push(`le profil de ${PROFILE_REPORT.target} signalé ${PROFILE_REPORT.by.length} fois (visible)`);

  if (!me) {
    lines.push('sans --me, aucun compte n’est modérateur éditeur');
  } else if (!LOCAL_HOSTS.includes(host.replace(/:\d+$/, ''))) {
    lines.push(`${me.handle} n’est PAS déclaré modérateur éditeur : ce projet n’est pas une base locale`);
  } else {
    check(
      (await admin.from('app_moderators').upsert({ user_id: me.id }, { onConflict: 'user_id', ignoreDuplicates: true })).error,
      'Modérateur éditeur',
    );
    lines.push(`${me.handle} est modérateur éditeur de la base locale (Réglages > Modération)`);
  }
  return lines;
}

/** Recrée les groupes de test avec leurs membres, demandes, intentions et « je la porte ». Renvoie les lignes du résumé. */
async function seedGroups(admin, ids, me, rdvIn) {
  const idList = Object.values(ids);
  const old = await admin.from('groups').delete().in('name', GROUP_NAMES).in('created_by', idList);
  check(old.error, 'Nettoyage des groupes');

  const now = Date.now();
  const summary = [];
  for (const group of GROUPS) {
    const code = inviteCode();
    const { data, error } = await admin
      .from('groups')
      .insert({
        name: group.name,
        description: group.description,
        kind: group.kind,
        invite_code: code,
        ends_at: group.endsInDays ? new Date(now + group.endsInDays * DAY).toISOString() : null,
        created_by: ids[group.members.find(([, role]) => role === 'owner')[0]],
      })
      .select('id')
      .single();
    check(error, `Création de « ${group.name} »`);
    const groupId = data.id;

    // joined_at échelonné : le plus ancien membre passe en premier si la propriété doit être réattribuée.
    const members = group.members.map(([handle, role], i) => ({
      group_id: groupId,
      user_id: ids[handle],
      role,
      joined_at: new Date(now - (10 - i) * DAY).toISOString(),
    }));
    if (me && group.includeMe) {
      members.push({
        group_id: groupId,
        user_id: me.id,
        role: group.meRole ?? 'member',
        joined_at: new Date(now - DAY).toISOString(),
      });
    }
    check((await admin.from('group_members').insert(members)).error, `Membres de « ${group.name} »`);

    if (group.requests.length) {
      const requests = group.requests.map((handle) => ({
        group_id: groupId,
        user_id: ids[handle],
      }));
      check((await admin.from('group_requests').insert(requests)).error, `Demandes de « ${group.name} »`);
    }

    const rows = group.intentions.map(([handle, body, answered], rank) => ({
      group_id: groupId,
      user_id: ids[handle],
      body,
      created_at: new Date(now - (rank + 1) * 3_600_000).toISOString(),
      answered_at: answered ? new Date(now - 1_800_000).toISOString() : null,
      thanks: answered?.thanks ?? null,
    }));
    const { data: inserted, error: insErr } = await admin.from('group_intentions').insert(rows).select('id, body');
    check(insErr, `Intentions de « ${group.name} »`);
    // On retrouve chaque intention par son texte, sans compter sur l'ordre des lignes renvoyées.
    const idByBody = new Map(inserted.map((row) => [row.body, row.id]));
    const carries = group.carries.map(([by, rank]) => ({
      user_id: ids[by],
      intention_id: idByBody.get(group.intentions[rank][1]),
    }));
    check((await admin.from('group_carries').insert(carries)).error, `Intentions portées de « ${group.name} »`);

    const reports = (group.reports ?? []).flatMap(({ rank, by, reason }) =>
      by.map((handle) => ({
        user_id: ids[handle],
        intention_id: idByBody.get(group.intentions[rank][1]),
        reason,
      })),
    );
    if (reports.length) check((await admin.from('group_reports').insert(reports)).error, `Signalements de « ${group.name} »`);

    const meetings = await seedGatherings(admin, group, groupId, ids, me, now, rdvIn);
    const novenas = await seedNovenas(admin, group, groupId, ids, now);
    const rosaries = await seedRosaries(admin, group, groupId, ids, now);
    const adorations = await seedAdorations(admin, group, groupId, ids, now);

    const who = group.members.map(([handle, role]) => `${handle} (${role})`).join(', ');
    summary.push(
      `${group.name} — ${group.kind}${group.endsInDays ? `, fin dans ${group.endsInDays} jours` : ''}`,
      `    code : ${code}   lien : manne://rejoindre/${code}`,
      `    membres : ${who}${me && group.includeMe ? `, ${me.handle} (${group.meRole ?? 'member'})` : ''}${group.requests.length ? ` ; demande en attente : ${group.requests.join(', ')}` : ''}`,
      ...meetings,
      ...novenas,
      ...rosaries,
      ...adorations,
    );
  }
  return summary;
}

/** Le jour et l'heure du mur de `zone` à l'instant `ts` : de quoi savoir si un rendez-vous hebdomadaire est en cours. */
function wallClock(ts, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ts));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const weekday = new Date(Date.UTC(get('year'), get('month') - 1, get('day'))).getUTCDay();
  return {
    weekday,
    minutes: (get('hour') % 24) * 60 + get('minute'),
    seconds: get('second'),
  };
}

/**
 * Recrée les rendez-vous d'un groupe avec leurs inscrits. Renvoie les lignes du résumé.
 * Présences : si un rendez-vous hebdomadaire est EN COURS au moment du seed (de 10 minutes avant le début à la fin),
 * dev_marie et dev_pierre s'y déclarent présents. Approximation volontaire : le début est déduit de l'heure du mur du
 * jour même, sans tenir compte d'un changement d'heure survenu entre le début et maintenant.
 */
async function seedGatherings(admin, group, groupId, ids, me, now, rdvIn) {
  const owner = ids[group.members.find(([, role]) => role === 'owner')[0]];
  const lines = [];
  for (const meeting of group.gatherings ?? []) {
    const once = meeting.once === true;
    const startsAt = new Date(now + rdvIn * 60_000);
    const row = {
      group_id: groupId,
      title: meeting.title,
      description: meeting.description,
      duration_min: meeting.durationMin,
      recurrence: once ? 'once' : 'weekly',
      weekdays: once ? null : meeting.weekly.weekdays,
      local_time: once ? null : meeting.weekly.localTime,
      timezone: once ? null : meeting.weekly.timezone,
      starts_at: once ? startsAt.toISOString() : null,
      ends_on: !once && meeting.weekly.endsInDays ? dateIn(meeting.weekly.timezone, now, meeting.weekly.endsInDays) : null,
      prayer_kind: meeting.prayerKind ?? 'libre',
      created_by: owner,
    };
    const { data, error } = await admin.from('group_gatherings').insert(row).select('id').single();
    check(error, `Rendez-vous « ${meeting.title} »`);
    const userIds = meeting.participants.flatMap((who) => (who === 'me' ? (me && group.includeMe ? [me.id] : []) : [ids[who]]));
    if (userIds.length) {
      const rows = userIds.map((user_id) => ({
        gathering_id: data.id,
        user_id,
      }));
      check((await admin.from('gathering_participants').insert(rows)).error, `Inscrits à « ${meeting.title} »`);
    }

    let present = '';
    if (once && meeting.roomPresent?.length) {
      const rows = meeting.roomPresent.map((handle) => ({
        gathering_id: data.id,
        occurrence_start: startsAt.toISOString(),
        user_id: ids[handle],
      }));
      check((await admin.from('gathering_presence').insert(rows)).error, `Présences à « ${meeting.title} »`);
      const intentions = (meeting.roomIntentions ?? []).map(([handle, body]) => ({
        group_id: groupId,
        user_id: ids[handle],
        body,
        gathering_id: data.id,
        occurrence_start: startsAt.toISOString(),
      }));
      if (intentions.length) {
        check((await admin.from('group_intentions').insert(intentions)).error, `Intentions de la salle de « ${meeting.title} »`);
      }
      present = ` ; salle : ${rows.length} présent(s) dev, ${intentions.length} intention(s)`;
    }
    if (!once) {
      const [h, m] = meeting.weekly.localTime.split(':').map(Number);
      const wall = wallClock(now, meeting.weekly.timezone);
      const since = wall.minutes - (h * 60 + m); // minutes écoulées depuis le début de CE jour
      const ended = row.ends_on !== null && dateIn(meeting.weekly.timezone, now, 0) > row.ends_on;
      if (!ended && meeting.weekly.weekdays.includes(wall.weekday) && since >= -10 && since < meeting.durationMin) {
        const start = new Date(Math.floor((now - wall.seconds * 1000 - since * 60_000) / 60_000) * 60_000).toISOString();
        const rows = ['dev_marie', 'dev_pierre']
          .filter((handle) => userIds.includes(ids[handle]))
          .map((handle) => ({
            gathering_id: data.id,
            occurrence_start: start,
            user_id: ids[handle],
          }));
        if (rows.length) {
          check((await admin.from('gathering_presence').insert(rows)).error, `Présences à « ${meeting.title} »`);
          present = ` ; en cours : ${rows.length} présent(s) dev`;
        }
      }
    }

    const when = once
      ? `ponctuel, commence à ${startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} heure locale (dans ${rdvIn} min ; « Je suis là » dès ${new Date(startsAt.getTime() - 10 * 60_000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`
      : `hebdomadaire, jours ${meeting.weekly.weekdays.join(', ')} (0 = dimanche) à ${meeting.weekly.localTime}, ${meeting.weekly.timezone}${row.ends_on ? `, jusqu’au ${row.ends_on}` : ', sans fin'}`;
    const who = meeting.participants.filter((p) => p !== 'me' || (me && group.includeMe)).map((p) => (p === 'me' ? me.handle : p));
    lines.push(`    rendez-vous : ${meeting.title} — ${when}, ${meeting.durationMin} min ; inscrits : ${who.join(', ')}${present}`);
  }
  return lines;
}

/** AAAA-MM-JJ du jour de `zone` à l'instant `ts`, décalé de `shift` jours. */
function dateIn(zone, ts, shift) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(
    new Date(ts),
  );
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day') + shift)).toISOString().slice(0, 10);
}

/**
 * Recrée les neuvaines d'un groupe avec les jours priés par les comptes de test. Rien n'est écrit au nom de l'utilisateur
 * (--me) : ni jour prié ni rappel. Renvoie les lignes du résumé.
 */
async function seedNovenas(admin, group, groupId, ids, now) {
  const owner = ids[group.members.find(([, role]) => role === 'owner')[0]];
  const lines = [];
  for (const novena of group.novenas ?? []) {
    const startDate = dateIn(novena.timezone, now, -novena.startDaysAgo);
    const { data, error } = await admin
      .from('group_novenas')
      .insert({
        group_id: groupId,
        model: novena.model,
        title: novena.title,
        intention: novena.intention,
        custom_prayer: novena.customPrayer ?? null,
        passage_set: novena.passageSet ?? null,
        start_date: startDate,
        timezone: novena.timezone,
        created_by: owner,
      })
      .select('id')
      .single();
    check(error, `Neuvaine « ${novena.title} »`);
    const rows = Object.entries(novena.prayed).flatMap(([handle, days]) =>
      days.map((day) => ({ novena_id: data.id, user_id: ids[handle], day })),
    );
    if (rows.length) check((await admin.from('novena_days_prayed').insert(rows)).error, `Jours priés de « ${novena.title} »`);
    const current = novena.startDaysAgo < 0 ? 'pas encore commencée' : `jour ${novena.startDaysAgo + 1} sur 9`;
    const who = Object.entries(novena.prayed).map(([handle, days]) => `${handle} (${days.join(', ')})`);
    lines.push(
      `    neuvaine : ${novena.title} (${novena.model}) — début ${startDate}, ${novena.timezone}, ${current}${who.length ? ` ; jours priés : ${who.join(', ')}` : ''}`,
    );
  }
  return lines;
}

/**
 * Recrée le Rosaire vivant d'un groupe (le groupe vient d'être recréé : rien d'ancien). Rien n'est écrit au nom de
 * l'utilisateur (--me) : il n'a pas de place. Renvoie les lignes du résumé.
 */
async function seedRosaries(admin, group, groupId, ids, now) {
  const owner = ids[group.members.find(([, role]) => role === 'owner')[0]];
  const lines = [];
  for (const rosary of group.rosaries ?? []) {
    const today = dateIn(rosary.timezone, now, 0);
    const [year, month] = today.split('-').map(Number);
    const startMonth = new Date(Date.UTC(year, month - 1 - rosary.startMonthsAgo, 1)).toISOString().slice(0, 10);
    const { data, error } = await admin
      .from('group_rosaries')
      .insert({ group_id: groupId, start_month: startMonth, timezone: rosary.timezone, created_by: owner })
      .select('id')
      .single();
    check(error, `Rosaire vivant de « ${group.name} »`);
    const places = Object.entries(rosary.places).map(([handle, [team, slot]]) => ({
      rosary_id: data.id,
      user_id: ids[handle],
      team,
      slot,
    }));
    check((await admin.from('rosary_members').insert(places)).error, `Places du Rosaire vivant de « ${group.name} »`);
    const prayed = rosary.prayedToday.map((handle) => ({ rosary_id: data.id, user_id: ids[handle], day: today }));
    if (prayed.length) check((await admin.from('rosary_decades').insert(prayed)).error, `Dizaines du Rosaire vivant de « ${group.name} »`);
    const who = Object.entries(rosary.places).map(([handle, [team, slot]]) => `${handle} (équipe ${team}, place ${slot})`);
    lines.push(
      `    rosaire vivant : début ${startMonth}, ${rosary.timezone} — ${who.join(', ')} ; dizaine cochée aujourd’hui (${today}) : ${rosary.prayedToday.join(', ') || 'personne'}`,
    );
  }
  return lines;
}

/** AAAA-MM-JJ décalé de `shift` jours (calendrier UTC, sans changement d'heure). */
function shiftIso(iso, shift) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + shift)).toISOString().slice(0, 10);
}

/** AAAA-MM-JJ plus `months` mois, le jour ramené au dernier du mois s'il n'existe pas. */
function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}

/** L'instant (ms) où il est `hour:minute` le `iso` (AAAA-MM-JJ) dans `zone`. Deux passes corrigent le décalage quand il change. */
function instantIn(zone, iso, hour, minute) {
  const [y, m, d] = iso.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  const offset = (ts) => {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(new Date(ts));
    const get = (type) => Number(p.find((x) => x.type === type).value);
    return (
      Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - Math.floor(ts / 1000) * 1000
    );
  };
  const first = wall - offset(wall);
  return wall - offset(first);
}

/**
 * Recrée les chaînes d'adoration d'un groupe avec les réservations des comptes de test. Rien n'est écrit au nom de
 * l'utilisateur (--me) : aucune réservation. Renvoie les lignes du résumé.
 */
async function seedAdorations(admin, group, groupId, ids, now) {
  const owner = ids[group.members.find(([, role]) => role === 'owner')[0]];
  const lines = [];
  for (const chain of group.adorations ?? []) {
    const weekly = chain.weekly !== undefined;
    const zone = chain.timezone;
    const slotMs = chain.slotMinutes * 60_000;
    /** Les occurrences : une pour une chaîne ponctuelle, une par jour voulu pour une hebdomadaire (fin à l'heure du mur). */
    let occurrences;
    let schedule = {};
    if (weekly) {
      const w = chain.weekly;
      const [sh, sm] = w.localStart.split(':').map(Number);
      const [eh, em] = w.localEnd.split(':').map(Number);
      // Premier jour : demain ou le premier jour voulu qui suit.
      let firstOn = dateIn(zone, now, 1);
      while (!w.weekdays.includes(new Date(`${firstOn}T00:00:00Z`).getUTCDay())) firstOn = shiftIso(firstOn, 1);
      const lastOn = shiftIso(addMonthsIso(firstOn, w.months), -1);
      occurrences = [];
      for (let day = firstOn; day <= lastOn; day = shiftIso(day, 1)) {
        if (!w.weekdays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) continue;
        const nextDay = eh * 60 + em > sh * 60 + sm ? 0 : 1;
        occurrences.push({ start: instantIn(zone, day, sh, sm), end: instantIn(zone, shiftIso(day, nextDay), eh, em) });
      }
      schedule = {
        recurrence: 'weekly',
        weekdays: w.weekdays,
        local_start: w.localStart,
        local_end: w.localEnd,
        first_on: firstOn,
        last_on: lastOn,
      };
    } else {
      let start;
      let end;
      if (chain.tonight) {
        let day = dateIn(zone, now, 0);
        start = instantIn(zone, day, chain.tonight.startHour, 0);
        // Une heure déjà passée (à 5 minutes près) : demain soir.
        if (start <= now + 5 * 60_000) {
          day = dateIn(zone, now, 1);
          start = instantIn(zone, day, chain.tonight.startHour, 0);
        }
        end = instantIn(zone, dateIn(zone, start, 1), chain.tonight.endHour, 0);
      } else {
        start = Math.floor((now + chain.startsInMin * 60_000) / 60_000) * 60_000;
        end = start + chain.durationMin * 60_000;
      }
      occurrences = [{ start, end }];
      schedule = { recurrence: 'once' };
    }
    const start = occurrences[0].start;
    const end = occurrences[occurrences.length - 1].end;
    const { data, error } = await admin
      .from('adoration_chains')
      .insert({
        group_id: groupId,
        title: chain.title,
        intention: chain.intention,
        place: chain.place,
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(end).toISOString(),
        slot_minutes: chain.slotMinutes,
        timezone: zone,
        created_by: owner,
        ...schedule,
      })
      .select('id')
      .single();
    check(error, `Chaîne d’adoration « ${chain.title} »`);
    // Une réservation = l'instant de début du créneau. Ponctuel : [index du créneau]. Hebdomadaire : [occurrence, index du créneau].
    const rows = Object.entries(chain.reservations).flatMap(([handle, picks]) =>
      picks.map((pick) => {
        const [occurrence, index] = weekly ? pick : [0, pick];
        return {
          chain_id: data.id,
          slot_start: new Date(occurrences[occurrence].start + index * slotMs).toISOString(),
          user_id: ids[handle],
        };
      }),
    );
    if (rows.length) check((await admin.from('adoration_slots').insert(rows)).error, `Réservations de « ${chain.title} »`);
    const count = occurrences.reduce((sum, o) => sum + Math.floor((o.end - o.start) / slotMs), 0);
    const taken = new Set(rows.map((r) => r.slot_start)).size;
    const clock = (ts) =>
      new Intl.DateTimeFormat('fr-FR', { timeZone: zone, weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    const who = Object.entries(chain.reservations).map(([handle, picks]) => `${handle} (${picks.length} créneau(x))`);
    const when = weekly
      ? `hebdomadaire, jours ${chain.weekly.weekdays.join(', ')} (0 = dimanche), ${chain.weekly.localStart} – ${chain.weekly.localEnd} (${zone}), du ${schedule.first_on} au ${schedule.last_on}, ${occurrences.length} occurrences`
      : `du ${clock(start)} au ${clock(end)} (${zone})`;
    lines.push(
      `    chaîne d’adoration : ${chain.title} — ${when}, ${count} créneaux de ${chain.slotMinutes} min, ${taken} réservés ; ${who.join(', ')}`,
    );
  }
  return lines;
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
  // Les groupes de test d'abord : si l'un d'eux compte votre adhésion (--me), supprimer son propriétaire de test
  // vous en ferait le propriétaire au lieu de le supprimer.
  check(
    (
      await admin
        .from('groups')
        .delete()
        .in('name', GROUP_NAMES)
        .in(
          'created_by',
          targets.map((u) => u.id),
        )
    ).error,
    'Suppression des groupes de test',
  );
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
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  check(error, 'Génération du code');
  console.log(`Adresse : ${email}`);
  console.log(`Code    : ${data.properties.email_otp}`);
  console.log(
    '\nDans l’app : saisissez cette adresse, appuyez sur « Recevoir un lien », PUIS lancez cette commande\n' +
      'et tapez le code affiché. Le dernier code généré remplace le précédent.',
  );
}

/** Un mot de passe long tiré au hasard, sans caractère ambigu. */
function newPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Crée ou met à jour le compte de démonstration : adresse confirmée, mot de passe neuf (REVIEWER_PASSWORD, ou tiré au hasard),
 * profil, un passage, une intention et un abonnement aux comptes de test s'ils existent. Le mot de passe n'est affiché qu'ici.
 */
async function reviewer(admin, base) {
  const email = emailFor(base, REVIEWER_HANDLE);
  const password = process.env.REVIEWER_PASSWORD?.trim() || newPassword();
  if (password.length < 12) fail('REVIEWER_PASSWORD doit faire au moins 12 caractères.');
  const users = await allUsers(admin);
  let user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    const updated = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    check(updated.error, `Mise à jour de ${email}`);
  } else {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    check(created.error, `Création de ${email}`);
    user = created.data.user;
  }
  const { data: taken } = await admin.from('profiles').select('id').eq('handle', REVIEWER_HANDLE).maybeSingle();
  if (taken && taken.id !== user.id) fail(`Le pseudo « ${REVIEWER_HANDLE} » appartient déjà à un autre compte.`);
  check(
    (
      await admin.from('profiles').upsert(
        {
          id: user.id,
          handle: REVIEWER_HANDLE,
          display_name: REVIEWER_HANDLE,
          bio: REVIEWER_PROFILE.bio,
          parish: REVIEWER_PROFILE.parish,
          charter_accepted_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
    ).error,
    'Profil',
  );
  check((await admin.from('profile_passages').delete().eq('user_id', user.id)).error, 'Nettoyage des passages');
  check(
    (
      await admin.from('profile_passages').insert(
        REVIEWER_PROFILE.passages.map(([book, chapter, verse_from, verse_to]) => ({
          user_id: user.id,
          book,
          chapter,
          verse_from,
          verse_to,
        })),
      )
    ).error,
    'Passages',
  );
  check((await admin.from('intentions').delete().eq('user_id', user.id)).error, 'Nettoyage des intentions');
  check(
    (await admin.from('intentions').insert({ user_id: user.id, body: REVIEWER_PROFILE.intention, shown_on_profile: true })).error,
    'Intention',
  );
  const { data: devs, error: devErr } = await admin.from('profiles').select('id').in('handle', HANDLES);
  check(devErr, 'Recherche des comptes de test');
  if (devs.length) {
    check(
      (
        await admin.from('follows').upsert(
          devs.map((d) => ({ follower_id: user.id, followee_id: d.id })),
          { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
        )
      ).error,
      'Abonnements',
    );
  }
  console.log(`Compte de démonstration prêt (pseudo : ${REVIEWER_HANDLE}).`);
  console.log(`Adresse      : ${email}`);
  console.log(`Mot de passe : ${password}`);
  console.log('\nÀ coller dans la Play Console (Accès à l’application). Ne l’écrivez dans aucun fichier du dépôt.');
}

/** Supprime le compte de démonstration avec ses données (comme « Supprimer mon compte » dans l'app). */
async function removeReviewer(admin, base) {
  const email = emailFor(base, REVIEWER_HANDLE);
  const user = (await allUsers(admin)).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return console.log('Aucun compte de démonstration à supprimer.');
  const { data, error } = await admin.from('profiles').select('handle').eq('id', user.id).maybeSingle();
  check(error, 'Lecture du profil');
  if (data && data.handle !== REVIEWER_HANDLE) fail(`Le profil de ${email} n’est pas « ${REVIEWER_HANDLE} » : rien n’est supprimé.`);
  check((await admin.from('daily_posts').delete().eq('user_id', user.id)).error, 'Nettoyage de daily_posts');
  check((await admin.auth.admin.deleteUser(user.id)).error, `Suppression de ${email}`);
  console.log(`Supprimé : ${email}`);
}

function help() {
  console.log(`Usage : node scripts/seed-dev.mjs <commande>
  seed [--me <pseudo>] [--rdv-in <minutes>]   crée ou met à jour les comptes de test (${HANDLES.join(', ')}) et trois groupes de test avec leurs rendez-vous, deux neuvaines, un Rosaire vivant et deux chaînes d’adoration
                         --me : ces comptes suivent votre profil (sauf dev_therese) et vous entrez
                         comme MODÉRATEUR dans « ${GROUPS[0].name} » (un signalement en attente à traiter) et inscrit à ses rendez-vous ; simple membre dans « ${GROUPS[2].name} »
                         --me : votre compte devient aussi modérateur éditeur de la base LOCALE (écran Modération), avec trois éléments signalés en attente
                         --rdv-in : « Prière de test » commence dans ce nombre de minutes (${RDV_IN_MIN} à ${RDV_IN_MAX}, ${RDV_IN_DEFAULT} par défaut)
  reset                  supprime les comptes de test et tout ce qui s’y rattache
  code <pseudo>          code de connexion d’un compte de test
  reviewer               crée ou met à jour le compte de démonstration de Google Play, sur la production seulement
  reviewer-remove        supprime le compte de démonstration, sur la production seulement
Via npm : npm run db:local   |   npm run seed -- --me votre_pseudo   |   npm run seed:reset`);
}

const [command, ...args] = process.argv.slice(2);
if (!['seed', 'reset', 'code', 'reviewer', 'reviewer-remove'].includes(command)) {
  help();
  process.exit(command ? 1 : 0);
}
const { admin, base, host } = setup();
assertTarget(command, host);
console.log(`Projet : ${host}\n`);
if (command === 'seed') {
  const i = args.indexOf('--me');
  if (i !== -1 && !args[i + 1]) fail('--me demande un pseudo.');
  const r = args.indexOf('--rdv-in');
  let rdvIn = RDV_IN_DEFAULT;
  if (r !== -1) {
    rdvIn = /^\d+$/.test(args[r + 1] ?? '') ? Number(args[r + 1]) : Number.NaN;
    if (!(rdvIn >= RDV_IN_MIN && rdvIn <= RDV_IN_MAX))
      fail(`--rdv-in demande un nombre entier de minutes, de ${RDV_IN_MIN} à ${RDV_IN_MAX}.`);
  }
  await seed(admin, base, i === -1 ? null : args[i + 1].toLowerCase(), rdvIn, host);
} else if (command === 'reset') {
  await reset(admin, base);
} else if (command === 'reviewer') {
  await reviewer(admin, base);
} else if (command === 'reviewer-remove') {
  await removeReviewer(admin, base);
} else {
  if (!args[0]) fail('code demande un pseudo (par exemple dev_marie).');
  await code(admin, base, args[0]);
}
