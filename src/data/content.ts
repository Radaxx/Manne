import versesJson from './verses.json';

export type Theme = 'Paix' | 'Force' | 'Espoir' | 'Amour' | 'Sagesse' | 'Foi' | 'Pardon' | 'Gratitude';

/** Un ou plusieurs versets consécutifs d'un même chapitre. */
export type Passage = {
  id: string;
  book: number;
  bookName: string;
  chapter: number;
  from: number;
  to: number;
  reference: string;
  text: string;
};

export type Verse = Passage & { theme: Theme };

export const VERSES = versesJson as Verse[];

export const THEMES: Theme[] = ['Paix', 'Force', 'Espoir', 'Amour', 'Sagesse', 'Foi', 'Pardon', 'Gratitude'];

export const THEME_GRADIENTS: Record<Theme, [string, string, string]> = {
  Paix: ['#0b1d2a', '#14394a', '#1f5a66'],
  Force: ['#1a0f0a', '#5a2410', '#9c4a1c'],
  Espoir: ['#120f33', '#4a2266', '#b5527a'],
  Amour: ['#24070f', '#6e1730', '#b03a55'],
  Sagesse: ['#141209', '#3d3418', '#7d6a30'],
  Foi: ['#060f24', '#16326b', '#3466b0'],
  Pardon: ['#08201b', '#1a4a3d', '#3c8a6c'],
  Gratitude: ['#1f1205', '#6b4310', '#c4882c'],
};

export type Fact = { title: string; text: string };

export const FACTS: Fact[] = [
  {
    title: '66 livres, une bibliothèque',
    text: 'La Bible protestante compte 66 livres (73 dans la Bible catholique). Ils ont été écrits sur plus d’un millénaire, par des dizaines d’auteurs différents.',
  },
  {
    title: 'Le plus long chapitre',
    text: 'Le Psaume 119 compte 176 versets. C’est un acrostiche : 22 strophes de 8 versets, une pour chaque lettre de l’alphabet hébreu.',
  },
  {
    title: 'Le plus court chapitre',
    text: 'Le Psaume 117 ne compte que 2 versets. C’est le plus court chapitre de toute la Bible.',
  },
  {
    title: 'Les manuscrits de la mer Morte',
    text: 'Découverts à partir de 1947 près de Qumrân, ils contiennent les plus anciennes copies connues de livres de l’Ancien Testament, dont un rouleau complet d’Ésaïe.',
  },
  {
    title: 'Chapitres et versets',
    text: 'Les textes originaux n’avaient ni chapitres ni versets. Les chapitres datent du XIIIᵉ siècle (Étienne Langton), les versets du Nouveau Testament de Robert Estienne en 1551.',
  },
  {
    title: 'Trois langues',
    text: 'L’Ancien Testament est écrit en hébreu, avec quelques passages en araméen (dans Daniel et Esdras). Le Nouveau Testament est écrit en grec.',
  },
  {
    title: 'D’où vient le mot « Bible » ?',
    text: 'Du grec biblia, « les livres » — un pluriel. Le mot est lié à Byblos, port phénicien par où transitait le papyrus.',
  },
  {
    title: 'La Louis Segond',
    text: 'Louis Segond, pasteur et théologien suisse, a publié sa traduction de l’Ancien Testament en 1874 et du Nouveau en 1880. La version révisée de 1910 est celle que tu lis ici.',
  },
  {
    title: '« Évangile »',
    text: 'Le mot vient du grec euangelion, qui signifie « bonne nouvelle ».',
  },
  {
    title: 'Un livre sans le nom de Dieu',
    text: 'Le livre d’Esther (dans sa version hébraïque) ne mentionne jamais explicitement le nom de Dieu. Pourtant, toute l’histoire parle de providence.',
  },
  {
    title: 'Le plus court verset',
    text: 'Jean 11:35 : « Jésus pleura. » Deux mots en français, et pourtant tout y est : Dieu fait homme est touché par la peine de ceux qu’il aime.',
  },
  {
    title: 'La langue de Jésus',
    text: 'Jésus parlait très probablement l’araméen. Les évangiles ont gardé quelques-unes de ses paroles telles quelles : « Talitha koum » (Marc 5:41), « Éphphatha » (Marc 7:34).',
  },
  {
    title: 'Un nom pour Dieu',
    text: 'Le nom divin, composé des quatre lettres YHWH, apparaît environ 6 800 fois dans l’Ancien Testament hébreu. La Louis Segond le traduit par « l’Éternel ».',
  },
  {
    title: 'La Bible de Gutenberg',
    text: 'Vers 1455, le premier grand livre imprimé en Europe avec des caractères mobiles fut une Bible, en latin. Il en subsiste moins de cinquante exemplaires.',
  },
  {
    title: 'La Septante',
    text: 'C’est la traduction grecque de l’Ancien Testament, réalisée à Alexandrie vers le IIIᵉ siècle avant Jésus-Christ. C’est celle que citent souvent les auteurs du Nouveau Testament.',
  },
  {
    title: 'La Vulgate de saint Jérôme',
    text: 'À la fin du IVᵉ siècle, Jérôme traduit la Bible en latin à partir de l’hébreu et du grec. Sa Vulgate restera la Bible de l’Occident pendant plus de mille ans.',
  },
  {
    title: 'Un livre en 21 versets',
    text: 'Abdias est le plus court livre de l’Ancien Testament : un seul chapitre de 21 versets, adressé à Édom.',
  },
  {
    title: 'Les Psaumes, un livre-monde',
    text: 'Avec 150 chapitres, les Psaumes forment le plus long livre de la Bible. Soixante-treize d’entre eux portent le nom de David en tête.',
  },
  {
    title: 'Le nombre quarante',
    text: 'Quarante jours de déluge, quarante ans au désert, quarante jours de Jésus au désert : dans la Bible, ce nombre dit souvent un temps d’épreuve… qui prépare un commencement.',
  },
  {
    title: 'Les mages, combien étaient-ils ?',
    text: 'Matthieu 2 parle de « mages venus d’Orient » et de trois présents : l’or, l’encens et la myrrhe. Il ne donne ni leur nombre, ni le titre de rois : la tradition l’a déduit plus tard.',
  },
  {
    title: 'Deux « Notre Père »',
    text: 'La prière enseignée par Jésus nous est transmise en deux versions : une plus longue en Matthieu 6:9-13 (celle que nous récitons), et une plus brève en Luc 11:2-4.',
  },
  {
    title: 'Le Codex Sinaiticus',
    text: 'Ce manuscrit grec du IVᵉ siècle, retrouvé au monastère Sainte-Catherine, au pied du Sinaï, contient le plus ancien Nouveau Testament complet connu.',
  },
  {
    title: '« Christ », un titre',
    text: 'Christ vient du grec christos, qui traduit l’hébreu mashiah (« messie ») : celui qui a reçu l’onction. Ce n’est pas un nom de famille, mais un titre.',
  },
  {
    title: 'Le livre le plus traduit',
    text: 'La Bible entière est disponible dans plus de sept cents langues, et au moins l’un de ses livres dans plusieurs milliers.',
  },
  {
    title: 'Les cinq premiers livres',
    text: 'On les appelle Pentateuque, du grec « cinq rouleaux ». Les Juifs les nomment Torah, mot qui signifie « enseignement » plus que « loi ».',
  },
];

