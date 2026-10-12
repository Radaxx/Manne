# Manne

Scroller, mais nourri. Une application mobile qui reprend les codes des réels (plein écran, glisser vers le haut, double-tap) pour lire la Bible au lieu de faire défiler du vide.

## Accueil

- **Prier maintenant** : l’office de la Liturgie des Heures qui correspond à l’heure (Laudes, Tierce, Sexte, None, Vêpres, Complies, et l’Office des lectures).
- **Évangile du jour** et toutes les lectures de la messe.
- **Plans de lecture** : les Évangiles en 30 jours, les Psaumes, toute la Bible en un an… Les chapitres lus dans l’onglet Lecture font avancer les plans.
- **Continuer ma lecture** et quelques statistiques.

Les textes liturgiques viennent de l’[API de l’AELF](https://api.aelf.org) (© AELF), mis en cache pour la journée.

## Deux fils

- **Lecture** : la Bible en lecture suivie, quelques versets par écran. Chaque glissement fait avancer le marque-page ; on reprend toujours là où on s’était arrêté. Une présentation ouvre chaque livre, une question de méditation clôt chaque chapitre. Par défaut on commence par l’Évangile de Marc.
- **Découvrir** : des versets choisis par thème (qui s’adaptent à ce que tu aimes), des anecdotes, des quiz et des personnages bibliques.

Et pour ne pas reproduire le « doomscrolling » : un objectif quotidien de 30 versets, une série de jours, et une carte Pause toutes les 15 cartes dans Découvrir.

## Texte

Louis Segond 1910 (domaine public), embarquée dans l’app pour fonctionner hors connexion. Source : [getbible.net](https://getbible.net) (module CrossWire).

- `scripts/build-bible.mjs` régénère `src/data/bible/` (un fichier JSON par livre).
- `scripts/build-verses.mjs` régénère `src/data/verses.json` (versets du fil Découvrir).

## Lancer

```bash
npm install
npx expo start
```

Puis scanner le QR code avec Expo Go (iOS / Android), ou appuyer sur `w` pour la version web.

## Structure

- `src/app/` : les écrans (Expo Router) — onglets Accueil, Lecture, Découvrir ; offices, messe, plans
- `src/home.tsx` : l’écran d’accueil
- `src/feeds.tsx` : les fils de cartes plein écran
- `src/aelf.ts` / `src/liturgy.tsx` : textes liturgiques AELF et leur affichage
- `src/plans.ts` : plans de lecture
- `src/reading.ts` : découpage du texte en passages pour la lecture suivie
- `src/feed.ts` : composition du fil Découvrir
- `src/cards.tsx` : les cartes
- `src/sheets.tsx` : chapitre complet, favoris, liste des livres
- `src/storage.ts` : progression (marque-page, série, favoris), stockée sur l’appareil
- `src/data/` : Bible, présentations des livres, anecdotes, quiz
