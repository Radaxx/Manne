import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Textes liturgiques du jour (messe et Liturgie des Heures) fournis par l'AELF : https://www.aelf.org
// Ils sont © AELF ; on les récupère à la demande et on les garde en cache pour la journée.
const API = 'https://api.aelf.org/v1';
const ZONE = 'france';

export type OfficeId = 'lectures' | 'laudes' | 'tierce' | 'sexte' | 'none' | 'vepres' | 'complies';

export type Office = { id: OfficeId; name: string; hint: string; from: number; to: number; icon: string; minutes: number };

/** Les Heures, avec leur moment habituel (heures locales indicatives). */
export const OFFICES: Office[] = [
  { id: 'lectures', name: 'Office des lectures', hint: 'À tout moment', from: -1, to: -1, icon: 'book-outline', minutes: 20 },
  { id: 'laudes', name: 'Laudes', hint: 'Au lever du jour', from: 5, to: 9, icon: 'sunny-outline', minutes: 15 },
  { id: 'tierce', name: 'Tierce', hint: 'Milieu de matinée', from: 9, to: 12, icon: 'partly-sunny-outline', minutes: 5 },
  { id: 'sexte', name: 'Sexte', hint: 'Vers midi', from: 12, to: 15, icon: 'sunny', minutes: 5 },
  { id: 'none', name: 'None', hint: 'Milieu d’après-midi', from: 15, to: 18, icon: 'cloudy-outline', minutes: 5 },
  { id: 'vepres', name: 'Vêpres', hint: 'À la tombée du jour', from: 18, to: 21, icon: 'moon-outline', minutes: 15 },
  { id: 'complies', name: 'Complies', hint: 'Avant de dormir', from: 21, to: 29, icon: 'bed-outline', minutes: 10 },
];

/** L'office qui correspond à l'heure qu'il est. */
export function currentOffice(date = new Date()): Office {
  const h = date.getHours() + (date.getHours() < 5 ? 24 : 0);
  return OFFICES.find((o) => h >= o.from && h < o.to) ?? OFFICES[1];
}

export type LiturgicalInfo = {
  couleur: string;
  temps_liturgique: string;
  semaine: string;
  jour: string;
  fete: string;
  jour_liturgique_nom: string;
  ligne1: string;
  ligne2: string;
  ligne3: string;
};

export type MassReading = {
  type: string;
  titre: string | null;
  contenu: string;
  ref: string;
  intro_lue: string | null;
  refrain_psalmique: string | null;
  verset_evangile: string | null;
  ref_verset: string | null;
};

export type Mass = { nom: string; lectures: MassReading[] };

export const LITURGICAL_COLORS: Record<string, string> = {
  vert: '#3f9b5f',
  violet: '#7b4bb5',
  blanc: '#f2efe6',
  rouge: '#c8323c',
  rose: '#e58fb4',
  noir: '#222',
};

export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const CACHE = 'manne/aelf/';

