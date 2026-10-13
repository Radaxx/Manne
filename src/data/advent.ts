// Le parcours de l'Avent : un passage de la Bible, une courte méditation et un geste pour chaque jour.
// Les trois premières semaines suivent les jours depuis le 1er dimanche de l'Avent (un dimanche tous les
// sept jours) ; du 17 au 24 décembre, le parcours suit la date et les grandes antiennes « Ô ».
// Les passages sont lus dans la traduction choisie (livre, chapitre, premier et dernier verset).

import type { JourneyDay, JourneyWeek } from '../journeys';

export const ADVENT_WEEKS: JourneyWeek[] = [
  { when: '1re semaine', theme: 'Veiller', blurb: 'Se réveiller et rester tourné vers celui qui vient.' },
  { when: '2e semaine', theme: 'Préparer le chemin', blurb: 'Avec Jean-Baptiste, faire de la place et se convertir.' },
  { when: '3e semaine', theme: 'Se réjouir', blurb: 'Le Seigneur est proche : la joie de Gaudete.' },
  {
    when: 'Du 17 au 24 décembre',
    theme: 'Accueillir',
    blurb: 'Avec Marie, ouvrir la porte à l’Emmanuel, au fil des grandes antiennes « Ô ».',
  },
];

/** Les jours depuis le 1er dimanche de l'Avent, jusqu'au 16 décembre au plus tard (20 jours au maximum). */
export const ADVENT_DAYS: JourneyDay[] = [
  // 1re semaine — Veiller
  {
    title: 'Veillez',
    passage: [41, 13, 33, 37],
    meditation:
      'L’Avent commence par un réveil. Veiller, ce n’est pas s’inquiéter : c’est rester tourné vers celui qui vient, comme on guette une lumière à la fenêtre.',
    gesture: 'Choisis un signe pour ces semaines : une couronne de l’Avent, une bougie, une crèche que tu rempliras peu à peu.',
  },
  {
    title: 'Marchons à la lumière',
    passage: [23, 2, 2, 5],
    meditation:
      'Le prophète voit les peuples monter ensemble vers Dieu et changer leurs épées en charrues. La paix commence par un pas vers la montagne du Seigneur.',
    gesture: 'Fais la paix avec quelqu’un, même par un simple message.',
  },
  {
    title: 'Vers toi j’élève mon âme',
    passage: [19, 25, 1, 5],
    meditation: 'Attendre Dieu, c’est lui demander de nous montrer ses chemins. Le psalmiste ne sait pas tout : il espère tout le jour.',
    gesture: 'Ce soir, confie ta journée à Dieu en une seule phrase.',
  },
  {
    title: 'L’heure de sortir du sommeil',
    passage: [45, 13, 11, 12],
    meditation: 'La nuit est avancée, le jour approche. Saint Paul invite à revêtir les armes de la lumière, dès maintenant.',
    gesture: 'Lève-toi dix minutes plus tôt pour un moment de silence avec Dieu.',
  },
  {
    title: 'Vous ne savez pas le jour',
    passage: [40, 24, 42, 44],
    meditation:
      'Jésus ne demande pas de deviner la date, mais d’être prêts. Une vie prête, c’est une vie où l’on aime aujourd’hui sans remettre à demain.',
    gesture: 'Éteins ton téléphone une heure ce soir, et passe ce temps avec quelqu’un.',
  },
  {
    title: 'Que vos cœurs ne s’alourdissent pas',
    passage: [42, 21, 34, 36],
    meditation: 'Les excès et les soucis de la vie alourdissent le cœur. Veiller, c’est aussi alléger, pour pouvoir se tenir debout.',
    gesture: 'Repère une chose qui alourdit tes journées et renonces-y aujourd’hui.',
  },
  {
    title: 'Plus qu’un veilleur n’attend l’aurore',
    passage: [19, 130, 5, 6],
    meditation: 'Le veilleur ne fait pas venir le matin : il sait qu’il viendra. Notre attente est faite de cette confiance.',
    gesture: 'Regarde le lever ou le coucher du soleil, et attends une minute en silence.',
  },
  // 2e semaine — Préparer le chemin
  {
    title: 'Consolez mon peuple',
    passage: [23, 40, 1, 5],
    meditation:
      'Dieu commence par consoler. Puis il demande d’aplanir la route dans le désert : ce sont nos ravins et nos montagnes intérieures qu’il veut traverser.',
    gesture: 'Prépare un coin de prière chez toi pour le temps de l’Avent.',
  },
  {
    title: 'Une voix dans le désert',
    passage: [41, 1, 1, 5],
    meditation: 'Jean-Baptiste ne parle pas de lui : il prépare. On peut tous être, pour quelqu’un, celui qui ouvre le chemin.',
    gesture: 'Pense à une chose à changer dans ta vie, et fais aujourd’hui le premier pas.',
  },
  {
    title: 'Amour et vérité se rencontrent',
    passage: [19, 85, 9, 14],
    meditation:
      'Quand Dieu vient, la justice et la paix s’embrassent. Préparer sa venue, c’est faire se rencontrer en nous la vérité et la bonté.',
    gesture: 'Dis à quelqu’un une parole vraie et bienveillante dont il a besoin.',
  },
  {
    title: 'Un rameau du tronc de Jessé',
    passage: [23, 11, 1, 5],
    meditation:
      'Sur un tronc qu’on croyait mort, un rameau repousse. L’Esprit du Seigneur repose sur lui : sagesse, conseil, force, crainte de Dieu.',
    gesture: 'Demande à l’Esprit Saint l’un de ses dons pour aujourd’hui.',
  },
  {
    title: 'Que devons-nous faire ?',
    passage: [42, 3, 10, 14],
    meditation:
      'Jean ne demande rien d’extraordinaire : partager, être honnête, ne pas abuser de son pouvoir. La conversion se joue dans le quotidien.',
    gesture: 'Donne un vêtement que tu ne portes plus, ou partage un repas.',
  },
  {
    title: 'Quitte ta robe de deuil',
    passage: [73, 5, 1, 4],
    meditation:
      'Dieu invite Jérusalem à se lever et à revêtir la beauté de sa gloire. Il nous veut debout, pas écrasés par nos tristesses.',
    gesture: 'Fais une chose belle aujourd’hui : une fleur, une lettre, un repas soigné.',
  },
  {
    title: 'Crée en moi un cœur pur',
    passage: [19, 51, 12, 14],
    meditation: 'Préparer le chemin, c’est aussi demander pardon. Dieu ne répare pas seulement : il recrée.',
    gesture: 'Prends un temps d’examen de conscience, et pourquoi pas, prépare une confession avant Noël.',
  },
  // 3e semaine — Se réjouir
  {
    title: 'Réjouissez-vous',
    passage: [50, 4, 4, 7],
    meditation:
      'C’est le dimanche de Gaudete : la joie n’attend pas que tout soit parfait. Le Seigneur est proche, et cela suffit pour se réjouir.',
    gesture: 'Remercie quelqu’un pour ce qu’il est, ou partage une bonne nouvelle.',
  },
  {
    title: 'Le désert fleurira',
    passage: [23, 35, 1, 6],
    meditation: 'Isaïe voit les terres arides refleurir, les aveugles voir et les boiteux bondir. Dieu vient là où rien ne pousse plus.',
    gesture: 'Rends visite ou téléphone à une personne seule.',
  },
  {
    title: 'Il dansera pour toi',
    passage: [36, 3, 14, 17],
    meditation: 'Ce n’est pas seulement nous qui nous réjouissons de Dieu : lui se réjouit de nous, avec des cris de joie.',
    gesture: 'Chante, même seul, un chant de Noël ou un cantique.',
  },
  {
    title: 'Es-tu celui qui doit venir ?',
    passage: [40, 11, 2, 6],
    meditation: 'Même Jean-Baptiste doute en prison. Jésus ne lui fait pas un discours : il lui montre des signes, des vies relevées.',
    gesture: 'Note trois signes de la présence de Dieu dans ta semaine.',
  },
  {
    title: 'Priez sans cesse',
    passage: [52, 5, 16, 24],
    meditation:
      'Être toujours joyeux, prier sans cesse, rendre grâce en tout : Paul ne décrit pas des héros, mais des cœurs qui restent reliés.',
    gesture: 'Glisse une courte prière à chaque changement d’activité aujourd’hui.',
  },
  {
    title: 'Comme le cultivateur',
    passage: [59, 5, 7, 8],
    meditation: 'Le cultivateur ne tire pas sur les épis pour les faire pousser. La patience est une forme d’espérance.',
    gesture: 'Dans une file d’attente ou un embouteillage, transforme l’attente en prière.',
  },
];

