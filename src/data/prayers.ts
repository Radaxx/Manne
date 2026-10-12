// Recueil de prières. Les textes traditionnels ont été vérifiés auprès de sources catholiques
// (diocèses, sanctuaires) ; les prières bibliques sont lues dans la Louis Segond 1910 embarquée.
// Format du texte : paragraphes séparés par une ligne vide ; une ligne qui commence par « — » est
// la réponse de l'assemblée.

export type PrayerCategory = 'Essentielles' | 'Marie' | 'Saints et anges' | 'Christ et Esprit Saint' | 'Pardon et vertus' | 'Confiance et paix' | 'Repas' | 'Dans la Bible';

export const PRAYER_CATEGORIES: PrayerCategory[] = ['Essentielles', 'Marie', 'Saints et anges', 'Christ et Esprit Saint', 'Pardon et vertus', 'Confiance et paix', 'Repas', 'Dans la Bible'];

export type Prayer = {
  id: string;
  title: string;
  category: PrayerCategory;
  text?: string;
  /** Prière tirée de l'Écriture : [livre, chapitre, premier verset, dernier verset]. */
  scripture?: [number, number, number, number];
  /** Le chapelet a un affichage particulier (mystères du jour). */
  rosary?: boolean;
  note?: string;
};

export const PRAYERS: Prayer[] = [
  // ——— Essentielles ———
  { id: 'signe-de-croix', title: 'Signe de croix', category: 'Essentielles', text: 'Au nom du Père, et du Fils, et du Saint-Esprit. Amen.' },
  {
    id: 'notre-pere',
    title: 'Notre Père',
    category: 'Essentielles',
    text: 'Notre Père, qui es aux cieux,\nque ton nom soit sanctifié,\nque ton règne vienne,\nque ta volonté soit faite sur la terre comme au ciel.\n\nDonne-nous aujourd’hui notre pain de ce jour.\nPardonne-nous nos offenses,\ncomme nous pardonnons aussi à ceux qui nous ont offensés.\nEt ne nous laisse pas entrer en tentation\nmais délivre-nous du Mal.\n\nAmen.',
    note: 'Traduction liturgique en usage depuis 2017.',
  },
  {
    id: 'je-vous-salue-marie',
    title: 'Je vous salue Marie',
    category: 'Essentielles',
    text: 'Je vous salue, Marie, pleine de grâce ;\nle Seigneur est avec vous.\nVous êtes bénie entre toutes les femmes,\net Jésus, le fruit de vos entrailles, est béni.\n\nSainte Marie, Mère de Dieu,\npriez pour nous, pauvres pécheurs,\nmaintenant et à l’heure de notre mort.\n\nAmen.',
  },
  {
    id: 'gloire-au-pere',
    title: 'Gloire au Père',
    category: 'Essentielles',
    text: 'Gloire au Père, et au Fils, et au Saint-Esprit,\ncomme il était au commencement, maintenant et toujours,\net dans les siècles des siècles.\n\nAmen.',
  },
  {
    id: 'je-crois-en-dieu',
    title: 'Je crois en Dieu',
    category: 'Essentielles',
    text: 'Je crois en Dieu, le Père tout-puissant,\ncréateur du ciel et de la terre.\n\nEt en Jésus Christ, son Fils unique, notre Seigneur ;\nqui a été conçu du Saint-Esprit,\nest né de la Vierge Marie,\na souffert sous Ponce Pilate,\na été crucifié, est mort et a été enseveli,\nest descendu aux enfers ;\nle troisième jour est ressuscité des morts,\nest monté aux cieux,\nest assis à la droite de Dieu le Père tout-puissant,\nd’où il viendra juger les vivants et les morts.\n\nJe crois en l’Esprit Saint,\nà la sainte Église catholique,\nà la communion des saints,\nà la rémission des péchés,\nà la résurrection de la chair,\nà la vie éternelle.\n\nAmen.',
    note: 'Symbole des Apôtres.',
  },
  {
    id: 'credo-nicee',
    title: 'Je crois en un seul Dieu',
    category: 'Essentielles',
    text: 'Je crois en un seul Dieu,\nle Père tout-puissant,\ncréateur du ciel et de la terre,\nde l’univers visible et invisible.\n\nJe crois en un seul Seigneur, Jésus Christ,\nle Fils unique de Dieu,\nné du Père avant tous les siècles :\nil est Dieu, né de Dieu,\nlumière, née de la lumière,\nvrai Dieu, né du vrai Dieu,\nengendré, non pas créé,\nconsubstantiel au Père ;\net par lui tout a été fait.\n\nPour nous les hommes, et pour notre salut,\nil descendit du ciel ;\npar l’Esprit Saint, il a pris chair de la Vierge Marie,\net s’est fait homme.\nCrucifié pour nous sous Ponce Pilate,\nil souffrit sa passion et fut mis au tombeau.\nIl ressuscita le troisième jour,\nconformément aux Écritures,\net il monta au ciel ;\nil est assis à la droite du Père.\nIl reviendra dans la gloire,\npour juger les vivants et les morts ;\net son règne n’aura pas de fin.\n\nJe crois en l’Esprit Saint,\nqui est Seigneur et qui donne la vie ;\nil procède du Père et du Fils ;\navec le Père et le Fils,\nil reçoit même adoration et même gloire ;\nil a parlé par les prophètes.\n\nJe crois en l’Église, une, sainte, catholique et apostolique.\nJe reconnais un seul baptême pour le pardon des péchés.\nJ’attends la résurrection des morts,\net la vie du monde à venir.\n\nAmen.',
    note: 'Symbole de Nicée-Constantinople, dit le dimanche à la messe.',
  },

  // ——— Marie ———
  { id: 'chapelet', title: 'Le chapelet', category: 'Marie', rosary: true },
  {
    id: 'angelus',
    title: 'Angélus',
    category: 'Marie',
    text: 'L’ange du Seigneur apporta l’annonce à Marie,\n— et elle conçut du Saint-Esprit.\nJe vous salue Marie…\n\nVoici la servante du Seigneur,\n— qu’il me soit fait selon votre parole.\nJe vous salue Marie…\n\nEt le Verbe s’est fait chair,\n— et il a habité parmi nous.\nJe vous salue Marie…\n\nPriez pour nous, sainte Mère de Dieu,\n— afin que nous soyons rendus dignes des promesses du Christ.\n\nPrions : Que ta grâce, Seigneur notre Père, se répande en nos cœurs : par le message de l’ange, tu nous as fait connaître l’incarnation de ton Fils bien-aimé, conduis-nous par sa passion et par sa croix jusqu’à la gloire de la résurrection. Par le Christ, notre Seigneur.\n— Amen.',
    note: 'Traditionnellement prié le matin, à midi et le soir.',
  },
  {
    id: 'regina-caeli',
    title: 'Reine du ciel',
    category: 'Marie',
    text: 'Reine du ciel, réjouissez-vous, alléluia,\ncar celui que vous avez mérité de porter, alléluia,\nest ressuscité comme il l’avait dit, alléluia.\nPriez Dieu pour nous, alléluia.\n\nSoyez dans la joie et l’allégresse, Vierge Marie, alléluia,\n— car le Seigneur est vraiment ressuscité, alléluia.',
    note: 'Regina Caeli : remplace l’Angélus pendant le temps pascal.',
  },
  {
    id: 'salve-regina',
    title: 'Salut, ô Reine',
    category: 'Marie',
    text: 'Salut, ô Reine, Mère de miséricorde,\nnotre vie, notre douceur, notre espérance, salut !\n\nEnfants d’Ève, exilés, nous crions vers vous ;\nvers vous nous soupirons, gémissant et pleurant\ndans cette vallée de larmes.\n\nÔ vous, notre avocate,\ntournez vers nous vos regards miséricordieux.\nEt, après cet exil,\nmontrez-nous Jésus, le fruit béni de vos entrailles.\n\nÔ clémente, ô miséricordieuse, ô douce Vierge Marie !',
    note: 'Salve Regina.',
  },
  {
    id: 'souvenez-vous',
    title: 'Souvenez-vous',
    category: 'Marie',
    text: 'Souvenez-vous, ô très miséricordieuse Vierge Marie,\nqu’on n’a jamais entendu dire\nqu’aucun de ceux qui ont eu recours à votre protection,\nimploré votre assistance ou réclamé vos suffrages,\nait été abandonné.\n\nAnimé d’une pareille confiance,\nô Vierge des vierges, ô ma Mère, je cours vers vous,\net gémissant sous le poids de mes péchés,\nje me prosterne à vos pieds.\n\nÔ Mère du Verbe incarné,\nne méprisez pas mes prières,\nmais écoutez-les favorablement et daignez les exaucer.\n\nAmen.',
    note: 'Memorare, attribué à saint Bernard.',
  },
  {
    id: 'sous-l-abri',
    title: 'Sous l’abri de votre miséricorde',
    category: 'Marie',
    text: 'Sous l’abri de votre miséricorde,\nnous nous réfugions, sainte Mère de Dieu.\nNe méprisez pas nos prières quand nous sommes dans l’épreuve,\nmais de tous les dangers délivrez-nous toujours,\nVierge glorieuse et bénie.',
    note: 'Sub tuum praesidium, la plus ancienne prière connue à la Vierge Marie (IIIᵉ siècle).',
  },
  {
    id: 'o-marie-concue',
    title: 'Ô Marie conçue sans péché',
    category: 'Marie',
    text: 'Ô Marie conçue sans péché,\npriez pour nous qui avons recours à vous.',
    note: 'Invocation de la Médaille miraculeuse (1830).',
  },

  // ——— Saints et anges ———
  {
    id: 'glorieux-saint-joseph',
    title: 'Glorieux saint Joseph',
    category: 'Saints et anges',
    text: 'Glorieux saint Joseph, époux de Marie,\naccordez-nous votre protection paternelle,\nnous vous en supplions par le Cœur de Jésus-Christ.\n\nÔ vous dont la puissance infinie s’étend à toutes nos nécessités\net sait nous rendre possibles les choses les plus impossibles,\nouvrez vos yeux de père sur les intérêts de vos enfants.\n\nDans l’embarras et la peine qui nous pressent,\nnous recourons à vous avec confiance ;\ndaignez nous prendre sous votre charitable conduite\net réglez pour nous cette affaire si importante et si difficile,\ncause de toutes nos inquiétudes.\n\nFaites que son heureuse issue tourne à la gloire de Dieu\net au bien de ses dévoués serviteurs.\n\nAinsi soit-il.',
    note: 'Saint François de Sales. Prière pour obtenir une grâce ; on peut confier à saint Joseph l’intention qui nous préoccupe.',
  },
  {
    id: 'je-vous-salue-joseph',
    title: 'Je vous salue Joseph',
    category: 'Saints et anges',
    text: 'Je vous salue Joseph,\nvous que la grâce divine a comblé,\nle Sauveur a reposé dans vos bras et grandi sous vos yeux.\nVous êtes béni entre tous les hommes\net Jésus, l’Enfant divin de votre virginale Épouse, est béni.\n\nSaint Joseph, donné pour père au Fils de Dieu,\npriez pour nous dans nos soucis de famille,\nde santé et de travail, jusqu’à nos derniers jours,\net daignez nous secourir à l’heure de notre mort.\n\nAmen.',
  },
  {
    id: 'souvenez-vous-joseph',
    title: 'Souvenez-vous (à saint Joseph)',
    category: 'Saints et anges',
    text: 'Souvenez-vous, ô très chaste époux de la Vierge Marie,\nô mon aimable protecteur, saint Joseph,\nqu’on n’a jamais entendu dire que quelqu’un ait invoqué votre protection\net demandé votre secours sans avoir été consolé.\n\nAnimé d’une pareille confiance, je viens à vous\net je me recommande à vous de toute la ferveur de mon âme.\n\nNe rejetez pas ma prière, ô vous qui êtes appelé le père du Rédempteur,\nmais daignez l’accueillir avec bonté.\n\nAmen.',
    note: 'Bienheureux Pie IX, 1863.',
  },
  {
    id: 'saint-michel',
    title: 'Saint Michel Archange',
    category: 'Saints et anges',
    text: 'Saint Michel Archange, défendez-nous dans le combat ;\nsoyez notre secours contre la malice et les embûches du démon.\nQue Dieu exerce sur lui son empire, nous vous en supplions ;\net vous, prince de la milice céleste,\npar la force divine, repoussez en enfer Satan\net les autres esprits mauvais\nqui rôdent dans le monde pour la perte des âmes.\n\nAmen.',
    note: 'Léon XIII.',
  },
  {
    id: 'ange-gardien',
    title: 'Ange de Dieu',
    category: 'Saints et anges',
    text: 'Ange de Dieu, qui êtes mon gardien,\net à qui j’ai été confié par la bonté divine,\néclairez-moi, gardez-moi,\ndirigez-moi et gouvernez-moi.\n\nAmen.',
    note: 'Prière à l’ange gardien.',
  },

  // ——— Christ et Esprit Saint ———
  {
    id: 'viens-esprit-saint',
    title: 'Viens, Esprit Saint',
    category: 'Christ et Esprit Saint',
    text: 'Viens, Esprit Saint, remplis le cœur de tes fidèles,\net allume en eux le feu de ton amour.\n\nEnvoie ton Esprit, et tout sera créé,\n— et tu renouvelleras la face de la terre.\n\nPrions : Ô Dieu, qui as instruit les cœurs de tes fidèles par la lumière de l’Esprit Saint, donne-nous, par ce même Esprit, de goûter ce qui est bien et de jouir sans cesse de ses consolations. Par le Christ, notre Seigneur.\n— Amen.',
  },
  {
    id: 'ame-du-christ',
    title: 'Âme du Christ',
    category: 'Christ et Esprit Saint',
    text: 'Âme du Christ, sanctifie-moi.\nCorps du Christ, sauve-moi.\nSang du Christ, enivre-moi.\nEau du côté du Christ, lave-moi.\nPassion du Christ, fortifie-moi.\n\nÔ bon Jésus, exauce-moi.\nDans tes blessures, cache-moi.\nNe permets pas que je sois séparé de toi.\nDe l’ennemi, défends-moi.\nÀ l’heure de ma mort, appelle-moi,\net ordonne-moi de venir à toi,\npour qu’avec tes saints je te loue\ndans les siècles des siècles.\n\nAmen.',
    note: 'Anima Christi (XIVᵉ siècle), chère à saint Ignace de Loyola. Souvent priée après la communion.',
  },
  {
    id: 'parle-seigneur',
    title: 'Parle, Seigneur',
    category: 'Christ et Esprit Saint',
    scripture: [9, 3, 9, 10],
    note: 'La réponse du jeune Samuel : une prière avant de lire la Bible.',
  },

  // ——— Pardon et vertus ———
  {
    id: 'acte-de-contrition',
    title: 'Acte de contrition',
    category: 'Pardon et vertus',
    text: 'Mon Dieu, j’ai un très grand regret de vous avoir offensé,\nparce que vous êtes infiniment bon, infiniment aimable,\net que le péché vous déplaît.\n\nJe prends la ferme résolution, avec le secours de votre sainte grâce,\nde ne plus vous offenser et de faire pénitence.',
    note: 'Attribué à saint Alphonse de Liguori. Se dit notamment pendant la confession.',
  },
  {
    id: 'acte-de-foi',
    title: 'Acte de foi',
    category: 'Pardon et vertus',
    text: 'Mon Dieu, je crois fermement toutes les vérités que vous avez révélées\net que vous nous enseignez par votre Église,\nparce que vous ne pouvez ni vous tromper ni nous tromper.',
  },
  {
    id: 'acte-d-esperance',
    title: 'Acte d’espérance',
    category: 'Pardon et vertus',
    text: 'Mon Dieu, j’espère avec une ferme confiance\nque vous me donnerez, à cause des mérites de Jésus-Christ,\nvotre grâce en ce monde\net, si j’observe vos commandements, le bonheur éternel dans l’autre,\nparce que vous l’avez promis et que vous êtes fidèle dans vos promesses.',
  },
  {
    id: 'acte-de-charite',
    title: 'Acte de charité',
    category: 'Pardon et vertus',
    text: 'Mon Dieu, je vous aime de tout mon cœur et plus que tout,\nparce que vous êtes infiniment bon et infiniment aimable,\net j’aime mon prochain comme moi-même pour l’amour de vous.',
  },
  { id: 'miserere', title: 'Miserere (Psaume 51)', category: 'Pardon et vertus', scripture: [19, 51, 3, 21], note: 'Le grand psaume de la pénitence, attribué à David.' },

  // ——— Confiance et paix ———
  {
    id: 'priere-d-abandon',
    title: 'Prière d’abandon',
    category: 'Confiance et paix',
    text: 'Mon Père, je m’abandonne à toi,\nfais de moi ce qu’il te plaira.\nQuoi que tu fasses de moi, je te remercie.\nJe suis prêt à tout, j’accepte tout.\nPourvu que ta volonté se fasse en moi,\nen toutes tes créatures,\nje ne désire rien d’autre, mon Dieu.\n\nJe remets mon âme entre tes mains.\nJe te la donne, mon Dieu,\navec tout l’amour de mon cœur,\nparce que je t’aime,\net que ce m’est un besoin d’amour de me donner,\nde me remettre entre tes mains, sans mesure,\navec une infinie confiance,\ncar tu es mon Père.',
    note: 'Tirée d’une méditation de saint Charles de Foucauld (1896) sur la dernière parole de Jésus : « Père, je remets mon esprit entre tes mains » (Luc 23:46).',
  },
  {
    id: 'saint-francois',
    title: 'Fais de moi un instrument de ta paix',
    category: 'Confiance et paix',
    text: 'Seigneur, fais de moi un instrument de ta paix.\nLà où est la haine, que je mette l’amour.\nLà où est l’offense, que je mette le pardon.\nLà où est la discorde, que je mette l’union.\nLà où est l’erreur, que je mette la vérité.\nLà où est le doute, que je mette la foi.\nLà où est le désespoir, que je mette l’espérance.\nLà où sont les ténèbres, que je mette la lumière.\nLà où est la tristesse, que je mette la joie.\n\nÔ Seigneur, que je ne cherche pas tant\nà être consolé qu’à consoler,\nà être compris qu’à comprendre,\nà être aimé qu’à aimer.\n\nCar c’est en se donnant qu’on reçoit,\nc’est en s’oubliant qu’on se retrouve,\nc’est en pardonnant qu’on est pardonné,\nc’est en mourant qu’on ressuscite à l’éternelle vie.',
    note: 'Attribuée à saint François d’Assise ; parue en 1912 dans la revue La Clochette.',
  },
  { id: 'psaume-23', title: 'Le Seigneur est mon berger (Psaume 23)', category: 'Confiance et paix', scripture: [19, 23, 1, 6] },
  { id: 'psaume-91', title: 'Sous l’abri du Très-Haut (Psaume 91)', category: 'Confiance et paix', scripture: [19, 91, 1, 16], note: 'Le psaume de la protection, prié à Complies le dimanche.' },

  // ——— Repas ———
  {
    id: 'benedicite',
    title: 'Bénédicité',
    category: 'Repas',
    text: 'Bénissez-nous, Seigneur,\nbénissez ce repas, ceux qui l’ont préparé,\net procurez du pain à ceux qui n’en ont pas.\n\nAinsi soit-il.',
    note: 'Avant le repas.',
  },
  {
    id: 'graces',
    title: 'Action de grâce après le repas',
    category: 'Repas',
    text: 'Nous vous rendons grâce, Dieu tout-puissant, pour tous vos bienfaits,\nvous qui vivez et régnez pour les siècles des siècles.\n\nAinsi soit-il.',
  },

  // ——— Dans la Bible ———
  { id: 'notre-pere-bible', title: 'Le Notre Père dans l’Évangile', category: 'Dans la Bible', scripture: [40, 6, 9, 13] },
  { id: 'magnificat', title: 'Magnificat', category: 'Dans la Bible', scripture: [42, 1, 46, 55], note: 'Le cantique de Marie, prié chaque soir aux Vêpres.' },
  { id: 'benedictus', title: 'Benedictus', category: 'Dans la Bible', scripture: [42, 1, 68, 79], note: 'Le cantique de Zacharie, prié chaque matin aux Laudes.' },
  { id: 'nunc-dimittis', title: 'Cantique de Syméon', category: 'Dans la Bible', scripture: [42, 2, 29, 32], note: 'Nunc dimittis, prié chaque soir aux Complies.' },
  { id: 'beatitudes', title: 'Les Béatitudes', category: 'Dans la Bible', scripture: [40, 5, 3, 12] },
  { id: 'benediction-aaron', title: 'La bénédiction d’Aaron', category: 'Dans la Bible', scripture: [4, 6, 24, 26] },
  { id: 'hymne-amour', title: 'L’hymne à l’amour', category: 'Dans la Bible', scripture: [46, 13, 4, 7] },
];