async function fetchAelf<T>(endpoint: string, date: string): Promise<T> {
  const key = `${CACHE}${endpoint}/${date}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as T;
  } catch {}
  const res = await fetch(`${API}/${endpoint}/${date}/${ZONE}`);
  if (!res.ok) throw new Error(`AELF ${endpoint} ${res.status}`);
  const data = (await res.json()) as T;
  AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
  return data;
}

type State<T> = { data: T | null; error: boolean };

function useAelf<T>(endpoint: string, date: string): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: false });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: false });
    fetchAelf<T>(endpoint, date)
      .then((data) => alive && setState({ data, error: false }))
      .catch(() => alive && setState({ data: null, error: true }));
    return () => {
      alive = false;
    };
  }, [endpoint, date]);
  return state;
}

export const useMass = (date = localDate()) => useAelf<{ informations: LiturgicalInfo; messes: Mass[] }>('messes', date);

export const useOffice = (id: OfficeId, date = localDate()) => useAelf<{ informations: LiturgicalInfo } & Record<string, Record<string, unknown>>>(id, date);

// ——— Du HTML de l'AELF vers des segments affichables ———

export type Segment = { text: string; bold?: boolean; italic?: boolean; verse?: boolean };
export type Paragraph = Segment[];

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', hellip: '…', ndash: '–', mdash: '—', oelig: 'œ' };

// Lettres accentuées (&eacute; → é…), sans dépendre de String.normalize.
const ACCENTED: Record<string, string> = {};
for (const [suffix, letters, out] of [
  ['acute', 'aeiouyAEIOUY', 'áéíóúýÁÉÍÓÚÝ'],
  ['grave', 'aeiouAEIOU', 'àèìòùÀÈÌÒÙ'],
  ['circ', 'aeiouAEIOU', 'âêîôûÂÊÎÔÛ'],
  ['uml', 'aeiouyAEIOUY', 'äëïöüÿÄËÏÖÜŸ'],
  ['cedil', 'cC', 'çÇ'],
]) {
  [...letters].forEach((l, i) => (ACCENTED[l + suffix] = [...out][i]));
}

const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ACCENTED[e] ?? ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });

/** Découpe le HTML en paragraphes ; garde gras, italique et numéros de versets, ignore le reste. */
export function parseHtml(html: string | null | undefined): Paragraph[] {
  if (!html) return [];
  const paragraphs: Paragraph[] = [];
  let current: Paragraph = [];
  let bold = 0;
  let italic = 0;
  let verse = false;
  const push = (text: string) => {
    const last = current[current.length - 1];
    // Pas d'espace en début de paragraphe ni après un autre espace ou un retour à la ligne.
    if (!last) text = text.replace(/^\s+/, '');
    else if (/\s$/.test(last.text)) text = text.replace(/^[ \t]+/, '');
    if (!text) return;
    const style = { bold: bold > 0, italic: italic > 0, verse };
    if (last && last.bold === style.bold && last.italic === style.italic && last.verse === style.verse) last.text += text;
    else current.push({ text, ...style });
  };
  const breakParagraph = () => {
    // Retirer les retours à la ligne en bord de paragraphe.
    while (current.length && /^\s*$/.test(current[current.length - 1].text)) current.pop();
    if (current.length) {
      current[current.length - 1].text = current[current.length - 1].text.replace(/\s+$/, '');
      paragraphs.push(current);
    }
    current = [];
  };

  for (const token of html.replace(/\r?\n/g, ' ').match(/<[^>]+>|[^<]+/g) ?? []) {
    if (token[0] !== '<') {
      // L'AELF indente avec des espaces insécables : on ne garde qu'un espace (une insécable seule, comme avant « : », est conservée).
      push(decode(token).replace(/[ \t\u00a0]{2,}/g, ' ').replace(/[ \t]+/g, ' '));
      continue;
    }
    const tag = token.toLowerCase();
    if (/^<br/.test(tag)) {
      const last = current[current.length - 1];
      // Un double saut de ligne sépare deux strophes : on en fait un paragraphe.
      if (last?.text.endsWith('\n')) {
        last.text = last.text.slice(0, -1);
        breakParagraph();
      } else push('\n');
    } else if (/^<\/?p[\s>]/.test(tag) || tag === '</p>') breakParagraph();
    else if (/^<(strong|b)[\s>]/.test(tag)) bold++;
    else if (/^<\/(strong|b)>/.test(tag)) bold = Math.max(0, bold - 1);
    else if (/^<(em|i)[\s>]/.test(tag)) italic++;
    else if (/^<\/(em|i)>/.test(tag)) italic = Math.max(0, italic - 1);
    else if (/^<span[^>]*verse_number/.test(tag)) verse = true;
    else if (tag === '</span>' && verse) {
      verse = false;
      push(' ');
    }
  }
  breakParagraph();
  return paragraphs;
}

export const plainText = (html: string | null | undefined) =>
  parseHtml(html)
    .map((p) => p.map((s) => s.text).join(''))
    .join('\n');
