// La visite de bienvenue et le guide de l'app. Tout le contenu est ici, en données ; les écrans `bienvenue` et `guide` ne font
// que l'afficher. Chaque phrase décrit ce que fait l'app : à relire quand un écran change.

/** Un nom d'icône Ionicons (les écrans le passent à `<Ionicons name>`). */
export type GuideIcon = string;

export type TourPage = {
  id: string;
  icon: GuideIcon;
  title: string;
  /** Deux ou trois phrases courtes. */
  lines: string[];
  bullets?: string[];
  /** Une dernière ligne, plus discrète. */
  note?: string;
};

export type GuideEntry = {
  title: string;
  body: string;
  /** Un écran qui existe sous `src/app/` (jamais une route dynamique) : le guide propose alors « Ouvrir ». */
  route?: string;
};

export type GuideSection = {
  id: string;
  title: string;
  icon: GuideIcon;
  entries: GuideEntry[];
};

/** Les icônes des onglets : les mêmes que dans `src/app/(tabs)/_layout.tsx`. */
export const TAB_ICONS = {
  index: 'home',
  lecture: 'book',
  prieres: 'rose',
  decouvrir: 'compass',
  communaute: 'people',
} as const;

export const TOUR_PAGES: TourPage[] = [
  {
    id: 'bienvenue',
    icon: 'sparkles',
    title: 'Bienvenue sur Manne',
    lines: [
      'Une app pour lire la Bible et prier chaque jour, à ton rythme.',
      'Voici l’essentiel en quelques pages. Tu peux passer cette visite quand tu veux.',
    ],
  },
  {
    id: 'accueil',
    icon: TAB_ICONS.index,
    title: 'Accueil',
    lines: ['Ta journée en un coup d’œil : ce qu’il reste à lire et à prier.'],
    bullets: ['La prière du moment, en un geste', 'L’Évangile et le saint du jour', 'Ton plan de lecture et tes prières épinglées'],
  },
  {
    id: 'lecture',
    icon: TAB_ICONS.lecture,
    title: 'Lecture',
    lines: ['La Bible, chapitre après chapitre. Fais défiler : les versets que tu vois comptent pour l’objectif du jour (30 versets).'],
    bullets: [
      'Touche des versets pour les aimer, les garder ou les partager',
      'L’icône en haut à gauche choisit le livre et la traduction',
    ],
  },
  {
    id: 'prieres',
    icon: TAB_ICONS.prieres,
    title: 'Prières',
    lines: ['Le chapelet guidé, l’adoration, la préparation à la confession et un recueil de prières.'],
    bullets: ['Épingle tes prières préférées', 'Écris tes propres prières', 'Ta liste de confession reste sur ton téléphone'],
  },
  {
    id: 'decouvrir',
    icon: TAB_ICONS.decouvrir,
    title: 'Découvrir',
    lines: ['Un fil à faire défiler, carte par carte : versets, anecdotes, quiz, personnages et culture chrétienne.'],
    bullets: ['Aime, garde ou partage un verset', 'Lis ou écris un écho, une courte méditation'],
  },
  {
    id: 'communaute',
    icon: TAB_ICONS.communaute,
    title: 'Communauté',
    lines: [
      'Prier avec d’autres : groupes, rendez-vous, neuvaines, Rosaire vivant et chaînes d’adoration.',
      'Les groupes et le profil demandent un compte relié et un pseudo. Le reste de l’app marche sans.',
    ],
    note: 'Tu retrouveras ce guide dans Réglages → Guide de l’app.',
  },
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'accueil',
    title: 'Accueil',
    icon: TAB_ICONS.index,
    entries: [
      {
        title: 'Ta journée',
        body: 'Un geste par jour fait avancer ta série : l’Évangile, ta lecture du jour (30 versets, ou les chapitres de ton plan) ou une prière (un office, le chapelet ou l’adoration). Les trois font une journée complète, et la flamme change de couleur. La ligne avec la flamme montre ta série ; touche-la pour ouvrir Mon chemin.',
        route: '/compte',
      },
      {
        title: 'La prière du moment',
        body: 'Le grand bouton « Commencer la prière » ouvre l’office de l’heure. Les autres offices sont juste dessous.',
      },
      {
        title: 'Les textes de la messe',
        body: 'La carte Aujourd’hui affiche l’Évangile du jour. Touche-la pour lire tous les textes de la messe.',
        route: '/messe',
      },
      {
        title: 'Le saint du jour',
        body: 'Sous l’Évangile, touche le saint du jour pour le découvrir.',
        route: '/saints',
      },
      {
        title: 'L’année liturgique',
        body: 'La ligne avec un point de couleur, sous la date, ouvre le temps liturgique en cours, les fêtes et leurs couleurs.',
        route: '/annee-liturgique',
      },
      {
        title: 'Avent et Carême',
        body: 'Pendant ces deux temps, une carte propose chaque jour un passage, une méditation et un geste.',
      },
      {
        title: 'Suivre la messe',
        body: 'Dans À portée de main, « Suivre la messe » donne le déroulé pas à pas.',
        route: '/suivre-messe',
      },
      {
        title: 'Rappel et profil',
        body: 'La cloche, en haut, règle le rappel quotidien. L’avatar ouvre ton profil.',
        route: '/rappel',
      },
    ],
  },
  {
    id: 'lecture',
    title: 'Lecture',
    icon: TAB_ICONS.lecture,
    entries: [
      {
        title: 'Lire à ton rythme',
        body: 'Fais défiler le chapitre. Les versets que tu as vus, après un court instant sans mouvement, comptent pour l’objectif du jour. À la fin, « Chapitre suivant » continue.',
      },
      {
        title: 'Choisir un livre ou une traduction',
        body: 'L’icône bibliothèque, en haut à gauche, ouvre la liste des livres et le choix de la traduction. La traduction se règle aussi dans les Réglages.',
        route: '/reglages',
      },
      {
        title: 'Aimer, garder, partager',
        body: 'Touche un ou plusieurs versets : une barre propose J’aime, Garder et Partager. Un appui long sélectionne jusqu’à ce verset.',
      },
      {
        title: 'Retrouver tes versets gardés',
        body: 'Le signet, en haut à droite, ouvre Mes versets. La liste complète est dans Passages gardés.',
        route: '/passages',
      },
      {
        title: 'Un plan de lecture',
        body: 'Un plan te donne quelques chapitres par jour, avec son propre marque-page, indépendant de ta lecture libre. Quand un plan est en cours, c’est lui qui fait ta lecture du jour.',
        route: '/plans',
      },
    ],
  },
  {
    id: 'prieres',
    title: 'Prières',
    icon: TAB_ICONS.prieres,
    entries: [
      {
        title: 'Prier le chapelet',
        body: 'Le chapelet est guidé grain après grain, avec les mystères du jour. Touche le chapelet ou le bouton à chaque prière. Tu peux faire une pause et reprendre plus tard.',
        route: '/chapelet',
      },
      {
        title: 'Adorer le Saint-Sacrement',
        body: 'Une adoration contemplative, ou guidée en plusieurs temps. Les intentions que tu notes te sont proposées à chaque adoration.',
        route: '/adoration',
      },
      {
        title: 'Préparer ta confession',
        body: 'Note tes péchés au fil des jours, relis l’examen de conscience et le déroulé. Après l’absolution, « J’ai reçu l’absolution » efface la liste.',
        route: '/confession',
      },
      {
        title: 'Chercher et épingler',
        body: 'La barre de recherche parcourt les titres et les textes. L’épingle d’une prière la range dans Épinglées et sur l’Accueil.',
      },
      {
        title: 'Écrire ta prière',
        body: 'Dans Mes prières, « Écrire une prière » garde tes propres mots, pour les retrouver à côté des autres.',
        route: '/priere-edition',
      },
    ],
  },
  {
    id: 'decouvrir',
    title: 'Découvrir',
    icon: TAB_ICONS.decouvrir,
    entries: [
      {
        title: 'Un fil de cartes',
        body: 'Fais défiler : versets, anecdotes, quiz, personnages et œuvres de la culture chrétienne s’enchaînent. Le fil s’adapte peu à peu à ce que tu aimes.',
      },
      {
        title: 'Aimer, garder, partager',
        body: 'Sur un verset, tu peux l’aimer, le garder ou le partager, et ouvrir son chapitre pour le lire en entier.',
      },
      {
        title: 'Les échos',
        body: 'Touche Échos sur un verset pour lire ou écrire une courte méditation (240 caractères au plus), publiée sans ton nom. Tu peux signaler un écho.',
      },
      {
        title: 'L’Église aujourd’hui',
        body: 'Quand elle est disponible, l’icône journal, en haut à gauche, ouvre les titres de Vatican News, de l’Église catholique en France et de cath.ch. L’article s’ouvre chez l’éditeur.',
        route: '/actualites',
      },
      {
        title: 'Au fil du calendrier',
        body: 'Dans les Réglages, un interrupteur met en avant les œuvres liées au saint, à la fête ou au temps liturgique du jour.',
        route: '/reglages',
      },
    ],
  },
  {
    id: 'communaute',
    title: 'Communauté',
    icon: TAB_ICONS.communaute,
    entries: [
      {
        title: 'Avoir un profil',
        body: 'Il faut relier un compte (e-mail, Apple ou Google), choisir un pseudo, accepter la charte et avoir 15 ans ou plus. Sans profil, les groupes et les abonnements restent fermés.',
        route: '/inscription',
      },
      {
        title: 'Trouver des personnes',
        body: 'Dans Communauté, choisis Personnes et tape un pseudo exact. Quand tu suis quelqu’un, tu lui ouvres ton profil.',
      },
      {
        title: 'Trouver un groupe',
        body: 'Les communautés et les groupes éphémères se cherchent par leur nom. Une fraternité reste introuvable : on y entre avec son code.',
        route: '/groupe/rejoindre',
      },
      {
        title: 'Créer un groupe',
        body: 'Trois types : une fraternité (privée, sur code), une communauté (les demandes sont acceptées par le propriétaire ou un modérateur) et un groupe éphémère (on y entre tout de suite, jusqu’à une date de fin).',
        route: '/groupe/nouveau',
      },
      {
        title: 'Prier ensemble',
        body: 'Dans un groupe, le propriétaire ou un modérateur propose des rendez-vous de prière, des neuvaines, un Rosaire vivant et des chaînes d’adoration. Les membres s’y inscrivent, cochent leurs jours ou réservent un créneau.',
      },
      {
        title: 'Confier une intention au groupe',
        body: 'Dans l’onglet Intentions d’un groupe, tu confies une intention que seuls les membres voient, avec ton pseudo. Chacun peut dire « Je la porte ».',
      },
      {
        title: 'Les intentions de tous',
        body: 'Le fil commun est anonyme : ni ton nom ni ton pseudo n’y figurent. Rien n’est publié sans ton geste.',
        route: '/intentions',
      },
      {
        title: 'Signaler et bloquer',
        body: 'Tu peux signaler un contenu : à trois signalements, il est masqué. Tu peux aussi bloquer une personne depuis son profil ; ta liste est dans Personnes bloquées.',
        route: '/profil/bloques',
      },
    ],
  },
  {
    id: 'compte',
    title: 'Compte et confidentialité',
    icon: 'shield-checkmark-outline',
    entries: [
      {
        title: 'Ton chemin est sauvegardé',
        body: 'Ta lecture, tes prières, tes plans et tes réglages sont synchronisés en ligne. Tant que tu n’as pas relié de compte, ils sont attachés à une session anonyme de ce téléphone.',
      },
      {
        title: 'Relier un compte',
        body: 'Depuis ton profil, relie une adresse e-mail, Apple ou Google pour retrouver ton chemin sur un autre téléphone.',
        route: '/profil',
      },
      {
        title: 'La confession reste chez toi',
        body: 'La liste de ta confession n’est jamais envoyée en ligne : seule la date de ta dernière absolution suit ton compte. Tu peux protéger cet espace par empreinte, visage ou Face ID, selon ton téléphone.',
        route: '/confession',
      },
      {
        title: 'Qui voit ton profil',
        body: 'Ton pseudo est visible de qui le connaît exactement. Ta bio, ta paroisse et ton nombre d’abonnés ne le sont que des personnes que tu suis et des membres de tes groupes. Ta progression et ta confession ne figurent jamais sur ton profil.',
        route: '/profil/modifier',
      },
      {
        title: 'Ce que tu choisis d’afficher',
        body: 'Tes passages gardés, tes prières et tes intentions n’apparaissent sur ton profil que si tu choisis de les afficher.',
        route: '/passages',
      },
      {
        title: 'Te déconnecter ou tout supprimer',
        body: 'Sur ton profil, « Se déconnecter » ou « Supprimer mon compte ». La suppression efface pour de bon ton profil et ce que tu as publié, ta progression synchronisée, tes j’aime, tes échos et tes intentions. La liste de ta confession reste sur le téléphone.',
        route: '/profil',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'notifications-outline',
    entries: [
      {
        title: 'Rappel quotidien',
        body: 'Choisis une heure : une notification t’invite à lire avec un verset. Elle n’arrive pas si ta journée est déjà faite. Il marche sans compte.',
        route: '/rappel',
      },
      {
        title: 'Rappels de groupe',
        body: 'Ton téléphone programme les rappels : l’heure des rendez-vous auxquels tu participes, chaque jour pour une neuvaine ou une dizaine du Rosaire vivant dont tu as demandé le rappel, 10 minutes avant tes créneaux d’adoration. Ils demandent un compte relié.',
        route: '/notifications',
      },
      {
        title: 'Notifications de la communauté',
        body: 'Demande pour rejoindre un groupe, signalement à traiter, nouvel abonné, vie et nouveautés de tes groupes : un interrupteur pour chacune. Elles ne contiennent jamais le texte d’une intention, seulement le nom du groupe ou le @pseudo.',
        route: '/notifications',
      },
      {
        title: 'Couper un seul groupe',
        body: 'Sur la page d’un groupe, « Notifications de ce groupe » coupe ce groupe pour toi seulement.',
      },
    ],
  },
];
