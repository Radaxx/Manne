// Le parcours de Carême : du mercredi des Cendres au Samedi saint, toujours 46 jours (40 jours et 6 dimanches).
// Les Cendres et les trois jours qui suivent, cinq semaines du dimanche au samedi, puis la Semaine sainte.
// Chaque semaine a un thème tiré des grands évangiles du Carême ; les gestes reprennent la prière,
// le jeûne et le partage. Les passages sont lus dans la traduction choisie.

import type { JourneyDay, JourneyWeek } from '../journeys';

export const LENT_WEEKS: JourneyWeek[] = [
  { when: 'Mercredi des Cendres', theme: 'Revenir à Dieu', blurb: 'Les premiers jours : la prière, le jeûne et le partage.' },
  { when: '1re semaine', theme: 'Au désert', blurb: 'Avec Jésus tenté au désert, choisir ce qui fait vivre.' },
  { when: '2e semaine', theme: 'Écouter', blurb: 'La Transfiguration : « Écoutez-le. »' },
  { when: '3e semaine', theme: 'La source', blurb: 'Avec la Samaritaine, découvrir de quoi l’on a soif.' },
  { when: '4e semaine', theme: 'La lumière', blurb: 'Laetare : la joie de l’aveugle qui voit et du fils qui revient.' },
  { when: '5e semaine', theme: 'La vie', blurb: 'Avec Lazare, croire que la mort n’a pas le dernier mot.' },
  { when: 'Semaine sainte', theme: 'Suivre Jésus jusqu’à la croix', blurb: 'Des Rameaux au silence du Samedi saint.' },
];

