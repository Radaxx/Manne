// Le saint du jour, pour chaque jour de l'année (clé MM-JJ). D'abord les célébrations du calendrier romain
// général et du propre de la France (vérifiées sur le calendrier de l'AELF), dans l'ordre où on les met en
// avant ; les jours sans célébration, un saint du martyrologe romain ou de la tradition française.
// Les notices sont écrites pour Manne.

export type SaintRank = 'solennite' | 'fete' | 'memoire' | 'facultative' | 'commemoraison' | 'martyrologe';

export type Saint = {
  name: string;
  title?: string;
  rank: SaintRank;
  life: string;
  /** Solennité qui change de jour certaines années : son nom dans `upcomingFeasts` (`liturgical-year.ts`). */
  feast?: string;
  /** Fête du Seigneur : elle passe même avant le dimanche. */
  lord?: true;
};

export const SAINTS: Record<string, Saint[]> = {
  // Janvier
  '01-01': [
    {
      name: 'Sainte Marie, Mère de Dieu',
      rank: 'solennite',
      life: 'L’année commence auprès de Marie. Le concile d’Éphèse, en 431, l’a proclamée Theotokos, « Mère de Dieu » : celui qu’elle a mis au monde est vraiment Dieu fait homme. C’est aussi la Journée mondiale de la paix.',
    },
  ],
  '01-02': [
    {
      name: 'Saints Basile le Grand et Grégoire de Nazianze',
      title: 'évêques et docteurs de l’Église',
      rank: 'memoire',
      life: 'Deux amis cappadociens du IVe siècle, étudiants ensemble à Athènes. Basile, évêque de Césarée, a donné des règles aux moines d’Orient ; Grégoire, le « Théologien », a défendu la divinité du Christ et de l’Esprit Saint.',
    },
  ],
  '01-03': [
    {
      name: 'Sainte Geneviève',
      title: 'vierge, patronne de Paris',
      rank: 'facultative',
      life: 'Consacrée à Dieu dès l’enfance, elle a soutenu les Parisiens face aux Huns d’Attila en 451 par la prière et le jeûne, puis les a ravitaillés pendant un siège. Elle est morte vers 500.',
    },
    {
      name: 'Le Saint Nom de Jésus',
      rank: 'facultative',
      life: '« Jésus » veut dire « Dieu sauve ». L’Église honore le nom que l’ange a donné à l’enfant, huit jours après sa naissance, et devant lequel « tout genou fléchisse » (Philippiens 2, 10).',
    },
  ],
  '01-04': [
    {
      name: 'Sainte Angèle de Foligno',
      title: 'tertiaire franciscaine',
      rank: 'martyrologe',
      life: 'Épouse et mère italienne à la vie mondaine, elle se convertit vers 1285 et devient franciscaine séculière. Le récit de ses expériences mystiques lui a valu le titre de « maîtresse des théologiens ». Morte en 1309.',
    },
  ],
  '01-05': [
    {
      name: 'Saint Édouard le Confesseur',
      title: 'roi d’Angleterre',
      rank: 'martyrologe',
      life: 'Roi d’Angleterre de 1042 à 1066, réputé pour sa piété et sa générosité envers les pauvres. Il a fait bâtir l’abbaye de Westminster, où il repose.',
    },
  ],
  '01-06': [
    {
      name: 'Saint André Bessette',
      title: 'religieux',
      rank: 'martyrologe',
      life: 'Frère de Sainte-Croix à Montréal, longtemps portier de collège, il recevait les malades et les confiait à saint Joseph. Il est à l’origine de l’oratoire Saint-Joseph du Mont-Royal. Mort en 1937.',
    },
  ],
  '01-07': [
    {
      name: 'Saint Raymond de Peñafort',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Dominicain catalan du XIIIe siècle, juriste, il a rassemblé les décrets des papes pour Grégoire IX et écrit un guide pour les confesseurs. Maître général de son ordre, il est mort presque centenaire en 1275.',
    },
  ],
  '01-08': [
    {
      name: 'Saint Lucien de Beauvais',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Selon la tradition, il a annoncé l’Évangile dans la région de Beauvais au IIIe siècle et y est mort martyr avec ses compagnons.',
    },
  ],
  '01-09': [
    {
      name: 'Saint Adrien de Cantorbéry',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Moine né en Afrique du Nord, envoyé en Angleterre par le pape au VIIe siècle. Abbé à Cantorbéry pendant près de quarante ans, il y a fondé une école réputée pour l’étude des Écritures, du grec et du latin.',
    },
  ],
  '01-10': [
    {
      name: 'Saint Guillaume de Bourges',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine cistercien devenu archevêque de Bourges en 1200, il a gardé une vie austère, visitait les prisonniers et défendait les pauvres. Il est mort en 1209.',
    },
  ],
  '01-11': [
    {
      name: 'Saint Théodose le Cénobiarque',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Moine de Cappadoce installé près de Bethléem au Ve siècle, il a fondé un grand monastère où vivaient des centaines de moines, avec des hôpitaux pour les malades et les pauvres.',
    },
  ],
  '01-12': [
    {
      name: 'Sainte Marguerite Bourgeoys',
      title: 'vierge, fondatrice',
      rank: 'martyrologe',
      life: 'Née à Troyes en 1620, elle part pour la Nouvelle-France et ouvre à Montréal la première école. Elle fonde la Congrégation de Notre-Dame, des religieuses non cloîtrées vouées à l’éducation. Morte en 1700.',
    },
  ],
  '01-13': [
    {
      name: 'Saint Hilaire de Poitiers',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Converti à l’âge adulte, évêque de Poitiers vers 350, il a défendu la divinité du Christ contre l’arianisme, ce qui lui a valu l’exil en Phrygie. Il a accueilli saint Martin et l’a encouragé à fonder Ligugé.',
    },
  ],
  '01-14': [
    {
      name: 'Saint Félix de Nole',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Prêtre de Nole, en Campanie, persécuté au IIIe siècle, il a survécu aux tortures et fini sa vie dans la pauvreté. Saint Paulin de Nole a fait de son tombeau un lieu de pèlerinage.',
    },
  ],
  '01-15': [
    {
      name: 'Saint Remi',
      title: 'évêque de Reims',
      rank: 'facultative',
      life: 'Évêque de Reims pendant plus de soixante ans, il a baptisé Clovis vers 496 avec des milliers de Francs, un moment fondateur pour la foi en France. Il est mort vers 533.',
    },
  ],
  '01-16': [
    {
      name: 'Saint Marcel Ier',
      title: 'pape',
      rank: 'martyrologe',
      life: 'Pape au début du IVe siècle, après la persécution de Dioclétien, il a réorganisé l’Église de Rome et demandé une pénitence à ceux qui avaient renié la foi. Il est mort en exil vers 309.',
    },
  ],
  '01-17': [
    {
      name: 'Saint Antoine le Grand',
      title: 'abbé',
      rank: 'memoire',
      life: 'Jeune Égyptien, il entend l’Évangile « Va, vends ce que tu as » et part au désert vers 270. Des disciples le rejoignent : il est le père des moines. Saint Athanase a écrit sa vie. Mort très âgé en 356.',
    },
  ],
  '01-18': [
    {
      name: 'Sainte Marguerite de Hongrie',
      title: 'moniale',
      rank: 'martyrologe',
      life: 'Fille du roi Béla IV, offerte à Dieu avant sa naissance, elle est entrée chez les dominicaines et y a choisi les tâches les plus humbles, refusant les mariages royaux qu’on lui proposait. Morte en 1270.',
    },
  ],
  '01-19': [
    {
      name: 'Saints Marius et Marthe',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Selon la tradition, un couple venu de Perse à Rome avec ses fils pour vénérer les tombeaux des martyrs, qui ensevelissait les chrétiens tués et a partagé leur sort vers 270.',
    },
  ],
  '01-20': [
    {
      name: 'Saint Fabien',
      title: 'pape et martyr',
      rank: 'facultative',
      life: 'Laïc élu pape en 236, il a organisé l’Église de Rome en sept diaconies. Il a été l’une des premières victimes de la persécution de Dèce en 250.',
    },
    {
      name: 'Saint Sébastien',
      title: 'martyr',
      rank: 'facultative',
      life: 'Martyr romain du IIIe ou IVe siècle, enterré sur la voie Appienne. La tradition en fait un officier de la garde impériale qui soutenait les chrétiens emprisonnés.',
    },
  ],
  '01-21': [
    {
      name: 'Sainte Agnès',
      title: 'vierge et martyre',
      rank: 'memoire',
      life: 'Jeune Romaine d’environ douze ans, elle a refusé un mariage pour rester consacrée au Christ et a été mise à mort vers 304. Saint Ambroise et le pape Damase ont célébré son courage.',
    },
  ],
  '01-22': [
    {
      name: 'Saint Vincent de Saragosse',
      title: 'diacre et martyr',
      rank: 'facultative',
      life: 'Diacre de Saragosse, il a été torturé à Valence en 304 pendant la persécution de Dioclétien. Patron des vignerons en France.',
    },
  ],
  '01-23': [
    {
      name: 'Saint Ildefonse de Tolède',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine puis archevêque de Tolède au VIIe siècle, il a écrit un traité sur la virginité perpétuelle de Marie. Il est mort en 667.',
    },
  ],
  '01-24': [
    {
      name: 'Saint François de Sales',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Évêque de Genève résidant à Annecy, il a enseigné que la sainteté est pour tous, dans chaque état de vie (Introduction à la vie dévote). Il a fondé la Visitation avec Jeanne de Chantal. Patron des journalistes. Mort en 1622.',
    },
  ],
  '01-25': [
    {
      name: 'Conversion de saint Paul',
      title: 'apôtre',
      rank: 'fete',
      life: 'Sur le chemin de Damas, le persécuteur Saul est saisi par le Christ ressuscité : « Je suis Jésus, celui que tu persécutes. » Il devient l’apôtre des nations. Ce jour clôt la semaine de prière pour l’unité des chrétiens.',
    },
  ],
  '01-26': [
    {
      name: 'Saints Timothée et Tite',
      title: 'évêques',
      rank: 'memoire',
      life: 'Compagnons de saint Paul, qui leur a adressé trois lettres. Timothée a conduit l’Église d’Éphèse, Tite celle de Crète.',
    },
  ],
  '01-27': [
    {
      name: 'Sainte Angèle Merici',
      title: 'vierge',
      rank: 'facultative',
      life: 'À Brescia, en 1535, elle a fondé la Compagnie de Sainte-Ursule : des jeunes femmes consacrées, vivant dans leur famille, vouées à l’éducation chrétienne des filles. Morte en 1540.',
    },
  ],
  '01-28': [
    {
      name: 'Saint Thomas d’Aquin',
      title: 'prêtre et docteur de l’Église',
      rank: 'memoire',
      life: 'Dominicain, maître à Paris au XIIIe siècle, il a montré l’accord de la foi et de la raison dans la Somme théologique. Auteur aussi des hymnes de la Fête-Dieu. Mort en 1274.',
    },
  ],
  '01-29': [
    {
      name: 'Saint Gildas',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Moine venu de Grande-Bretagne au VIe siècle, il a fondé le monastère de Rhuys, dans le Morbihan. Il est l’un des saints fondateurs de la Bretagne chrétienne.',
    },
  ],
  '01-30': [
    {
      name: 'Sainte Bathilde',
      title: 'reine',
      rank: 'martyrologe',
      life: 'Jeune esclave anglo-saxonne devenue reine des Francs par son mariage avec Clovis II, elle a racheté des captifs et fondé l’abbaye de Chelles, où elle a fini sa vie comme simple moniale. Morte vers 680.',
    },
  ],
  '01-31': [
    {
      name: 'Saint Jean Bosco',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Prêtre à Turin au XIXe siècle, il a accueilli les jeunes des rues par la confiance et la joie plutôt que par la punition. Il a fondé les Salésiens et, avec Marie-Dominique Mazzarello, les Filles de Marie-Auxiliatrice. Mort en 1888.',
    },
  ],
  // Février
  '02-01': [
    {
      name: 'Sainte Brigitte de Kildare',
      title: 'abbesse',
      rank: 'martyrologe',
      life: 'Avec Patrick, elle est la grande sainte de l’Irlande. Au VIe siècle, elle a fondé à Kildare un double monastère, d’hommes et de femmes, réputé pour son hospitalité.',
    },
  ],
  '02-02': [
    {
      name: 'Présentation du Seigneur au Temple',
      rank: 'fete',
      lord: true,
      life: 'Quarante jours après Noël, Marie et Joseph présentent Jésus au Temple. Le vieillard Syméon le reconnaît : « lumière pour éclairer les nations ». D’où les cierges de la Chandeleur. C’est aussi la journée de la vie consacrée.',
    },
  ],
  '02-03': [
    {
      name: 'Saint Blaise',
      title: 'évêque et martyr',
      rank: 'facultative',
      life: 'Évêque de Sébaste, en Arménie, martyr au début du IVe siècle. La tradition raconte qu’il sauva un enfant qui s’étouffait avec une arête : on bénit les gorges ce jour-là.',
    },
    {
      name: 'Saint Anschaire',
      title: 'évêque',
      rank: 'facultative',
      life: 'Moine de Corbie, il a annoncé l’Évangile au Danemark et en Suède au IXe siècle. Archevêque de Hambourg, il est appelé l’« apôtre du Nord ». Mort en 865.',
    },
  ],
  '02-04': [
    {
      name: 'Sainte Jeanne de France',
      title: 'reine, fondatrice',
      rank: 'martyrologe',
      life: 'Fille de Louis XI, mariée de force au futur Louis XII qui fit annuler leur union, elle a fondé à Bourges l’ordre de l’Annonciade, pour imiter les vertus de Marie. Morte en 1505.',
    },
  ],
  '02-05': [
    {
      name: 'Sainte Agathe',
      title: 'vierge et martyre',
      rank: 'memoire',
      life: 'Jeune chrétienne de Catane, en Sicile, martyrisée vers 251 pour être restée fidèle au Christ. Son nom est cité dans la première prière eucharistique.',
    },
  ],
  '02-06': [
    {
      name: 'Saint Paul Miki et ses compagnons',
      title: 'martyrs',
      rank: 'memoire',
      life: 'Le 5 février 1597, à Nagasaki, vingt-six chrétiens — jésuites japonais comme Paul Miki, franciscains, laïcs et enfants — sont crucifiés. Paul Miki a pardonné à ses bourreaux depuis la croix.',
    },
  ],
  '02-07': [
    {
      name: 'Bienheureuse Rosalie Rendu',
      title: 'fille de la Charité',
      rank: 'martyrologe',
      life: 'Pendant cinquante ans, sœur Rosalie a servi les pauvres du quartier Mouffetard à Paris, pendant les épidémies de choléra et les barricades de 1848. Elle a guidé Frédéric Ozanam. Morte en 1856.',
    },
  ],
  '02-08': [
    {
      name: 'Sainte Joséphine Bakhita',
      title: 'vierge',
      rank: 'facultative',
      life: 'Enlevée enfant au Soudan et vendue comme esclave, elle découvre le Christ en Italie et devient religieuse canossienne. Elle disait du Seigneur : « Il est mon Maître. » Morte en 1947.',
    },
    {
      name: 'Saint Jérôme Émilien',
      title: 'fondateur',
      rank: 'facultative',
      life: 'Officier vénitien converti en captivité, il s’est consacré aux orphelins et aux malades et a fondé les Somasques. Mort en soignant des pestiférés en 1537.',
    },
  ],
  '02-09': [
    {
      name: 'Sainte Apolline',
      title: 'vierge et martyre',
      rank: 'martyrologe',
      life: 'Diaconesse âgée d’Alexandrie, martyrisée vers 249 lors d’une émeute contre les chrétiens. On lui brisa les dents : elle est invoquée contre les maux de dents.',
    },
  ],
  '02-10': [
    {
      name: 'Sainte Scholastique',
      title: 'vierge',
      rank: 'memoire',
      life: 'Sœur de saint Benoît, consacrée à Dieu près du Mont-Cassin. Saint Grégoire raconte que, par sa prière, elle obtint un orage pour prolonger une dernière conversation spirituelle avec son frère.',
    },
  ],
  '02-11': [
    {
      name: 'Notre-Dame de Lourdes',
      rank: 'facultative',
      life: 'Le 11 février 1858, la Vierge apparaît à Bernadette Soubirous dans la grotte de Massabielle ; elle se nomme « l’Immaculée Conception ». C’est la Journée mondiale du malade.',
    },
  ],
  '02-12': [
    {
      name: 'Sainte Eulalie de Barcelone',
      title: 'vierge et martyre',
      rank: 'martyrologe',
      life: 'Jeune martyre de Barcelone au début du IVe siècle, sous Dioclétien. Elle est la patronne de la ville.',
    },
  ],
  '02-13': [
    {
      name: 'Bienheureux Jourdain de Saxe',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Successeur de saint Dominique à la tête des Prêcheurs, il a attiré des centaines d’étudiants dans l’ordre. Ses lettres à la bienheureuse Diane d’Andalò sont célèbres. Mort en mer en 1237.',
    },
  ],
  '02-14': [
    {
      name: 'Saints Cyrille et Méthode',
      title: 'patrons de l’Europe',
      rank: 'fete',
      life: 'Deux frères de Thessalonique, envoyés au IXe siècle chez les Slaves de Moravie. Ils ont traduit la liturgie et les Écritures dans leur langue, en inventant un alphabet. Jean-Paul II les a faits patrons de l’Europe.',
    },
  ],
  '02-15': [
    {
      name: 'Saint Claude La Colombière',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Jésuite, confesseur de sainte Marguerite-Marie à Paray-le-Monial, il l’a soutenue et a fait connaître le message du Sacré-Cœur. Mort en 1682.',
    },
  ],
  '02-16': [
    {
      name: 'Saint Onésime',
      title: 'disciple de saint Paul',
      rank: 'martyrologe',
      life: 'Esclave en fuite, il rencontre Paul en prison et devient chrétien. Paul le renvoie à son maître Philémon « comme un frère bien-aimé » : c’est la lettre à Philémon.',
    },
  ],
  '02-17': [
    {
      name: 'Les sept saints fondateurs des Servites de Marie',
      rank: 'facultative',
      life: 'Sept marchands de Florence qui, vers 1233, ont tout quitté pour vivre en frères au service de la Vierge, au mont Senario. Ils ont fondé l’ordre des Servites.',
    },
  ],
  '02-18': [
    {
      name: 'Sainte Bernadette Soubirous',
      title: 'vierge',
      rank: 'facultative',
      life: 'Fille d’un meunier pauvre de Lourdes, elle a vu la Vierge dix-huit fois en 1858. Entrée chez les sœurs de la Charité de Nevers, elle y a vécu cachée et malade. Morte en 1879.',
    },
  ],
  '02-19': [
    {
      name: 'Saint Conrad de Plaisance',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Noble de Plaisance, il provoqua par accident un incendie dont un innocent fut accusé ; il se dénonça, paya, et partit vivre en ermite franciscain en Sicile. Mort en 1351.',
    },
  ],
  '02-20': [
    {
      name: 'Saints François et Jacinthe Marto',
      rank: 'martyrologe',
      life: 'Avec leur cousine Lucie, ces deux enfants ont vu la Vierge à Fatima en 1917. Ils ont prié et offert leurs souffrances pour la conversion des pécheurs, et sont morts de la grippe espagnole. Les plus jeunes saints non martyrs.',
    },
  ],
  '02-21': [
    {
      name: 'Saint Pierre Damien',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Moine camaldule, cardinal-évêque d’Ostie au XIe siècle, il a lutté pour la réforme du clergé. Mort en 1072.',
    },
  ],
  '02-22': [
    {
      name: 'La Chaire de saint Pierre',
      title: 'apôtre',
      rank: 'fete',
      life: 'La « chaire » est le siège de l’évêque. L’Église rend grâce pour la mission confiée à Pierre : « Tu es Pierre, et sur cette pierre je bâtirai mon Église. »',
    },
  ],
  '02-23': [
    {
      name: 'Saint Polycarpe',
      title: 'évêque et martyr',
      rank: 'memoire',
      life: 'Disciple de l’apôtre Jean, évêque de Smyrne, brûlé vers 155. Sommé de renier le Christ, il répondit : « Voilà quatre-vingt-six ans que je le sers, et il ne m’a fait aucun mal. »',
    },
  ],
  '02-24': [
    {
      name: 'Saint Éthelbert',
      title: 'roi de Kent',
      rank: 'martyrologe',
      life: 'Roi de Kent, il a accueilli en 597 le moine Augustin envoyé par le pape Grégoire, et a reçu le baptême : premier roi anglo-saxon chrétien.',
    },
  ],
  '02-25': [
    {
      name: 'Sainte Walburge',
      title: 'abbesse',
      rank: 'martyrologe',
      life: 'Moniale anglaise venue en Germanie aider saint Boniface au VIIIe siècle, abbesse de Heidenheim. Morte en 779.',
    },
  ],
  '02-26': [
    {
      name: 'Saint Porphyre de Gaza',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Ermite puis évêque de Gaza vers 395, il a annoncé l’Évangile dans une ville encore païenne. Mort en 420.',
    },
  ],
  '02-27': [
    {
      name: 'Saint Grégoire de Narek',
      title: 'abbé et docteur de l’Église',
      rank: 'facultative',
      life: 'Moine arménien du Xe siècle, auteur du Livre des lamentations, une longue prière où l’homme pécheur se tourne vers la miséricorde de Dieu. François l’a déclaré docteur de l’Église en 2015.',
    },
  ],
  '02-28': [
    {
      name: 'Saint Romain du Jura',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Au Ve siècle, il se retire dans les forêts du Jura, rejoint par son frère Lupicin. Ils fondent Condat, l’abbaye d’où naîtra Saint-Claude.',
    },
  ],
  '02-29': [
    {
      name: 'Saint Auguste Chapdelaine',
      title: 'prêtre et martyr',
      rank: 'martyrologe',
      life: 'Prêtre normand des Missions étrangères de Paris, il a annoncé l’Évangile dans le Guangxi, en Chine, où il a été torturé et mis à mort le 29 février 1856.',
    },
  ],
  // Mars
  '03-01': [
    {
      name: 'Saint Aubin d’Angers',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine devenu évêque d’Angers au VIe siècle, il a racheté des captifs et défendu les pauvres. Mort vers 550.',
    },
  ],
  '03-02': [
    {
      name: 'Bienheureux Charles le Bon',
      title: 'comte de Flandre',
      rank: 'martyrologe',
      life: 'Comte de Flandre, il a nourri son peuple pendant la famine de 1125 et lutté contre l’usure. Il a été assassiné en prière dans une église de Bruges en 1127.',
    },
  ],
  '03-03': [
    {
      name: 'Saint Guénolé',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Disciple de saint Budoc, il a fondé au VIe siècle l’abbaye de Landévennec, en Bretagne, au fond de la rade de Brest.',
    },
  ],
  '03-04': [
    {
      name: 'Saint Casimir',
      rank: 'facultative',
      life: 'Prince de Pologne, fils du roi, il a vécu dans la prière, la chasteté et le service des pauvres. Mort de la tuberculose à 25 ans en 1484. Patron de la Lituanie.',
    },
  ],
  '03-05': [
    {
      name: 'Saint Jean-Joseph de la Croix',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Franciscain né à Ischia, il a conduit la réforme de son ordre dans le royaume de Naples avec douceur et austérité. Mort en 1734.',
    },
  ],
  '03-06': [
    {
      name: 'Sainte Colette',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Née à Corbie, recluse puis clarisse, elle a réformé l’ordre de sainte Claire au XVe siècle et fondé ou restauré dix-sept monastères. Morte à Gand en 1447.',
    },
  ],
  '03-07': [
    {
      name: 'Saintes Perpétue et Félicité',
      title: 'martyres',
      rank: 'memoire',
      life: 'Une jeune mère noble et son esclave enceinte, catéchumènes à Carthage, livrées aux bêtes en 203. Le récit de leur captivité, écrit en partie par Perpétue, est l’un des plus anciens textes de femme chrétienne.',
    },
  ],
  '03-08': [
    {
      name: 'Saint Jean de Dieu',
      title: 'religieux',
      rank: 'facultative',
      life: 'Ancien soldat portugais converti par un sermon de Jean d’Avila, il a ouvert à Grenade un hôpital pour les pauvres et les malades mentaux. Ses compagnons sont devenus les Frères hospitaliers. Mort en 1550.',
    },
  ],
  '03-09': [
    {
      name: 'Sainte Françoise Romaine',
      title: 'religieuse',
      rank: 'facultative',
      life: 'Épouse et mère dans la Rome du XVe siècle, elle a servi les malades et les pauvres pendant les épidémies et fondé une communauté d’oblates. Morte en 1440.',
    },
  ],
  '03-10': [
    {
      name: 'Saint Jean Ogilvie',
      title: 'prêtre et martyr',
      rank: 'martyrologe',
      life: 'Jésuite écossais revenu clandestinement dans son pays, il a été pendu à Glasgow en 1615 pour avoir refusé de reconnaître l’autorité du roi sur l’Église.',
    },
  ],
  '03-11': [
    {
      name: 'Saint Euloge de Cordoue',
      title: 'prêtre et martyr',
      rank: 'martyrologe',
      life: 'Prêtre de Cordoue sous la domination musulmane, il a soutenu les chrétiens persécutés et écrit leur histoire avant d’être décapité en 859.',
    },
  ],
  '03-12': [
    {
      name: 'Saint Maximilien de Tébessa',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Fils d’un vétéran, appelé à l’armée en 295 en Numidie, il refusa de servir en déclarant : « Je suis chrétien. » Il fut décapité à vingt et un ans.',
    },
  ],
  '03-13': [
    {
      name: 'Saints Rodrigue et Salomon',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Un prêtre et un laïc, décapités ensemble à Cordoue en 857, pendant la persécution racontée par saint Euloge.',
    },
  ],
  '03-14': [
    {
      name: 'Sainte Mathilde',
      title: 'reine',
      rank: 'martyrologe',
      life: 'Épouse du roi de Germanie Henri Ier, mère de l’empereur Otton Ier, elle a fondé des monastères et donné largement aux pauvres. Morte en 968.',
    },
  ],
  '03-15': [
    {
      name: 'Saint Clément-Marie Hofbauer',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Ancien apprenti boulanger morave devenu rédemptoriste, il a fondé des œuvres à Varsovie puis animé le renouveau catholique à Vienne. Mort en 1820.',
    },
  ],
  '03-16': [
    {
      name: 'Saint Héribert de Cologne',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Chancelier de l’empereur Otton III puis archevêque de Cologne, il a fondé l’abbaye de Deutz et secouru son peuple pendant une famine. Mort en 1021.',
    },
  ],
  '03-17': [
    {
      name: 'Saint Patrice',
      title: 'évêque',
      rank: 'facultative',
      life: 'Enlevé adolescent en Bretagne insulaire et réduit en esclavage en Irlande, il s’en échappe, devient prêtre et revient évangéliser l’île au Ve siècle. Patron de l’Irlande.',
    },
  ],
  '03-18': [
    {
      name: 'Saint Cyrille de Jérusalem',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Évêque de Jérusalem au IVe siècle, plusieurs fois exilé. Ses catéchèses aux futurs baptisés expliquent le Credo et les sacrements de l’initiation. Mort en 387.',
    },
  ],
  '03-19': [
    {
      name: 'Saint Joseph',
      title: 'époux de la Vierge Marie',
      rank: 'solennite',
      feast: 'Saint Joseph',
      life: 'L’homme juste à qui Dieu a confié Marie et Jésus. Silencieux dans l’Évangile, il obéit aux songes, protège sa famille et transmet son métier. Patron de l’Église universelle.',
    },
  ],
  '03-20': [
    {
      name: 'Saint Cuthbert',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Berger devenu moine de Melrose puis évêque de Lindisfarne au VIIe siècle, il a parcouru à pied les villages du nord de l’Angleterre. Mort en ermite en 687.',
    },
  ],
  '03-21': [
    {
      name: 'Saint Nicolas de Flüe',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Paysan, juge et père de dix enfants, il se retire avec l’accord de sa femme dans un ermitage du Ranft. Ses conseils ont évité une guerre entre cantons suisses en 1481. Patron de la Suisse.',
    },
  ],
  '03-22': [
    {
      name: 'Sainte Léa',
      title: 'veuve',
      rank: 'martyrologe',
      life: 'Veuve romaine du IVe siècle qui a choisi une vie de prière et de pauvreté dans une communauté de femmes. Saint Jérôme a fait son éloge.',
    },
  ],
  '03-23': [
    {
      name: 'Saint Turibio de Mogrovejo',
      title: 'évêque',
      rank: 'facultative',
      life: 'Juriste espagnol nommé archevêque de Lima en 1580, il a parcouru à pied son immense diocèse, appris les langues indiennes et défendu les autochtones. Mort en 1606.',
    },
  ],
  '03-24': [
    {
      name: 'Sainte Catherine de Suède',
      title: 'religieuse',
      rank: 'martyrologe',
      life: 'Fille de sainte Brigitte, elle l’a accompagnée à Rome et en pèlerinage, puis a dirigé le monastère de Vadstena fondé par sa mère. Morte en 1381.',
    },
  ],
  '03-25': [
    {
      name: 'Annonciation du Seigneur',
      rank: 'solennite',
      feast: 'Annonciation du Seigneur',
      life: 'L’ange Gabriel annonce à Marie qu’elle sera la mère du Fils de Dieu. « Voici la servante du Seigneur ; que tout m’advienne selon ta parole. » Le Verbe se fait chair, neuf mois avant Noël.',
    },
  ],
  '03-26': [
    {
      name: 'Saint Ludger',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Frison formé à York, il a annoncé l’Évangile en Frise et en Saxe et est devenu le premier évêque de Münster. Mort en 809.',
    },
  ],
  '03-27': [
    {
      name: 'Saint Jean d’Égypte',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Ermite de Lycopolis au IVe siècle, reclus pendant des décennies, consulté pour ses conseils et ses prophéties, jusque par l’empereur Théodose.',
    },
  ],
  '03-28': [
    {
      name: 'Saint Gontran',
      title: 'roi',
      rank: 'martyrologe',
      life: 'Roi de Burgondie au VIe siècle, petit-fils de Clovis, il a fait pénitence de ses fautes, fondé des églises et protégé les pauvres. Mort en 592.',
    },
  ],
  '03-29': [
    {
      name: 'Saint Eustase',
      title: 'abbé de Luxeuil',
      rank: 'martyrologe',
      life: 'Disciple de saint Colomban, il lui a succédé à la tête de l’abbaye de Luxeuil, d’où sont partis de nombreux fondateurs de monastères. Mort en 629.',
    },
  ],
  '03-30': [
    {
      name: 'Saint Jean Climaque',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Abbé du monastère du Sinaï au VIIe siècle, auteur de L’Échelle sainte, trente marches pour monter vers Dieu. Un classique de la vie spirituelle en Orient.',
    },
  ],
  '03-31': [
    {
      name: 'Saint Benjamin',
      title: 'diacre et martyr',
      rank: 'martyrologe',
      life: 'Diacre en Perse, emprisonné puis relâché à condition de se taire, il continua d’annoncer le Christ et fut mis à mort vers 424.',
    },
  ],
  // Avril
  '04-01': [
    {
      name: 'Saint Hugues de Grenoble',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Grenoble pendant cinquante ans, réformateur de son diocèse, il a accueilli saint Bruno et ses compagnons et les a conduits dans le désert de Chartreuse en 1084. Mort en 1132.',
    },
  ],
  '04-02': [
    {
      name: 'Saint François de Paule',
      title: 'ermite',
      rank: 'facultative',
      life: 'Ermite de Calabre, fondateur des Minimes, voués à l’humilité et à un carême perpétuel. Louis XI le fit venir en France ; il mourut à Plessis-lès-Tours en 1507.',
    },
  ],
  '04-03': [
    {
      name: 'Saint Richard de Chichester',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Chichester au XIIIe siècle, il vivait simplement et donnait tout aux pauvres. On lui attribue la prière : « Te connaître plus clairement, t’aimer plus tendrement, te suivre de plus près. »',
    },
  ],
  '04-04': [
    {
      name: 'Saint Isidore de Séville',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Évêque de Séville au VIIe siècle, il a rassemblé le savoir de l’Antiquité dans ses Étymologies, une encyclopédie lue pendant tout le Moyen Âge. Mort en 636.',
    },
  ],
  '04-05': [
    {
      name: 'Saint Vincent Ferrier',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Dominicain de Valence, prédicateur infatigable, il a parcouru l’Europe pendant vingt ans en appelant à la conversion. Mort à Vannes en 1419, où il repose.',
    },
  ],
  '04-06': [
    {
      name: 'Saint Marcellin de Carthage',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Haut fonctionnaire impérial et ami de saint Augustin, qui lui dédia La Cité de Dieu. Il a présidé la conférence de Carthage de 411 et a été exécuté injustement en 413.',
    },
  ],
  '04-07': [
    {
      name: 'Saint Jean-Baptiste de La Salle',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Chanoine de Reims, il a renoncé à sa fortune pour fonder les Frères des écoles chrétiennes et ouvrir des écoles gratuites aux enfants pauvres. Patron des éducateurs. Mort en 1719.',
    },
  ],
  '04-08': [
    {
      name: 'Sainte Julie Billiart',
      title: 'vierge, fondatrice',
      rank: 'martyrologe',
      life: 'Paralysée pendant vingt-deux ans, cachée pendant la Révolution, elle a fondé à Amiens les Sœurs de Notre-Dame pour l’éducation des filles. Morte à Namur en 1816.',
    },
  ],
  '04-09': [
    {
      name: 'Sainte Marie, femme de Cléophas',
      rank: 'martyrologe',
      life: 'Présente au pied de la croix avec la mère de Jésus et Marie Madeleine (Jean 19, 25), elle fait partie des femmes qui ont suivi Jésus jusqu’au tombeau.',
    },
  ],
  '04-10': [
    {
      name: 'Saint Fulbert de Chartres',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Maître de l’école de Chartres puis évêque vers l’an 1000, il a fait rebâtir la cathédrale après un incendie et répandu la dévotion mariale. Mort en 1028.',
    },
  ],
  '04-11': [
    {
      name: 'Saint Stanislas',
      title: 'évêque et martyr',
      rank: 'memoire',
      life: 'Évêque de Cracovie, il a reproché au roi Boleslas II sa conduite et a été mis à mort sur son ordre en 1079. Patron de la Pologne.',
    },
  ],
  '04-12': [
    {
      name: 'Saint Jules Ier',
      title: 'pape',
      rank: 'martyrologe',
      life: 'Pape de 337 à 352, il a accueilli et défendu saint Athanase, exilé pour sa fidélité à la foi de Nicée.',
    },
  ],
  '04-13': [
    {
      name: 'Saint Martin Ier',
      title: 'pape et martyr',
      rank: 'facultative',
      life: 'Pape au VIIe siècle, il a condamné le monothélisme, une erreur sur la volonté humaine du Christ. Arrêté par l’empereur de Byzance, il est mort en exil en Crimée en 655.',
    },
  ],
  '04-14': [
    {
      name: 'Sainte Lydwine de Schiedam',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Après une chute sur la glace à quinze ans, cette Hollandaise est restée alitée pendant trente-huit ans, offrant ses souffrances en union avec le Christ. Morte en 1433.',
    },
  ],
  '04-15': [
    {
      name: 'Saint Damien de Molokai',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Prêtre belge des Sacrés-Cœurs, il a rejoint en 1873 les lépreux relégués sur l’île de Molokai, à Hawaï. Devenu lépreux à son tour, il est mort parmi eux en 1889.',
    },
  ],
  '04-16': [
    {
      name: 'Saint Benoît-Joseph Labre',
      title: 'pèlerin',
      rank: 'martyrologe',
      life: 'Artésien refusé par plusieurs monastères, il a vécu en pèlerin mendiant sur les routes d’Europe, puis à Rome, en prière devant le Saint-Sacrement. Mort en 1783.',
    },
  ],
  '04-17': [
    {
      name: 'Sainte Kateri Tekakwitha',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Jeune Mohawk baptisée en 1676 malgré l’hostilité des siens, elle s’est réfugiée près de Montréal pour vivre sa foi. Morte à vingt-quatre ans en 1680, première sainte autochtone d’Amérique du Nord.',
    },
  ],
  '04-18': [
    {
      name: 'Bienheureuse Marie de l’Incarnation (Madame Acarie)',
      rank: 'martyrologe',
      life: 'Mère de six enfants, son salon parisien était un foyer spirituel. Elle a fait venir les carmélites thérésiennes en France en 1604, puis est entrée elle-même au Carmel après son veuvage. Morte en 1618.',
    },
  ],
  '04-19': [
    {
      name: 'Saint Léon IX',
      title: 'pape',
      rank: 'martyrologe',
      life: 'Alsacien, évêque de Toul puis pape de 1049 à 1054, il a parcouru l’Europe pour réformer l’Église et combattre la simonie.',
    },
  ],
  '04-20': [
    {
      name: 'Sainte Agnès de Montepulciano',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Entrée au monastère à neuf ans, abbesse à quinze, elle a fondé un couvent dominicain à Montepulciano. Morte en 1317.',
    },
  ],
  '04-21': [
    {
      name: 'Saint Anselme',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Moine du Bec en Normandie puis archevêque de Cantorbéry, il a défini la théologie comme « la foi qui cherche à comprendre ». Mort en 1109.',
    },
  ],
  '04-22': [
    {
      name: 'Saint Épipode',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Jeune chrétien de Lyon, martyrisé avec son ami Alexandre vers 178, peu après Pothin et Blandine.',
    },
  ],
  '04-23': [
    {
      name: 'Saint Georges',
      title: 'martyr',
      rank: 'facultative',
      life: 'Martyr de Lydda, en Palestine, vers 303. La légende en a fait le chevalier vainqueur du dragon, image du combat contre le mal.',
    },
    {
      name: 'Saint Adalbert',
      title: 'évêque et martyr',
      rank: 'facultative',
      life: 'Évêque de Prague, il est parti annoncer l’Évangile aux Prussiens, qui l’ont tué en 997.',
    },
  ],
  '04-24': [
    {
      name: 'Saint Fidèle de Sigmaringen',
      title: 'prêtre et martyr',
      rank: 'facultative',
      life: 'Avocat devenu capucin, surnommé l’avocat des pauvres, il a été tué en 1622 lors d’une mission dans les Grisons.',
    },
  ],
  '04-25': [
    {
      name: 'Saint Marc',
      title: 'évangéliste',
      rank: 'fete',
      life: 'Compagnon de Paul et de Barnabé, puis de Pierre à Rome. Son Évangile, le plus bref, transmet la prédication de Pierre. Son symbole est le lion.',
    },
  ],
  '04-26': [
    {
      name: 'Saint Clet',
      title: 'pape et martyr',
      rank: 'martyrologe',
      life: 'Troisième évêque de Rome après Pierre et Lin, à la fin du Ier siècle. Son nom est cité dans la première prière eucharistique.',
    },
  ],
  '04-27': [
    {
      name: 'Sainte Zita',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Servante pendant quarante-huit ans dans une famille de Lucques au XIIIe siècle, patiente et généreuse envers les pauvres. Patronne des employés de maison.',
    },
  ],
  '04-28': [
    {
      name: 'Saint Louis-Marie Grignion de Montfort',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Missionnaire dans l’Ouest de la France, il a prêché le chapelet et la consécration à Jésus par Marie (Traité de la vraie dévotion). Fondateur des Montfortains et des Filles de la Sagesse. Mort en 1716.',
    },
    {
      name: 'Saint Pierre Chanel',
      title: 'prêtre et martyr',
      rank: 'facultative',
      life: 'Mariste de l’Ain, missionnaire à Futuna, il y a été tué en 1841. Peu après, l’île entière a demandé le baptême. Premier martyr d’Océanie.',
    },
  ],
  '04-29': [
    {
      name: 'Sainte Catherine de Sienne',
      title: 'vierge et docteur de l’Église, patronne de l’Europe',
      rank: 'fete',
      life: 'Laïque dominicaine, mystique, elle a soigné les pestiférés et écrit aux papes pour les presser de quitter Avignon pour Rome. Son Dialogue est une grande œuvre spirituelle. Morte à 33 ans en 1380.',
    },
  ],
  '04-30': [
    {
      name: 'Saint Pie V',
      title: 'pape',
      rank: 'facultative',
      life: 'Dominicain élu pape en 1566, il a mis en œuvre le concile de Trente : catéchisme, missel et bréviaire. Il a confié au Rosaire la victoire de Lépante. Mort en 1572.',
    },
  ],
  // Mai
  '05-01': [
    {
      name: 'Saint Joseph, travailleur',
      rank: 'facultative',
      life: 'Instituée par Pie XII en 1955, cette mémoire présente le charpentier de Nazareth comme modèle du travail humain, qui participe à l’œuvre de Dieu.',
    },
  ],
  '05-02': [
    {
      name: 'Saint Athanase',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Évêque d’Alexandrie au IVe siècle, il a défendu la foi de Nicée — le Fils est Dieu comme le Père — au prix de cinq exils. Mort en 373.',
    },
  ],
  '05-03': [
    {
      name: 'Saints Philippe et Jacques',
      title: 'apôtres',
      rank: 'fete',
      life: 'Philippe, de Bethsaïde, demanda : « Montre-nous le Père. » Jacques, fils d’Alphée, est identifié par la tradition latine au « frère du Seigneur », responsable de l’Église de Jérusalem.',
    },
  ],
  '05-04': [
    {
      name: 'Saint Florian',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Officier romain du Norique, noyé dans l’Enns vers 304 pour avoir soutenu les chrétiens. Patron des pompiers.',
    },
  ],
  '05-05': [
    {
      name: 'Saint Hilaire d’Arles',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine de Lérins devenu évêque d’Arles au Ve siècle, il travaillait de ses mains pour nourrir les pauvres et racheter des captifs. Mort en 449.',
    },
  ],
  '05-06': [
    {
      name: 'Saint François de Laval',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Né à Montigny-sur-Avre, premier évêque de Québec en 1674, il a fondé le séminaire de Québec et défendu les Amérindiens contre le trafic d’alcool. Mort en 1708.',
    },
  ],
  '05-07': [
    {
      name: 'Sainte Rose Venerini',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'À Viterbe, en 1685, elle a ouvert l’une des premières écoles publiques pour filles en Italie et fondé les Maîtresses pies Venerini. Morte en 1728.',
    },
  ],
  '05-08': [
    {
      name: 'Saint Désiré de Bourges',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Conseiller des rois francs puis évêque de Bourges au VIe siècle, il a lutté contre les hérésies et défendu les pauvres. Mort vers 550.',
    },
  ],
  '05-09': [
    {
      name: 'Sainte Louise de Marillac',
      title: 'veuve, fondatrice',
      rank: 'facultative',
      life: 'Veuve, guidée par saint Vincent de Paul, elle a fondé avec lui en 1633 les Filles de la Charité, au service des pauvres et des malades. Morte en 1660.',
    },
  ],
  '05-10': [
    {
      name: 'Saint Jean d’Avila',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Prédicateur en Andalousie au XVIe siècle, conseiller de Thérèse d’Avila, de Jean de Dieu et de François de Borgia. Patron du clergé espagnol. Mort en 1569.',
    },
  ],
  '05-11': [
    {
      name: 'Saint Mayeul',
      title: 'abbé de Cluny',
      rank: 'martyrologe',
      life: 'Abbé de Cluny au Xe siècle, conseiller des empereurs, il a étendu la réforme clunisienne à de nombreux monastères. Mort en 994.',
    },
  ],
  '05-12': [
    {
      name: 'Saints Nérée et Achille',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Soldats romains convertis, qui ont quitté l’armée et sont morts martyrs, probablement sous Dioclétien.',
    },
    {
      name: 'Saint Pancrace',
      title: 'martyr',
      rank: 'facultative',
      life: 'Adolescent martyrisé à Rome vers 304 et enterré sur la voie Aurélienne.',
    },
  ],
  '05-13': [
    {
      name: 'Notre-Dame de Fatima',
      rank: 'facultative',
      life: 'Le 13 mai 1917, la Vierge apparaît à trois enfants bergers au Portugal et les invite à prier le chapelet pour la paix et la conversion des pécheurs.',
    },
  ],
  '05-14': [
    {
      name: 'Saint Matthias',
      title: 'apôtre',
      rank: 'fete',
      life: 'Disciple depuis le baptême de Jésus, il est choisi par le sort pour remplacer Judas parmi les Douze, comme témoin de la Résurrection (Actes 1).',
    },
  ],
  '05-15': [
    {
      name: 'Saint Isidore le Laboureur',
      rank: 'martyrologe',
      life: 'Paysan de Madrid au XIIe siècle, il commençait ses journées par la messe et partageait le peu qu’il avait. Patron des agriculteurs.',
    },
  ],
  '05-16': [
    {
      name: 'Saint Honoré d’Amiens',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque d’Amiens au VIe siècle. La tradition en a fait le patron des boulangers.',
    },
  ],
  '05-17': [
    {
      name: 'Saint Pascal Baylon',
      title: 'religieux',
      rank: 'martyrologe',
      life: 'Berger aragonais devenu frère franciscain, portier de son couvent, il passait ses nuits en adoration. Patron des congrès eucharistiques. Mort en 1592.',
    },
  ],
  '05-18': [
    {
      name: 'Saint Jean Ier',
      title: 'pape et martyr',
      rank: 'facultative',
      life: 'Envoyé à Constantinople par le roi Théodoric, il fut emprisonné à son retour à Ravenne, où il mourut en 526.',
    },
  ],
  '05-19': [
    {
      name: 'Saint Yves',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Juge d’Église à Rennes avant d’être prêtre, il est ordonné en 1284 pour l’être à Tréguier, où il défend gratuitement les pauvres. Patron de la Bretagne et des avocats. Mort en 1303.',
    },
  ],
  '05-20': [
    {
      name: 'Saint Bernardin de Sienne',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Franciscain, prédicateur populaire dans toute l’Italie au XVe siècle, il faisait vénérer le nom de Jésus, montré sur une tablette avec le monogramme IHS. Mort en 1444.',
    },
  ],
  '05-21': [
    {
      name: 'Saint Christophe Magallanes et ses compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Prêtres et laïcs mexicains tués pendant la persécution des années 1915-1937. Le père Magallanes a pardonné à ses bourreaux avant d’être fusillé en 1927.',
    },
  ],
  '05-22': [
    {
      name: 'Sainte Rita de Cascia',
      title: 'religieuse',
      rank: 'facultative',
      life: 'Épouse d’un homme violent, veuve, elle a obtenu la réconciliation de sa famille avec les meurtriers de son mari, puis est devenue augustine à Cascia. Invoquée pour les causes désespérées. Morte en 1457.',
    },
  ],
  '05-23': [
    {
      name: 'Saint Didier de Vienne',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Évêque de Vienne en Dauphiné, il reprocha sa conduite à la reine Brunehaut et fut assassiné vers 607.',
    },
  ],
  '05-24': [
    {
      name: 'Saints Donatien et Rogatien',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Deux frères de Nantes, l’un baptisé et l’autre catéchumène, martyrisés vers 290. On les appelle les « enfants nantais ».',
    },
  ],
  '05-25': [
    {
      name: 'Saint Bède le Vénérable',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Moine de Jarrow, en Angleterre, il a écrit l’Histoire ecclésiastique du peuple anglais et commenté les Écritures. Mort en 735.',
    },
    {
      name: 'Saint Grégoire VII',
      title: 'pape',
      rank: 'facultative',
      life: 'Pape de 1073 à 1085, il a mené la réforme de l’Église et défendu sa liberté face à l’empereur Henri IV.',
    },
    {
      name: 'Sainte Marie-Madeleine de Pazzi',
      title: 'vierge',
      rank: 'facultative',
      life: 'Carmélite de Florence, mystique, elle a vécu de longues épreuves intérieures dans la confiance. Morte en 1607.',
    },
  ],
  '05-26': [
    {
      name: 'Saint Philippe Néri',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Prêtre florentin à Rome, joyeux et plein d’humour, il a fondé l’Oratoire et attiré les jeunes à la prière et à la musique. L’« apôtre de Rome ». Mort en 1595.',
    },
  ],
  '05-27': [
    {
      name: 'Saint Augustin de Cantorbéry',
      title: 'évêque',
      rank: 'facultative',
      life: 'Moine romain envoyé en Angleterre par Grégoire le Grand en 597, il a baptisé le roi de Kent et fondé le siège de Cantorbéry. Mort vers 605.',
    },
  ],
  '05-28': [
    {
      name: 'Saint Germain de Paris',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Abbé puis évêque de Paris au VIe siècle, il a racheté de nombreux captifs. Il repose à Saint-Germain-des-Prés. Mort en 576.',
    },
  ],
  '05-29': [
    {
      name: 'Saint Paul VI',
      title: 'pape',
      rank: 'facultative',
      life: 'Pape de 1963 à 1978, il a conduit et appliqué le concile Vatican II, voyagé sur tous les continents et écrit Humanae vitae et Evangelii nuntiandi.',
    },
  ],
  '05-30': [
    {
      name: 'Sainte Jeanne d’Arc',
      title: 'vierge, patronne secondaire de la France',
      rank: 'memoire',
      life: 'Jeune paysanne de Domrémy, appelée par des voix, elle a délivré Orléans et fait sacrer Charles VII à Reims. Condamnée par un tribunal d’Église, elle est brûlée à Rouen en 1431, à dix-neuf ans, en invoquant le nom de Jésus.',
    },
  ],
  '05-31': [
    {
      name: 'Visitation de la Vierge Marie',
      rank: 'fete',
      life: 'Marie se rend en hâte chez sa cousine Élisabeth ; Jean-Baptiste tressaille dans le sein de sa mère. Marie chante le Magnificat : « Mon âme exalte le Seigneur. »',
    },
  ],
  // Juin
  '06-01': [
    {
      name: 'Saint Justin',
      title: 'martyr',
      rank: 'memoire',
      life: 'Philosophe de Naplouse, converti après avoir cherché la vérité dans toutes les écoles. Il a écrit la plus ancienne description de la messe du dimanche. Décapité à Rome vers 165.',
    },
  ],
  '06-02': [
    {
      name: 'Saints Pothin, Blandine et leurs compagnons',
      title: 'martyrs de Lyon',
      rank: 'facultative',
      life: 'En 177, l’évêque Pothin, âgé de plus de quatre-vingt-dix ans, et une quarantaine de chrétiens de Lyon sont mis à mort. L’esclave Blandine, livrée aux bêtes, encourageait les autres jusqu’au bout.',
    },
    {
      name: 'Saints Marcellin et Pierre',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Un prêtre et un exorciste de Rome, décapités en 304. Leurs noms sont cités dans la première prière eucharistique.',
    },
  ],
  '06-03': [
    {
      name: 'Saint Charles Lwanga et ses compagnons',
      title: 'martyrs',
      rank: 'memoire',
      life: 'Jeunes pages du roi du Buganda, catholiques et anglicans, brûlés vifs en 1886 à Namugongo pour leur foi et pour avoir refusé les avances du roi.',
    },
  ],
  '06-04': [
    {
      name: 'Sainte Clotilde',
      title: 'reine',
      rank: 'facultative',
      life: 'Princesse burgonde, épouse de Clovis, elle a prié pour sa conversion et l’a conduit au baptême. Veuve, elle s’est retirée à Tours. Morte en 545.',
    },
  ],
  '06-05': [
    {
      name: 'Saint Boniface',
      title: 'évêque et martyr',
      rank: 'memoire',
      life: 'Moine anglais, « apôtre de la Germanie », il a organisé l’Église en Allemagne au VIIIe siècle et fondé l’abbaye de Fulda. Tué en Frise en 754.',
    },
  ],
  '06-06': [
    {
      name: 'Saint Norbert',
      title: 'évêque',
      rank: 'facultative',
      life: 'Chanoine mondain converti, il a fondé à Prémontré, près de Laon, en 1120, un ordre de chanoines voués à la prédication. Archevêque de Magdebourg, mort en 1134.',
    },
  ],
  '06-07': [
    {
      name: 'Bienheureuse Anne de Saint-Barthélemy',
      title: 'carmélite',
      rank: 'martyrologe',
      life: 'Compagne et infirmière de Thérèse d’Avila, qui mourut dans ses bras, elle a fondé le Carmel thérésien en France puis en Flandre. Morte à Anvers en 1626.',
    },
  ],
  '06-08': [
    {
      name: 'Saint Médard',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Noyon au VIe siècle, il consacra sainte Radegonde. Le dicton en a fait le saint de la pluie : « S’il pleut à la Saint-Médard… »',
    },
  ],
  '06-09': [
    {
      name: 'Saint Éphrem',
      title: 'diacre et docteur de l’Église',
      rank: 'facultative',
      life: 'Diacre d’Édesse au IVe siècle, poète, il a chanté les mystères de la foi et Marie dans des hymnes. On l’a appelé la « harpe de l’Esprit Saint ». Mort en 373.',
    },
  ],
  '06-10': [
    {
      name: 'Saint Landry',
      title: 'évêque de Paris',
      rank: 'martyrologe',
      life: 'Évêque de Paris au VIIe siècle, il vendit les biens de son Église pendant une famine et fonda près de Notre-Dame un hôpital, l’ancêtre de l’Hôtel-Dieu.',
    },
  ],
  '06-11': [
    {
      name: 'Saint Barnabé',
      title: 'apôtre',
      rank: 'memoire',
      life: 'Lévite de Chypre, il vendit son champ pour la communauté, présenta Paul converti aux apôtres et partit avec lui en mission. Son nom signifie « fils de l’encouragement ».',
    },
  ],
  '06-12': [
    {
      name: 'Saint Onuphre',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Ermite du désert d’Égypte au IVe siècle, qui y aurait vécu seul pendant soixante ans dans la prière.',
    },
  ],
  '06-13': [
    {
      name: 'Saint Antoine de Padoue',
      title: 'prêtre et docteur de l’Église',
      rank: 'memoire',
      life: 'Né à Lisbonne, devenu franciscain en voyant les reliques de martyrs, il a prêché en Italie et dans le sud de la France. On l’invoque pour retrouver les objets perdus. Mort à Padoue en 1231.',
    },
  ],
  '06-14': [
    {
      name: 'Saint Élisée',
      title: 'prophète',
      rank: 'martyrologe',
      life: 'Disciple d’Élie, il reçut une double part de son esprit. Le deuxième livre des Rois raconte ses miracles, dont la guérison de Naaman le Syrien.',
    },
  ],
  '06-15': [
    {
      name: 'Sainte Germaine Cousin',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Bergère de Pibrac, près de Toulouse, maltraitée par sa belle-mère, elle priait aux champs et partageait son pain avec les pauvres. Morte à vingt-deux ans en 1601.',
    },
  ],
  '06-16': [
    {
      name: 'Sainte Lutgarde',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Cistercienne du Brabant au XIIIe siècle, mystique, elle a contribué à la dévotion au Cœur de Jésus. Aveugle à la fin de sa vie, morte en 1246.',
    },
  ],
  '06-17': [
    {
      name: 'Saint Hervé',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Moine breton aveugle du VIe siècle, chantre et maître de moines. La tradition le montre guidé par un loup.',
    },
  ],
  '06-18': [
    {
      name: 'Saint Grégoire Barbarigo',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Bergame puis de Padoue au XVIIe siècle, il a appliqué le concile de Trente, fondé un séminaire et une imprimerie. Mort en 1697.',
    },
  ],
  '06-19': [
    {
      name: 'Saint Romuald',
      title: 'abbé',
      rank: 'facultative',
      life: 'Noble de Ravenne devenu moine, il a fondé l’ermitage de Camaldoli au XIe siècle, unissant vie solitaire et vie commune. Mort en 1027.',
    },
  ],
  '06-20': [
    {
      name: 'Saint Silvère',
      title: 'pape et martyr',
      rank: 'martyrologe',
      life: 'Pape en 536, déposé et exilé sur l’île de Palmarola sur l’ordre de l’impératrice Théodora. Il y est mort en 537.',
    },
  ],
  '06-21': [
    {
      name: 'Saint Louis de Gonzague',
      title: 'religieux',
      rank: 'memoire',
      life: 'Héritier d’une grande famille lombarde, il renonce à son titre pour devenir jésuite. Il meurt à vingt-trois ans en 1591, après avoir soigné les malades de la peste à Rome. Patron de la jeunesse.',
    },
  ],
  '06-22': [
    {
      name: 'Saints Jean Fisher et Thomas More',
      title: 'martyrs',
      rank: 'facultative',
      life: 'L’évêque de Rochester et le chancelier d’Angleterre ont refusé de reconnaître Henri VIII comme chef de l’Église. Décapités en 1535. Thomas More est le patron des responsables politiques.',
    },
    {
      name: 'Saint Paulin de Nole',
      title: 'évêque',
      rank: 'facultative',
      life: 'Riche sénateur né à Bordeaux, il a distribué ses biens avec son épouse et s’est installé à Nole, près du tombeau de saint Félix, dont il est devenu évêque. Mort en 431.',
    },
  ],
  '06-23': [
    {
      name: 'Saint Joseph Cafasso',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Prêtre à Turin, formateur de prêtres, il accompagnait les prisonniers et les condamnés à mort. Directeur spirituel de Jean Bosco. Mort en 1860.',
    },
  ],
  '06-24': [
    {
      name: 'Nativité de saint Jean-Baptiste',
      rank: 'solennite',
      life: 'Six mois avant Noël, l’Église fête la naissance du Précurseur. Zacharie, muet depuis l’annonce de l’ange, retrouve la parole : « Son nom est Jean. »',
    },
  ],
  '06-25': [
    {
      name: 'Saint Prosper d’Aquitaine',
      rank: 'martyrologe',
      life: 'Laïc et théologien du Ve siècle, défenseur de la doctrine de saint Augustin sur la grâce. On lui doit l’adage : la loi de la prière fonde la loi de la foi.',
    },
  ],
  '06-26': [
    {
      name: 'Saint Josemaría Escrivá',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Prêtre espagnol, il a fondé l’Opus Dei en 1928 pour rappeler que le travail et la vie ordinaire sont des chemins de sainteté. Mort en 1975.',
    },
  ],
  '06-27': [
    {
      name: 'Saint Cyrille d’Alexandrie',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Patriarche d’Alexandrie, il a défendu au concile d’Éphèse, en 431, l’unité du Christ et le titre de Marie Mère de Dieu. Mort en 444.',
    },
  ],
  '06-28': [
    {
      name: 'Saint Irénée',
      title: 'évêque et martyr, docteur de l’Église',
      rank: 'memoire',
      life: 'Disciple de Polycarpe, évêque de Lyon après Pothin, il a réfuté les gnostiques. « La gloire de Dieu, c’est l’homme vivant. » François l’a déclaré docteur de l’unité en 2022.',
    },
  ],
  '06-29': [
    {
      name: 'Saints Pierre et Paul',
      title: 'apôtres',
      rank: 'solennite',
      life: 'Les deux colonnes de l’Église de Rome, morts martyrs sous Néron : Pierre, le pêcheur à qui Jésus a confié son troupeau, et Paul, l’apôtre des nations.',
    },
  ],
  '06-30': [
    {
      name: 'Les premiers martyrs de l’Église de Rome',
      rank: 'facultative',
      life: 'Après l’incendie de Rome en 64, Néron accuse les chrétiens. Une foule d’entre eux est mise à mort dans les jardins du Vatican, quelques années avant Pierre et Paul.',
    },
  ],
  // Juillet
  '07-01': [
    {
      name: 'Saint Olivier Plunkett',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Archevêque d’Armagh pendant les persécutions contre les catholiques irlandais, accusé d’un faux complot, il a été pendu à Londres en 1681.',
    },
  ],
  '07-02': [
    {
      name: 'Saints Processe et Martinien',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Martyrs romains très anciennement vénérés. La tradition en fait les gardiens de prison de Pierre et Paul, baptisés par eux.',
    },
  ],
  '07-03': [
    {
      name: 'Saint Thomas',
      title: 'apôtre',
      rank: 'fete',
      life: 'Absent le soir de Pâques, il ne voulait croire qu’en touchant les plaies du Christ. Huit jours plus tard, il confesse : « Mon Seigneur et mon Dieu ! » La tradition le dit apôtre de l’Inde.',
    },
  ],
  '07-04': [
    {
      name: 'Sainte Élisabeth de Portugal',
      title: 'reine',
      rank: 'facultative',
      life: 'Reine de Portugal, artisane de paix entre son mari et son fils, généreuse envers les pauvres. Veuve, elle s’est retirée près des clarisses de Coimbra. Morte en 1336.',
    },
  ],
  '07-05': [
    {
      name: 'Saint Antoine-Marie Zaccaria',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Médecin de Crémone devenu prêtre, il a fondé les Barnabites et répandu l’adoration des Quarante-Heures. Mort à trente-six ans en 1539.',
    },
  ],
  '07-06': [
    {
      name: 'Sainte Maria Goretti',
      title: 'vierge et martyre',
      rank: 'facultative',
      life: 'Jeune paysanne de onze ans, poignardée en 1902 en résistant à une agression. Avant de mourir, elle pardonna à son meurtrier, qui se convertit et assista à sa canonisation.',
    },
  ],
  '07-07': [
    {
      name: 'Saint Willibald',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine anglais, pèlerin en Terre sainte, il a rejoint saint Boniface en Germanie et est devenu le premier évêque d’Eichstätt. Frère de sainte Walburge. Mort vers 787.',
    },
  ],
  '07-08': [
    {
      name: 'Saints Aquila et Priscille',
      rank: 'martyrologe',
      life: 'Couple de fabricants de tentes, amis et collaborateurs de saint Paul à Corinthe et à Éphèse, qui accueillaient l’Église dans leur maison (Romains 16, 3-5).',
    },
  ],
  '07-09': [
    {
      name: 'Saint Augustin Zhao Rong et ses compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Cent vingt martyrs de Chine, du XVIIe au XXe siècle, Chinois et missionnaires. Augustin Zhao Rong, soldat converti en escortant un évêque, devint prêtre et mourut en prison en 1815.',
    },
  ],
  '07-10': [
    {
      name: 'Saintes Rufine et Seconde',
      title: 'vierges et martyres',
      rank: 'martyrologe',
      life: 'Deux sœurs romaines martyrisées vers 257 sous l’empereur Valérien, enterrées sur la voie Aurélienne.',
    },
  ],
  '07-11': [
    {
      name: 'Saint Benoît',
      title: 'abbé, patron de l’Europe',
      rank: 'fete',
      life: 'Né à Nursie vers 480, il a fondé le Mont-Cassin. Sa Règle, qui équilibre prière et travail, a façonné le monachisme occidental et la culture de l’Europe. Mort vers 547.',
    },
  ],
  '07-12': [
    {
      name: 'Saints Louis et Zélie Martin',
      title: 'époux',
      rank: 'martyrologe',
      life: 'Horloger et dentellière d’Alençon, parents de neuf enfants dont sainte Thérèse de Lisieux. En 2015, ils sont le premier couple canonisé ensemble.',
    },
  ],
  '07-13': [
    {
      name: 'Saint Henri',
      title: 'empereur',
      rank: 'facultative',
      life: 'Empereur germanique au début du XIe siècle, il a soutenu la réforme de l’Église et fondé l’évêché de Bamberg. Mort en 1024.',
    },
  ],
  '07-14': [
    {
      name: 'Saint Camille de Lellis',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Ancien soldat joueur et bagarreur, converti, il a fondé les Camilliens au service des malades, reconnaissables à leur croix rouge. Mort en 1614.',
    },
  ],
  '07-15': [
    {
      name: 'Saint Bonaventure',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Franciscain, maître à Paris, ministre général de son ordre, il a écrit l’Itinéraire de l’esprit vers Dieu et une vie de saint François. Le « Docteur séraphique ». Mort en 1274.',
    },
  ],
  '07-16': [
    {
      name: 'Notre-Dame du Mont-Carmel',
      rank: 'facultative',
      life: 'Le Carmel, montagne du prophète Élie, a donné son nom aux carmes. Ils honorent Marie comme leur mère et leur sœur ; le scapulaire en est le signe.',
    },
  ],
  '07-17': [
    {
      name: 'Saintes carmélites de Compiègne',
      title: 'martyres',
      rank: 'martyrologe',
      life: 'Seize carmélites guillotinées à Paris le 17 juillet 1794, en chantant le Veni Creator, après s’être offertes pour que cesse la Terreur. Elle s’arrêta dix jours plus tard.',
    },
  ],
  '07-18': [
    {
      name: 'Saint Arnoul de Metz',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Haut dignitaire du royaume d’Austrasie devenu évêque de Metz, il finit sa vie en ermite dans les Vosges, près de Remiremont. Mort vers 640.',
    },
  ],
  '07-19': [
    {
      name: 'Saint Arsène le Grand',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Précepteur des fils de l’empereur Théodose, il quitta la cour pour le désert d’Égypte. Une parole lui fut adressée : « Fuis, tais-toi, demeure en paix. »',
    },
  ],
  '07-20': [
    {
      name: 'Saint Apollinaire',
      title: 'évêque et martyr',
      rank: 'facultative',
      life: 'Premier évêque de Ravenne, honoré comme martyr. La basilique Saint-Apollinaire-in-Classe garde son souvenir.',
    },
  ],
  '07-21': [
    {
      name: 'Saint Laurent de Brindisi',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Capucin, il parlait de nombreuses langues et a prêché dans toute l’Europe à la fin du XVIe siècle. Diplomate au service de la paix. Mort à Lisbonne en 1619.',
    },
  ],
  '07-22': [
    {
      name: 'Sainte Marie-Madeleine',
      title: 'disciple du Seigneur',
      rank: 'fete',
      life: 'Délivrée par Jésus, elle l’a suivi jusqu’à la croix. Au matin de Pâques, il l’appelle par son nom et l’envoie aux disciples : l’« apôtre des apôtres ». François a élevé sa mémoire au rang de fête en 2016.',
    },
  ],
  '07-23': [
    {
      name: 'Sainte Brigitte de Suède',
      title: 'religieuse, patronne de l’Europe',
      rank: 'fete',
      life: 'Épouse et mère de huit enfants, veuve, elle a fondé l’ordre du Très-Saint-Sauveur et appelé le pape à revenir d’Avignon à Rome. Ses révélations ont marqué la piété européenne. Morte en 1373.',
    },
  ],
  '07-24': [
    {
      name: 'Saint Charbel Makhlouf',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Moine maronite du Liban, il a vécu ses vingt-trois dernières années en ermite à Annaya, dans le silence et l’adoration. Mort en 1898.',
    },
  ],
  '07-25': [
    {
      name: 'Saint Jacques le Majeur',
      title: 'apôtre',
      rank: 'fete',
      life: 'Fils de Zébédée et frère de Jean, témoin de la Transfiguration, premier des Douze à mourir martyr, vers 44. Son tombeau à Compostelle attire les pèlerins depuis le IXe siècle.',
    },
  ],
  '07-26': [
    {
      name: 'Saints Joachim et Anne',
      title: 'parents de la Vierge Marie',
      rank: 'memoire',
      life: 'Selon une tradition ancienne, les parents de Marie et les grands-parents de Jésus. Le dimanche le plus proche, c’est la Journée mondiale des grands-parents et des personnes âgées.',
    },
  ],
  '07-27': [
    {
      name: 'Saint Pantaléon',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Médecin de Nicomédie qui soignait sans se faire payer, martyrisé vers 305. Patron des médecins en Orient.',
    },
  ],
  '07-28': [
    {
      name: 'Saint Samson de Dol',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine gallois venu en Armorique au VIe siècle, il a fondé le monastère de Dol. L’un des sept saints fondateurs de la Bretagne.',
    },
  ],
  '07-29': [
    {
      name: 'Saints Marthe, Marie et Lazare',
      rank: 'memoire',
      life: 'Les amis de Béthanie, chez qui Jésus aimait s’arrêter. Marthe le sert, Marie l’écoute, et Lazare est rappelé du tombeau. Marthe confesse : « Tu es le Christ, le Fils de Dieu. »',
    },
  ],
  '07-30': [
    {
      name: 'Saint Pierre Chrysologue',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Évêque de Ravenne au Ve siècle, prédicateur aux sermons brefs et denses, d’où son nom, « parole d’or ». Mort vers 450.',
    },
  ],
  '07-31': [
    {
      name: 'Saint Ignace de Loyola',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Gentilhomme basque blessé à Pampelune, converti en lisant la vie du Christ et des saints, il a écrit les Exercices spirituels et fondé la Compagnie de Jésus. « Tout pour la plus grande gloire de Dieu. » Mort en 1556.',
    },
  ],
  // Août
  '08-01': [
    {
      name: 'Saint Alphonse-Marie de Liguori',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Avocat napolitain devenu prêtre, fondateur des Rédemptoristes pour les campagnes abandonnées, il a enseigné une morale de la miséricorde. Patron des confesseurs. Mort en 1787.',
    },
  ],
  '08-02': [
    {
      name: 'Saint Pierre-Julien Eymard',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Prêtre de La Mure, en Isère, il a fondé les congrégations du Saint-Sacrement pour l’adoration eucharistique et la première communion des adultes. Mort en 1868.',
    },
    {
      name: 'Saint Eusèbe de Verceil',
      title: 'évêque',
      rank: 'facultative',
      life: 'Premier évêque de Verceil, il a vécu en communauté avec ses prêtres et défendu la foi de Nicée, ce qui lui valut l’exil. Mort en 371.',
    },
  ],
  '08-03': [
    {
      name: 'Sainte Lydie',
      rank: 'martyrologe',
      life: 'Marchande de pourpre à Philippes, elle écoute Paul au bord de la rivière : « le Seigneur lui ouvrit le cœur ». Baptisée, elle accueille l’Église dans sa maison, la première en Europe (Actes 16).',
    },
  ],
  '08-04': [
    {
      name: 'Saint Jean-Marie Vianney',
      title: 'curé d’Ars',
      rank: 'memoire',
      life: 'Prêtre de campagne à Ars pendant quarante ans, il passait jusqu’à seize heures par jour au confessionnal. « Le sacerdoce, c’est l’amour du Cœur de Jésus. » Patron des curés. Mort en 1859.',
    },
  ],
  '08-05': [
    {
      name: 'Dédicace de la basilique Sainte-Marie-Majeure',
      rank: 'facultative',
      life: 'Après le concile d’Éphèse, le pape Sixte III dédie à Rome une grande basilique à Marie, Mère de Dieu. La légende parle d’une neige tombée en plein été.',
    },
  ],
  '08-06': [
    {
      name: 'Transfiguration du Seigneur',
      rank: 'fete',
      lord: true,
      life: 'Sur la montagne, devant Pierre, Jacques et Jean, Jésus est transfiguré, entre Moïse et Élie. La voix du Père dit : « Celui-ci est mon Fils bien-aimé : écoutez-le ! »',
    },
  ],
  '08-07': [
    {
      name: 'Saint Sixte II et ses compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Pape surpris par les soldats en 258 alors qu’il prêchait dans les catacombes de Calixte, décapité avec quatre de ses diacres.',
    },
    {
      name: 'Saint Gaëtan',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Prêtre de Vicence, il a fondé les Théatins pour réformer le clergé et ouvert des monts-de-piété pour libérer les pauvres de l’usure. Mort en 1547.',
    },
  ],
  '08-08': [
    {
      name: 'Saint Dominique',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Chanoine castillan, il a prêché en pauvre dans le Languedoc et fondé à Toulouse, en 1215, l’ordre des Prêcheurs. « Parler avec Dieu ou de Dieu. » Mort à Bologne en 1221.',
    },
  ],
  '08-09': [
    {
      name: 'Sainte Thérèse-Bénédicte de la Croix (Édith Stein)',
      title: 'vierge et martyre, patronne de l’Europe',
      rank: 'fete',
      life: 'Philosophe juive allemande, convertie en lisant Thérèse d’Avila, devenue carmélite. Arrêtée aux Pays-Bas, elle est morte à Auschwitz en 1942 avec sa sœur Rosa.',
    },
  ],
  '08-10': [
    {
      name: 'Saint Laurent',
      title: 'diacre et martyr',
      rank: 'fete',
      life: 'Diacre de Rome, chargé des biens de l’Église. Sommé de livrer ses trésors, il présenta les pauvres. Martyrisé en 258, quelques jours après le pape Sixte II.',
    },
  ],
  '08-11': [
    {
      name: 'Sainte Claire',
      title: 'vierge',
      rank: 'memoire',
      life: 'Jeune noble d’Assise, elle a suivi saint François en 1212 et fondé les Pauvres Dames, les clarisses, dans une pauvreté radicale. Morte en 1253.',
    },
  ],
  '08-12': [
    {
      name: 'Sainte Jeanne-Françoise de Chantal',
      title: 'religieuse',
      rank: 'facultative',
      life: 'Baronne bourguignonne, veuve avec quatre enfants, elle a fondé la Visitation avec saint François de Sales à Annecy en 1610. Morte en 1641.',
    },
  ],
  '08-13': [
    {
      name: 'Saints Pontien et Hippolyte',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Le pape Pontien et le prêtre Hippolyte, longtemps opposés, ont été déportés ensemble aux mines de Sardaigne en 235. Ils y sont morts réconciliés.',
    },
  ],
  '08-14': [
    {
      name: 'Saint Maximilien Kolbe',
      title: 'prêtre et martyr',
      rank: 'memoire',
      life: 'Franciscain polonais, fondateur de la Milice de l’Immaculée. À Auschwitz, en 1941, il a pris la place d’un père de famille condamné à mourir de faim.',
    },
  ],
  '08-15': [
    {
      name: 'Assomption de la Vierge Marie',
      rank: 'solennite',
      life: 'Au terme de sa vie terrestre, Marie est élevée corps et âme dans la gloire du ciel. Elle précède l’Église là où nous sommes attendus. Pie XII a défini ce dogme en 1950.',
    },
  ],
  '08-16': [
    {
      name: 'Saint Étienne de Hongrie',
      title: 'roi',
      rank: 'facultative',
      life: 'Premier roi chrétien de Hongrie, couronné en l’an 1000, il a organisé l’Église dans son royaume. Mort en 1038.',
    },
  ],
  '08-17': [
    {
      name: 'Sainte Jeanne Delanoue',
      title: 'vierge, fondatrice',
      rank: 'martyrologe',
      life: 'Commerçante de Saumur, convertie, elle a ouvert sa maison aux pauvres, aux orphelins et aux malades, et fondé les Servantes des pauvres. Morte en 1736.',
    },
  ],
  '08-18': [
    {
      name: 'Sainte Hélène',
      title: 'impératrice',
      rank: 'martyrologe',
      life: 'Mère de l’empereur Constantin, baptisée tard, elle a fait un pèlerinage en Terre sainte et fait bâtir des basiliques à Bethléem et au mont des Oliviers. Morte vers 330.',
    },
  ],
  '08-19': [
    {
      name: 'Saint Jean Eudes',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Prêtre normand, missionnaire, fondateur des Eudistes pour former les prêtres. Il a été le premier à célébrer liturgiquement les Cœurs de Jésus et de Marie. Mort en 1680.',
    },
  ],
  '08-20': [
    {
      name: 'Saint Bernard de Clairvaux',
      title: 'abbé et docteur de l’Église',
      rank: 'memoire',
      life: 'Entré à Cîteaux avec trente compagnons, abbé de Clairvaux, il a fait rayonner les cisterciens dans toute l’Europe. Docteur « à la parole de miel », chantre de Marie. Mort en 1153.',
    },
  ],
  '08-21': [
    {
      name: 'Saint Pie X',
      title: 'pape',
      rank: 'memoire',
      life: 'Fils d’un facteur vénitien, pape de 1903 à 1914, il a encouragé la communion fréquente et permis aux enfants de communier dès l’âge de raison.',
    },
  ],
  '08-22': [
    {
      name: 'La Vierge Marie, Reine',
      rank: 'memoire',
      life: 'Huit jours après l’Assomption, l’Église contemple Marie couronnée dans la gloire, reine parce que mère du Roi et première des disciples.',
    },
  ],
  '08-23': [
    {
      name: 'Sainte Rose de Lima',
      title: 'vierge',
      rank: 'facultative',
      life: 'Tertiaire dominicaine à Lima, elle a vécu dans la pénitence et soigné les malades et les pauvres. Première sainte des Amériques. Morte en 1617.',
    },
  ],
  '08-24': [
    {
      name: 'Saint Barthélemy',
      title: 'apôtre',
      rank: 'fete',
      life: 'Souvent identifié à Nathanaël, que Jésus vit sous le figuier : « Voici vraiment un Israélite en qui il n’y a pas de ruse. » La tradition le dit martyr en Arménie.',
    },
  ],
  '08-25': [
    {
      name: 'Saint Louis',
      title: 'roi de France',
      rank: 'memoire',
      life: 'Louis IX, roi juste et pieux, servait lui-même les pauvres à sa table et fit bâtir la Sainte-Chapelle pour la couronne d’épines. Mort près de Tunis pendant la croisade, en 1270.',
    },
    {
      name: 'Saint Joseph de Calasanz',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Prêtre aragonais, il a ouvert à Rome en 1597 la première école gratuite d’Europe pour les enfants pauvres et fondé les Piaristes. Mort en 1648.',
    },
  ],
  '08-26': [
    {
      name: 'Saint Césaire d’Arles',
      title: 'évêque',
      rank: 'facultative',
      life: 'Moine de Lérins devenu évêque d’Arles pendant quarante ans, prédicateur proche du peuple, il a écrit l’une des premières règles pour moniales. Mort en 542.',
    },
  ],
  '08-27': [
    {
      name: 'Sainte Monique',
      rank: 'memoire',
      life: 'Mère d’Augustin, elle a prié pendant des années pour sa conversion et l’a suivi jusqu’à Milan. Un évêque lui dit : « Il est impossible que le fils de tant de larmes périsse. » Morte à Ostie en 387.',
    },
  ],
  '08-28': [
    {
      name: 'Saint Augustin',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Brillant rhéteur, longtemps en quête, converti à Milan en 386, évêque d’Hippone. Ses Confessions disent : « Tu nous as faits pour toi, et notre cœur est sans repos tant qu’il ne demeure en toi. » Mort en 430.',
    },
  ],
  '08-29': [
    {
      name: 'Martyre de saint Jean-Baptiste',
      rank: 'memoire',
      life: 'Le Précurseur a reproché à Hérode d’avoir pris la femme de son frère. Emprisonné, il est décapité à la demande d’Hérodiade. Il meurt témoin de la vérité.',
    },
  ],
  '08-30': [
    {
      name: 'Saint Fiacre',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Moine irlandais installé en ermite près de Meaux au VIIe siècle, il cultivait un jardin pour nourrir les pèlerins. Patron des jardiniers.',
    },
  ],
  '08-31': [
    {
      name: 'Saint Aidan de Lindisfarne',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine d’Iona, envoyé en Northumbrie au VIIe siècle, il a fondé le monastère de Lindisfarne et parcouru le pays à pied pour rencontrer chacun. Mort en 651.',
    },
  ],
  // Septembre
  '09-01': [
    {
      name: 'Saint Gilles',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Ermite d’origine grecque installé en Provence au VIIe siècle, il a fondé l’abbaye de Saint-Gilles, étape des pèlerins vers Compostelle.',
    },
  ],
  '09-02': [
    {
      name: 'Bienheureux martyrs de septembre 1792',
      rank: 'martyrologe',
      life: 'Près de deux cents prêtres, religieux et laïcs massacrés dans les prisons de Paris, notamment au couvent des Carmes, pour avoir refusé le serment à la Constitution civile du clergé.',
    },
  ],
  '09-03': [
    {
      name: 'Saint Grégoire le Grand',
      title: 'pape et docteur de l’Église',
      rank: 'memoire',
      life: 'Préfet de Rome devenu moine puis pape en 590, il a nourri la ville pendant les famines, envoyé des missionnaires en Angleterre et se disait « serviteur des serviteurs de Dieu ». Mort en 604.',
    },
  ],
  '09-04': [
    {
      name: 'Sainte Rosalie',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Ermite du XIIe siècle sur le mont Pellegrino. La découverte de ses restes en 1624 aurait mis fin à une peste : elle est la patronne de Palerme.',
    },
  ],
  '09-05': [
    {
      name: 'Sainte Teresa de Calcutta',
      title: 'vierge',
      rank: 'facultative',
      life: 'Religieuse albanaise enseignante à Calcutta, elle a entendu l’appel à servir « les plus pauvres des pauvres » et fondé les Missionnaires de la Charité. Prix Nobel de la paix en 1979. Morte en 1997.',
    },
  ],
  '09-06': [
    {
      name: 'Saint Zacharie',
      title: 'prophète',
      rank: 'martyrologe',
      life: 'Prophète du retour d’exil, vers 520 avant Jésus-Christ, il a encouragé la reconstruction du Temple. Il annonce un roi humble « monté sur un âne » (Zacharie 9, 9).',
    },
  ],
  '09-07': [
    {
      name: 'Saint Cloud',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Petit-fils de Clovis, il échappa au massacre de ses frères, renonça au trône et se fit ermite puis prêtre, près de Paris, à l’endroit qui porte son nom. Mort vers 560.',
    },
  ],
  '09-08': [
    {
      name: 'Nativité de la Vierge Marie',
      rank: 'fete',
      life: 'Neuf mois après l’Immaculée Conception, l’Église fête la naissance de Marie, « aurore du salut ». Sa venue annonce celle du Sauveur.',
    },
  ],
  '09-09': [
    {
      name: 'Saint Pierre Claver',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Jésuite catalan, il a passé quarante ans à Carthagène, en Colombie, à accueillir et soigner les esclaves africains débarqués des navires. Il signait « esclave des esclaves ». Mort en 1654.',
    },
  ],
  '09-10': [
    {
      name: 'Saint Nicolas de Tolentino',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Augustin des Marches au XIIIe siècle, prédicateur et confesseur, il priait beaucoup pour les âmes du purgatoire. Mort en 1305.',
    },
  ],
  '09-11': [
    {
      name: 'Saint Jean-Gabriel Perboyre',
      title: 'prêtre et martyr',
      rank: 'martyrologe',
      life: 'Lazariste du Lot, missionnaire en Chine, trahi et torturé, il a été étranglé sur une croix à Wuchang en 1840.',
    },
  ],
  '09-12': [
    {
      name: 'Le Saint Nom de Marie',
      rank: 'facultative',
      life: 'Quatre jours après sa Nativité, l’Église honore le nom de Marie. Cette mémoire rappelle aussi la levée du siège de Vienne en 1683.',
    },
  ],
  '09-13': [
    {
      name: 'Saint Jean Chrysostome',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Prédicateur d’Antioche à la « bouche d’or », archevêque de Constantinople, il a dénoncé le luxe de la cour et défendu les pauvres, ce qui lui valut l’exil où il mourut en 407.',
    },
  ],
  '09-14': [
    {
      name: 'La Croix glorieuse',
      rank: 'fete',
      lord: true,
      life: 'L’instrument de la mort devient l’arbre de vie. Cette fête rappelle la dédicace de la basilique du Saint-Sépulcre à Jérusalem en 335.',
    },
  ],
  '09-15': [
    {
      name: 'Notre-Dame des Douleurs',
      rank: 'memoire',
      life: 'Au lendemain de la Croix glorieuse, l’Église contemple Marie debout au pied de la croix, unie à la souffrance de son Fils (Stabat Mater).',
    },
  ],
  '09-16': [
    {
      name: 'Saints Corneille et Cyprien',
      title: 'martyrs',
      rank: 'memoire',
      life: 'Le pape Corneille et l’évêque Cyprien de Carthage, unis dans la défense de la miséricorde envers ceux qui avaient renié la foi pendant la persécution. Tous deux martyrs, en 253 et 258.',
    },
  ],
  '09-17': [
    {
      name: 'Sainte Hildegarde de Bingen',
      title: 'vierge et docteur de l’Église',
      rank: 'facultative',
      life: 'Abbesse bénédictine rhénane du XIIe siècle, visionnaire, compositrice, savante en médecine et en sciences naturelles. Benoît XVI l’a déclarée docteur de l’Église en 2012.',
    },
    {
      name: 'Saint Robert Bellarmin',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Jésuite et cardinal, théologien de la Réforme catholique, il a écrit des catéchismes qui ont formé des générations. Mort en 1621.',
    },
  ],
  '09-18': [
    {
      name: 'Saint Joseph de Cupertino',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Franciscain des Pouilles, jugé peu doué pour les études, connu pour ses extases. Patron des étudiants en période d’examen. Mort en 1663.',
    },
  ],
  '09-19': [
    {
      name: 'Notre-Dame de La Salette',
      rank: 'facultative',
      life: 'Le 19 septembre 1846, la Vierge apparaît en pleurs à deux enfants bergers dans les Alpes, Mélanie et Maximin, et appelle à la conversion.',
    },
    {
      name: 'Saint Janvier',
      title: 'évêque et martyr',
      rank: 'facultative',
      life: 'Évêque de Bénévent, martyrisé vers 305. Patron de Naples, où l’on vénère une ampoule de son sang.',
    },
  ],
  '09-20': [
    {
      name: 'Saints André Kim Tae-gon, Paul Chong Ha-sang et leurs compagnons',
      title: 'martyrs',
      rank: 'memoire',
      life: 'Cent trois martyrs de Corée au XIXe siècle. L’Église y est née de laïcs qui avaient découvert la foi dans des livres. André Kim fut le premier prêtre coréen, décapité en 1846.',
    },
  ],
  '09-21': [
    {
      name: 'Saint Matthieu',
      title: 'apôtre et évangéliste',
      rank: 'fete',
      life: 'Collecteur d’impôts à Capharnaüm, il quitte son bureau quand Jésus lui dit : « Suis-moi. » Son Évangile montre en Jésus l’accomplissement des Écritures.',
    },
  ],
  '09-22': [
    {
      name: 'Saint Maurice et ses compagnons',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Selon la tradition, soldats de la légion thébaine massacrés à Agaune, en Valais, vers 300, pour avoir refusé de sacrifier aux dieux. L’abbaye de Saint-Maurice garde leur mémoire.',
    },
  ],
  '09-23': [
    {
      name: 'Saint Pio de Pietrelcina (Padre Pio)',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Capucin de San Giovanni Rotondo, marqué des stigmates, confesseur infatigable, il a fondé un grand hôpital, la Maison du soulagement de la souffrance. Mort en 1968.',
    },
  ],
  '09-24': [
    {
      name: 'Saint Gérard Sagredo',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Moine vénitien devenu précepteur du fils de saint Étienne de Hongrie, puis évêque de Csanád, il a été tué lors d’une révolte païenne en 1046.',
    },
  ],
  '09-25': [
    {
      name: 'Saint Firmin',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Selon la tradition, venu de Pampelune, premier évêque d’Amiens, martyrisé vers 303. Il est fêté aussi à Pampelune.',
    },
  ],
  '09-26': [
    {
      name: 'Saints Côme et Damien',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Frères médecins de Syrie qui soignaient gratuitement, martyrisés vers 300. Patrons des médecins et des pharmaciens.',
    },
  ],
  '09-27': [
    {
      name: 'Saint Vincent de Paul',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Fils de paysans landais, aumônier des galères, il a fondé les Lazaristes et, avec Louise de Marillac, les Filles de la Charité. « Les pauvres sont nos maîtres. » Mort en 1660.',
    },
  ],
  '09-28': [
    {
      name: 'Saint Venceslas',
      title: 'martyr',
      rank: 'facultative',
      life: 'Duc de Bohême, chrétien fervent, assassiné par son frère en 935 sur le chemin de la messe. Patron de la République tchèque.',
    },
    {
      name: 'Saint Laurent Ruiz et ses compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Seize martyrs tués à Nagasaki entre 1633 et 1637. Laurent Ruiz, père de famille philippin, est le premier saint des Philippines.',
    },
  ],
  '09-29': [
    {
      name: 'Saints Michel, Gabriel et Raphaël',
      title: 'archanges',
      rank: 'fete',
      life: 'Michel, « qui est comme Dieu ? », combat le mal ; Gabriel annonce la naissance de Jean et de Jésus ; Raphaël, « Dieu guérit », accompagne Tobie.',
    },
  ],
  '09-30': [
    {
      name: 'Saint Jérôme',
      title: 'prêtre et docteur de l’Église',
      rank: 'memoire',
      life: 'Lettré au caractère vif, il s’est installé à Bethléem et a traduit la Bible en latin, la Vulgate. « Ignorer les Écritures, c’est ignorer le Christ. » Mort en 420.',
    },
  ],
  // Octobre
  '10-01': [
    {
      name: 'Sainte Thérèse de l’Enfant-Jésus',
      title: 'vierge et docteur de l’Église',
      rank: 'memoire',
      life: 'Entrée au Carmel de Lisieux à quinze ans, morte à vingt-quatre en 1897, elle a découvert la « petite voie » de la confiance et de l’amour. Patronne des missions et patronne secondaire de la France.',
    },
  ],
  '10-02': [
    {
      name: 'Les saints Anges gardiens',
      rank: 'memoire',
      life: '« Leurs anges dans les cieux voient sans cesse la face de mon Père » (Matthieu 18, 10). L’Église croit que chacun est accompagné par un ange qui le garde.',
    },
  ],
  '10-03': [
    {
      name: 'Saint Gérard de Brogne',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Seigneur du comté de Namur devenu moine, il a fondé l’abbaye de Brogne et réformé de nombreux monastères de Flandre et de Lotharingie au Xe siècle. Mort en 959.',
    },
  ],
  '10-04': [
    {
      name: 'Saint François d’Assise',
      rank: 'memoire',
      life: 'Fils d’un riche marchand, il a tout quitté pour épouser « Dame Pauvreté ». Il a fondé les Frères mineurs, reçu les stigmates et chanté le Cantique des créatures. Mort en 1226.',
    },
  ],
  '10-05': [
    {
      name: 'Sainte Faustine Kowalska',
      title: 'vierge',
      rank: 'facultative',
      life: 'Religieuse polonaise, elle a reçu du Christ le message de la Divine Miséricorde et l’image « Jésus, j’ai confiance en toi ». Morte en 1938.',
    },
  ],
  '10-06': [
    {
      name: 'Saint Bruno',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Maître de l’école de Reims, il a quitté sa chaire pour le désert de Chartreuse en 1084 et fondé l’ordre des Chartreux, dans le silence et la solitude. Mort en Calabre en 1101.',
    },
  ],
  '10-07': [
    {
      name: 'Notre-Dame du Rosaire',
      rank: 'memoire',
      life: 'Instituée après la victoire de Lépante en 1571, attribuée à la prière du chapelet. Le Rosaire parcourt avec Marie les mystères de la vie du Christ.',
    },
  ],
  '10-08': [
    {
      name: 'Saint Siméon',
      title: 'vieillard du Temple',
      rank: 'martyrologe',
      life: 'Homme juste qui attendait la consolation d’Israël, il reçoit l’enfant Jésus dans ses bras au Temple : « Maintenant, ô Maître, tu peux laisser ton serviteur s’en aller en paix. »',
    },
  ],
  '10-09': [
    {
      name: 'Saint Denis et ses compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Premier évêque de Paris, au IIIe siècle, décapité avec le prêtre Rustique et le diacre Éleuthère à Montmartre. Sa basilique abrite les tombeaux des rois.',
    },
    {
      name: 'Saint John Henry Newman',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Pasteur anglican d’Oxford, entré dans l’Église catholique en 1845 après une longue recherche, puis cardinal. Léon XIV l’a déclaré docteur de l’Église en 2025. Mort en 1890.',
    },
    {
      name: 'Saint Jean Léonardi',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Pharmacien de Lucques devenu prêtre, il a fondé les Clercs réguliers de la Mère de Dieu et contribué à la naissance de la Propagande pour les missions. Mort en 1609.',
    },
  ],
  '10-10': [
    {
      name: 'Saint Daniel Comboni',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Missionnaire italien en Afrique centrale, il voulait « sauver l’Afrique par l’Afrique ». Premier évêque de Khartoum, fondateur des Comboniens. Mort en 1881.',
    },
  ],
  '10-11': [
    {
      name: 'Saint Jean XXIII',
      title: 'pape',
      rank: 'facultative',
      life: 'Fils de paysans de Bergame, nonce à Paris, élu pape à soixante-seize ans en 1958, le « bon pape Jean » a ouvert le concile Vatican II le 11 octobre 1962. Mort en 1963.',
    },
  ],
  '10-12': [
    {
      name: 'Saint Carlo Acutis',
      rank: 'martyrologe',
      life: 'Adolescent milanais passionné d’informatique, il a créé une exposition en ligne sur les miracles eucharistiques. « L’Eucharistie est mon autoroute vers le ciel. » Mort d’une leucémie à quinze ans en 2006, canonisé en 2025.',
    },
  ],
  '10-13': [
    {
      name: 'Saint Géraud d’Aurillac',
      title: 'comte',
      rank: 'martyrologe',
      life: 'Comte d’Auvergne qui a vécu dans le monde comme un moine, juste et charitable, et fondé l’abbaye d’Aurillac. Modèle du laïc saint au Xe siècle. Mort en 909.',
    },
  ],
  '10-14': [
    {
      name: 'Saint Calixte Ier',
      title: 'pape et martyr',
      rank: 'facultative',
      life: 'Ancien esclave devenu pape vers 217, il a organisé le cimetière de la voie Appienne qui porte son nom et prôné la miséricorde envers les pécheurs repentants.',
    },
  ],
  '10-15': [
    {
      name: 'Sainte Thérèse d’Avila',
      title: 'vierge et docteur de l’Église',
      rank: 'memoire',
      life: 'Carmélite castillane, réformatrice du Carmel avec Jean de la Croix, maîtresse d’oraison : « un échange d’amitié avec Celui dont on se sait aimé ». Première femme docteur de l’Église. Morte en 1582.',
    },
  ],
  '10-16': [
    {
      name: 'Sainte Marguerite-Marie Alacoque',
      title: 'vierge',
      rank: 'facultative',
      life: 'Visitandine à Paray-le-Monial, elle a reçu les révélations du Sacré-Cœur entre 1673 et 1675 : « Voici ce Cœur qui a tant aimé les hommes. » Morte en 1690.',
    },
    {
      name: 'Sainte Edwige',
      title: 'religieuse',
      rank: 'facultative',
      life: 'Duchesse de Silésie, mère de sept enfants, elle a fondé des hôpitaux et des monastères, puis s’est retirée chez les cisterciennes de Trebnitz. Morte en 1243.',
    },
  ],
  '10-17': [
    {
      name: 'Saint Ignace d’Antioche',
      title: 'évêque et martyr',
      rank: 'memoire',
      life: 'Évêque d’Antioche conduit à Rome pour y être livré aux bêtes vers 110. En chemin, il écrit sept lettres aux Églises : « Je suis le froment de Dieu. »',
    },
  ],
  '10-18': [
    {
      name: 'Saint Luc',
      title: 'évangéliste',
      rank: 'fete',
      life: 'Médecin et compagnon de Paul, il a écrit l’Évangile de la miséricorde et les Actes des Apôtres. Il raconte l’enfance de Jésus du point de vue de Marie. Son symbole est le taureau.',
    },
  ],
  '10-19': [
    {
      name: 'Saints Jean de Brébeuf, Isaac Jogues et leurs compagnons',
      title: 'martyrs',
      rank: 'facultative',
      life: 'Huit jésuites français, prêtres et laïcs, missionnaires chez les Hurons et les Iroquois, tués en Nouvelle-France entre 1642 et 1649.',
    },
    {
      name: 'Saint Paul de la Croix',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Prédicateur italien du XVIIIe siècle, il a fondé les Passionistes pour faire mémoire de la Passion du Christ. Mort en 1775.',
    },
  ],
  '10-20': [
    {
      name: 'Sainte Marie-Bertille Boscardin',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Jugée simple d’esprit, employée aux cuisines de son couvent, elle est devenue une infirmière admirable auprès des enfants malades et des soldats blessés. Morte en 1922.',
    },
  ],
  '10-21': [
    {
      name: 'Sainte Ursule et ses compagnes',
      title: 'martyres',
      rank: 'martyrologe',
      life: 'Selon une ancienne tradition de Cologne, des jeunes filles martyrisées dans cette ville. Ursule a donné son nom aux Ursulines d’Angèle Merici.',
    },
  ],
  '10-22': [
    {
      name: 'Saint Jean-Paul II',
      title: 'pape',
      rank: 'facultative',
      life: 'Karol Wojtyła, archevêque de Cracovie, pape de 1978 à 2005. « N’ayez pas peur ! » Il a voyagé dans le monde entier, créé les JMJ et contribué à la chute du communisme en Europe.',
    },
  ],
  '10-23': [
    {
      name: 'Saint Jean de Capistran',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Juriste italien devenu franciscain, prédicateur dans toute l’Europe centrale, il a soutenu la défense de Belgrade en 1456. Mort la même année.',
    },
  ],
  '10-24': [
    {
      name: 'Saint Antoine-Marie Claret',
      title: 'évêque',
      rank: 'facultative',
      life: 'Missionnaire catalan, archevêque de Santiago de Cuba, fondateur des Clarétains, il a diffusé des millions de livres de piété. Mort en exil à Fontfroide, près de Narbonne, en 1870.',
    },
  ],
  '10-25': [
    {
      name: 'Saints Crépin et Crépinien',
      title: 'martyrs',
      rank: 'martyrologe',
      life: 'Frères cordonniers de Soissons qui annonçaient l’Évangile en travaillant, martyrisés vers 287. Patrons des cordonniers.',
    },
  ],
  '10-26': [
    {
      name: 'Saint Évariste',
      title: 'pape',
      rank: 'martyrologe',
      life: 'Quatrième successeur de Pierre à Rome, vers l’an 100, honoré comme martyr par la tradition.',
    },
  ],
  '10-27': [
    {
      name: 'Saint Frumence',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Jeune Syrien naufragé, devenu conseiller du roi d’Aksoum, il fut sacré évêque par saint Athanase au IVe siècle. Apôtre de l’Éthiopie.',
    },
  ],
  '10-28': [
    {
      name: 'Saints Simon et Jude',
      title: 'apôtres',
      rank: 'fete',
      life: 'Simon le Zélote et Jude, appelé aussi Thaddée, auteur d’une courte lettre du Nouveau Testament. La tradition les dit martyrs ensemble en Perse.',
    },
  ],
  '10-29': [
    {
      name: 'Saint Narcisse de Jérusalem',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Jérusalem à la fin du IIe siècle, réputé avoir vécu plus de cent ans.',
    },
  ],
  '10-30': [
    {
      name: 'Saint Marcel le Centurion',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Officier romain qui jeta ses insignes lors d’une fête impériale en 298, à Tanger, en déclarant ne servir que le Christ. Il fut décapité.',
    },
  ],
  '10-31': [
    {
      name: 'Saint Quentin',
      title: 'martyr',
      rank: 'martyrologe',
      life: 'Missionnaire romain en Gaule au IIIe siècle, martyrisé dans la ville d’Augusta Viromanduorum, qui porte aujourd’hui son nom.',
    },
  ],
  // Novembre
  '11-01': [
    {
      name: 'Tous les saints',
      rank: 'solennite',
      life: 'L’Église fête la foule immense des saints, connus et inconnus, « de toutes nations, tribus, peuples et langues » (Apocalypse 7, 9). Tous sont appelés à la sainteté.',
    },
  ],
  '11-02': [
    {
      name: 'Commémoraison de tous les fidèles défunts',
      rank: 'commemoraison',
      life: 'Au lendemain de la Toussaint, l’Église prie pour tous ceux qui sont morts et les confie à la miséricorde de Dieu, dans l’espérance de la résurrection.',
    },
  ],
  '11-03': [
    {
      name: 'Saint Martin de Porrès',
      title: 'religieux',
      rank: 'facultative',
      life: 'Fils d’un noble espagnol et d’une ancienne esclave, frère dominicain à Lima, il soignait les malades et les pauvres, sans distinction. Mort en 1639.',
    },
    {
      name: 'Saint Hubert',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Évêque de Maastricht puis de Liège au VIIIe siècle. Selon la légende, il se convertit à la vue d’un cerf portant une croix. Patron des chasseurs.',
    },
  ],
  '11-04': [
    {
      name: 'Saint Charles Borromée',
      title: 'évêque',
      rank: 'memoire',
      life: 'Archevêque de Milan, il a appliqué le concile de Trente, fondé des séminaires et soigné lui-même les malades de la peste de 1576. Mort en 1584.',
    },
  ],
  '11-05': [
    {
      name: 'Sainte Bertille',
      title: 'abbesse de Chelles',
      rank: 'martyrologe',
      life: 'Première abbesse de Chelles, appelée par la reine Bathilde, elle y a dirigé pendant plus de quarante ans un monastère réputé jusqu’en Angleterre. Morte vers 705.',
    },
  ],
  '11-06': [
    {
      name: 'Saint Léonard de Noblat',
      title: 'ermite',
      rank: 'martyrologe',
      life: 'Ermite près de Limoges au VIe siècle, il obtint du roi la libération des prisonniers. Patron des prisonniers.',
    },
  ],
  '11-07': [
    {
      name: 'Saint Willibrord',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Moine anglais, apôtre des Frisons, premier évêque d’Utrecht, il a fondé l’abbaye d’Echternach. Mort en 739.',
    },
  ],
  '11-08': [
    {
      name: 'Sainte Élisabeth de la Trinité',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Jeune pianiste de Dijon entrée au Carmel, elle a vécu de la présence de Dieu en elle : « Ô mon Dieu, Trinité que j’adore ». Morte à vingt-six ans en 1906.',
    },
  ],
  '11-09': [
    {
      name: 'Dédicace de la basilique du Latran',
      rank: 'fete',
      lord: true,
      life: 'Saint-Jean-de-Latran, la cathédrale de Rome, est la « mère et tête de toutes les églises ». Sa dédicace rappelle que l’Église est faite de pierres vivantes.',
    },
  ],
  '11-10': [
    {
      name: 'Saint Léon le Grand',
      title: 'pape et docteur de l’Église',
      rank: 'memoire',
      life: 'Pape de 440 à 461, il a exprimé la foi au Christ vrai Dieu et vrai homme, reprise par le concile de Chalcédoine, et a négocié avec Attila pour épargner Rome.',
    },
  ],
  '11-11': [
    {
      name: 'Saint Martin de Tours',
      title: 'évêque',
      rank: 'memoire',
      life: 'Soldat romain, il partage son manteau avec un pauvre à Amiens, puis devient moine à Ligugé et évêque de Tours. Apôtre des campagnes de Gaule. Mort en 397.',
    },
  ],
  '11-12': [
    {
      name: 'Saint Josaphat',
      title: 'évêque et martyr',
      rank: 'memoire',
      life: 'Moine basilien, archevêque de Polotsk, il a œuvré pour l’unité des chrétiens d’Orient avec Rome. Tué par des opposants à cette union en 1623.',
    },
  ],
  '11-13': [
    {
      name: 'Saint Brice',
      title: 'évêque de Tours',
      rank: 'martyrologe',
      life: 'Disciple turbulent de saint Martin, à qui il succéda à Tours. Calomnié et chassé, il revint après sept ans d’exil, transformé par l’épreuve. Mort en 444.',
    },
  ],
  '11-14': [
    {
      name: 'Saint Laurent O’Toole',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Archevêque de Dublin au XIIe siècle, artisan de paix entre Irlandais et Anglo-Normands. Mort en 1180 à Eu, en Normandie, où il repose.',
    },
  ],
  '11-15': [
    {
      name: 'Saint Albert le Grand',
      title: 'évêque et docteur de l’Église',
      rank: 'facultative',
      life: 'Dominicain allemand, maître de Thomas d’Aquin, savant en philosophie et en sciences naturelles. Patron des scientifiques. Mort en 1280.',
    },
  ],
  '11-16': [
    {
      name: 'Sainte Marguerite d’Écosse',
      title: 'reine',
      rank: 'facultative',
      life: 'Reine d’Écosse au XIe siècle, mère de huit enfants, elle a réformé l’Église du royaume et servait elle-même les pauvres. Morte en 1093.',
    },
    {
      name: 'Sainte Gertrude',
      title: 'vierge',
      rank: 'facultative',
      life: 'Moniale de Helfta, en Saxe, mystique du Cœur de Jésus au XIIIe siècle, appelée Gertrude la Grande. Morte vers 1302.',
    },
  ],
  '11-17': [
    {
      name: 'Sainte Élisabeth de Hongrie',
      title: 'religieuse',
      rank: 'memoire',
      life: 'Princesse hongroise, landgravine de Thuringe, veuve à vingt ans, elle a fondé un hôpital à Marbourg et servi les malades en tertiaire franciscaine. Morte à vingt-quatre ans en 1231.',
    },
  ],
  '11-18': [
    {
      name: 'Dédicace des basiliques Saint-Pierre et Saint-Paul',
      rank: 'facultative',
      life: 'Les deux basiliques de Rome construites sur les tombeaux des apôtres Pierre, au Vatican, et Paul, sur la route d’Ostie.',
    },
    {
      name: 'Sainte Rose-Philippine Duchesne',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Religieuse du Sacré-Cœur née à Grenoble, partie à quarante-neuf ans pour le Missouri, elle a ouvert des écoles et vécu chez les Potawatomis. Morte en 1852.',
    },
  ],
  '11-19': [
    {
      name: 'Sainte Mechtilde de Hackeborn',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Moniale de Helfta, chantre du monastère, maîtresse de sainte Gertrude. Ses révélations ont été réunies dans le Livre de la grâce spéciale. Morte en 1298.',
    },
  ],
  '11-20': [
    {
      name: 'Saint Edmond',
      title: 'roi et martyr',
      rank: 'martyrologe',
      life: 'Roi d’Est-Anglie, tué par les Vikings en 869 pour avoir refusé de renier le Christ.',
    },
  ],
  '11-21': [
    {
      name: 'Présentation de la Vierge Marie',
      rank: 'memoire',
      life: 'Selon une tradition ancienne, Marie enfant fut présentée au Temple par ses parents. L’Église y voit le don de toute sa vie à Dieu.',
    },
  ],
  '11-22': [
    {
      name: 'Sainte Cécile',
      title: 'vierge et martyre',
      rank: 'memoire',
      life: 'Martyre romaine dont le nom est cité dans la première prière eucharistique. La légende dit qu’elle chantait Dieu dans son cœur : patronne des musiciens.',
    },
  ],
  '11-23': [
    {
      name: 'Saint Colomban',
      title: 'abbé',
      rank: 'facultative',
      life: 'Moine irlandais parti pour le continent vers 590, il a fondé Luxeuil dans les Vosges puis Bobbio en Italie. Mort en 615.',
    },
    {
      name: 'Saint Clément Ier',
      title: 'pape et martyr',
      rank: 'facultative',
      life: 'Troisième successeur de Pierre, auteur vers 96 d’une lettre aux Corinthiens qui les appelle à la concorde. Cité dans la première prière eucharistique.',
    },
  ],
  '11-24': [
    {
      name: 'Saints André Dung-Lac et ses compagnons',
      title: 'martyrs',
      rank: 'memoire',
      life: 'Cent dix-sept martyrs du Viêt Nam entre 1745 et 1862 : prêtres et laïcs vietnamiens, missionnaires espagnols et français.',
    },
  ],
  '11-25': [
    {
      name: 'Sainte Catherine d’Alexandrie',
      title: 'vierge et martyre',
      rank: 'facultative',
      life: 'Selon la tradition, une jeune savante d’Alexandrie qui tint tête aux philosophes de l’empereur et fut martyrisée au IVe siècle. Le monastère du Sinaï porte son nom.',
    },
  ],
  '11-26': [
    {
      name: 'Saint Léonard de Port-Maurice',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Franciscain de Ligurie, prédicateur de missions populaires, il a répandu le chemin de croix dans toute l’Italie. Mort en 1751.',
    },
  ],
  '11-27': [
    {
      name: 'Notre-Dame de la Médaille miraculeuse',
      rank: 'martyrologe',
      life: 'Le 27 novembre 1830, rue du Bac à Paris, la Vierge montre à Catherine Labouré la médaille portant : « Ô Marie conçue sans péché, priez pour nous qui avons recours à vous. »',
    },
  ],
  '11-28': [
    {
      name: 'Sainte Catherine Labouré',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Fille de la Charité, voyante de la Médaille miraculeuse en 1830, elle a ensuite servi les vieillards de Reuilly pendant quarante-six ans dans un total effacement. Morte en 1876.',
    },
  ],
  '11-29': [
    {
      name: 'Saint Saturnin',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Premier évêque de Toulouse, attaché à un taureau furieux vers 250 pour avoir refusé de sacrifier aux idoles. La basilique Saint-Sernin garde son tombeau.',
    },
  ],
  '11-30': [
    {
      name: 'Saint André',
      title: 'apôtre',
      rank: 'fete',
      life: 'Pêcheur de Bethsaïde, disciple de Jean-Baptiste, premier appelé, il conduit son frère Simon-Pierre à Jésus. La tradition le dit crucifié en Grèce sur une croix en X.',
    },
  ],
  // Décembre
  '12-01': [
    {
      name: 'Saint Charles de Foucauld',
      title: 'prêtre',
      rank: 'martyrologe',
      life: 'Officier fêtard devenu explorateur, converti à Paris en 1886, il a vécu en ermite et en frère universel parmi les Touaregs du Hoggar. Tué à Tamanrasset en 1916.',
    },
    {
      name: 'Saint Éloi',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Orfèvre et conseiller du roi Dagobert, il employait sa fortune à racheter des esclaves, puis devint évêque de Noyon. Patron des orfèvres et des métallurgistes. Mort en 660.',
    },
  ],
  '12-02': [
    {
      name: 'Sainte Bibiane',
      title: 'vierge et martyre',
      rank: 'martyrologe',
      life: 'Martyre romaine du IVe siècle, sous Julien l’Apostat. Une église lui est dédiée sur l’Esquilin.',
    },
  ],
  '12-03': [
    {
      name: 'Saint François Xavier',
      title: 'prêtre',
      rank: 'memoire',
      life: 'Compagnon d’Ignace de Loyola, il a annoncé l’Évangile en Inde et au Japon. Il est mort en 1552 aux portes de la Chine. Patron des missions avec Thérèse de Lisieux.',
    },
  ],
  '12-04': [
    {
      name: 'Saint Jean de Damas',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Haut fonctionnaire à la cour du calife de Damas devenu moine près de Jérusalem, il a défendu la vénération des icônes et résumé la foi de l’Orient chrétien. Mort vers 750.',
    },
    {
      name: 'Sainte Barbe',
      title: 'vierge et martyre',
      rank: 'martyrologe',
      life: 'Martyre des premiers siècles selon la tradition, enfermée dans une tour par son père. Patronne des pompiers, des mineurs et des artilleurs.',
    },
  ],
  '12-05': [
    {
      name: 'Saint Sabas',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Moine de Cappadoce, fondateur en 483 de la grande laure de Mar Saba, dans le désert de Judée, toujours habitée par des moines. Mort en 532.',
    },
  ],
  '12-06': [
    {
      name: 'Saint Nicolas',
      title: 'évêque',
      rank: 'facultative',
      life: 'Évêque de Myre, en Asie Mineure, au IVe siècle, connu pour sa générosité discrète envers les pauvres. Patron des enfants, très fêté en Lorraine.',
    },
  ],
  '12-07': [
    {
      name: 'Saint Ambroise',
      title: 'évêque et docteur de l’Église',
      rank: 'memoire',
      life: 'Gouverneur de Milan acclamé évêque alors qu’il n’était que catéchumène, en 374. Prédicateur, auteur d’hymnes, il a baptisé saint Augustin. Mort en 397.',
    },
  ],
  '12-08': [
    {
      name: 'Immaculée Conception de la Vierge Marie',
      rank: 'solennite',
      feast: 'Immaculée Conception',
      life: 'Dès le premier instant de sa conception, Marie a été préservée du péché originel, en vue de sa mission de Mère du Sauveur. Pie IX a défini ce dogme en 1854.',
    },
  ],
  '12-09': [
    {
      name: 'Saint Juan Diego',
      rank: 'facultative',
      life: 'Indien aztèque baptisé, il a vu la Vierge en 1531 sur la colline de Tepeyac. Son manteau porte l’image de Notre-Dame de Guadalupe. Mort en 1548.',
    },
  ],
  '12-10': [
    {
      name: 'Notre-Dame de Lorette',
      rank: 'facultative',
      life: 'Le sanctuaire de Lorette, en Italie, vénère la Sainte Maison de Nazareth. Notre-Dame de Lorette est la patronne des aviateurs.',
    },
  ],
  '12-11': [
    {
      name: 'Saint Damase Ier',
      title: 'pape',
      rank: 'facultative',
      life: 'Pape de 366 à 384, il a demandé à saint Jérôme de réviser la Bible latine et honoré les tombeaux des martyrs par des inscriptions en vers.',
    },
  ],
  '12-12': [
    {
      name: 'Notre-Dame de Guadalupe',
      rank: 'facultative',
      life: 'Apparue en 1531 à Juan Diego au Mexique sous les traits d’une jeune métisse, elle est la patronne des Amériques.',
    },
  ],
  '12-13': [
    {
      name: 'Sainte Lucie',
      title: 'vierge et martyre',
      rank: 'memoire',
      life: 'Jeune chrétienne de Syracuse martyrisée vers 304. Son nom évoque la lumière, et sa fête est celle des lumières dans les pays du Nord.',
    },
  ],
  '12-14': [
    {
      name: 'Saint Jean de la Croix',
      title: 'prêtre et docteur de l’Église',
      rank: 'memoire',
      life: 'Carme, réformateur du Carmel avec Thérèse d’Avila, emprisonné par ses frères. Poète de la « nuit obscure », il guide vers l’union à Dieu. Mort en 1591.',
    },
  ],
  '12-15': [
    {
      name: 'Sainte Nino',
      title: 'apôtre de la Géorgie',
      rank: 'martyrologe',
      life: 'Jeune femme venue de Cappadoce, captive en Géorgie au IVe siècle, elle a conduit la reine puis le roi à la foi chrétienne.',
    },
  ],
  '12-16': [
    {
      name: 'Sainte Adélaïde',
      title: 'impératrice',
      rank: 'martyrologe',
      life: 'Reine d’Italie, épouse de l’empereur Otton Ier, régente avisée, elle a fondé des monastères et fini sa vie à Seltz, en Alsace. Morte en 999.',
    },
  ],
  '12-17': [
    {
      name: 'Saint Judicaël',
      title: 'roi',
      rank: 'martyrologe',
      life: 'Roi de Domnonée, en Bretagne, au VIIe siècle, il fit la paix avec le roi Dagobert puis se retira au monastère de Gaël.',
    },
  ],
  '12-18': [
    {
      name: 'Saint Gatien',
      title: 'évêque',
      rank: 'martyrologe',
      life: 'Premier évêque de Tours au IIIe siècle, il célébrait en secret dans des grottes pendant les persécutions. La cathédrale de Tours porte son nom.',
    },
  ],
  '12-19': [
    {
      name: 'Bienheureux Urbain V',
      title: 'pape',
      rank: 'martyrologe',
      life: 'Bénédictin du Gévaudan, élu pape à Avignon en 1362, il tenta de ramener la papauté à Rome. Il fonda des collèges et resta moine sous la tiare. Mort en 1370.',
    },
  ],
  '12-20': [
    {
      name: 'Saint Dominique de Silos',
      title: 'abbé',
      rank: 'martyrologe',
      life: 'Abbé de Silos, en Castille, au XIe siècle, il a restauré le monastère et racheté des captifs chrétiens. Mort en 1073.',
    },
  ],
  '12-21': [
    {
      name: 'Saint Pierre Canisius',
      title: 'prêtre et docteur de l’Église',
      rank: 'facultative',
      life: 'Jésuite néerlandais, il a parcouru l’Allemagne et la Suisse au XVIe siècle et écrit des catéchismes réédités des centaines de fois. Mort à Fribourg en 1597.',
    },
  ],
  '12-22': [
    {
      name: 'Sainte Françoise-Xavière Cabrini',
      title: 'vierge',
      rank: 'martyrologe',
      life: 'Lombarde, fondatrice des Missionnaires du Sacré-Cœur, elle a servi les émigrés italiens aux États-Unis en ouvrant écoles et hôpitaux. Patronne des migrants. Morte en 1917.',
    },
  ],
  '12-23': [
    {
      name: 'Saint Jean de Kenty',
      title: 'prêtre',
      rank: 'facultative',
      life: 'Professeur à l’université de Cracovie au XVe siècle, connu pour sa charité envers les pauvres et les étudiants. Mort en 1473.',
    },
  ],
  '12-24': [
    {
      name: 'Sainte Adèle',
      title: 'abbesse',
      rank: 'martyrologe',
      life: 'Fille de saint Dagobert II selon la tradition, veuve, elle a fondé le monastère de Pfalzel près de Trèves. Morte vers 735.',
    },
  ],
  '12-25': [
    {
      name: 'Nativité du Seigneur',
      rank: 'solennite',
      life: '« Le Verbe s’est fait chair, et il a habité parmi nous » (Jean 1, 14). À Bethléem, le Fils de Dieu naît de la Vierge Marie, dans la pauvreté d’une crèche.',
    },
  ],
  '12-26': [
    {
      name: 'Saint Étienne',
      title: 'premier martyr',
      rank: 'fete',
      life: 'L’un des sept diacres de Jérusalem, plein de grâce et de force. Lapidé, il prie pour ses bourreaux comme Jésus ; Saul, futur saint Paul, assiste à sa mort.',
    },
  ],
  '12-27': [
    {
      name: 'Saint Jean',
      title: 'apôtre et évangéliste',
      rank: 'fete',
      life: 'Le disciple que Jésus aimait, à qui il confie sa mère au pied de la croix. Son Évangile s’ouvre sur le Verbe et culmine dans « Dieu est amour ». Son symbole est l’aigle.',
    },
  ],
  '12-28': [
    {
      name: 'Les saints Innocents',
      title: 'martyrs',
      rank: 'fete',
      life: 'Les enfants de Bethléem massacrés sur l’ordre d’Hérode, qui voulait tuer Jésus nouveau-né (Matthieu 2, 16-18). L’Église les honore comme martyrs.',
    },
  ],
  '12-29': [
    {
      name: 'Saint Thomas Becket',
      title: 'évêque et martyr',
      rank: 'facultative',
      life: 'Chancelier et ami du roi Henri II, devenu archevêque de Cantorbéry, il a défendu la liberté de l’Église contre lui. Assassiné dans sa cathédrale en 1170.',
    },
  ],
  '12-30': [
    {
      name: 'Saint Sabin de Spolète',
      title: 'évêque et martyr',
      rank: 'martyrologe',
      life: 'Évêque honoré comme martyr à Spolète, en Ombrie, au début du IVe siècle.',
    },
  ],
  '12-31': [
    {
      name: 'Saint Sylvestre Ier',
      title: 'pape',
      rank: 'facultative',
      life: 'Pape de 314 à 335, après la fin des persécutions, au temps de Constantin et du concile de Nicée. Il a vu s’élever les premières grandes basiliques de Rome.',
    },
  ],
};
