# Manne

Scroller, mais nourri. Une application mobile qui reprend les codes des réels (plein écran, glisser vers le haut, double-tap) pour lire la Bible au lieu de faire défiler du vide.

## Accueil

- **Prier maintenant** : l’office de la Liturgie des Heures qui correspond à l’heure (Laudes, Tierce, Sexte, None, Vêpres, Complies, et l’Office des lectures).
- **Évangile du jour** et toutes les lectures de la messe.
- **Plans de lecture** : les Évangiles en 30 jours, les Psaumes, toute la Bible en un an… Chaque plan se lit chapitre entier par chapitre entier (même vue et même sélection de versets que la lecture libre), avec son propre marque-page, indépendant de la lecture libre : il avance quand on finit un chapitre, ne recule jamais en relecture, et « Marquer ici » le place où l’on veut ; on peut prendre de l’avance, et rattraper son retard.
- **Arbre généalogique** : la lignée d’Adam et Ève jusqu’à Jésus, en un seul fil vertical. Il suit la Genèse et Ruth jusqu’à David, puis se partage en deux colonnes là où Matthieu (les rois de Juda) et Luc (par Nathan) divergent, et se rejoint à Salathiel puis à Joseph. Les personnages clés ont leur carte ; on la touche pour lire le passage dans son chapitre, sans déplacer le marque-page.
- **Continuer ma lecture** et quelques statistiques.
- **Intentions confiées** : porter la prière de quelqu’un, ou confier la sienne.
- **Rappel quotidien** (cloche) : une notification par jour à l’heure choisie, avec un verset, seulement si l’app n’a pas encore été ouverte ce jour-là.

