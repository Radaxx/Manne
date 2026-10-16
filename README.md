# Manne

Scroller, mais nourri. Une application mobile qui reprend les codes des réels (plein écran, glisser vers le haut, double-tap) pour lire la Bible au lieu de faire défiler du vide.

## Accueil

- **Prier maintenant** : l’office de la Liturgie des Heures qui correspond à l’heure (Laudes, Tierce, Sexte, None, Vêpres, Complies, et l’Office des lectures).
- **Année liturgique** : le temps (Avent, Noël, temps ordinaire, Carême, Triduum, temps pascal), la semaine, la couleur, l’année A, B ou C des lectures et les prochaines grandes fêtes. Le calendrier romain pour la France est calculé sur le téléphone (Pâques, fêtes mobiles et déplacées), hors connexion ; les saints du jour viennent de l’AELF en ligne. La ligne du jour liturgique de l’accueil ouvre cet écran.
- **Saint du jour** : chaque jour de l’année, un saint ou une fête avec quelques lignes de sa vie, sur l’accueil et dans un écran qui montre aussi les sept jours suivants. Les célébrations suivent le calendrier romain et le propre de la France (vérifiés sur celui de l’AELF), avec les mémoires mobiles ; les autres jours, un saint du martyrologe ou de la tradition. L’app dit quand le dimanche, le Carême ou la Semaine sainte passe avant la mémoire. Tout est sur le téléphone, hors connexion.
- **Parcours de l’Avent** : chaque jour jusqu’à Noël, un passage de la Bible (dans la traduction choisie), une courte méditation et un geste à vivre. Les trois premières semaines ont un thème (veiller, préparer le chemin, se réjouir) ; du 17 au 24 décembre, les grandes antiennes « Ô ». Les jours s’ouvrent un à un ; on peut rattraper ceux qu’on a manqués et marquer chaque jour comme vécu. L’accueil l’annonce trois semaines avant.
- **Parcours de Carême** : sur le même modèle, du mercredi des Cendres au Samedi saint (46 jours). Les premiers jours (revenir à Dieu par la prière, le jeûne et le partage), cinq semaines tirées des grands évangiles du Carême (au désert, écouter, la source, la lumière, la vie), puis la Semaine sainte. Les gestes rappellent l’abstinence des vendredis et le jeûne des Cendres et du Vendredi saint.
- **Évangile du jour** et toutes les lectures de la messe.
- **Suivre la messe** : le déroulé, moment par moment (ouverture, Parole, eucharistie, envoi) : qui parle (prêtre, lecteur, assemblée), ce qu’on répond, quand se lever ou s’asseoir. Les chants fixes en français ou en latin, le Credo de Nicée ou celui des Apôtres, les lectures du jour (AELF), et une introduction pour une première fois.
- **Plans de lecture** : les Évangiles en 30 jours, les Psaumes, toute la Bible en un an (avec les livres deutérocanoniques)… Chaque plan se lit chapitre entier par chapitre entier (même vue et même sélection de versets que la lecture libre), avec son propre marque-page, indépendant de la lecture libre : il avance quand on finit un chapitre, ne recule jamais en relecture, et « Marquer ici » le place où l’on veut ; on peut prendre de l’avance, et rattraper son retard.
- **Arbre généalogique** : la lignée d’Adam et Ève jusqu’à Jésus, en un seul fil vertical. Il suit la Genèse et Ruth jusqu’à David, puis se partage en deux colonnes là où Matthieu (les rois de Juda) et Luc (par Nathan) divergent, et se rejoint à Salathiel puis à Joseph. Les personnages clés ont leur carte ; on la touche pour lire le passage dans son chapitre, sans déplacer le marque-page.
- **Continuer ma lecture** et quelques statistiques.
- **Intentions confiées** : porter la prière de quelqu’un, ou confier la sienne.
- **Rappel quotidien** (cloche) : une notification par jour à l’heure choisie, avec un verset. Elle ne part pas si la journée est déjà faite (l’Évangile, la lecture et une prière).