export type Quiz = { question: string; options: string[]; answer: number; explanation: string };

export const QUIZZES: Quiz[] = [
  { question: 'Qui a construit l’arche ?', options: ['Abraham', 'Noé', 'Moïse'], answer: 1, explanation: 'Genèse 6 à 9.' },
  {
    question: 'Combien de livres compte le Nouveau Testament ?',
    options: ['24', '27', '31'],
    answer: 1,
    explanation: 'De Matthieu à l’Apocalypse : 27 livres.',
  },
  {
    question: 'Dans quelle ville Jésus est-il né ?',
    options: ['Nazareth', 'Jérusalem', 'Bethléem'],
    answer: 2,
    explanation: 'Matthieu 2:1 et Luc 2:4-7.',
  },
  {
    question: 'Qui fut englouti par un grand poisson ?',
    options: ['Jonas', 'Élie', 'Daniel'],
    answer: 0,
    explanation: 'Jonas 2:1 (Louis Segond) — trois jours et trois nuits.',
  },
  {
    question: 'Qui a vaincu Goliath ?',
    options: ['Saül', 'Samson', 'David'],
    answer: 2,
    explanation: '1 Samuel 17, avec une fronde et une pierre.',
  },
  {
    question: 'Combien d’apôtres Jésus a-t-il choisis ?',
    options: ['7', '12', '70'],
    answer: 1,
    explanation: 'Marc 3:14 — il en établit douze.',
  },
  {
    question: 'Quel est le premier miracle de Jésus dans l’Évangile de Jean ?',
    options: ['La multiplication des pains', 'L’eau changée en vin', 'La guérison d’un aveugle'],
    answer: 1,
    explanation: 'Aux noces de Cana, Jean 2:1-11.',
  },
  {
    question: 'Qui a renié Jésus trois fois ?',
    options: ['Judas', 'Thomas', 'Pierre'],
    answer: 2,
    explanation: 'Luc 22:54-62, avant que le coq ne chante.',
  },
  {
    question: 'Dans quel livre Moïse reçoit-il les Dix Commandements au Sinaï ?',
    options: ['Genèse', 'Exode', 'Lévitique'],
    answer: 1,
    explanation: 'Exode 20.',
  },
  {
    question: 'Quel est le premier livre du Nouveau Testament ?',
    options: ['Matthieu', 'Marc', 'Actes'],
    answer: 0,
    explanation: 'L’Évangile selon Matthieu ouvre le Nouveau Testament.',
  },
  {
    question: 'Combien de jours et de nuits la pluie est-elle tombée sur la terre lors du déluge ?',
    options: ['7', '40', '150'],
    answer: 1,
    explanation: 'Genèse 7:12 — quarante jours et quarante nuits. Les eaux ont ensuite grossi pendant cent cinquante jours.',
  },
  {
    question: 'Qui a conduit le peuple hébreu hors d’Égypte ?',
    options: ['Josué', 'Aaron', 'Moïse'],
    answer: 2,
    explanation: 'Exode 3 à 14, du buisson ardent à la traversée de la mer Rouge.',
  },
  {
    question: 'Qui a succédé à Moïse pour faire entrer le peuple en Terre promise ?',
    options: ['Josué', 'Caleb', 'Aaron'],
    answer: 0,
    explanation: 'Josué 1:1-2 — « Moïse, mon serviteur, est mort… »',
  },
  {
    question: 'Quelle ville a vu ses murailles tomber après que le peuple en eut fait le tour au son des trompettes ?',
    options: ['Jérusalem', 'Babylone', 'Jéricho'],
    answer: 2,
    explanation: 'Josué 6.',
  },
  {
    question: 'Qui a bâti le premier temple de Jérusalem ?',
    options: ['David', 'Salomon', 'Hérode'],
    answer: 1,
    explanation: '1 Rois 6 — David l’avait préparé, mais c’est son fils Salomon qui l’a construit.',
  },
  {
    question: 'Quel prophète a affronté les prophètes de Baal sur le mont Carmel ?',
    options: ['Élie', 'Élisée', 'Ésaïe'],
    answer: 0,
    explanation: '1 Rois 18 — le feu du ciel est tombé sur son sacrifice.',
  },
  {
    question: 'Combien de fils Jacob (Israël) avait-il ?',
    options: ['7', '10', '12'],
    answer: 2,
    explanation: 'Genèse 35:22-26 — ils sont à l’origine des douze tribus d’Israël.',
  },
  {
    question: 'Quel livre de la Bible compte 150 chapitres ?',
    options: ['Les Psaumes', 'Les Proverbes', 'Ésaïe'],
    answer: 0,
    explanation: 'Les Psaumes : 150 prières et chants, le plus long livre de la Bible.',
  },
  {
    question: 'Dans quel évangile trouve-t-on le Sermon sur la montagne ?',
    options: ['Luc', 'Matthieu', 'Jean'],
    answer: 1,
    explanation: 'Matthieu 5 à 7 — il s’ouvre sur les Béatitudes.',
  },
  {
    question: 'Quel apôtre a refusé de croire à la résurrection avant d’avoir vu Jésus ?',
    options: ['Philippe', 'André', 'Thomas'],
    answer: 2,
    explanation: 'Jean 20:24-29 — « Heureux ceux qui n’ont pas vu, et qui ont cru. »',
  },
  {
    question: 'Qui a pris la place de Judas parmi les Douze ?',
    options: ['Barnabas', 'Matthias', 'Silas'],
    answer: 1,
    explanation: 'Actes 1:23-26 — le sort est tombé sur Matthias.',
  },
  {
    question: 'Quel apôtre était collecteur d’impôts avant de suivre Jésus ?',
    options: ['Matthieu', 'Jacques', 'Simon'],
    answer: 0,
    explanation: 'Matthieu 9:9 — Jésus le voit assis au bureau des taxes et lui dit : « Suis-moi. »',
  },
  {
    question: 'Sur la route de quelle ville Saul a-t-il rencontré le Christ ressuscité ?',
    options: ['Antioche', 'Corinthe', 'Damas'],
    answer: 2,
    explanation: 'Actes 9:1-9 — il devient Paul, l’apôtre des nations.',
  },
  {
    question: 'Combien de plaies ont frappé l’Égypte avant le départ des Hébreux ?',
    options: ['7', '10', '12'],
    answer: 1,
    explanation: 'Exode 7 à 12, de l’eau changée en sang à la mort des premiers-nés.',
  },
  {
    question: 'Quelle femme, juge d’Israël, a mené le peuple à la victoire avec Barak ?',
    options: ['Déborah', 'Jaël', 'Myriam'],
    answer: 0,
    explanation: 'Juges 4 et 5 — Déborah rendait la justice sous un palmier.',
  },
  {
    question: 'Selon Paul, quelle est la plus grande des trois choses qui demeurent ?',
    options: ['La foi', 'L’espérance', 'L’amour'],
    answer: 2,
    explanation: '1 Corinthiens 13:13 — « la plus grande de ces choses, c’est la charité » (Louis Segond).',
  },
  {
    question: 'Dans quelle ville les disciples ont-ils été appelés « chrétiens » pour la première fois ?',
    options: ['Jérusalem', 'Antioche', 'Rome'],
    answer: 1,
    explanation: 'Actes 11:26.',
  },
  {
    question: 'Dans quel jardin Jésus a-t-il prié avant son arrestation ?',
    options: ['Gethsémané', 'Éden', 'Siloé'],
    answer: 0,
    explanation: 'Matthieu 26:36-46 — « Mon âme est triste jusqu’à la mort. »',
  },
  {
    question: 'Avec quoi Jésus a-t-il nourri les cinq mille hommes ?',
    options: ['Deux pains et cinq poissons', 'Sept pains et trois poissons', 'Cinq pains et deux poissons'],
    answer: 2,
    explanation: 'Jean 6:9 — cinq pains d’orge et deux poissons, donnés par un jeune garçon.',
  },
  {
    question: 'Quel prophète a vu une vallée d’ossements desséchés revenir à la vie ?',
    options: ['Jérémie', 'Ézéchiel', 'Amos'],
    answer: 1,
    explanation: 'Ézéchiel 37.',
  },
  {
    question: 'Qui répond à l’appel de Dieu par ces mots : « Me voici, envoie-moi » ?',
    options: ['Ésaïe', 'Samuel', 'Jérémie'],
    answer: 0,
    explanation: 'Ésaïe 6:8, dans la vision du temple.',
  },
  {
    question: 'Quel était le métier de Pierre et d’André quand Jésus les a appelés ?',
    options: ['Bergers', 'Charpentiers', 'Pêcheurs'],
    answer: 2,
    explanation: 'Matthieu 4:18-19 — « Je vous ferai pêcheurs d’hommes. »',
  },
];