export const LENT_DAYS: JourneyDay[] = [
  // Les Cendres — Revenir à Dieu
  {
    title: 'Aie pitié de moi',
    passage: [19, 51, 3, 6],
    meditation:
      'On reçoit les cendres avec ces mots : « Convertissez-vous et croyez à l’Évangile. » Le Carême ne commence pas par nos efforts, mais par la miséricorde qu’on demande.',
    gesture:
      'Choisis pour ce Carême trois efforts petits et précis : un de prière, un de jeûne, un de partage. Aujourd’hui, jeûne et abstinence.',
  },
  {
    title: 'Dans le secret',
    passage: [40, 6, 5, 6],
    meditation: 'Jésus ne demande pas de longues prières, mais une porte fermée et un cœur ouvert. Dieu voit dans le secret.',
    gesture: 'Trouve ta « chambre » : un lieu et une heure pour prier chaque jour du Carême.',
  },
  {
    title: 'Quand vous jeûnez',
    passage: [40, 6, 16, 18],
    meditation:
      'Le jeûne n’est pas une performance : il creuse en nous une faim de Dieu. On le vit le visage lavé, sans en faire un spectacle.',
    gesture: 'Les vendredis de Carême, on ne mange pas de viande. Jeûne aussi d’une chose qui te prend du temps, et offre ce temps à Dieu.',
  },
  {
    title: 'Que ta main gauche ignore',
    passage: [40, 6, 1, 4],
    meditation: 'Le partage est la troisième jambe du Carême. Donner sans le dire, c’est déjà se libérer de soi.',
    gesture: 'Mets de côté, chaque jour, ce que te coûte ton jeûne : tu le donneras à Pâques.',
  },
  // 1re semaine — Au désert
  {
    title: 'Pas seulement de pain',
    passage: [40, 4, 1, 4],
    meditation: 'Au désert, Jésus a faim, et il répond par la Parole. Ce dont nous vivons vraiment ne se mange pas.',
    gesture: 'Lis un passage de l’Évangile avant d’ouvrir tes messages, chaque matin de cette semaine.',
  },
  {
    title: 'Souviens-toi du chemin',
    passage: [5, 8, 2, 3],
    meditation:
      'Quarante ans au désert pour apprendre la confiance : Dieu nourrissait son peuple jour après jour, la manne de chaque matin.',
    gesture: 'Ce soir, relis ta journée et remercie pour trois choses reçues sans les avoir prévues.',
  },
  {
    title: 'Tu ne mettras pas Dieu à l’épreuve',
    passage: [40, 4, 5, 7],
    meditation: 'La tentation de forcer Dieu à prouver qu’il est là. Jésus choisit la confiance, sans exiger de signe.',
    gesture: 'Remets à Dieu une inquiétude que tu voudrais tout contrôler.',
  },
  {
    title: 'Tu adoreras le Seigneur',
    passage: [40, 4, 8, 11],
    meditation:
      'Le pouvoir, l’argent, l’image de soi : tout ce qui prend la première place devient une idole. Jésus rend la première place à Dieu.',
    gesture: 'Repère ce qui prend trop de place dans ta vie, et remets-le à sa juste place aujourd’hui.',
  },
  {
    title: 'Le jeûne qui me plaît',
    passage: [23, 58, 6, 8],
    meditation: 'Isaïe ne sépare pas le jeûne de la justice : se priver a un sens quand cela ouvre les mains aux autres.',
    gesture: 'Partage ton pain : apporte un repas ou des courses à quelqu’un qui en a besoin.',
  },
  {
    title: 'À l’ombre du Très-Haut',
    passage: [19, 91, 1, 4],
    meditation:
      'C’est le psaume que le diable cite à Jésus. Jésus le prie autrement : non pour se mettre en avant, mais pour s’abriter en Dieu.',
    gesture: 'Pas de viande aujourd’hui : un repas simple, et une prière pour ceux qui ont faim.',
  },
  {
    title: 'Convertissez-vous',
    passage: [41, 1, 12, 15],
    meditation: 'Se convertir, c’est se retourner : faire face à Dieu au lieu de lui tourner le dos. La bonne nouvelle vient en premier.',
    gesture: 'Note dans ton agenda une date pour recevoir le sacrement de réconciliation avant Pâques.',
  },
  // 2e semaine — Écouter
  {
    title: 'Écoutez-le',
    passage: [40, 17, 1, 8],
    meditation:
      'Sur la montagne, le Père ne donne qu’une consigne : écouter son Fils. La lumière de la Transfiguration éclaire la route vers la croix.',
    gesture: 'Prends dix minutes de silence pour écouter, sans rien demander.',
  },
  {
    title: 'Va vers le pays que je te montrerai',
    passage: [1, 12, 1, 4],
    meditation: 'Abraham part sans savoir où il va, sur une parole. Écouter Dieu, c’est accepter de se mettre en route.',
    gesture: 'Sors d’une habitude : appelle quelqu’un que tu n’as pas vu depuis longtemps.',
  },
  {
    title: 'Parle, ton serviteur écoute',
    passage: [9, 3, 9, 10],
    meditation: 'Le jeune Samuel ne reconnaît pas la voix de Dieu du premier coup. Il faut parfois quelqu’un pour nous aider à écouter.',
    gesture: 'Écoute vraiment quelqu’un aujourd’hui, sans préparer ta réponse.',
  },
  {
    title: 'La meilleure part',
    passage: [42, 10, 38, 42],
    meditation: 'Marthe sert, Marie écoute. Jésus ne méprise pas le service, mais il rappelle d’où il tire sa source.',
    gesture: 'Au milieu d’une journée chargée, arrête-toi cinq minutes pour être simplement avec Dieu.',
  },
  {
    title: 'Comme un arbre près des eaux',
    passage: [24, 17, 7, 8],
    meditation: 'L’arbre planté près de l’eau ne craint pas la sécheresse. La confiance donne des racines.',
    gesture: 'Écris une chose pour laquelle tu veux t’appuyer sur Dieu plutôt que sur toi seul.',
  },
  {
    title: 'Il éveille mon oreille',
    passage: [23, 50, 4, 5],
    meditation: 'Le serviteur reçoit, chaque matin, une parole pour réconforter celui qui est las. Écouter Dieu rend capable de consoler.',
    gesture: 'Jeûne de bruit : un trajet sans musique ni podcast, en silence ou en prière.',
  },
  {
    title: 'Prompts à écouter',
    passage: [59, 1, 19, 22],
    meditation: 'Lent à parler, lent à la colère : saint Jacques dit que l’écoute se vérifie dans ce qu’on fait.',
    gesture: 'Choisis une phrase de l’Évangile de la semaine et mets-la en pratique aujourd’hui.',
  },
  // 3e semaine — La source
  {
    title: 'Une source jaillissante',
    passage: [43, 4, 13, 14],
    meditation: 'Au puits, Jésus demande à boire, puis offre une eau qui désaltère pour toujours. Il connaît notre soif mieux que nous.',
    gesture: 'Bois un verre d’eau lentement, en remerciant Dieu pour la vie qu’il donne.',
  },
  {
    title: 'L’eau du rocher',
    passage: [2, 17, 3, 6],
    meditation: 'Le peuple murmure et doute : « Le Seigneur est-il au milieu de nous ? » Dieu répond en faisant jaillir l’eau du rocher.',
    gesture: 'Ne murmure pas aujourd’hui : remplace chaque plainte par une demande.',
  },
  {
    title: 'Mon âme a soif',
    passage: [19, 42, 2, 3],
    meditation: 'La soif de Dieu n’est pas un manque à cacher : c’est le début de la prière.',
    gesture: 'Dis à Dieu, avec tes mots, ce dont tu as soif.',
  },
  {
    title: 'Un cœur nouveau',
    passage: [26, 36, 25, 27],
    meditation: 'Dieu ne se contente pas de laver : il remplace le cœur de pierre par un cœur de chair, capable d’aimer.',
    gesture: 'Demande pardon à quelqu’un que tu as blessé.',
  },
  {
    title: 'Si quelqu’un a soif',
    passage: [43, 7, 37, 38],
    meditation: 'Celui qui boit à la source devient source à son tour. La grâce reçue déborde vers les autres.',
    gesture: 'Prends des nouvelles de quelqu’un, et laisse-le te parler de ce qui le fait vivre.',
  },
  {
    title: 'Venez aux eaux',
    passage: [23, 55, 1, 3],
    meditation: 'Dieu invite même ceux qui n’ont pas d’argent. Ce qu’il donne ne s’achète pas.',
    gesture: 'Fais un don à une association qui donne accès à l’eau ou à la nourriture.',
  },
  {
    title: 'Le pharisien et le publicain',
    passage: [42, 18, 9, 14],
    meditation: 'L’un fait la liste de ses mérites, l’autre ne dit qu’une phrase. C’est celui-là qui repart justifié.',
    gesture: 'Redis plusieurs fois aujourd’hui : « Seigneur, prends pitié de moi, pécheur. »',
  },
  // 4e semaine — La lumière
  {
    title: 'Va te laver',
    passage: [43, 9, 1, 7],
    meditation: 'C’est Laetare, le dimanche de la joie, à mi-chemin de Pâques. L’aveugle obéit sans encore voir, et revient voyant clair.',
    gesture: 'Offre une vraie joie à quelqu’un aujourd’hui, et accepte d’en recevoir une.',
  },
  {
    title: 'Ma lumière et mon salut',
    passage: [19, 27, 1, 1],
    meditation: 'Le psalmiste n’ignore pas ses ennemis ni ses peurs. Il les regarde à la lumière de Dieu.',
    gesture: 'Nomme une peur, et confie-la au Seigneur.',
  },
  {
    title: 'Vivez en enfants de lumière',
    passage: [49, 5, 8, 9],
    meditation: 'Paul ne dit pas « vous avez la lumière », mais « vous êtes lumière dans le Seigneur ». Cela se voit à la bonté.',
    gesture: 'Fais une chose bonne en secret.',
  },
  {
    title: 'Un homme avait deux fils',
    passage: [42, 15, 11, 24],
    meditation: 'Le père court au-devant du fils avant même ses excuses. Le Carême est le chemin du retour, et quelqu’un nous attend.',
    gesture: 'Fais le premier pas vers une réconciliation.',
  },
  {
    title: 'La lumière du monde',
    passage: [43, 8, 12, 12],
    meditation: 'Suivre Jésus, c’est marcher dans une lumière qui ne supprime pas la nuit, mais empêche de s’y perdre.',
    gesture: 'Ce soir, éteins tout, allume une seule bougie et prie quelques minutes.',
  },
  {
    title: 'Au fond de la mer',
    passage: [33, 7, 18, 19],
    meditation: 'Dieu ne garde pas la liste de nos fautes : il les jette au fond de la mer. Il prend plaisir à faire grâce.',
    gesture: 'Prépare ta confession avec l’examen de conscience de l’onglet Prières.',
  },
  {
    title: 'La brebis perdue',
    passage: [42, 15, 4, 7],
    meditation: 'Le berger laisse les quatre-vingt-dix-neuf pour une seule. Personne n’est de trop pour Dieu.',
    gesture: 'Prie pour quelqu’un qui s’est éloigné de la foi.',
  },
  // 5e semaine — La vie
  {
    title: 'Je suis la résurrection',
    passage: [43, 11, 25, 27],
    meditation: 'Devant le tombeau de son ami, Jésus pleure, puis appelle Lazare à sortir. La foi de Marthe précède le miracle.',
    gesture: 'Prie pour un défunt qui t’est cher.',
  },
  {
    title: 'J’ouvrirai vos tombeaux',
    passage: [26, 37, 12, 14],
    meditation: 'Ézéchiel voit des ossements reprendre vie. Il n’y a pas de situation trop morte pour le souffle de Dieu.',
    gesture: 'Rends visite ou téléphone à une personne malade ou âgée.',
  },
  {
    title: 'Moi non plus, je ne te condamne pas',
    passage: [43, 8, 3, 11],
    meditation: 'Les pierres tombent des mains une à une. Jésus relève la femme et lui ouvre un avenir : « Va, et ne pèche plus. »',
    gesture: 'Ne juge personne aujourd’hui, même en pensée.',
  },
  {
    title: 'Qui nous séparera ?',
    passage: [45, 8, 35, 39],
    meditation:
      'Ni la détresse, ni la mort, ni rien d’autre : Paul dresse la liste de tout ce qui pourrait nous séparer de Dieu, et rien n’y parvient.',
    gesture: 'Écris à quelqu’un qui traverse une épreuve.',
  },
  {
    title: 'Le grain de blé',
    passage: [43, 12, 24, 26],
    meditation: 'Jésus annonce sa mort avec l’image d’une semence. Donner sa vie, c’est la rendre féconde.',
    gesture: 'Renonce à avoir le dernier mot dans une discussion.',
  },
  {
    title: 'Il portait nos souffrances',
    passage: [23, 53, 4, 5],
    meditation: 'Isaïe décrit le serviteur souffrant des siècles avant la Passion. Ses blessures guérissent les nôtres.',
    gesture: 'Prie un chemin de croix, ou contemple un crucifix quelques minutes.',
  },
  {
    title: 'Il s’est abaissé',
    passage: [50, 2, 6, 8],
    meditation: 'Le Fils ne s’accroche pas à sa grandeur : il descend jusqu’à la croix. C’est le chemin de la semaine qui vient.',
    gesture: 'Demain, va à la messe des Rameaux et rapporte un rameau béni.',
  },
  // Semaine sainte
  {
    title: 'Hosanna !',
    passage: [40, 21, 8, 9],
    meditation: 'La foule acclame un roi monté sur un âne. Quelques jours plus tard, elle criera autre chose. Jésus entre quand même.',
    gesture: 'Place ton rameau près d’une croix chez toi, et prie pour ceux qui souffrent cette semaine.',
  },
  {
    title: 'Le parfum de Béthanie',
    passage: [43, 12, 1, 3],
    meditation: 'Marie verse un parfum très cher, sans compter. L’amour gratuit remplit toute la maison.',
    gesture: 'Fais un geste gratuit, « pour rien », par amour.',
  },
  {
    title: 'Je donnerai ma vie pour toi',
    passage: [43, 13, 36, 38],
    meditation: 'Pierre promet tout, et reniera trois fois. Jésus le sait, et ne lui retire pas son amitié.',
    gesture: 'Confie à Dieu une promesse que tu n’as pas su tenir.',
  },
  {
    title: 'Trente pièces d’argent',
    passage: [40, 26, 14, 16],
    meditation: 'Judas vend son maître. Ce mercredi invite à regarder en face nos propres trahisons, pour les rendre à la miséricorde.',
    gesture: 'Si ce n’est pas encore fait, va te confesser avant Pâques.',
  },
  {
    title: 'Je vous ai donné l’exemple',
    passage: [43, 13, 12, 15],
    meditation: 'Le Jeudi saint, Jésus lave les pieds de ses disciples et leur donne son Corps. Aimer, c’est servir.',
    gesture: 'Rends un service humble à quelqu’un de ta maison. Ce soir, la messe de la Cène du Seigneur.',
  },
  {
    title: 'Tout est accompli',
    passage: [43, 19, 25, 30],
    meditation: 'Au pied de la croix, Marie et le disciple bien-aimé. Jésus donne sa mère, puis son esprit. Tout est donné.',
    gesture: 'Jour de jeûne et d’abstinence. À 15 heures, un temps de silence devant la croix.',
  },
  {
    title: 'Attendre en silence',
    passage: [25, 3, 22, 26],
    meditation: 'Le Samedi saint, l’Église se tait près du tombeau. Même dans la nuit, ses miséricordes se renouvellent chaque matin.',
    gesture: 'Garde un peu de silence aujourd’hui, et prépare-toi à la Vigile pascale de ce soir.',
  },
];