export const prayerById = (id: string) => PRAYERS.find((p) => p.id === id);

// ——— Le chapelet ———

export type MysterySet = { name: string; days: number[]; mysteries: string[] };

/** Les quatre séries de mystères ; days : jours de la semaine (0 = dimanche) où on les médite. */
export const MYSTERIES: MysterySet[] = [
  { name: 'Mystères joyeux', days: [1, 6], mysteries: ['L’Annonciation', 'La Visitation', 'La Nativité', 'La Présentation de Jésus au Temple', 'Le Recouvrement de Jésus au Temple'] },
  { name: 'Mystères lumineux', days: [4], mysteries: ['Le Baptême de Jésus', 'Les Noces de Cana', 'L’Annonce du Royaume', 'La Transfiguration', 'L’Institution de l’Eucharistie'] },
  { name: 'Mystères douloureux', days: [2, 5], mysteries: ['L’Agonie de Jésus', 'La Flagellation', 'Le Couronnement d’épines', 'Le Portement de la croix', 'La Crucifixion'] },
  { name: 'Mystères glorieux', days: [0, 3], mysteries: ['La Résurrection', 'L’Ascension', 'La Pentecôte', 'L’Assomption de Marie', 'Le Couronnement de Marie'] },
];

export const ROSARY_STEPS = [
  'Signe de croix, puis Je crois en Dieu.',
  'Un Notre Père, trois Je vous salue Marie, un Gloire au Père.',
  'Pour chacun des cinq mystères : on annonce le mystère, puis un Notre Père, dix Je vous salue Marie et un Gloire au Père.',
  'On termine par le Salut, ô Reine.',
];