Les textes liturgiques viennent de l’[API de l’AELF](https://api.aelf.org) (© AELF), mis en cache pour la journée.

## Prières

Un recueil de 53 prières (essentielles, Marie, saints, saint François d’Assise, Esprit Saint, pardon, confiance, défunts, repas, prières de la Bible), avec recherche, thèmes et le chapelet avec les mystères du jour. On peut aussi écrire ses propres prières. Les prières épinglées apparaissent en tête de l’onglet et sur l’accueil.

**Préparer ma confession** : une liste personnelle de péchés à noter au fil des jours, un examen de conscience, le déroulement de la confession, et un bouton « J’ai reçu l’absolution » qui efface tout. La liste reste uniquement sur le téléphone, protégée par empreinte, visage ou Face ID.

**Prier le chapelet** : un chapelet guidé, grain après grain. On choisit ses mystères (ceux du jour sont proposés), le chapelet entier ou une seule dizaine, et une intention. Chaque mystère s’ouvre sur la grâce à demander et un verset de l’Évangile ; un compteur suit les Je vous salue Marie, avec une légère vibration à chaque grain. On peut faire une pause et reprendre là où on s’était arrêté.

Le chapelet s’affiche en 3D : un chapelet en bois d’olivier posé sur une nappe de lin, qu’on égrène en le tirant vers soi (glisser vers le bas) ou d’une simple touche. La caméra suit le grain qu’on prie, qui s’éclaire d’une lumière dorée. Un réglage permet de revenir au chapelet dessiné à plat ; c’est aussi ce qui s’affiche si le téléphone ne peut pas faire la 3D.

**Adorer le Saint-Sacrement** : une adoration guidée, de 15 à 60 minutes, répartie en temps successifs. Le parcours **contemplatif** laisse surtout place au silence, avec un verset du jour ; le parcours **guidé** accompagne pas à pas : se mettre en présence, adorer, écouter l’Évangile du jour (AELF), remercier, demander pardon, confier ses intentions, puis rendre grâce. Les silences ont une minuterie douce avec une vibration à la fin ; les autres temps vont à son rythme. L’écran reste allumé, on peut faire une pause et reprendre. Les intentions à confier sont gardées d’une adoration à l’autre.

## Deux fils

- **Lecture** : la Bible en lecture libre, un chapitre entier à la fois qu’on fait défiler (plus de cartes de 3-4 versets). On choisit un livre puis un chapitre, avec « Précédent / Suivant » pour changer de chapitre. Les versets vus comptent dans l’objectif du jour ; arrivé en bas, le chapitre est lu et le marque-page passe au suivant (relire un chapitre déjà dépassé ne le fait pas reculer). On touche des versets pour les sélectionner (appui long : jusqu’à ce verset), puis une barre propose **J’aime**, **Garder** et **Partager**, pour un verset, une suite ou plusieurs passages à la fois ; les versets aimés ou gardés sont signalés dans le texte. Une présentation ouvre chaque livre, une question de méditation clôt chaque chapitre. Par défaut on commence par l’Évangile de Marc.
- **Découvrir** : des versets choisis par thème (qui s’adaptent à ce que tu aimes), des anecdotes, des quiz et des personnages bibliques.

Et pour ne pas reproduire le « doomscrolling » : un objectif quotidien de 30 versets, une série de jours, et une carte Pause toutes les 15 cartes dans Découvrir.

## Ensemble

Sur les versets de Découvrir et les passages d’un plan, le cœur compte pour tout le monde : le nombre s’affiche sous l’icône. Dans la lecture libre, aimer une sélection de versets envoie le même compteur. Le double-tap de Découvrir reste le tien. Hors connexion, le geste est gardé sur le téléphone et le compteur se met à jour au retour du réseau. Anecdotes, quiz, personnages et cartes Pause n’ont pas ce rail.

**Échos** : une courte méditation sur le passage, une phrase, sans réponse. On peut retirer la sienne ou signaler celle d’un autre ; trois signalements la retirent. La feuille le dit quand le réseau manque, et n’envoie rien.

**Intentions confiées** : une liste de prières publiées exprès. « Je la porte » dit qu’on s’en charge, et l’auteur peut retirer la sienne. Depuis l’adoration, « Confier à la communauté » ouvre cet écran avec le texte déjà écrit : rien ne part sans confirmation, et la liste privée de l’adoration ne change pas. Trois signalements retirent une intention.

La confession, le chapelet, les favoris, la série et les intentions d’adoration restent sur le téléphone. Sans projet Supabase configuré, la lecture continue ; les compteurs et les textes communs restent silencieux.

## Texte

Louis Segond 1910 (domaine public), embarquée dans l’app pour fonctionner hors connexion. Source : [getbible.net](https://getbible.net) (module CrossWire).

- `scripts/build-bible.mjs` régénère `src/data/bible/` (un fichier JSON par livre).
- `scripts/build-verses.mjs` régénère `src/data/verses.json` (versets du fil Découvrir).

## Logo

« La Parole lumière » : un livre ouvert d’où rayonne la lumière (« la vie était la lumière des hommes », Jean 1:4). `node scripts/build-icons.mjs` génère l’icône iOS, l’icône adaptative Android (avec sa version monochrome), le splash, l’icône de notification et le favicon depuis un même dessin SVG.

## Lancer

```bash
npm install
npx expo start
```

Puis scanner le QR code avec Expo Go (iOS / Android), ou appuyer sur `w` pour la version web.

Pour les j’aime, les échos, les intentions et le compte : copier `.env.example` vers `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), activer les connexions anonymes, le rattachement manuel (Manual linking), Apple et Google, ajouter `manne://auth/callback` aux URL de redirection, et appliquer `supabase/migrations/001_community.sql` puis `002_account.sql`. Le mail de confirmation est celui de Supabase, un lien qui revient dans l’app ; il doit s’ouvrir sur le téléphone qui l’a demandé (flux PKCE : un lien forgé n’ouvre aucune session). La clé est la clé publishable (`sb_publishable_…`), jamais la clé secrète.

## Structure

- `src/app/` : les écrans (Expo Router) — onglets Accueil, Lecture, Prières, Découvrir ; offices, messe, plans, confession, chapelet, adoration, intentions confiées, compte
- `src/home.tsx` : l’écran d’accueil
- `src/feeds.tsx` : le fil Découvrir (cartes plein écran) et l’écran Lecture
- `src/chapter.tsx` : la lecture d’un chapitre entier (libre et plans), sélection de versets, J’aime / Garder / Partager
- `src/aelf.ts` / `src/liturgy.tsx` : textes liturgiques AELF et leur affichage
- `src/plans.ts` : plans de lecture
- `src/prayers.tsx` / `src/data/prayers.ts` : l’onglet Prières et son recueil
- `src/rosary.tsx` : le déroulé du chapelet guidé et le chapelet dessiné à plat
- `src/rosary3d.tsx` / `src/rosary-scene.ts` / `src/rosary-textures.ts` : le chapelet en 3D (Three.js sur expo-gl) et ses textures calculées
- `src/adoration.ts` : les temps de l’adoration guidée et leur durée
- `src/genealogy.tsx` / `src/data/genealogy.ts` : l’arbre généalogique d’Adam à Jésus et ses données (noms d’après la Louis Segond embarquée)
- `src/reading.ts` : positions dans la Bible, question de méditation de fin de chapitre
- `src/feed.ts` : composition du fil Découvrir
- `src/cards.tsx` : les cartes
- `src/sheets.tsx` : chapitre complet, favoris, liste des livres
- `src/storage.ts` : progression (marque-page, journal du jour, série, favoris), stockée sur l’appareil
- `src/today.ts` : journée faite (Évangile, lecture, prière), série, reprise, étapes
- `src/supabase.ts` / `src/auth.ts` / `src/sync.ts` / `src/community.ts` / `src/echoes.tsx` : session anonyme, rattachement du compte, synchro, j’aime, échos et intentions
- `supabase/migrations/` : schéma communautaire et progression du compte
- `src/data/` : Bible, présentations des livres, anecdotes, quiz
