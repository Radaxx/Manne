// Compagnon de la messe : ce qui se passe, et ce que l'assemblée fait.
// Les lectures du jour viennent de l'AELF. Les chants fixes sont ceux du missel
// (traduction en usage depuis l'Avent 2021). L'entrée, l'offertoire, la communion
// et la sortie changent selon la paroisse : leurs paroles sont au livret.

import { prayerById } from './prayers';

export type MassPart = 'ouverture' | 'parole' | 'eucharistie' | 'envoi';

export type Posture = 'debout' | 'assis' | 'agenoux' | 'avec-lassemblee';

/** `sunday` : dimanche et fêtes. `sunday-hors-violet` : pas en Avent ni en Carême ordinaire. */
export type MassWhen = 'always' | 'sunday' | 'sunday-hors-violet';

/** Qui prononce la réplique. Le lecteur n'est pas le prêtre : il a sa propre couleur. */
export type MassVoice = 'pretre' | 'lecteur' | 'assemblee';

export type ChantLang = 'fr' | 'la';

export type CreedId = 'nicee' | 'apotres';

export type MassLine = { who: MassVoice; text: string; caption?: string; lang?: ChantLang; creed?: CreedId };

/** Garde les répliques sans langue, et celles de la langue choisie pour les chants. */
export function linesForLang(lines: MassLine[], lang: ChantLang): MassLine[] {
  return lines.filter((line) => !line.lang || line.lang === lang);
}

/** Garde les répliques hors Credo, et celui qui est choisi. */
export function linesForCreed(lines: MassLine[], creed: CreedId): MassLine[] {
  return lines.filter((line) => !line.creed || line.creed === creed);
}

export const VOICE_LABEL: Record<MassVoice, string> = {
  pretre: 'Prêtre',
  lecteur: 'Lecteur',
  assemblee: 'Assemblée',
};

export const VOICE_ORDER: MassVoice[] = ['pretre', 'lecteur', 'assemblee'];

export type MassMoment = {
  id: string;
  part: MassPart;
  title: string;
  posture: Posture;
  what: string;
  you: string;
  /** Texte de remplacement quand la couleur liturgique est violette (Carême, Avent). */
  whatViolet?: string;
  youViolet?: string;
  /** Échange prononcé : une couleur par voix. */
  lines?: MassLine[];
  when?: MassWhen;
  /** Prière déjà dans le recueil. */
  prayerId?: string;
  /** Type de lecture AELF (`lecture_1`, `psaume`, `lecture_2`, `evangile`). */
  readingType?: string;
};

export const MASS_PARTS: { id: MassPart; label: string }[] = [
  { id: 'ouverture', label: 'Ouverture' },
  { id: 'parole', label: 'Parole' },
  { id: 'eucharistie', label: 'Eucharistie' },
  { id: 'envoi', label: 'Envoi' },
];

export const POSTURE_LABEL: Record<Posture, string> = {
  debout: 'Debout',
  assis: 'Assis',
  agenoux: 'À genoux',
  'avec-lassemblee': 'Avec l’assemblée',
};

export const FIRST_TIME: { title: string; text: string }[] = [
  {
    title: 'Combien de temps',
    text: 'Compte environ une heure le dimanche, une demi-heure en semaine.',
  },
  {
    title: 'Où t’asseoir',
    text: 'Où tu veux. Vers le milieu, tu vois et tu entends bien. Personne ne te dira que la place est mauvaise.',
  },
  {
    title: 'Personne ne te fera lire',
    text: 'Tu n’as rien à dire tout seul devant tout le monde. Tu suis, tu écoutes, tu réponds avec les autres si tu le souhaites.',
  },
  {
    title: 'Le téléphone',
    text: 'Mets-le en silencieux. Ce guide se lit d’un coup d’œil, puis tu le reposes.',
  },
  {
    title: 'Le livret ou l’écran',
    text: 'Les chants changent chaque dimanche. Les paroles sont souvent dans un livret, ou projetées.',
  },
  {
    title: 'Tu peux juste écouter',
    text: 'Rien ne t’oblige à chanter, à te lever du premier coup, ni à communier. Regarder et écouter, c’est déjà être là.',
  },
];

