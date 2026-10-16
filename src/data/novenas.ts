// Les neuvaines proposées aux groupes : quatre modèles intégrés (Esprit Saint, saint Joseph, Sacré-Cœur, Notre-Dame),
// plus le modèle « personnalisée » dont le créateur écrit la prière.
//
// Provenance des textes : les méditations et les prières du jour sont ÉCRITES pour l'app (aucune citation d'un texte
// moderne protégé). Les passages bibliques sont des références (livre, chapitre, premier et dernier verset), lues dans la
// traduction choisie par chacun ; chaque référence existe dans la Louis Segond et dans la Crampon (vérifié par les tests).
// Les prières répétées sont celles du recueil de l'app (src/data/prayers.ts), désignées par leur identifiant.

import type { NovenaModel, PassageSetId } from '../novenas';

/** [livre, chapitre, premier verset, dernier verset], comme les parcours de l'Avent et du Carême. */
export type Passage = [number, number, number, number];

/** Une prière du recueil, dite `times` fois (le texte n'est montré qu'une fois). */
export type PrayerRef = { id: string; times: number };

export type NovenaDay = {
  title: string;
  passage: Passage;
  /** 60 à 110 mots, écrite pour l'app. */
  meditation: string;
  /** La prière du jour, écrite pour l'app. */
  prayer: string;
  repeated: PrayerRef[];
};

export type NovenaTemplate = {
  id: Exclude<NovenaModel, 'personnalisee'>;
  title: string;
  /** Une phrase de présentation, montrée sur la carte du modèle. */
  short: string;
  days: NovenaDay[];
};

const once = (id: string): PrayerRef => ({ id, times: 1 });

/** Notre Père, trois Je vous salue Marie et Gloire au Père, comme la neuvaine des apôtres autour de Marie. */
const MARIAN: PrayerRef[] = [once('notre-pere'), { id: 'je-vous-salue-marie', times: 3 }, once('gloire-au-pere')];

