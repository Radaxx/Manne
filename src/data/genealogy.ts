import { BOOKS } from './bible';
import type { Passage } from './content';

/** Où lire le passage : livre, chapitre, premier et dernier verset. */
export type Place = [book: number, chapter: number, from: number, to: number];

export type Ancestor = {
  name: string;
  /** Une autre orthographe, celle de Luc ou d'un autre livre. */
  alt?: string;
  /** Les années vécues, quand la Genèse les donne. */
  years?: number;
  /** La femme nommée avec lui. */
  with?: string;
  /** Une ou deux phrases pour situer le personnage : la carte s'affiche en grand. */
  note?: string;
  /** Une remarque discrète sous le nom. */
  aside?: string;
  read?: Place;
  /** Le bout de la lignée. */
  final?: boolean;
};

export type Branch = { label: string; caption: string; people: Ancestor[] };

export type Stage =
  | { kind: 'trunk'; title?: string; caption?: string; people: Ancestor[] }
  | { kind: 'fork'; title: string; caption: string; left: Branch; right: Branch };

/** « Genèse 3:20 », « 1 Rois 12:16 »… */
export const placeLabel = ([book, chapter, from, to]: Place) => `${BOOKS[book - 1].name} ${chapter}:${from}${to > from ? `-${to}` : ''}`;

/** Le passage à ouvrir dans la feuille « chapitre complet », sans toucher au marque-page. */
export const placePassage = (place: Place): Passage => {
  const [book, chapter, from, to] = place;
  return {
    id: `genealogie-${book}-${chapter}-${from}`,
    book,
    bookName: BOOKS[book - 1].name,
    chapter,
    from,
    to,
    reference: placeLabel(place),
    text: '',
  };
};

const GN = 1;
const JOSUE = 6;
const RUTH = 8;
const SAMUEL1 = 9;
const SAMUEL2 = 10;
const ROIS1 = 11;
const ROIS2 = 12;
const CHRON1 = 13;
const ESDRAS = 15;
const MATTHIEU = 40;
const LUC = 42;

const names = (...list: string[]): Ancestor[] => list.map((name) => ({ name }));

/**
 * D'Adam à Jésus. Les noms suivent la Bible Louis Segond embarquée dans l'app :
 * Genèse 5 et 11 jusqu'à Abraham, Matthieu 1 et Ruth 4 ensuite, Luc 3 pour la seconde lignée.
 */