/** Du 17 au 24 décembre, par date : les grandes antiennes « Ô » des Vêpres, puis la veille de Noël. */
export const ADVENT_LAST_DAYS: Record<number, JourneyDay> = {
  17: {
    title: 'Ô Sagesse',
    passage: [71, 8, 1, 1],
    antiphon:
      'Ô Sagesse, sortie de la bouche du Très-Haut, tu atteins d’un bout du monde à l’autre et tu disposes tout avec force et douceur : viens nous enseigner le chemin de la prudence.',
    meditation: 'Les sept derniers jours, l’Église appelle le Christ par ses noms. Le premier est Sagesse : celui qui donne sens à tout.',
    gesture: 'Demande conseil à quelqu’un de sage, ou relis un passage qui t’a guidé.',
  },
  18: {
    title: 'Ô Adonaï',
    passage: [2, 3, 4, 6],
    antiphon:
      'Ô Adonaï, chef de la maison d’Israël, tu es apparu à Moïse dans le feu du buisson ardent et tu lui as donné la Loi sur le Sinaï : viens nous racheter, le bras étendu.',
    meditation: 'Le Dieu du buisson ardent brûle sans consumer. À Noël, il vient encore tout près, sans écraser.',
    gesture: 'Ôte tes sandales : prie un moment à genoux, ou dans un lieu silencieux.',
  },
  19: {
    title: 'Ô Rameau de Jessé',
    passage: [23, 11, 10, 10],
    antiphon:
      'Ô Rameau de Jessé, dressé comme un signe pour les peuples, devant qui les rois se taisent et que les nations implorent : viens nous délivrer, ne tarde plus.',
    meditation: 'Jésus a une famille, une histoire, des ancêtres plus ou moins glorieux. Il assume toute notre histoire.',
    gesture: 'Prie pour ta famille et pour ceux qui t’ont précédé.',
  },
  20: {
    title: 'Ô Clé de David',
    passage: [23, 22, 22, 22],
    antiphon:
      'Ô Clé de David, sceptre de la maison d’Israël, tu ouvres et nul ne ferme, tu fermes et nul n’ouvre : viens, fais sortir de prison celui qui est assis dans les ténèbres.',
    meditation: 'Le Christ ouvre ce qui était fermé : les cœurs, les prisons, les tombeaux.',
    gesture: 'Ouvre une porte : propose ton aide, ou invite quelqu’un de seul pour Noël.',
  },
  21: {
    title: 'Ô Orient',
    passage: [42, 1, 78, 79],
    antiphon:
      'Ô Orient, splendeur de la lumière éternelle et soleil de justice : viens illuminer ceux qui sont assis dans les ténèbres et l’ombre de la mort.',
    meditation: 'C’est la nuit la plus longue de l’année. C’est justement là que l’Église chante le soleil levant.',
    gesture: 'Allume une bougie ce soir et prie pour ceux qui traversent une nuit.',
  },
  22: {
    title: 'Ô Roi des nations',
    passage: [49, 2, 13, 14],
    antiphon: 'Ô Roi des nations, leur désiré, pierre d’angle qui réunis les deux en un : viens sauver l’homme que tu as façonné du limon.',
    meditation: 'Le Christ abat les murs de séparation. Sa royauté n’écrase personne : elle rassemble.',
    gesture: 'Prie pour un pays en guerre, et pour la paix entre deux personnes que tu connais.',
  },
  23: {
    title: 'Ô Emmanuel',
    passage: [23, 7, 14, 14],
    antiphon: 'Ô Emmanuel, notre Roi et notre Législateur, attente des nations et leur Sauveur : viens nous sauver, Seigneur notre Dieu.',
    meditation:
      'Lues à l’envers, les premières lettres des antiennes latines forment « Ero cras » : « Je serai là demain ». Dieu-avec-nous est à la porte.',
    gesture: 'Prépare la crèche, et un moment de prière en famille pour demain soir.',
  },
  24: {
    title: 'Une grande lumière',
    passage: [23, 9, 1, 5],
    meditation: 'Un enfant nous est né. Ce soir, l’attente s’achève : la lumière ne vient pas d’en haut avec fracas, mais d’une crèche.',
    gesture: 'Va à la messe de la nuit de Noël, ou lis en famille le récit de la Nativité (Luc 2).',
  },
};