export const NOVENAS: NovenaTemplate[] = [
  {
    id: 'esprit-saint',
    title: 'Neuvaine à l’Esprit Saint',
    short: 'Neuf jours de prière dans l’attente de l’Esprit, comme les apôtres réunis avec Marie entre l’Ascension et la Pentecôte.',
    days: [
      {
        title: 'Attendre la promesse',
        passage: [44, 1, 4, 8],
        meditation:
          'Avant de les quitter, Jésus demande à ses disciples d’attendre. Ils ne savent ni l’heure ni la manière, et pourtant ils restent ensemble à Jérusalem. Cette neuvaine commence par la même attente : nous n’avons pas à fabriquer l’Esprit Saint, seulement à nous rendre disponibles à son don. Attendre n’est pas perdre son temps ; c’est ouvrir les mains. Aujourd’hui, demandons un cœur qui désire recevoir, et la patience de rester unis dans la prière, comme eux.',
        prayer:
          'Esprit Saint, nous voici devant toi, les mains ouvertes. Nous ne savons pas comment tu viendras, mais nous croyons à la promesse du Christ. Rends-nous patients dans l’attente, fidèles dans la prière et unis les uns aux autres. Que ces neuf jours préparent nos cœurs à te recevoir, et que ce que nous te confions ensemble trouve en toi son chemin. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'Le Défenseur',
        passage: [43, 14, 15, 21],
        meditation:
          'Jésus annonce qu’il ne laissera pas ses amis orphelins. Il promet un autre Défenseur, l’Esprit de vérité, qui demeure auprès d’eux et en eux. Le mot dit une présence qui accompagne, console et soutient, comme un avocat reste aux côtés de celui qu’il défend. Dans nos épreuves, nous pouvons nous croire seuls. Aujourd’hui, tournons-nous vers cette présence discrète : elle est déjà là, plus proche que nos pensées, et elle nous rattache à l’amour du Père et du Fils.',
        prayer:
          'Esprit Saint, Défenseur et Consolateur, tu demeures auprès de nous et en nous. Quand nous nous sentons seuls ou faibles, rappelle-nous que nous ne sommes pas orphelins. Soutiens ceux qui traversent l’épreuve, éclaire ceux qui doutent, et garde-nous dans l’amour du Père et du Fils. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'La paix du Christ',
        passage: [43, 14, 23, 27],
        meditation:
          'La paix que donne Jésus n’est pas l’absence de difficultés. Elle vient de sa parole gardée et de la présence du Père et du Fils, qui font leur demeure en celui qui aime. L’Esprit Saint rappelle et enseigne : il n’apporte pas des idées nouvelles, il fait vivre en nous ce que le Christ a dit. Aujourd’hui, choisissons une parole de l’Évangile et laissons-la descendre dans le cœur. Là où le trouble nous habite, demandons cette paix que le monde ne sait pas donner.',
        prayer:
          'Esprit de paix, toi que le Christ a promis, rappelle-nous ses paroles et fais-les vivre en nous. Calme nos agitations, apaise nos conflits, et que notre cœur ne se trouble pas. Donne ta paix à notre groupe, à nos familles et à ceux que nous portons dans la prière. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'L’Esprit de vérité',
        passage: [43, 16, 12, 15],
        meditation:
          'Jésus sait que ses disciples ne peuvent pas tout porter d’un coup. L’Esprit de vérité les conduira pas à pas, sans parler de lui-même : il reçoit du Christ pour le donner. Voilà un trait de son visage, discret et fidèle. Il éclaire sans éblouir, et il oriente toujours vers Jésus. Aujourd’hui, demandons la lumière pour une question que nous portons, avec la confiance qu’une vérité reçue peu à peu vaut mieux qu’une réponse forcée.',
        prayer:
          'Esprit de vérité, conduis-nous pas à pas vers la lumière du Christ. Là où nous cherchons, donne-nous de la patience ; là où nous nous trompons, donne-nous l’humilité. Fais-nous aimer la vérité plus que nos opinions, et mets sur nos lèvres des paroles justes et bienveillantes. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'Fils et filles de Dieu',
        passage: [45, 8, 14, 17],
        meditation:
          'Saint Paul le dit simplement : ceux que conduit l’Esprit de Dieu sont fils de Dieu. Nous n’avons pas reçu un esprit de crainte, mais un esprit qui nous fait dire « Abba, Père ». Le baptême nous a faits enfants, et l’Esprit nous le murmure au fond du cœur. Aujourd’hui, osons appeler Dieu notre Père, avec la confiance d’un enfant, même si notre prière est maladroite. Elle est déjà reçue, parce que c’est lui qui la souffle.',
        prayer:
          'Père, par ton Esprit tu fais de nous tes enfants. Donne-nous la confiance de te dire « Père » dans la joie comme dans l’épreuve. Délivre-nous de la peur, apprends-nous à nous recevoir de toi, et conduis-nous chaque jour sur le chemin de tes fils et de tes filles. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'L’Esprit prie en nous',
        passage: [45, 8, 26, 27],
        meditation:
          'Il nous arrive de ne plus savoir quoi demander, ni comment. Paul nous console : l’Esprit vient au secours de notre faiblesse et prie en nous par des gémissements que les mots ne peuvent contenir. Notre prière n’est jamais seulement la nôtre. Quand les mots manquent, un silence, un soupir, un simple nom suffit à lui donner voix. Aujourd’hui, prenons quelques minutes de silence devant Dieu, sans rien dire, en laissant l’Esprit prier ce que nous portons.',
        prayer:
          'Esprit Saint, tu connais ce que nous n’arrivons pas à dire. Viens au secours de notre faiblesse et prie en nous selon le cœur de Dieu. Transforme nos silences en offrande et nos soupirs en confiance. Ce que nous portons ensemble, présente-le toi-même au Père. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'Des dons variés',
        passage: [46, 12, 4, 11],
        meditation:
          'L’Esprit ne distribue pas les mêmes dons à tous : il y a diversité de dons, de services, d’activités, mais un seul Esprit, et c’est pour le bien commun. Aucun don n’est un trophée ; chacun est un service. Dans un groupe de prière aussi, les talents sont différents et se complètent. Aujourd’hui, remercions pour ce que Dieu a donné aux autres membres de notre communauté, et demandons de reconnaître le don qui nous est confié pour le mettre au service de tous.',
        prayer:
          'Esprit Saint, source de tous les dons, merci pour la diversité de ceux qui prient avec nous. Apprends-nous à reconnaître ce que tu as mis en chacun, à nous réjouir des dons des autres et à offrir les nôtres sans orgueil. Fais de notre groupe un seul corps, uni dans ton amour. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'Le fruit de l’Esprit',
        passage: [48, 5, 22, 25],
        meditation:
          'L’Esprit se reconnaît à ses fruits : l’amour, la joie, la paix, la patience, la douceur. Ce ne sont pas des performances, mais une vie qui grandit quand on reste attaché à lui. Un fruit se reçoit et se cultive, il ne se fabrique pas. Aujourd’hui, choisissons un seul de ces fruits dont nous avons particulièrement besoin, et demandons-le pour la journée. Marcher selon l’Esprit, c’est accepter qu’il fasse mûrir en nous ce que nous ne pouvons pas produire seuls.',
        prayer:
          'Esprit Saint, fais mûrir en nous ton fruit. Là où règnent la dureté et l’impatience, mets de la douceur ; là où il y a de la tristesse, mets ta joie ; là où il y a des divisions, mets ta paix. Que notre vie soit conduite par toi, et non par nos humeurs. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
      {
        title: 'Le jour de la Pentecôte',
        passage: [44, 2, 1, 11],
        meditation:
          'Au jour de la Pentecôte, un grand souffle remplit la maison, des langues de feu se posent sur chacun, et la peur des disciples se change en parole. Chacun entend les merveilles de Dieu dans sa propre langue : l’Esprit n’efface pas les différences, il les rassemble. Au terme de ces neuf jours, accueillons ce don non comme un souvenir, mais comme un envoi. Que le feu reçu nous rende audacieux pour annoncer et pour aimer, là où nous sommes.',
        prayer:
          'Esprit Saint, tu es venu sur les apôtres réunis avec Marie. Viens aujourd’hui sur nous et sur tous ceux pour qui nous avons prié. Allume en nous le feu de ton amour, ouvre nos bouches pour dire les merveilles de Dieu, et envoie-nous vivre de toi dans la vie de chaque jour. Amen.',
        repeated: [once('viens-esprit-saint'), ...MARIAN],
      },
    ],
  },
  {
    id: 'saint-joseph',
    title: 'Neuvaine à saint Joseph',
    short: 'Neuf jours avec saint Joseph, l’homme juste de Nazareth et gardien de la Sainte Famille, pour lui confier une intention.',
    days: [
      {
        title: 'Un homme juste',
        passage: [40, 1, 18, 21],
        meditation:
          'Joseph apprend que Marie attend un enfant, et ce n’est pas de lui. L’Évangile le dit juste : il cherche à ne pas la blâmer. Dans la nuit de son trouble, un ange lui parle en songe : ne crains pas. Sa justice n’est pas la dureté d’une règle, c’est la délicatesse d’un cœur qui cherche le bien de l’autre. Aujourd’hui, confions à saint Joseph nos situations confuses ou blessantes, et demandons de pouvoir agir avec la même droiture et la même douceur.',
        prayer:
          'Saint Joseph, homme juste, toi qui as su écouter dans le silence, aide-nous à ne pas juger trop vite. Quand nous sommes troublés, apprends-nous à chercher la volonté de Dieu avec droiture et douceur. Prie pour nous et pour l’intention que nous portons ensemble. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Il prit chez lui son épouse',
        passage: [40, 1, 22, 25],
        meditation:
          'Au réveil, Joseph fait ce que l’ange lui a demandé. Il prend chez lui Marie et il donne son nom à l’enfant : il devient père par l’obéissance de la foi. Il ne dit pas un mot dans l’Évangile, mais son oui est dans les actes. Aujourd’hui, demandons la grâce de ces oui concrets qui engagent : accueillir ce que Dieu nous confie, même quand nous ne comprenons pas tout, et prendre chez nous ceux qu’il met sur notre route.',
        prayer:
          'Saint Joseph, tu as dit oui sans bruit et tu as pris chez toi Marie et Jésus. Obtiens-nous la grâce d’accueillir ce que Dieu nous confie. Rends-nous fidèles dans les petites choses, attentifs à ceux qui dépendent de nous, et confiants quand l’avenir nous échappe. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'À Bethléem',
        passage: [42, 2, 1, 7],
        meditation:
          'Un recensement oblige Joseph à prendre la route avec Marie sur le point d’accoucher. À Bethléem, pas de place dans l’hôtellerie : le Fils de Dieu naît dans la pauvreté, et c’est Joseph qui cherche, s’inquiète, trouve un abri. Il veille sur la naissance sans la maîtriser. Aujourd’hui, pensons à ceux qui cherchent un toit ou une place, et demandons à saint Joseph de nous apprendre à faire de la place à Dieu et aux autres dans nos agendas et dans nos maisons.',
        prayer:
          'Saint Joseph, toi qui as cherché un abri pour l’Enfant qui allait naître, protège ceux qui n’ont pas de logement ni de place. Ouvre nos maisons et nos cœurs à l’accueil. Aide-nous à préparer, dans la pauvreté et la confiance, un lieu où le Seigneur puisse venir. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Présenté au Temple',
        passage: [42, 2, 22, 33],
        meditation:
          'Joseph et Marie montent au Temple pour présenter leur enfant, comme la Loi le demande. Ils sont fidèles aux gestes simples de leur peuple. Et là, un vieillard prend l’enfant dans ses bras et bénit Dieu, pendant que le père et la mère s’étonnent de ce qu’on dit de lui. Joseph apprend que l’enfant dépasse ce qu’il comprend. Demandons aujourd’hui de rester fidèles aux gestes quotidiens de la foi, et de nous laisser étonner par Dieu sans nous raidir.',
        prayer:
          'Saint Joseph, fidèle aux gestes de la foi, apprends-nous à présenter à Dieu ce que nous avons de plus cher. Garde-nous dans l’émerveillement devant ses œuvres, même quand elles nous dépassent. Prie pour nos familles et pour les enfants confiés à notre prière. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'La fuite en Égypte',
        passage: [40, 2, 13, 15],
        meditation:
          'Averti en songe, Joseph se lève la nuit même, prend l’enfant et sa mère, et part. Il ne discute pas et ne remet pas à demain. Il protège sa famille au prix d’un exil, sans savoir quand il reviendra. Dans l’histoire de la foi, il est le gardien qui agit à l’heure juste. Aujourd’hui, prions pour les familles obligées de quitter leur maison, pour les réfugiés et les exilés, et demandons la promptitude de saint Joseph pour répondre à l’appel quand il se présente.',
        prayer:
          'Saint Joseph, gardien de la Sainte Famille, toi qui as connu la route de l’exil, veille sur les familles obligées de fuir. Donne-leur un abri, du courage et des mains tendues. Rends-nous prompts à secourir et à protéger ceux qui sont en danger. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Le retour à Nazareth',
        passage: [40, 2, 19, 23],
        meditation:
          'Hérode est mort, mais Joseph n’agit pas à la légère : il reçoit un nouvel avertissement, et choisit de s’installer à Nazareth, en Galilée, loin du pouvoir. Il veut une vie simple pour l’enfant, à l’abri du bruit. La sainteté de Joseph n’a rien d’éclatant : c’est une présence fidèle dans la vie ordinaire. Aujourd’hui, demandons à aimer notre quotidien comme un lieu où Dieu grandit, au village, au bureau, à la maison.',
        prayer:
          'Saint Joseph, homme de Nazareth, tu nous apprends la valeur d’une vie cachée et fidèle. Aide-nous à aimer notre quotidien, à y chercher Dieu, et à ne pas mépriser les tâches simples. Fais de nos foyers des lieux de paix où l’on prie et où l’on se pardonne. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Au Temple, à douze ans',
        passage: [42, 2, 41, 52],
        meditation:
          'Pendant trois jours, Joseph et Marie cherchent Jésus avec angoisse, puis le retrouvent dans le Temple. Joseph est père d’un enfant qui parle de son vrai Père. Il ne comprend pas tout, mais il ramène Jésus à Nazareth, où l’enfant grandit en sagesse et reste soumis. La paternité de Joseph consiste à guider sans posséder. Aujourd’hui, prions pour les parents inquiets pour leurs enfants, et pour tous ceux qui ont une autorité à exercer avec humilité.',
        prayer:
          'Saint Joseph, père du Christ, toi qui as cherché Jésus dans l’angoisse puis l’as retrouvé avec joie, prie pour les parents inquiets. Apprends-nous à guider sans posséder, à faire confiance à la liberté de ceux que nous aimons, et à les confier à Dieu. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Le fils du charpentier',
        passage: [40, 13, 54, 56],
        meditation:
          'Les gens de Nazareth s’étonnent de la sagesse de Jésus : n’est-il pas le fils du charpentier ? Ils connaissent la famille et le métier. Dieu a voulu un Fils élevé dans un atelier, auprès d’un père qui travaillait de ses mains. Cela donne au travail une dignité : il n’est pas un temps perdu, il est un lieu où l’on grandit. Aujourd’hui, confions à saint Joseph notre travail ou notre recherche d’emploi, et ceux qui peinent à gagner leur vie.',
        prayer:
          'Saint Joseph, artisan de Nazareth, patron de ceux qui travaillent, bénis nos tâches et donne-nous de les accomplir avec soin. Veille sur ceux qui cherchent un emploi, sur ceux qui sont fatigués ou mal payés. Que notre travail serve le bien de tous et la gloire de Dieu. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
      {
        title: 'Heureux l’homme qui craint le Seigneur',
        passage: [19, 112, 1, 7],
        meditation:
          'Le psalmiste décrit l’homme qui craint le Seigneur : sa maison est comblée, sa justice demeure, il ne tremble pas devant les mauvaises nouvelles. La tradition chrétienne reconnaît volontiers saint Joseph dans ce portrait. Au terme de la neuvaine, confions-lui l’intention de notre groupe, avec la certitude qu’il sait garder ce qu’on lui remet. Tournons-nous vers lui comme vers un père attentif, et laissons-nous guider par sa discrétion, sa fidélité et sa confiance en Dieu.',
        prayer:
          'Saint Joseph, père très aimant, nous te confions ce que nous avons porté ces neuf jours. Présente notre intention à Jésus et à Marie. Garde nos familles, soutiens l’Église, et obtiens-nous la grâce de vivre dans la confiance, la droiture et la paix. Amen.',
        repeated: [once('notre-pere'), once('je-vous-salue-joseph'), once('gloire-au-pere')],
      },
    ],
  },
  {
    id: 'sacre-coeur',
    title: 'Neuvaine au Sacré-Cœur',
    short: 'Neuf jours pour entrer dans l’amour du Christ et lui confier ce qui nous pèse, à la lumière de la tendresse de Dieu.',
    days: [
      {
        title: 'Un cœur nouveau',
        passage: [26, 36, 25, 28],
        meditation:
          'Par le prophète, Dieu promet : je vous donnerai un cœur nouveau, j’ôterai de votre chair le cœur de pierre et je mettrai en vous mon Esprit. Le chemin vers le Cœur du Christ commence par cette promesse : Dieu ne nous demande pas de nous refaire seuls. Il veut guérir ce qui s’est endurci en nous. Aujourd’hui, présentons-lui un endroit de notre vie devenu dur ou fermé, et demandons-lui d’y mettre un cœur de chair, sensible à l’amour.',
        prayer:
          'Seigneur Jésus, doux et humble de cœur, prends notre cœur de pierre et donne-nous un cœur de chair. Guéris ce qui s’est endurci en nous par la rancune, la peur ou la fatigue. Mets en nous ton Esprit, et fais-nous vivre de ton amour. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Un père qui ne se lasse pas',
        passage: [28, 11, 1, 4],
        meditation:
          'Dieu parle comme un père qui a appris à marcher à son enfant, qui l’a conduit avec des liens d’amour et lui a donné à manger. Israël s’est éloigné, et pourtant l’amour de Dieu ne se retire pas. Le Cœur de Jésus est ce cœur de Père qui se laisse toucher. Aujourd’hui, regardons notre propre histoire à la lumière de ces gestes de tendresse que nous n’avons pas toujours remarqués, et remercions pour les fois où Dieu nous a portés sans que nous le sachions.',
        prayer:
          'Cœur de Jésus, cœur d’un Père qui n’abandonne pas, merci pour les gestes de tendresse que nous n’avons pas vus. Quand nous nous éloignons, ramène-nous. Apprends-nous à nous laisser aimer, et à aimer à notre tour ceux que tu mets près de nous. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Doux et humble de cœur',
        passage: [40, 11, 25, 30],
        meditation:
          'Jésus se tourne vers le Père avec joie, puis vers nous : venez à moi, vous tous qui êtes fatigués et chargés. Il ne promet pas d’enlever toute charge, mais de la porter avec nous. Son joug est doux, son fardeau léger, parce qu’il avance à nos côtés. Apprendre de lui, c’est apprendre la douceur et l’humilité, loin du rendement. Aujourd’hui, déposons à ses pieds notre fatigue, avec les noms de ceux qui n’en peuvent plus, et laissons-nous soulager.',
        prayer:
          'Seigneur Jésus, doux et humble de cœur, nous venons à toi avec nos fatigues et nos fardeaux. Soulage ceux qui sont accablés, console ceux qui pleurent, et apprends-nous ta douceur. Que ton joug nous soit léger parce que nous le portons avec toi. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'La brebis perdue',
        passage: [42, 15, 3, 7],
        meditation:
          'Un berger laisse quatre-vingt-dix-neuf brebis pour chercher celle qui s’est égarée, la trouve, la charge sur ses épaules et fait la fête. Le Cœur du Christ ne se résigne pas à perdre quelqu’un. Chacun compte pour lui comme s’il était seul. Aujourd’hui, pensons à une personne qui s’est éloignée de la foi ou de nous, et confions-la au bon berger. Demandons aussi de reconnaître que nous avons été cherchés et portés, nous aussi.',
        prayer:
          'Bon Pasteur, toi qui cherches la brebis perdue, ramène vers toi ceux que nous aimons et qui se sont éloignés. Donne-nous la patience de ceux qui attendent, et la joie de ceux qui retrouvent. Porte-nous sur tes épaules quand nous n’avons plus de forces. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Celui qui a soif',
        passage: [43, 7, 37, 39],
        meditation:
          'Au dernier jour de la fête, Jésus crie : si quelqu’un a soif, qu’il vienne à moi et qu’il boive. Des fleuves d’eau vive couleront de son sein. La soif est un désir que le monde ne comble pas ; Jésus ne la méprise pas, il l’invite. Du Cœur du Christ jaillit l’Esprit qui désaltère. Aujourd’hui, reconnaissons notre soif, d’être aimés, d’être pardonnés, de paix, et venons boire à cette source, sans nous comparer aux autres.',
        prayer:
          'Seigneur Jésus, source d’eau vive, nous avons soif de toi. Désaltère ceux qui cherchent le sens de leur vie, ceux qui sont las et desséchés. Fais couler en nous le fleuve de ton Esprit, afin que nous soyons à notre tour une source pour les autres. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Demeurez dans mon amour',
        passage: [43, 15, 9, 13],
        meditation:
          'Comme le Père m’a aimé, je vous ai aimés : demeurez dans mon amour. Jésus ne donne pas un ordre froid, il invite à rester, comme on demeure dans une maison où l’on est attendu. Son commandement est de nous aimer les uns les autres comme lui. Il n’y a pas de plus grand amour que de donner sa vie pour ses amis. Aujourd’hui, choisissons un geste concret qui coûte un peu, pour quelqu’un de notre entourage.',
        prayer:
          'Cœur de Jésus, brûlant d’amour, fais-nous demeurer en toi. Donne-nous d’aimer comme tu nous as aimés, avec simplicité et sans calcul. Brise nos égoïsmes, élargis notre cœur, et fais de notre groupe un lieu où l’on se donne les uns aux autres. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Le côté ouvert',
        passage: [43, 19, 31, 37],
        meditation:
          'Sur la croix, un soldat perce le côté de Jésus, et il en sort du sang et de l’eau. L’évangéliste insiste : celui qui l’a vu en témoigne. La tradition y reconnaît la source des sacrements, l’Église née du côté ouvert du Christ. Le Cœur transpercé nous montre jusqu’où va l’amour : il ne se retire pas devant la blessure. Aujourd’hui, regardons celui qu’ils ont transpercé, et offrons-lui nos propres blessures, pour qu’il les guérisse.',
        prayer:
          'Cœur de Jésus transpercé pour nous, source de vie et de miséricorde, nous contemplons ton amour jusqu’au bout. Guéris nos blessures, pardonne nos péchés, et nourris-nous par les sacrements de ton Église. Que ton côté ouvert soit pour tous un refuge. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Largeur, longueur, hauteur',
        passage: [49, 3, 14, 19],
        meditation:
          'Paul prie à genoux pour que les chrétiens soient enracinés et fondés dans l’amour, et qu’ils comprennent la largeur, la longueur, la hauteur et la profondeur de l’amour du Christ, qui dépasse toute connaissance. On n’arrive pas à mesurer cet amour ; on peut seulement s’y laisser plonger. Aujourd’hui, prenons un moment à genoux ou en silence, et laissons le Christ habiter notre cœur par la foi, au-delà de nos pensées.',
        prayer:
          'Père, par ton Esprit, fortifie en nous l’homme intérieur. Que le Christ habite nos cœurs par la foi, que nous soyons enracinés dans l’amour, et capables de comprendre, avec tous les saints, l’immensité de son amour. Remplis-nous de ta plénitude. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
      {
        title: 'Dieu est amour',
        passage: [62, 4, 7, 12],
        meditation:
          'Tout se résume ici : Dieu est amour. L’amour ne vient pas de nous, il vient de lui, qui nous a aimés le premier et a envoyé son Fils. Si Dieu nous a ainsi aimés, nous devons aussi nous aimer les uns les autres. Personne n’a jamais vu Dieu, mais quand nous nous aimons, il demeure en nous. À la fin de la neuvaine, remercions pour ce cœur ouvert et demandons de rendre cet amour, dans des gestes simples, envers ceux de notre groupe et de notre entourage.',
        prayer:
          'Cœur sacré de Jésus, nous te rendons grâce pour ton amour qui nous a précédés. Nous te confions notre intention commune et ceux qui l’ont portée avec nous. Fais de nous des témoins de ta tendresse, et apprends-nous à aimer en actes et en vérité. Amen.',
        repeated: [once('notre-pere'), once('gloire-au-pere')],
      },
    ],
  },
  {
    id: 'notre-dame',
    title: 'Neuvaine à Notre-Dame',
    short: 'Neuf jours à l’école de Marie, de l’Annonciation au Cénacle, pour lui confier une intention.',
    days: [
      {
        title: 'Je suis la servante du Seigneur',
        passage: [42, 1, 26, 38],
        meditation:
          'L’ange Gabriel est envoyé à une jeune fille de Nazareth. Marie est troublée, elle questionne, puis elle répond : que tout se passe pour moi selon ta parole. Son oui libre ouvre la porte à l’Incarnation. Dieu ne s’impose pas, il demande. Au premier jour de la neuvaine, demandons à Marie de nous apprendre ce oui confiant, qui ne comprend pas tout mais se laisse conduire. Confions-lui l’intention que nous portons ensemble.',
        prayer:
          'Sainte Marie, servante du Seigneur, tu as dit oui avec liberté et confiance. Apprends-nous à répondre à l’appel de Dieu, même quand nous ne voyons pas la suite. Reçois cette neuvaine et l’intention que nous te confions, et présente-la à ton Fils. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Marie visite Élisabeth',
        passage: [42, 1, 39, 45],
        meditation:
          'À peine l’ange parti, Marie se met en route en hâte vers Élisabeth. Elle porte Jésus et elle porte aussi le service. La rencontre est une fête : l’enfant tressaille, Élisabeth s’exclame, bénissant celle qui a cru. La foi de Marie ne l’enferme pas, elle la pousse vers les autres. Aujourd’hui, pensons à quelqu’un à qui rendre visite ou qui a besoin d’un appel, et demandons à Marie la joie du service.',
        prayer:
          'Vierge de la Visitation, tu as couru vers Élisabeth pour la servir. Donne-nous un cœur attentif aux besoins des autres. Fais que nos rencontres soient habitées par la présence du Christ, et que notre joie se partage. Prie pour nos familles, nos voisins, et pour ceux qui sont seuls. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Mon âme exalte le Seigneur',
        passage: [42, 1, 46, 55],
        meditation:
          'Le Magnificat est la prière de Marie : elle y loue Dieu qui regarde l’humilité de sa servante, disperse les orgueilleux et élève les humbles. Sa joie n’est pas triomphante, elle est une reconnaissance : le Puissant a fait pour elle des merveilles. Marie nous apprend à relire notre vie comme une histoire de dons. Aujourd’hui, prenons le temps de dire merci pour trois choses reçues, grandes ou petites, et de chanter, à notre manière, la fidélité de Dieu.',
        prayer:
          'Seigneur, avec Marie nous disons que tu as fait pour nous des merveilles. Merci pour les dons reçus et pour ceux que nous ne voyons pas encore. Rends-nous humbles et joyeux, attentifs aux pauvres, et fidèles à ta promesse. Que notre vie chante ta miséricorde de génération en génération. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Marie gardait tous ces événements',
        passage: [42, 2, 15, 19],
        meditation:
          'Les bergers courent à la crèche et racontent ce qu’ils ont vu. Tout le monde s’étonne, mais Marie, elle, garde toutes ces choses et les médite dans son cœur. Elle ne cherche pas l’effet, elle laisse les événements mûrir. Dans un monde pressé, Marie nous apprend à accueillir sans tout comprendre immédiatement. Aujourd’hui, choisissons un événement de notre semaine, joyeux ou difficile, et gardons-le en silence devant Dieu, comme elle, en cherchant ce qu’il veut dire.',
        prayer:
          'Marie, Mère qui gardes tout dans ton cœur, apprends-nous le silence qui écoute. Aide-nous à relire notre vie à la lumière de Dieu, à ne pas juger trop vite, et à garder la mémoire de ses bienfaits. Prie pour que notre prière devienne plus profonde et plus attentive. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Une épée te transpercera l’âme',
        passage: [42, 2, 33, 35],
        meditation:
          'Syméon bénit l’enfant et annonce à Marie qu’une épée lui transpercera l’âme. Dès le commencement, la joie de la mère est mêlée à la douleur. Marie n’a pas été épargnée par l’épreuve, et elle ne s’est pas détournée. Elle reste fidèle quand les choses deviennent obscures. Aujourd’hui, confions à Notre-Dame ceux qui souffrent : les mères en deuil, les familles blessées, les malades. Demandons-lui de nous apprendre à rester présents auprès de ceux qui pleurent, sans fuir.',
        prayer:
          'Notre-Dame des Douleurs, toi qui as connu l’épreuve et n’as pas quitté ton Fils, console ceux qui souffrent. Sois près des mères et des pères en deuil, des malades, des personnes seules. Donne-nous la force de rester fidèles dans la nuit et de soutenir ceux qui pleurent. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Faites tout ce qu’il vous dira',
        passage: [43, 2, 1, 11],
        meditation:
          'À Cana, Marie remarque que le vin manque, avant même que les mariés s’en aperçoivent. Elle ne règle pas la situation, elle la confie à Jésus, puis dit aux serviteurs : faites tout ce qu’il vous dira. Son rôle est de montrer son Fils et de nous faire confiance à sa parole. Aujourd’hui, présentons à Marie un manque de notre vie, ou de ceux qui nous entourent, et décidons de faire un pas d’obéissance à l’Évangile.',
        prayer:
          'Marie, toi qui vois ce qui manque, présente à ton Fils nos besoins. Apprends-nous à faire tout ce qu’il nous dira, même lorsque ses demandes nous surprennent. Que notre eau devienne vin, et que notre joie renaisse. Veille sur les foyers et les couples en difficulté. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Voici ta mère',
        passage: [43, 19, 25, 27],
        meditation:
          'Au pied de la croix se tiennent Marie et le disciple que Jésus aimait. Du haut de la croix, le Christ confie sa mère au disciple et le disciple à sa mère. Dans ce don ultime, il nous donne Marie pour mère. Le disciple la prend chez lui : nous pouvons faire de même. Aujourd’hui, accueillons-la dans notre maison intérieure, et disons-lui avec simplicité nos peines et nos joies, comme un enfant à sa mère.',
        prayer:
          'Sainte Marie, Mère de Dieu et notre mère, tu es restée près de la croix. Nous te prenons chez nous, avec confiance. Garde-nous dans la foi, prie pour nous dans les épreuves, et conduis-nous vers ton Fils. Prends sous ta protection ceux qui n’ont plus de mère et ceux qui souffrent. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Avec Marie au Cénacle',
        passage: [44, 1, 12, 14],
        meditation:
          'Après l’Ascension, les apôtres reviennent à Jérusalem. Ils montent à la chambre haute, et tous persévèrent d’un même cœur dans la prière, avec quelques femmes, Marie, la mère de Jésus, et ses frères. Marie est au milieu de l’Église naissante, comme une mère. Elle prie avec eux et pour eux. Aujourd’hui, prions avec elle pour notre Église, pour notre paroisse et pour notre groupe, afin que nous persévérions dans l’unité et la prière.',
        prayer:
          'Marie, Mère de l’Église, tu as prié avec les apôtres dans l’attente de l’Esprit. Prie avec nous pour l’unité des chrétiens, pour les pasteurs et pour tous les baptisés. Fais de notre groupe une petite chambre haute, où l’on persévère dans la prière et la charité fraternelle. Amen.',
        repeated: MARIAN,
      },
      {
        title: 'Heureux ceux qui gardent la Parole',
        passage: [42, 11, 27, 28],
        meditation:
          'Une femme dans la foule s’écrie : heureux le sein qui t’a porté ! Jésus répond : heureux plutôt ceux qui écoutent la parole de Dieu et la gardent. Ce n’est pas un reproche à sa mère : c’est la louange de sa foi la plus profonde. Marie est bienheureuse parce qu’elle a écouté et gardé. Au dernier jour de cette neuvaine, demandons de recevoir à sa suite la Parole, de la garder dans notre cœur, et de la mettre en pratique avec elle.',
        prayer:
          'Notre-Dame, tu es heureuse d’avoir cru. Nous te rendons grâce pour ces neuf jours de prière, et nous te confions l’intention qui nous a rassemblés. Obtiens-nous d’écouter la Parole de Dieu, de la garder et de la vivre. Garde-nous sous ta protection, et conduis-nous à Jésus, ton Fils. Amen.',
        repeated: MARIAN,
      },
    ],
  },
];

/** Le modèle intégré, ou undefined pour la neuvaine personnalisée. */
export function novenaTemplate(model: NovenaModel): NovenaTemplate | undefined {
  return NOVENAS.find((template) => template.id === model);
}

export const CUSTOM_TITLE = 'Neuvaine du groupe';
export const CUSTOM_SHORT =
  'Tu écris la prière que le groupe récite chaque jour pendant neuf jours, avec si tu veux un passage biblique par jour.';

/** Le titre d'une neuvaine à partir de son modèle. */
export function novenaModelTitle(model: NovenaModel): string {
  return novenaTemplate(model)?.title ?? CUSTOM_TITLE;
}

/** Les suites de passages que peut choisir une neuvaine personnalisée : neuf références, une par jour. */
export const PASSAGE_SET_DATA: Record<PassageSetId, { name: string; passages: Passage[] }> = {
  psaumes: {
    name: 'Neuf psaumes',
    passages: [
      [19, 23, 1, 6],
      [19, 27, 1, 5],
      [19, 46, 2, 8],
      [19, 62, 2, 9],
      [19, 91, 1, 6],
      [19, 103, 1, 5],
      [19, 121, 1, 8],
      [19, 130, 1, 8],
      [19, 145, 13, 19],
    ],
  },
  evangile: {
    name: 'Neuf passages de l’Évangile',
    passages: [
      [40, 5, 3, 10],
      [40, 6, 9, 13],
      [40, 7, 7, 11],
      [40, 11, 28, 30],
      [43, 6, 35, 40],
      [43, 10, 11, 16],
      [43, 14, 1, 6],
      [43, 15, 12, 17],
      [42, 10, 25, 28],
    ],
  },
};
