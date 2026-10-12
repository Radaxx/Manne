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
];

export type Quiz = { question: string; options: string[]; answer: number; explanation: string };

export const QUIZZES: Quiz[] = [
  { question: 'Qui a construit l’arche ?', options: ['Abraham', 'Noé', 'Moïse'], answer: 1, explanation: 'Genèse 6 à 9.' },
  { question: 'Combien de livres compte le Nouveau Testament ?', options: ['24', '27', '31'], answer: 1, explanation: 'De Matthieu à l’Apocalypse : 27 livres.' },
  { question: 'Dans quelle ville Jésus est-il né ?', options: ['Nazareth', 'Jérusalem', 'Bethléem'], answer: 2, explanation: 'Matthieu 2:1 et Luc 2:4-7.' },
  { question: 'Qui fut englouti par un grand poisson ?', options: ['Jonas', 'Élie', 'Daniel'], answer: 0, explanation: 'Jonas 2:1 (Louis Segond) — trois jours et trois nuits.' },
  { question: 'Qui a vaincu Goliath ?', options: ['Saül', 'Samson', 'David'], answer: 2, explanation: '1 Samuel 17, avec une fronde et une pierre.' },
  { question: 'Combien d’apôtres Jésus a-t-il choisis ?', options: ['7', '12', '70'], answer: 1, explanation: 'Marc 3:14 — il en établit douze.' },
  { question: 'Quel est le premier miracle de Jésus dans l’Évangile de Jean ?', options: ['La multiplication des pains', 'L’eau changée en vin', 'La guérison d’un aveugle'], answer: 1, explanation: 'Aux noces de Cana, Jean 2:1-11.' },
  { question: 'Qui a renié Jésus trois fois ?', options: ['Judas', 'Thomas', 'Pierre'], answer: 2, explanation: 'Luc 22:54-62, avant que le coq ne chante.' },
  { question: 'Dans quel livre Moïse reçoit-il les Dix Commandements au Sinaï ?', options: ['Genèse', 'Exode', 'Lévitique'], answer: 1, explanation: 'Exode 20.' },
  { question: 'Quel est le premier livre du Nouveau Testament ?', options: ['Matthieu', 'Marc', 'Actes'], answer: 0, explanation: 'L’Évangile selon Matthieu ouvre le Nouveau Testament.' },
];

export type Person = { clues: string[]; name: string; reference: string };

export const PERSONS: Person[] = [
  {
    clues: ['Je suis moabite.', 'Je n’ai pas voulu quitter ma belle-mère Noémi.', 'Je suis l’arrière-grand-mère du roi David.'],
    name: 'Ruth',
    reference: 'Ruth 1 à 4',
  },
  {
    clues: ['J’étais chef des collecteurs d’impôts à Jéricho.', 'J’étais petit de taille.', 'Je suis monté sur un sycomore pour voir Jésus.'],
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
    clues: ['Je me tenais près de la croix.', 'Je suis allée au tombeau le premier jour de la semaine.', 'J’ai d’abord pris Jésus ressuscité pour le jardinier.'],
    name: 'Marie de Magdala',
    reference: 'Jean 20:1-18',
  },
  {
    clues: ['Mes frères m’ont vendu comme esclave.', 'J’ai expliqué les rêves de Pharaon.', 'Je suis devenu gouverneur de l’Égypte.'],
    name: 'Joseph',
    reference: 'Genèse 37 à 50',
  },
];

export const REFLECTIONS: string[] = [
  'Pour qui pourrais-tu prier aujourd’hui ?',
  'Qu’est-ce qui t’inquiète en ce moment ? Dépose-le, juste une minute.',
  'Cite trois choses pour lesquelles tu es reconnaissant·e aujourd’hui.',
  'À qui pourrais-tu pardonner, même un petit peu ?',
  'Quel verset as-tu envie de garder avec toi jusqu’à ce soir ?',
  'Envoie un message d’encouragement à quelqu’un qui en a besoin.',
];
