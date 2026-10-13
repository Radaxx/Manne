# Manne

Scroller, mais nourri. Une application mobile qui reprend les codes des réels (plein écran, glisser vers le haut, double-tap) pour lire la Bible au lieu de faire défiler du vide.

## Accueil

- **Prier maintenant** : l’office de la Liturgie des Heures qui correspond à l’heure (Laudes, Tierce, Sexte, None, Vêpres, Complies, et l’Office des lectures).
- **Évangile du jour** et toutes les lectures de la messe.
- **Plans de lecture** : les Évangiles en 30 jours, les Psaumes, toute la Bible en un an… Chaque plan a son propre fil de lecture et son propre marque-page, indépendants de la lecture libre ; on peut prendre de l’avance, et rattraper son retard.
- **Continuer ma lecture** et quelques statistiques.
- **Rappel quotidien** (cloche) : une notification par jour à l’heure choisie, avec un verset, seulement si l’app n’a pas encore été ouverte ce jour-là.

Les textes liturgiques viennent de l’[API de l’AELF](https://api.aelf.org) (© AELF), mis en cache pour la journée.

## Prières

Un recueil de 53 prières (essentielles, Marie, saints, saint François d’Assise, Esprit Saint, pardon, confiance, défunts, repas, prières de la Bible), avec recherche, thèmes et le chapelet avec les mystères du jour. On peut aussi écrire ses propres prières. Les prières épinglées apparaissent en tête de l’onglet et sur l’accueil.

**Préparer ma confession** : une liste personnelle de péchés à noter au fil des jours, un examen de conscience, le déroulement de la confession, et un bouton « J’ai reçu l’absolution » qui efface tout. La liste reste uniquement sur le téléphone, protégée par empreinte, visage ou Face ID.

**Prier le chapelet** : un chapelet guidé, grain après grain. On choisit ses mystères (ceux du jour sont proposés), le chapelet entier ou une seule dizaine, et une intention. Chaque mystère s’ouvre sur la grâce à demander et un verset de l’Évangile ; un compteur suit les Je vous salue Marie, avec une légère vibration à chaque grain. On peut faire une pause et reprendre là où on s’était arrêté.

Le chapelet s’affiche en 3D : un chapelet en bois d’olivier posé sur une nappe de lin, qu’on égrène en le tirant vers soi (glisser vers le bas) ou d’une simple touche. La caméra suit le grain qu’on prie, qui s’éclaire d’une lumière dorée. Un réglage permet de revenir au chapelet dessiné à plat ; c’est aussi ce qui s’affiche si le téléphone ne peut pas faire la 3D.

## Deux fils

- **Lecture** : la Bible en lecture suivie, quelques versets par écran. On choisit un livre puis un chapitre, et on peut remonter pour relire. Chaque glissement fait avancer le marque-page ; on reprend toujours là où on s’était arrêté. Une présentation ouvre chaque livre, une question de méditation clôt chaque chapitre. Par défaut on commence par l’Évangile de Marc.
- **Découvrir** : des versets choisis par thème (qui s’adaptent à ce que tu aimes), des anecdotes, des quiz et des personnages bibliques.

Et pour ne pas reproduire le « doomscrolling » : un objectif quotidien de 30 versets, une série de jours, et une carte Pause toutes les 15 cartes dans Découvrir.

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

## Structure

- `src/app/` : les écrans (Expo Router) — onglets Accueil, Lecture, Prières, Découvrir ; offices, messe, plans, confession, chapelet
- `src/home.tsx` : l’écran d’accueil
- `src/feeds.tsx` : les fils de cartes plein écran
- `src/aelf.ts` / `src/liturgy.tsx` : textes liturgiques AELF et leur affichage
- `src/plans.ts` : plans de lecture
- `src/prayers.tsx` / `src/data/prayers.ts` : l’onglet Prières et son recueil
- `src/rosary.tsx` : le déroulé du chapelet guidé et le chapelet dessiné à plat
- `src/rosary3d.tsx` / `src/rosary-scene.ts` / `src/rosary-textures.ts` : le chapelet en 3D (Three.js sur expo-gl) et ses textures calculées
- `src/reading.ts` : découpage du texte en passages pour la lecture suivie
- `src/feed.ts` : composition du fil Découvrir
- `src/cards.tsx` : les cartes
- `src/sheets.tsx` : chapitre complet, favoris, liste des livres
- `src/storage.ts` : progression (marque-page, série, favoris), stockée sur l’appareil
- `src/data/` : Bible, présentations des livres, anecdotes, quiz