const JE_CONFESSE = `Je confesse à Dieu tout-puissant,
je reconnais devant vous, frères et sœurs,
que j’ai péché
en pensée, en parole,
par action et par omission ;
oui, j’ai vraiment péché.

C’est pourquoi je supplie
la bienheureuse Vierge Marie,
les anges et tous les saints,
et vous aussi, frères et sœurs,
de prier pour moi le Seigneur notre Dieu.`;

const GLOIRE_A_DIEU = `Gloire à Dieu, au plus haut des cieux,
et paix sur la terre aux hommes qu’il aime.

Nous te louons, nous te bénissons, nous t’adorons,
nous te glorifions, nous te rendons grâce,
pour ton immense gloire,
Seigneur Dieu, Roi du ciel,
Dieu le Père tout-puissant.

Seigneur, Fils unique, Jésus Christ,
Seigneur Dieu, Agneau de Dieu, le Fils du Père.

Toi qui enlèves les péchés du monde,
prends pitié de nous.
Toi qui enlèves les péchés du monde,
reçois notre prière.
Toi qui es assis à la droite du Père,
prends pitié de nous.

Car toi seul es saint,
toi seul es Seigneur,
toi seul es le Très-Haut,
Jésus Christ,
avec le Saint-Esprit,
dans la gloire de Dieu le Père.

Amen.`;

const SAINT = `Saint ! Saint ! Saint, le Seigneur, Dieu de l’univers !
Le ciel et la terre sont remplis de ta gloire.
Hosanna au plus haut des cieux.
Béni soit celui qui vient au nom du Seigneur.
Hosanna au plus haut des cieux.`;

const SANCTUS = `Sanctus, Sanctus, Sanctus Dominus Deus Sabaoth.
Pleni sunt cæli et terra gloria tua.
Hosanna in excelsis.
Benedictus qui venit in nomine Domini.
Hosanna in excelsis.`;

const AGNEAU = `Agneau de Dieu, qui enlèves les péchés du monde, prends pitié de nous.
Agneau de Dieu, qui enlèves les péchés du monde, prends pitié de nous.
Agneau de Dieu, qui enlèves les péchés du monde, donne-nous la paix.`;

const KYRIE = `Kyrie, eleison.
Christe, eleison.
Kyrie, eleison.`;

const KYRIE_FR = `Seigneur, prends pitié.
Ô Christ, prends pitié.
Seigneur, prends pitié.`;

const GLORIA = `Gloria in excelsis Deo
et in terra pax hominibus bonæ voluntatis.
Laudamus te,
benedicimus te,
adoramus te,
glorificamus te,
gratias agimus tibi propter magnam gloriam tuam,
Domine Deus, Rex cælestis,
Deus Pater omnipotens.
Domine Fili unigenite, Iesu Christe,
Domine Deus, Agnus Dei, Filius Patris,
qui tollis peccata mundi, miserere nobis ;
qui tollis peccata mundi, suscipe deprecationem nostram.
Qui sedes ad dexteram Patris, miserere nobis.
Quoniam tu solus Sanctus,
tu solus Dominus,
tu solus Altissimus, Iesu Christe,
cum Sancto Spiritu :
in gloria Dei Patris.
Amen.`;

const AGNUS = `Agnus Dei, qui tollis peccata mundi, miserere nobis.
Agnus Dei, qui tollis peccata mundi, miserere nobis.
Agnus Dei, qui tollis peccata mundi, dona nobis pacem.`;