export type Person = { clues: string[]; name: string; reference: string };

export const PERSONS: Person[] = [
  {
    clues: ['Je suis moabite.', 'Je n’ai pas voulu quitter ma belle-mère Noémi.', 'Je suis l’arrière-grand-mère du roi David.'],
    name: 'Ruth',
    reference: 'Ruth 1 à 4',
  },
  {
    clues: [
      'J’étais chef des collecteurs d’impôts à Jéricho.',
      'J’étais petit de taille.',
      'Je suis monté sur un sycomore pour voir Jésus.',
    ],
    name: 'Zachée',
    reference: 'Luc 19:1-10',
  },
  {
    clues: ['Je suis devenue reine en Perse.', 'Mon cousin Mardochée m’a élevée.', 'J’ai risqué ma vie pour sauver mon peuple.'],
    name: 'Esther',
    reference: 'Esther 4:14-16',
  },
  {
    clues: ['J’étais pharisien et chef des Juifs.', 'Je suis venu voir Jésus de nuit.', 'Il m’a parlé de naître de nouveau.'],
    name: 'Nicodème',
    reference: 'Jean 3:1-21',
  },
  {
    clues: [
      'Je me tenais près de la croix.',
      'Je suis allée au tombeau le premier jour de la semaine.',
      'J’ai d’abord pris Jésus ressuscité pour le jardinier.',
    ],
    name: 'Marie de Magdala',
    reference: 'Jean 20:1-18',
  },
  {
    clues: ['Mes frères m’ont vendu comme esclave.', 'J’ai expliqué les rêves de Pharaon.', 'Je suis devenu gouverneur de l’Égypte.'],
    name: 'Joseph',
    reference: 'Genèse 37 à 50',
  },
  {
    clues: [
      'J’ai quitté Ur en Chaldée sans savoir où j’allais.',
      'On m’a promis une descendance aussi nombreuse que les étoiles.',
      'J’ai été prêt à offrir mon fils unique.',
    ],
    name: 'Abraham',
    reference: 'Genèse 12 à 22',
  },
  {
    clues: [
      'J’ai été élevé à la cour de Pharaon.',
      'J’ai gardé les troupeaux de mon beau-père à Madian.',
      'J’ai reçu les tables de la Loi sur le mont Sinaï.',
    ],
    name: 'Moïse',
    reference: 'Exode 2 à 34',
  },
  {
    clues: ['Je gardais les brebis de mon père à Bethléem.', 'Ma harpe apaisait le roi Saül.', 'J’ai écrit une grande partie des psaumes.'],
    name: 'David',
    reference: '1 Samuel 16 à 17',
  },
  {
    clues: [
      'J’ai été déporté à Babylone encore jeune.',
      'J’ai interprété les songes d’un roi.',
      'J’ai passé une nuit dans la fosse aux lions.',
    ],
    name: 'Daniel',
    reference: 'Daniel 6',
  },
  {
    clues: [
      'J’ai perdu mes troupeaux, mes enfants et ma santé.',
      'Trois amis sont venus me consoler, puis m’ont fait la leçon.',
      'J’ai dit : « L’Éternel a donné, et l’Éternel a ôté. »',
    ],
    name: 'Job',
    reference: 'Job 1:21',
  },
  {
    clues: [
      'Dieu m’a envoyé à Ninive, et j’ai pris la mer dans l’autre sens.',
      'J’ai passé trois jours dans le ventre d’un grand poisson.',
      'Je me suis fâché que Dieu pardonne à une ville entière.',
    ],
    name: 'Jonas',
    reference: 'Jonas 1 à 4',
  },
  {
    clues: [
      'J’ai été nourri par des corbeaux près d’un torrent.',
      'J’ai rendu son fils à une veuve de Sarepta.',
      'Je suis monté au ciel dans un tourbillon.',
    ],
    name: 'Élie',
    reference: '1 Rois 17 à 2 Rois 2',
  },
  {
    clues: ['Je vivais à Nazareth.', 'Un ange est venu me trouver.', 'J’ai répondu : « Voici la servante du Seigneur. »'],
    name: 'Marie, mère de Jésus',
    reference: 'Luc 1:26-38',
  },
  {
    clues: [
      'J’ai été pêcheur au bord du lac de Galilée.',
      'Jésus m’a donné un nouveau nom, qui veut dire « roc ».',
      'J’ai marché sur l’eau, puis j’ai eu peur du vent.',
    ],
    name: 'Pierre',
    reference: 'Matthieu 14:28-31',
  },
  {
    clues: [
      'J’étais citoyen romain et pharisien, formé aux pieds de Gamaliel.',
      'J’ai d’abord persécuté l’Église.',
      'Une lumière m’a aveuglé sur le chemin de Damas.',
    ],
    name: 'Paul',
    reference: 'Actes 9:1-19',
  },
  {
    clues: [
      'Je vendais de la pourpre à Philippes.',
      'J’adorais déjà Dieu quand Paul m’a parlé au bord d’une rivière.',
      'Ma maison a été la première à l’accueillir en Europe.',
    ],
    name: 'Lydie',
    reference: 'Actes 16:13-15',
  },
];