export const TREE: Stage[] = [
  {
    kind: 'trunk',
    title: 'D’Adam à Noé',
    caption: 'Dix générations avant le déluge · Genèse 5',
    people: [
      {
        name: 'Adam',
        with: 'Ève',
        years: 930,
        note: 'Le premier homme et la première femme, créés à l’image de Dieu. Adam donne à sa femme le nom d’Ève : elle est « la mère de tous les vivants ».',
        aside: 'Caïn et Abel, leurs aînés, ne sont pas de cette lignée : Caïn tua son frère.',
        read: [GN, 3, 20, 20],
      },
      {
        name: 'Seth',
        years: 912,
        note: 'Ève voit en lui le fils que Dieu lui a donné « à la place d’Abel ». Adam l’engendre « à sa ressemblance ».',
        read: [GN, 4, 25, 25],
      },
      { name: 'Énosch', alt: 'Lc : Énos', years: 905 },
      { name: 'Kénan', alt: 'Lc : Kaïnan', years: 910 },
      { name: 'Mahalaleel', alt: 'Lc : Maléléel', years: 895 },
      { name: 'Jéred', alt: 'Lc : Jared', years: 962 },
      {
        name: 'Hénoc',
        alt: 'Lc : Énoch',
        years: 365,
        note: '« Hénoc marcha avec Dieu ; puis il ne fut plus, parce que Dieu le prit. »',
        read: [GN, 5, 24, 24],
      },
      { name: 'Metuschélah', alt: 'Lc : Mathusala', years: 969, aside: 'Le plus long de tous les âges cités dans la Bible.' },
      { name: 'Lémec', alt: 'Lc : Lamech', years: 777 },
      {
        name: 'Noé',
        years: 950,
        note: 'Un homme juste et intègre, qui marchait avec Dieu. Il construit l’arche et traverse le déluge avec sa famille.',
        aside: 'Père de Sem, Cham et Japhet : la lignée continue par Sem.',
        read: [GN, 6, 9, 9],
      },
    ],
  },
  {
    kind: 'trunk',
    title: 'De Noé à Abraham',
    caption: 'Dix générations dans la Genèse · Luc en compte une de plus · Genèse 11',
    people: [
      { name: 'Sem' },
      { name: 'Arpacschad', alt: 'Lc : Arphaxad' },
      {
        name: 'Kaïnam',
        alt: 'Chez Luc seulement',
        aside: 'Absent de la Genèse hébraïque, il figure chez Luc et dans la version grecque de la Genèse.',
      },
      { name: 'Schélach', alt: 'Lc : Sala' },
      { name: 'Héber', alt: 'Lc : Éber' },
      { name: 'Péleg', alt: 'Lc : Phalek', aside: 'Son nom rappelle que « de son temps la terre fut partagée » (Genèse 10:25).' },
      { name: 'Rehu', alt: 'Lc : Ragau' },
      { name: 'Serug', alt: 'Lc : Seruch' },
      { name: 'Nachor' },
      {
        name: 'Térach',
        alt: 'Lc : Thara',
        note: 'Il quitte Ur en Chaldée avec son fils Abram pour aller au pays de Canaan, et s’arrête à Charan.',
        read: [GN, 11, 31, 31],
      },
    ],
  },
  {
    kind: 'trunk',
    title: 'D’Abraham à David',
    caption: 'Quatorze générations · Matthieu 1:2-6 et Ruth 4',
    people: [
      {
        name: 'Abraham',
        with: 'Sara',
        note: 'Dieu l’appelle à quitter son pays et lui promet une grande descendance : en lui « toutes les familles de la terre seront bénies ».',
        read: [GN, 12, 1, 3],
      },
      {
        name: 'Isaac',
        with: 'Rebecca',
        note: 'Le fils de la promesse, que Sara met au monde dans sa vieillesse, « au temps fixé » par Dieu.',
        read: [GN, 21, 2, 2],
      },
      {
        name: 'Jacob',
        with: 'Léa',
        note: 'Il lutte avec Dieu et reçoit le nom d’Israël. De ses douze fils viendront les douze tribus.',
        read: [GN, 32, 28, 28],
      },
      {
        name: 'Juda',
        with: 'Thamar',
        note: 'Fils de Jacob et de Léa. De Thamar il a deux jumeaux, Pharès et Zara. Jacob lui annonce que « le sceptre ne s’éloignera point de Juda ».',
        read: [GN, 49, 10, 10],
      },
      {
        name: 'Pharès',
        alt: 'Gn : Pérets',
        aside: 'Jumeau de Zara. À sa naissance : « Quelle brèche tu as faite ! » (Genèse 38:29).',
      },
      { name: 'Esrom', alt: 'Rt : Hetsron' },
      { name: 'Aram', alt: 'Rt : Ram', aside: 'Luc place ici deux noms de plus, Arni et Admin.' },
      { name: 'Aminadab', alt: 'Rt : Amminadab' },
      { name: 'Naasson', alt: 'Rt : Nachschon' },
      {
        name: 'Salmon',
        with: 'Rahab',
        note: 'Matthieu nomme Rahab, que la tradition reconnaît dans la femme de Jéricho qui accueillit les deux espions de Josué.',
        read: [JOSUE, 2, 1, 1],
      },
      {
        name: 'Boaz',
        alt: 'Lc : Booz',
        with: 'Ruth',
        note: 'Ruth la Moabite reste fidèle à sa belle-mère Naomi : « ton peuple sera mon peuple, et ton Dieu sera mon Dieu ».',
        read: [RUTH, 1, 16, 16],
      },
      { name: 'Obed', alt: 'Lc : Jobed' },
      {
        name: 'Isaï',
        aside: 'De Bethléem, père de huit fils dont David est le plus jeune (1 Samuel 16–17).',
        read: [SAMUEL1, 16, 1, 1],
      },
      {
        name: 'David',
        with: 'Bethsabée, « la femme d’Urie »',
        note: 'Berger de Bethléem devenu roi d’Israël. Dieu lui promet : « ton trône sera pour toujours affermi ».',
        read: [SAMUEL2, 7, 16, 16],
      },
    ],
  },
  {
    kind: 'fork',
    title: 'De David à la déportation',
    caption: 'Matthieu suit les rois de Juda, Luc passe par Nathan, un autre fils de David. Les deux lignées se retrouvent à Salathiel.',
    left: {
      label: 'Selon Matthieu',
      caption: 'les rois de Juda',
      people: [
        {
          name: 'Salomon',
          note: 'Fils de David et de Bethsabée. Il bâtit à Jérusalem la maison de l’Éternel.',
          read: [ROIS1, 6, 1, 1],
        },
        { name: 'Roboam', aside: 'Le royaume se divise sous son règne (1 Rois 12).' },
        ...names('Abia', 'Asa', 'Josaphat'),
        { name: 'Joram', aside: 'Matthieu passe ici trois rois : Achazia, Joas et Amatsia.' },
        ...names('Ozias', 'Joatham', 'Achaz'),
        {
          name: 'Ézéchias',
          note: 'Un roi fidèle : « Il mit sa confiance en l’Éternel ».',
          read: [ROIS2, 18, 5, 5],
        },
        ...names('Manassé', 'Amon'),
        {
          name: 'Josias',
          note: 'Sous son règne, on retrouve le livre de la loi dans la maison de l’Éternel.',
          read: [ROIS2, 22, 8, 8],
        },
        {
          name: 'Jéchonias',
          alt: '2 R : Jojakin',
          note: 'Emmené captif à Babylone avec les grands du pays. C’est l’exil.',
          read: [ROIS2, 24, 15, 15],
        },
      ],
    },
    right: {
      label: 'Selon Luc',
      caption: 'par Nathan',
      people: [
        {
          name: 'Nathan',
          note: 'Un autre fils de David et de Bethsabée.',
          read: [CHRON1, 3, 5, 5],
        },
        ...names('Mattatha', 'Menna', 'Méléa', 'Éliakim', 'Jonam', 'Joseph', 'Juda', 'Siméon', 'Lévi', 'Matthat', 'Jorim', 'Éliézer'),
        { name: 'Jésus', alt: 'Josué en hébreu' },
        ...names('Er', 'Elmadam', 'Kosam', 'Addi', 'Melchi', 'Néri'),
      ],
    },
  },
  {
    kind: 'trunk',
    title: 'Le retour d’exil',
    caption: 'Les deux lignées se rejoignent',
    people: [
      { name: 'Salathiel', alt: 'Esd : Schealthiel', aside: 'Fils de Jéchonias chez Matthieu, de Néri chez Luc.' },
      {
        name: 'Zorobabel',
        note: 'Au retour de Babylone, il rebâtit l’autel du Dieu d’Israël et relève le Temple avec le peuple.',
        read: [ESDRAS, 3, 2, 2],
      },
    ],
  },
  {
    kind: 'fork',
    title: 'De Zorobabel à Joseph',
    caption: 'Les deux lignées se séparent de nouveau, jusqu’à Joseph.',
    left: {
      label: 'Selon Matthieu',
      caption: 'Abiud et ses fils',
      people: names('Abiud', 'Éliakim', 'Azor', 'Sadok', 'Achim', 'Éliud', 'Éléazar', 'Matthan', 'Jacob'),
    },
    right: {
      label: 'Selon Luc',
      caption: 'Rhésa et ses fils',
      people: names(
        'Rhésa',
        'Joanan',
        'Joda',
        'Josech',
        'Sémeï',
        'Mattathias',
        'Maath',
        'Naggaï',
        'Esli',
        'Nahum',
        'Amos',
        'Mattathias',
        'Joseph',
        'Jannaï',
        'Melchi',
        'Lévi',
        'Matthat',
        'Héli',
      ),
    },
  },
  {
    kind: 'trunk',
    title: 'Jusqu’à Joseph',
    caption: 'Matthieu et Luc se retrouvent',
    people: [
      {
        name: 'Joseph',
        with: 'Marie',
        note: 'Un homme de bien. Un ange lui demande de prendre Marie chez lui ; c’est lui qui donne à l’enfant le nom de Jésus.',
        aside: 'Fils de Jacob chez Matthieu, d’Héli chez Luc : la tradition l’explique par un lévirat, ou par la lignée de Marie chez Luc.',
        read: [MATTHIEU, 1, 16, 16],
      },
      {
        name: 'Jésus',
        final: true,
        note: 'Fils de Marie. Pour Matthieu, « fils de David, fils d’Abraham » ; pour Luc, qui remonte jusqu’à Adam, « fils de Dieu ».',
        read: [LUC, 3, 38, 38],
      },
    ],
  },
];