export const MASS_MOMENTS: MassMoment[] = [
  {
    id: 'arrivee',
    part: 'ouverture',
    title: 'En arrivant',
    posture: 'assis',
    what: 'Tu entres. S’il y a un bénitier, tu peux prendre de l’eau et faire le signe de croix. Tu t’inclines vers l’autel. S’il y a une petite lumière rouge, tu peux mettre un genou à terre : le pain consacré est là.',
    you: 'Assieds-toi. Le silence avant la messe fait déjà partie de la prière.',
    prayerId: 'signe-de-croix',
  },
  {
    id: 'entree',
    part: 'ouverture',
    title: 'Chant d’entrée',
    posture: 'debout',
    what: 'La messe commence souvent par un chant. Les paroles sont au livret ou à l’écran. La mélodie change d’une paroisse à l’autre.',
    you: 'Lève-toi avec l’assemblée. Tu peux chanter, ou simplement écouter.',
  },
  {
    id: 'salutation',
    part: 'ouverture',
    title: 'Signe de croix',
    posture: 'debout',
    what: 'Le prêtre ouvre la messe par le signe de croix, puis il salue l’assemblée.',
    you: 'Tu fais le signe de croix avec lui.',
    lines: [
      { who: 'pretre', text: 'Au nom du Père, et du Fils, et du Saint-Esprit.' },
      { who: 'assemblee', text: 'Amen.' },
      { who: 'pretre', text: 'Le Seigneur soit avec vous.' },
      { who: 'assemblee', text: 'Et avec votre esprit.' },
    ],
    prayerId: 'signe-de-croix',
  },
  {
    id: 'pardon',
    part: 'ouverture',
    title: 'Demande de pardon',
    posture: 'debout',
    what: 'On reconnaît qu’on a besoin du pardon de Dieu. On le dit souvent avec le Je confesse, puis on chante le Kyrie. Parfois le prêtre propose une autre formule.',
    you: 'Tu le dis avec l’assemblée. On se frappe la poitrine en disant « oui, j’ai vraiment péché ». Chaque invocation du Kyrie est souvent répétée.',
    lines: [
      { who: 'assemblee', text: JE_CONFESSE },
      {
        who: 'pretre',
        text: 'Que Dieu tout-puissant nous fasse miséricorde, qu’il nous pardonne nos péchés et nous conduise à la vie éternelle.',
      },
      { who: 'assemblee', text: 'Amen.' },
      { who: 'assemblee', caption: 'Kyrie eleison', lang: 'la', text: KYRIE },
      { who: 'assemblee', caption: 'Seigneur, prends pitié', lang: 'fr', text: KYRIE_FR },
    ],
  },
  {
    id: 'gloire',
    part: 'ouverture',
    title: 'Gloria in excelsis',
    posture: 'debout',
    when: 'sunday-hors-violet',
    what: 'Le dimanche et les fêtes, on chante le Gloria. On ne le chante pas pendant l’Avent ni le Carême. La mélodie change selon la paroisse.',
    you: 'Tu chantes avec l’assemblée, ou tu écoutes.',
    lines: [
      { who: 'assemblee', caption: 'Gloria in excelsis', lang: 'la', text: GLORIA },
      { who: 'assemblee', caption: 'Gloire à Dieu', lang: 'fr', text: GLOIRE_A_DIEU },
    ],
  },
  {
    id: 'collecte',
    part: 'ouverture',
    title: 'Prière d’ouverture',
    posture: 'debout',
    what: 'Le prêtre invite à prier, laisse un court silence, puis dit une prière au nom de tous.',
    you: 'À la fin, tu réponds.',
    lines: [
      { who: 'pretre', text: 'Prions le Seigneur.' },
      { who: 'assemblee', text: 'Amen.' },
    ],
  },
  {
    id: 'lecture-1',
    part: 'parole',
    title: 'Première lecture',
    posture: 'assis',
    what: 'Un lecteur proclame un texte de la Bible, souvent l’Ancien Testament ou les Actes des Apôtres.',
    you: 'Tu écoutes, assis. À la fin :',
    lines: [
      { who: 'lecteur', text: 'Parole du Seigneur.' },
      { who: 'assemblee', text: 'Nous rendons grâce à Dieu.' },
    ],
    readingType: 'lecture_1',
  },
  {
    id: 'psaume',
    part: 'parole',
    title: 'Psaume',
    posture: 'assis',
    what: 'On chante ou on lit un psaume. Un refrain revient plusieurs fois. Les paroles sont souvent affichées.',
    you: 'Tu reprends le refrain avec l’assemblée, si tu le connais. Sinon, tu écoutes.',
    readingType: 'psaume',
  },
  {
    id: 'lecture-2',
    part: 'parole',
    title: 'Deuxième lecture',
    posture: 'assis',
    when: 'sunday',
    what: 'Le dimanche, un second texte est proclamé, en général une lettre des Apôtres.',
    you: 'Même échange qu’à la première lecture.',
    lines: [
      { who: 'lecteur', text: 'Parole du Seigneur.' },
      { who: 'assemblee', text: 'Nous rendons grâce à Dieu.' },
    ],
    readingType: 'lecture_2',
  },
  {
    id: 'acclamation',
    part: 'parole',
    title: 'Acclamation',
    posture: 'debout',
    what: 'On se lève pour accueillir l’Évangile. On chante l’Alléluia.',
    you: 'Tu te lèves. Tu peux chanter avec l’assemblée.',
    whatViolet: 'On se lève pour accueillir l’Évangile. En Carême, on ne dit pas l’Alléluia : une autre acclamation le remplace.',
    youViolet: 'Tu te lèves. Tu peux chanter l’acclamation avec l’assemblée.',
  },
  {
    id: 'evangile',
    part: 'parole',
    title: 'Évangile',
    posture: 'debout',
    what: 'Le prêtre ou le diacre proclame l’Évangile. On trace parfois un petit signe de croix sur le front, les lèvres et le cœur.',
    you: 'Tu te lèves et tu réponds.',
    lines: [
      { who: 'pretre', text: 'Le Seigneur soit avec vous.' },
      { who: 'assemblee', text: 'Et avec votre esprit.' },
      { who: 'pretre', text: 'Évangile de Jésus Christ selon saint N.' },
      { who: 'assemblee', text: 'Gloire à toi, Seigneur.' },
      { who: 'pretre', text: 'Acclamons la Parole de Dieu.' },
      { who: 'assemblee', text: 'Louange à toi, Seigneur Jésus.' },
    ],
    readingType: 'evangile',
  },
  {
    id: 'homelie',
    part: 'parole',
    title: 'Homélie',
    posture: 'assis',
    what: 'Le prêtre explique les lectures et les relie à la vie. Il n’y a pas de texte à suivre.',
    you: 'Tu écoutes. Tu peux retenir une phrase qui te touche.',
  },
  {
    id: 'credo',
    part: 'parole',
    title: 'Credo',
    posture: 'debout',
    when: 'sunday',
    what: 'Le dimanche et les fêtes, on proclame la foi de l’Église. En général le Symbole de Nicée-Constantinople. Certaines messes, surtout avec des enfants, disent le Symbole des Apôtres.',
    you: 'Tu le dis avec l’assemblée. On s’incline aux mots de l’incarnation.',
    lines: [
      { who: 'assemblee', caption: 'Nicée-Constantinople', creed: 'nicee', text: prayerById('credo-nicee')?.text ?? '' },
      { who: 'assemblee', caption: 'Symbole des Apôtres', creed: 'apotres', text: prayerById('je-crois-en-dieu')?.text ?? '' },
    ],
  },
  {
    id: 'universelle',
    part: 'parole',
    title: 'Prière universelle',
    posture: 'debout',
    what: 'On prie pour l’Église, pour le monde, pour ceux qui souffrent, pour la communauté.',
    you: 'À chaque intention, tu réponds. Parfois on dit plutôt « Seigneur, prends pitié ».',
    lines: [{ who: 'assemblee', text: 'Seigneur, écoute-nous.' }],
  },
  {
    id: 'offertoire',
    part: 'eucharistie',
    title: 'Préparation des dons',
    posture: 'assis',
    what: 'On apporte le pain et le vin à l’autel. Il y a souvent un chant. Les paroles sont au livret, et la mélodie change selon la paroisse.',
    you: 'Tu t’assois. Tu peux chanter, ou déposer dans ce moment ce que tu veux offrir à Dieu.',
  },
  {
    id: 'sur-les-offrandes',
    part: 'eucharistie',
    title: 'Prière sur les offrandes',
    posture: 'debout',
    what: 'Le prêtre invite à prier, puis dit une prière sur le pain et le vin.',
    you: 'Tu te lèves et tu réponds.',
    lines: [
      { who: 'pretre', text: 'Prions ensemble.' },
      { who: 'assemblee', text: 'Pour la gloire de Dieu et le salut du monde.' },
      { who: 'assemblee', text: 'Amen.' },
    ],
  },
  {
    id: 'preface',
    part: 'eucharistie',
    title: 'Préface',
    posture: 'debout',
    what: 'Un dialogue ouvre la grande prière.',
    you: 'Tu réponds à chaque invitation.',
    lines: [
      { who: 'pretre', text: 'Le Seigneur soit avec vous.' },
      { who: 'assemblee', text: 'Et avec votre esprit.' },
      { who: 'pretre', text: 'Élevons notre cœur.' },
      { who: 'assemblee', text: 'Nous le tournons vers le Seigneur.' },
      { who: 'pretre', text: 'Rendons grâce au Seigneur notre Dieu.' },
      { who: 'assemblee', text: 'Cela est juste et bon.' },
    ],
  },
  {
    id: 'sanctus',
    part: 'eucharistie',
    title: 'Sanctus',
    posture: 'debout',
    what: 'Toute l’assemblée chante le Sanctus. La mélodie change d’une paroisse à l’autre.',
    you: 'Tu chantes, ou tu écoutes.',
    lines: [
      { who: 'assemblee', caption: 'Sanctus', lang: 'la', text: SANCTUS },
      { who: 'assemblee', caption: 'Saint, saint, saint', lang: 'fr', text: SAINT },
    ],
  },
  {
    id: 'priere-eucharistique',
    part: 'eucharistie',
    title: 'Prière eucharistique',
    posture: 'avec-lassemblee',
    what: 'C’est le cœur de la messe. Le prêtre demande à l’Esprit Saint de consacrer le pain et le vin, qui deviennent le corps et le sang du Christ. Il élève l’hostie, puis le calice.',
    you: 'Fais comme l’assemblée : debout, à genoux, ou incliné. La formule après le mystère de la foi peut varier ; celle-ci est la plus fréquente.',
    lines: [
      { who: 'pretre', text: 'Il est grand, le mystère de la foi.' },
      {
        who: 'assemblee',
        text: 'Nous annonçons ta mort, Seigneur Jésus, nous proclamons ta résurrection, nous attendons ta venue dans la gloire.',
      },
      { who: 'assemblee', text: 'Amen.' },
    ],
  },
  {
    id: 'notre-pere',
    part: 'eucharistie',
    title: 'Notre Père',
    posture: 'debout',
    what: 'Jésus nous a appris cette prière. On la dit ensemble.',
    you: 'Tu la dis avec l’assemblée. Mains jointes, ou données aux voisins : suis ce que font les autres.',
    prayerId: 'notre-pere',
  },
  {
    id: 'paix',
    part: 'eucharistie',
    title: 'La paix',
    posture: 'debout',
    what: 'Puis on échange un geste de paix.',
    you: 'Un signe simple vers tes voisins suffit. Rien ne t’oblige à faire le tour de l’église.',
    lines: [
      { who: 'pretre', text: 'La paix du Seigneur soit toujours avec vous.' },
      { who: 'assemblee', text: 'Et avec votre esprit.' },
    ],
  },
  {
    id: 'agneau',
    part: 'eucharistie',
    title: 'Agnus Dei',
    posture: 'debout',
    what: 'Pendant que le prêtre rompt le pain, on chante l’Agnus Dei. La mélodie change selon la paroisse.',
    you: 'Tu chantes ou tu écoutes. Puis le prêtre présente le pain consacré.',
    lines: [
      { who: 'assemblee', caption: 'Agnus Dei', lang: 'la', text: AGNUS },
      { who: 'assemblee', caption: 'Agneau de Dieu', lang: 'fr', text: AGNEAU },
      {
        who: 'pretre',
        text: 'Voici l’Agneau de Dieu, voici celui qui enlève le péché du monde. Heureux les invités au repas du Seigneur.',
      },
      { who: 'assemblee', text: 'Seigneur, je ne suis pas digne de te recevoir, mais dis seulement une parole et je serai guéri.' },
    ],
  },
  {
    id: 'communion',
    part: 'eucharistie',
    title: 'Communion',
    posture: 'avec-lassemblee',
    what: 'Ceux qui communient s’avancent en procession. On communie si l’on est baptisé catholique et en paix avec Dieu.',
    you: 'Sinon, tu peux rester assis. Tu peux aussi t’avancer les bras croisés sur la poitrine, pour recevoir une bénédiction. Rien à justifier à personne.',
  },
  {
    id: 'apres-communion',
    part: 'eucharistie',
    title: 'Après la communion',
    posture: 'assis',
    what: 'Un temps de silence, parfois un chant de reconnaissance. Puis le prêtre dit une prière.',
    you: 'Tu restes assis. À la fin de la prière :',
    lines: [{ who: 'assemblee', text: 'Amen.' }],
  },
  {
    id: 'benediction',
    part: 'envoi',
    title: 'Bénédiction',
    posture: 'debout',
    what: 'Le prêtre bénit l’assemblée. Parfois quelques annonces précèdent la bénédiction.',
    you: 'Tu te lèves.',
    lines: [
      { who: 'pretre', text: 'Le Seigneur soit avec vous.' },
      { who: 'assemblee', text: 'Et avec votre esprit.' },
      { who: 'assemblee', text: 'Amen.' },
    ],
  },
  {
    id: 'envoi',
    part: 'envoi',
    title: 'Envoi',
    posture: 'debout',
    what: 'La messe envoie vivre ce qu’on a reçu. Un chant de sortie accompagne souvent le départ. Les paroles sont au livret.',
    you: 'Tu peux chanter, puis tu sors.',
    lines: [
      { who: 'pretre', text: 'Allez, dans la paix du Christ.' },
      { who: 'assemblee', text: 'Nous rendons grâce à Dieu.' },
    ],
  },
];

export function momentCopy(moment: MassMoment, violet: boolean): { what: string; you: string; lines: MassLine[] } {
  const lines = moment.lines ?? [];
  if (violet && moment.whatViolet) return { what: moment.whatViolet, you: moment.youViolet ?? moment.you, lines };
  return { what: moment.what, you: moment.you, lines };
}

/**
 * Dimanche ou semaine, et couleur violette pour le Gloire à Dieu.
 * `secondReading` à null tant qu'on ne sait pas si la messe du jour en a une : on garde l'étape.
 */
export function visibleMoments(sunday: boolean, violet: boolean, secondReading: boolean | null): MassMoment[] {
  return MASS_MOMENTS.filter((moment) => {
    if (moment.readingType === 'lecture_2' && secondReading === false) return false;
    if ((moment.when === 'sunday' || moment.when === 'sunday-hors-violet') && !sunday) return false;
    if (moment.when === 'sunday-hors-violet' && violet) return false;
    return true;
  });
}