export const REFLECTIONS: string[] = [
  'Pour qui pourrais-tu prier aujourd’hui ?',
  'Qu’est-ce qui t’inquiète en ce moment ? Dépose-le, juste une minute.',
  'Cite trois choses pour lesquelles tu es reconnaissant·e aujourd’hui.',
  'À qui pourrais-tu pardonner, même un petit peu ?',
  'Quel verset as-tu envie de garder avec toi jusqu’à ce soir ?',
  'Envoie un message d’encouragement à quelqu’un qui en a besoin.',
  'Qui, autour de toi, traverse une épreuve en silence ?',
  'Quel est le dernier moment où tu as senti la paix ? Dis merci pour lui.',
  'Qu’est-ce que cette journée t’a appris sur toi-même ?',
  'Offre une minute de silence : qu’aimerais-tu entendre de Dieu ?',
  'De quoi as-tu besoin de te décharger aujourd’hui ? Dis-le simplement, avec tes mots.',
  'Quelle petite attention pourrais-tu avoir pour un proche, ce soir ?',
  'Pour quelle personne que tu as du mal à aimer pourrais-tu prier ?',
  'Quelle joie récente peux-tu partager avec quelqu’un ?',
  'Qu’est-ce qui t’habite le plus en ce moment ? Remets-le entre les mains de Dieu.',
  'Quelle personne as-tu croisée aujourd’hui sans vraiment la regarder ?',
];