Les textes liturgiques viennent de l’[API de l’AELF](https://api.aelf.org) (© AELF), mis en cache pour la journée ; le cache des jours passés est effacé.

## Prières

Un recueil de 53 prières (essentielles, Marie, saints, saint François d’Assise, Esprit Saint, pardon, confiance, défunts, repas, prières de la Bible), avec recherche, thèmes et le chapelet avec les mystères du jour. On peut aussi écrire ses propres prières. Les prières épinglées apparaissent en tête de l’onglet et sur l’accueil.

**Préparer ma confession** : une liste personnelle de péchés à noter au fil des jours, un examen de conscience, le déroulement de la confession, et un bouton « J’ai reçu l’absolution » qui efface tout. La liste reste uniquement sur le téléphone, protégée par empreinte, visage ou Face ID : elle n’est jamais synchronisée, et l’app est exclue de la sauvegarde Android.

**Prier le chapelet** : un chapelet guidé, grain après grain. On choisit ses mystères (ceux du jour sont proposés), le chapelet entier ou une seule dizaine, et une intention. Chaque mystère s’ouvre sur la grâce à demander et un verset de l’Évangile ; un compteur suit les Je vous salue Marie, avec une légère vibration à chaque grain. On peut faire une pause et reprendre là où on s’était arrêté.

Le chapelet s’affiche en 3D : un chapelet en bois d’olivier posé sur une nappe de lin, qu’on égrène en le tirant vers soi (glisser vers le bas) ou d’une simple touche. La caméra suit le grain qu’on prie, qui s’éclaire d’une lumière dorée. Un réglage permet de revenir au chapelet dessiné à plat ; c’est aussi ce qui s’affiche si le téléphone ne peut pas faire la 3D.

**Adorer le Saint-Sacrement** : une adoration guidée, de 15 à 60 minutes, répartie en temps successifs. Le parcours **contemplatif** laisse surtout place au silence, avec un verset du jour ; le parcours **guidé** accompagne pas à pas : se mettre en présence, adorer, écouter l’Évangile du jour (AELF), remercier, demander pardon, confier ses intentions, puis rendre grâce. Les silences ont une minuterie douce avec une vibration à la fin ; les autres temps vont à son rythme. L’écran reste allumé, on peut faire une pause et reprendre. Les intentions à confier sont gardées d’une adoration à l’autre.

## Compte et réglages

**Mon chemin** (la flamme de la série) : la journée en cours, la semaine, la part de la Bible lue, les plans, le chapelet, l’adoration et les étapes atteintes. On peut y relier une adresse e-mail, Apple ou Google pour retrouver son chemin sur un autre téléphone.

**Réglages** : le thème de l’app (clair, sombre ou celui du téléphone), sa couleur d’accent (la couleur liturgique du jour, calculée sur le téléphone : violet, vert, rouge ou rose, et doré pour le blanc des fêtes ; ou toujours doré), la matière du chapelet (olivier, or, bois de rose, nacre, ébène, lapis), le fond de la lecture (le livre, nuit, parchemin, sépia, aube, encre) et le rappel quotidien.

## Deux fils

- **Lecture** : la Bible en lecture libre, un chapitre entier à la fois qu’on fait défiler (plus de cartes de 3-4 versets). On choisit la traduction (Louis Segond 1910 ou Bible Crampon 1923, aussi dans les réglages), puis un livre et un chapitre, avec « Précédent / Suivant » pour changer de chapitre. Les livres suivent l’ordre de la Bible catholique, deutérocanoniques compris. Les versets vus comptent dans l’objectif du jour ; arrivé en bas, le chapitre est lu et le marque-page passe au suivant (relire un chapitre déjà dépassé ne le fait pas reculer). On touche des versets pour les sélectionner (appui long : jusqu’à ce verset), puis une barre propose **J’aime**, **Garder** et **Partager**, pour un verset, une suite ou plusieurs passages à la fois ; les versets aimés ou gardés sont signalés dans le texte. Une présentation ouvre chaque livre, une question de méditation clôt chaque chapitre. Par défaut on commence par l’Évangile de Marc.
- **Découvrir** : près de 300 versets choisis par thème (qui s’adaptent à ce que tu aimes), affichés dans la traduction choisie, des anecdotes, des quiz, des personnages bibliques, des questions pour méditer et, toutes les 8 cartes, une œuvre de la culture chrétienne (peinture, sculpture, architecture, musique, littérature, grands textes, cinéma) avec le détail à regarder ou à écouter, un lien vers Wikipédia et, pour la musique, une recherche pour l’écouter. Les peintures, sculptures et édifices sont montrés dans l’app (images libres de Wikimedia Commons, embarquées, crédit sous l’image, plein écran d’un tap) ; les œuvres encore protégées par le droit d’auteur restent sans image. Avec le réglage « Œuvres au fil du calendrier » (activé par défaut), les œuvres liées au saint, à la fête ou au temps liturgique du jour passent en premier, avec un bandeau qui dit pourquoi. Un quiz sur deux porte sur la culture chrétienne (une quarantaine de questions, certaines autour de l’image d’une œuvre : « Qui a sculpté cette Pietà ? »). **L’Église aujourd’hui** : quelques titres récents de Vatican News, de l’Église catholique en France et de cath.ch glissés dans le fil (cinq au plus, une source après l’autre), et une page qui les liste tous (icône journal en haut à gauche). On n’affiche que le titre, un court résumé et la date ; l’article s’ouvre sur le site de l’éditeur.

Et pour ne pas reproduire le « doomscrolling » : un objectif quotidien de 30 versets, une série de jours, et une carte Pause toutes les 15 cartes dans Découvrir.

## Ensemble

Sur les versets de Découvrir et les passages d’un plan, le cœur compte pour tout le monde : le nombre s’affiche sous l’icône. Dans la lecture libre, aimer une sélection de versets envoie le même compteur. Le double-tap de Découvrir reste le tien. Hors connexion, le geste est gardé sur le téléphone et le compteur se met à jour au retour du réseau. Anecdotes, quiz, personnages, œuvres et cartes Pause n’ont pas ce rail.

**Échos** : une courte méditation sur le passage, une phrase, sans réponse. On peut retirer la sienne ou signaler celle d’un autre ; trois signalements la retirent. La feuille le dit quand le réseau manque, et n’envoie rien.

**Intentions confiées** : une liste de prières publiées exprès. « Je la porte » dit qu’on s’en charge, et l’auteur peut retirer la sienne. Depuis l’adoration, « Confier à la communauté » ouvre cet écran avec le texte déjà écrit : rien ne part sans confirmation, et la liste privée de l’adoration ne change pas. Trois signalements retirent une intention.

Le chemin (marque-pages, plans, journal et série, favoris, prières personnelles, chapelet et adoration en cours, intentions d’adoration, réglages d’apparence, traduction, jours vécus des parcours) est synchronisé avec Supabase dès qu’une session existe, anonyme au départ, puis reliée à un compte. Seules la liste de confession, son verrou et l’heure du rappel restent sur le téléphone. Sans projet Supabase configuré, tout reste sur le téléphone et la lecture continue ; les compteurs et les textes communs restent silencieux.

## Texte

Deux traductions, embarquées dans l’app pour fonctionner hors connexion :

- **Louis Segond 1910**. Source : [getbible.net](https://getbible.net) (module CrossWire).
- **Bible Crampon 1923** (domaine public), traduction catholique avec les livres deutérocanoniques : Tobie, Judith, 1 et 2 Maccabées, Sagesse, Siracide, Baruch, et les parties grecques d’Esther (chap. 11-16) et de Daniel (chap. 13-14). Source : [Wikisource](https://fr.wikisource.org/wiki/Bible_Crampon_1923), sans les notes ni les sommaires de l’édition. Elle écrit le nom divin « Yahweh ».

La Louis Segond n’a pas les deutérocanoniques : quand on la lit, ces livres et les chapitres grecs d’Esther et de Daniel viennent de la Crampon, et l’écran le dit. Les deux traductions ont donc les mêmes 73 livres et 1 334 chapitres ; seuls Joël (3 ou 4 chapitres) et Malachie (4 ou 3) se découpent autrement. Les livres gardent leur numéro (1-66 comme la Segond, 67-73 pour les deutérocanoniques). Le choix vaut pour la lecture, les plans, les prières tirées de la Bible et le chapelet ; Découvrir et l’arbre généalogique restent dans la Segond, sur laquelle leurs références sont calées.

- `scripts/build-bible.mjs` régénère `src/data/bible/lsg/` et `src/data/bible/crampon/` (un fichier JSON par livre et un index par traduction). `node scripts/build-bible.mjs crampon <dossier>` garde les pages Wikisource dans le dossier, pour ne pas les retélécharger.
- `scripts/fetch-culture-images.mjs` télécharge depuis Wikimedia Commons les images des œuvres de Découvrir (`assets/culture/`), avec leur auteur et leur licence, et régénère `src/data/culture-images.ts` ; `scripts/culture-files.json` fixe le fichier à prendre quand l’image de l’article Wikipédia ne convient pas.
- `scripts/build-verses.mjs` régénère `src/data/verses.json` (versets du fil Découvrir) depuis la Bible embarquée, et vérifie que chaque passage est découpé pareil dans les deux traductions.

## Logo

« La Parole lumière » : un livre ouvert d’où rayonne la lumière (« la vie était la lumière des hommes », Jean 1:4). `node scripts/build-icons.mjs` génère l’icône iOS, l’icône adaptative Android (avec sa version monochrome), le splash, l’icône de notification et le favicon depuis un même dessin SVG.

## Lancer

```bash
npm install
npx expo start
```

L’app utilise un development build (`expo-dev-client`) : la première fois, installer l’app sur le téléphone avec `npx expo run:android` / `npx expo run:ios` (ou `eas build --profile development`), puis ouvrir le projet depuis cette app. Appuyer sur `w` lance la version web.

Une version release, sans Metro, directement sur un téléphone branché :

```bash
npm run build:android
npm run build:ios
```

Les dossiers `android/` et `ios/` sont générés (CNG) : après un changement de `app.json`, les régénérer avec `npx expo prebuild`.

## Données de test

Pour essayer profils, abonnements, vitrine, blocage et groupes de prière sur un téléphone, `scripts/seed-dev.mjs` crée six comptes de test (`dev_marie`, `dev_pierre`, `dev_claire`, `dev_jean`, `dev_therese`, `dev_paul`) avec profil, passages, prières, intentions et abonnements entre eux, et trois groupes : « Fraternité de test » (privée, propriétaire `dev_marie`, membres `dev_pierre` et `dev_claire`), « Paroisse de test » (communauté, propriétaire `dev_jean`, modérateur `dev_therese`, une demande en attente de `dev_paul`) et « Neuvaine de test » (groupe éphémère qui se termine dans 9 jours, propriétaire `dev_claire`), avec quelques intentions, dont une exaucée avec son action de grâce, et des « je la porte ». Chaque groupe a aussi un ou deux rendez-vous de prière avec des inscrits : « Chapelet » (chaque mardi à 21 h, heure de Paris) et « Prière de test » (ponctuel, qui commence 15 minutes après le lancement du seed, ou `--rdv-in <minutes>` plus tard, de 2 à 240 : de quoi voir le rappel arriver, puis « Je suis là » à partir de 10 minutes avant le début ; l’heure locale exacte de début s’affiche à la fin du seed) dans la fraternité, « Chapelet de la paroisse » et « Adoration des Canadiens » (heure de Toronto) dans la paroisse, « Prière du soir » dans la neuvaine ; si un rendez-vous hebdomadaire est en cours au moment du seed, `dev_marie` et `dev_pierre` y sont déclarés présents. Deux **neuvaines de groupe** sont aussi créées : « Neuvaine à l’Esprit Saint » dans « Neuvaine de test » (commencée il y a 3 jours, heure de Paris : jour 4 sur 9, avec des jours déjà priés par `dev_claire`, `dev_pierre` et `dev_paul`) et une neuvaine personnalisée (prière écrite pour le test, suite de psaumes) dans la fraternité, qui commence demain. Les groupes sont supprimés et recréés à chaque `seed` ; leurs codes d’invitation (et liens `manne://rejoindre/…`) s’affichent à la fin.

Le développement parle à une base Supabase **locale** (Docker), jamais au projet de production. `npm run db:local` la démarre, applique les migrations, et écrit dans `.env` l’URL du Mac sur le Wi-Fi (le téléphone ne peut pas joindre `127.0.0.1`) avec la clé anon. `SEED_EMAIL` (votre adresse : les comptes utilisent `prenom+manne-dev_marie@…`) et la clé service locale sont dans `.env.local`. Les builds release et le compte Play lisent `.env.production.local`. `npm run seed` s’arrête si l’URL est celle de la production. Sur un téléphone, un nouveau build de développement est nécessaire une fois : iOS autorise le HTTP du réseau local, et seul le build debug Android autorise le HTTP clair.

```bash
npm run db:local                    # démarre la base locale et pointe .env dessus
npm run seed -- --me votre_pseudo   # crée ou met à jour les comptes et les groupes ; ils suivent votre profil (sauf dev_therese) et vous entrez dans la fraternité de test (inscrit à ses deux rendez-vous) et dans « Neuvaine de test » (neuvaine en cours) (pas dans la paroisse : testez la demande). Rien d’autre n’est écrit à votre nom : ni jour de neuvaine coché, ni rappel de neuvaine
npm run seed -- --me votre_pseudo --rdv-in 40   # « Prière de test » commence dans 40 minutes (15 par défaut, de 2 à 240)
npm run seed:reset                  # supprime les comptes de test, leurs groupes et leurs données
node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/seed-dev.mjs code dev_marie   # code de connexion
```

**Compte de démonstration pour Google Play** : la connexion par e-mail envoie un code qui expire en une heure, que le relecteur de Google ne peut pas recevoir. L'écran de liaison de compte propose donc « Accès relecteur » (adresse et mot de passe). `npm run seed:reviewer` crée ou met à jour le compte (pseudo `relecteur`, profil, un passage, une intention, abonnements aux comptes de test s'ils existent) et affiche son mot de passe une seule fois : à coller dans la Play Console (Accès à l'application), jamais dans le dépôt. `REVIEWER_PASSWORD` dans `.env.production.local` en impose un (12 caractères au moins). `npm run seed:reviewer-remove` le supprime, `seed:reset` n'y touche pas : ces deux commandes relecteur écrivent sur la production, le seed de test non.

Pour tester le rappel d’un rendez-vous sur un téléphone :

1. L’app de développement doit tourner avec `npx expo start` : elle lit la base locale. Le build release (`npm run build:android`) parle à la production et ne voit pas ces comptes. Relance le seed juste avant de tester, avec un `--rdv-in` assez long pour le temps qu’il te reste (le défaut, 15 minutes, est court).
2. Ouvre l’app après le seed, connecté à ton profil : c’est à l’ouverture (ou au retour au premier plan, ou en ouvrant la page du groupe) qu’elle programme le rappel. Si l’app se synchronise après l’heure de début, aucun rappel n’est programmé pour ce rendez-vous.
3. Autorise les notifications. Sur Android 12 et plus, l’app déclare la permission `SCHEDULE_EXACT_ALARM` (dans `app.json`, donc `npx expo prebuild` puis un nouveau build après ce changement) ; sur Android 14 et plus, elle n’est plus accordée d’office : active « Alarmes et rappels » pour Manne dans les réglages du téléphone (Réglages > Applis > Manne, ou le lien « Ouvrir les réglages » de l’app). Sans cela, le rappel peut arriver en retard, voire pas du tout.

Pour tester la **salle de prière** à deux téléphones (ou un téléphone et un second compte) :

1. Appliquer `010_prayer_room.sql`, puis dans le dashboard Supabase : Realtime > Settings > désactiver « Allow public access » (sinon les canaux privés ne sont pas imposés).
2. Lancer `npm run seed -- --me votre_pseudo --rdv-in 12` : « Prière de test » (chapelet) commence dans 12 minutes, et « Je suis là » s’ouvre 10 minutes avant. `dev_marie` et `dev_claire` y sont déjà déclarées présentes (comptées dans « N présents », mais pas « en ligne ») et ont écrit deux intentions dans la salle.
3. Téléphone 1 : votre compte. Téléphone 2 : connectez-vous avec un compte de test : saisissez son adresse dans l’écran de liaison de compte, appuyez sur « Recevoir un lien », puis `node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/seed-dev.mjs code dev_pierre` et tapez le code. `dev_pierre` est membre de la fraternité de test et inscrit au « Chapelet » ; pour « Prière de test », il lui faut « Je participe » (facultatif : « Je suis là » suffit pour entrer).
4. Dans « Fraternité de test », touchez « Je suis là » sur chaque téléphone : la salle s’ouvre. Vérifiez que les deux pseudos apparaissent dans « Dans la salle », que l’« Amen » d’un téléphone s’affiche sur l’autre (5 secondes entre deux), et qu’une intention écrite d’un côté apparaît de l’autre. Si « Connexion en direct indisponible » s’affiche, la case Realtime ou la migration 010 manque ; la salle se met alors à jour toutes les 20 secondes.

`npm run seed` crée de vrais comptes sur la base locale seulement. Elle n’écrit à votre nom que votre adhésion à la fraternité de test et à « Neuvaine de test », et votre inscription aux rendez-vous de la fraternité (avec `--me`) : les jours de neuvaine et les rappels de neuvaine restent à cocher et à régler vous-même ; le reset ne supprime que les adresses `+manne-dev_` et les groupes de test.

## Vérifier

```bash
npm run lint      # Biome : format, lint, imports (npm run fix pour appliquer)
npx tsc --noEmit  # types
npm test          # Jest (jest-expo) : synchro, validation de la progression, plans, chapelet
```

Les tests sont dans `__tests__/` (fichiers `*-test.ts`) ; `jest.setup.js` remplace AsyncStorage par un stockage en mémoire.

En local, `npm run db:local` suffit : il applique les migrations et active la session anonyme (`supabase/config.toml`). Le projet de production, lui, demande les connexions anonymes, le rattachement manuel (Manual linking), Apple et Google, `manne://auth/callback` dans les URL de redirection, et les migrations dans l’ordre ; pour la salle de prière, désactiver aussi « Allow public access » dans Realtime > Settings du dashboard. Le mail de confirmation est celui de Supabase, un lien qui revient dans l’app ; il doit s’ouvrir sur le téléphone qui l’a demandé (flux PKCE : un lien forgé n’ouvre aucune session). La clé embarquée dans l’app est la clé publishable (`sb_publishable_…`), jamais la clé secrète. Les builds du store prennent l’URL et la clé anon de l’environnement EAS « production ».

Pour « L’Église aujourd’hui », déployer la fonction qui lit les flux RSS : `supabase functions deploy news --no-verify-jwt`. Elle relit les flux au plus toutes les 30 minutes ; l’app garde la dernière liste 30 minutes, et l’affiche encore hors connexion. Le téléphone ne contacte que Supabase : les sites d’actualité ne voient une requête que quand on ouvre un article.

## Structure

- `src/app/` : les écrans (Expo Router) — onglets Accueil, Lecture, Prières, Découvrir ; offices, messe, suivre la messe, année liturgique, saint du jour, parcours de l’Avent et de Carême, plans, confession, chapelet, adoration, intentions confiées, groupes de prière (`groupe/`, `rejoindre/`), compte, réglages, rappel
- `src/home.tsx` : l’écran d’accueil
- `src/feeds.tsx` : le fil Découvrir (cartes plein écran) et l’écran Lecture
- `src/chapter.tsx` : la lecture d’un chapitre entier (libre et plans), sélection de versets, J’aime / Garder / Partager
- `src/aelf.ts` / `src/liturgy.tsx` : textes liturgiques AELF et leur affichage
- `src/mass-guide.tsx` / `src/data/mass-guide.ts` : suivre la messe, son déroulé et ses répliques
- `src/plans.ts` / `src/plan-reading.tsx` : plans de lecture et leur fil plein écran
- `src/prayers.tsx` / `src/data/prayers.ts` : l’onglet Prières et son recueil
- `src/rosary.tsx` : le déroulé du chapelet guidé et le chapelet dessiné à plat
- `src/rosary3d.tsx` / `src/rosary-scene.ts` / `src/rosary-textures.ts` : le chapelet en 3D (Three.js sur expo-gl) et ses textures calculées
- `src/adoration.ts` : les temps de l’adoration guidée et leur durée
- `src/genealogy.tsx` / `src/data/genealogy.ts` : l’arbre généalogique d’Adam à Jésus et ses données (noms d’après la Louis Segond embarquée)
- `src/bible.ts` : les deux traductions, l’ordre des livres, ce que la Segond emprunte à la Crampon
- `src/reading.ts` : positions dans la Bible, question de méditation de fin de chapitre
- `src/liturgical-year.ts` : l’année liturgique calculée (temps, semaines, cycles, grandes fêtes)
- `src/saints.ts` / `src/data/saints.ts` : le saint du jour (366 notices) et la préséance des célébrations
- `src/journeys.ts` / `src/journey-screen.tsx` : les parcours des temps forts et leur écran ; `src/data/advent.ts`, `src/data/lent.ts` : leurs jours
- `src/feed.ts` : composition du fil Découvrir
- `src/cards.tsx` : les cartes
- `src/sheets.tsx` : chapitre complet, favoris, liste des livres
- `src/storage.ts` : progression (marque-page, journal du jour, série, favoris), stockée sur l’appareil ; `useApp()` pour l’état et les actions, `useActions()` pour les seules actions
- `src/appearance.ts` / `src/theme.tsx` : palettes claire et sombre, chapelet et fonds de lecture ; `useThemed()` pour des styles qui suivent le thème
- `src/reminder.ts` / `src/lock.ts` : rappel quotidien, verrou biométrique de la confession
- `src/dates.ts` / `src/haptics.ts` : dates en français et retours tactiles, partagés par les écrans
- `src/today.ts` : journée faite (Évangile, lecture, prière), série, reprise, étapes
- `src/supabase.ts` / `src/auth.ts` / `src/sync.ts` / `src/community.ts` / `src/echoes.tsx` : session anonyme, rattachement du compte, synchro, j’aime, échos et intentions
- `supabase/migrations/` : schéma communautaire et progression du compte ; toute évolution passe par une nouvelle migration numérotée
- `__tests__/` : tests Jest
- `src/data/` : Bible, présentations des livres, anecdotes, quiz
