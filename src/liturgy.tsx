import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseHtml, plainText, type Mass } from './aelf';
import { SERIF } from './cards';

export const C = {
  bg: '#0d0e12',
  card: '#17191f',
  cardHi: '#1f222a',
  text: '#ece8df',
  muted: 'rgba(236,232,223,0.6)',
  faint: 'rgba(236,232,223,0.35)',
  gold: '#ffd166',
  red: '#e07a6b', // les rubriques liturgiques sont traditionnellement en rouge
  line: 'rgba(255,255,255,0.08)',
};

/** Texte AELF (HTML) rendu en paragraphes, avec numéros de versets et gras. */
export function LiturgyText({ html, style }: { html: string | null | undefined; style?: object }) {
  const paragraphs = parseHtml(html);
  return (
    <>
      {paragraphs.map((p, i) => (
        <Text key={i} style={[styles.para, style]}>
          {p.map((s, j) =>
            s.verse ? (
              <Text key={j} style={styles.verseNum}>
                {s.text.trim()}{' '}
              </Text>
            ) : (
              <Text key={j} style={[s.bold && styles.bold, s.italic && styles.italic]}>
                {s.text}
              </Text>
            ),
          )}
        </Text>
      ))}
    </>
  );
}

function Section({ label, reference, title, children }: { label: string; reference?: string | null; title?: string | null; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {reference ? <Text style={styles.ref}>{reference}</Text> : null}
      </View>
      {title ? <Text style={styles.sectionTitle}>{plainText(title)}</Text> : null}
      {children}
    </View>
  );
}

function Antienne({ html }: { html: unknown }) {
  if (typeof html !== 'string' || !html.trim()) return null;
  return (
    <Text style={styles.antienne}>
      <Text style={styles.rubric}>Ant. </Text>
      {plainText(html)}
    </Text>
  );
}

const asText = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const asObj = (v: unknown) => (v && typeof v === 'object' && Object.keys(v).length > 0 ? (v as Record<string, string | null>) : null);

// Texte liturgique en usage depuis 2017.
const NOTRE_PERE =
  '<p>Notre Père, qui es aux cieux,<br/>que ton nom soit sanctifié,<br/>que ton règne vienne,<br/>que ta volonté soit faite sur la terre comme au ciel.<br/>Donne-nous aujourd’hui notre pain de ce jour.<br/>Pardonne-nous nos offenses,<br/>comme nous pardonnons aussi à ceux qui nous ont offensés.<br/>Et ne nous laisse pas entrer en tentation<br/>mais délivre-nous du Mal.<br/>Amen.</p>';

const CANTIQUES: [string, string, string][] = [
  ['antienne_zacharie', 'cantique_zacharie', 'Cantique de Zacharie'],
  ['antienne_magnificat', 'cantique_mariale', 'Cantique de Marie'],
  ['antienne_symeon', 'cantique_symeon', 'Cantique de Syméon'],
];

/** « 72 - II » → Psaume, Ps 72 - II ; « CANTIQUE d'Isaïe (Is 42) » → Cantique d'Isaïe, Is 42. */
function psalmHeading(ref: string): { label: string; reference: string } {
  const r = ref.trim().replace(/\.$/, '');
  if (/^\d/.test(r) && !/[a-zà-ÿ]/.test(r)) return { label: 'Psaume', reference: `Ps ${r}` };
  const m = /^cantique\s*(.*?)\s*\(([^)]+)\)$/i.exec(r);
  if (m) return { label: `Cantique ${m[1]}`.trim(), reference: m[2] };
  return { label: 'Cantique', reference: r.replace(/^cantique\s*/i, '') };
}

/** Un office de la Liturgie des Heures, dans l'ordre où il se prie. */
export function OfficeBody({ office }: { office: Record<string, unknown> }) {
  const out: ReactNode[] = [];
  const add = (key: string, node: ReactNode) => out.push(<Fragment key={key}>{node}</Fragment>);

  const intro = asText(office.introduction);
  if (intro) add('intro', <Section label="Introduction"><LiturgyText html={intro} /></Section>);

  const invit = asObj(office.psaume_invitatoire);
  if (invit)
    add(
      'invit',
      <Section label="Invitatoire" reference={invit.reference ? `Ps ${invit.reference}` : null}>
        <Antienne html={office.antienne_invitatoire} />
        <LiturgyText html={invit.texte} />
      </Section>,
    );

  const hymne = asObj(office.hymne);
  if (hymne?.texte) add('hymne', <Section label="Hymne" title={hymne.titre}><LiturgyText html={hymne.texte} style={styles.poem} /></Section>);

  for (let i = 1; i <= 3; i++) {
    const ps = asObj(office[`psaume_${i}`]);
    if (!ps?.texte) continue;
    const { label, reference } = psalmHeading(ps.reference ?? '');
    add(
      `ps${i}`,
      <Section label={label} reference={reference}>
        <Antienne html={office[`antienne_${i}`]} />
        <LiturgyText html={ps.texte} />
        <Antienne html={office[`antienne_${i}`]} />
      </Section>,
    );
  }

  const verset = asText(office.verset_psaume);
  if (verset) add('verset', <Section label="Verset"><LiturgyText html={verset} /></Section>);

  const lecture = asObj(office.lecture);
  if (lecture?.texte)
    add('lecture', <Section label="Lecture" reference={lecture.reference} title={lecture.titre}><LiturgyText html={lecture.texte} /></Section>);
  const reponsLecture = asText(office.repons_lecture);
  if (reponsLecture) add('repons_lecture', <Section label="Répons"><LiturgyText html={reponsLecture} /></Section>);

  const patristique = asText(office.texte_patristique);
  if (patristique)
    add('patristique', <Section label="Lecture patristique" title={asText(office.titre_patristique)}><LiturgyText html={patristique} /></Section>);
  const reponsPatr = asText(office.repons_patristique);
  if (reponsPatr) add('repons_patristique', <Section label="Répons"><LiturgyText html={reponsPatr} /></Section>);

  const teDeum = asObj(office.te_deum);
  if (teDeum?.texte) add('tedeum', <Section label="Te Deum"><LiturgyText html={teDeum.texte} /></Section>);

  const pericope = asObj(office.pericope);
  if (pericope?.texte) add('pericope', <Section label="Parole de Dieu" reference={pericope.reference}><LiturgyText html={pericope.texte} /></Section>);
  const repons = asText(office.repons);
  if (repons) add('repons', <Section label="Répons"><LiturgyText html={repons} /></Section>);

  for (const [antKey, key, label] of CANTIQUES) {
    const cantique = asObj(office[key]);
    if (!cantique?.texte) continue;
    add(
      key,
      <Section label={label} reference={cantique.reference}>
        <Antienne html={office[antKey]} />
        <LiturgyText html={cantique.texte} />
        <Antienne html={office[antKey]} />
      </Section>,
    );
  }

  const intercession = asText(office.intercession);
  if (intercession) add('intercession', <Section label="Intercession"><LiturgyText html={intercession} /></Section>);
  if (asText(office.notre_pere)) add('pater', <Section label="Notre Père"><LiturgyText html={NOTRE_PERE} style={styles.poem} /></Section>);

  const oraison = asText(office.oraison);
  if (oraison) add('oraison', <Section label="Oraison"><LiturgyText html={oraison} /></Section>);
  const benediction = asText(office.benediction);
  if (benediction) add('benediction', <Section label="Bénédiction"><LiturgyText html={benediction} /></Section>);

  const mariale = asObj(office.hymne_mariale);
  if (mariale?.texte) add('mariale', <Section label="Antienne à la Vierge Marie" title={mariale.titre}><LiturgyText html={mariale.texte} style={styles.poem} /></Section>);

  return <>{out}</>;
}

const READING_LABELS: Record<string, string> = {
  lecture_1: 'Première lecture',
  lecture_2: 'Deuxième lecture',
  lecture_3: 'Troisième lecture',
  psaume: 'Psaume',
  cantique: 'Cantique',
  sequence: 'Séquence',
  evangile: 'Évangile',
};

export const readingLabel = (type: string) => READING_LABELS[type] ?? (type.startsWith('lecture_') ? `Lecture ${type.slice(8)}` : type.charAt(0).toUpperCase() + type.slice(1));

/** Les lectures d'une messe. */
export function MassBody({ mass }: { mass: Mass }) {
  return (
    <>
      {mass.lectures.map((l, i) => (
        <Section key={i} label={readingLabel(l.type)} reference={l.ref} title={l.titre}>
          {l.verset_evangile ? (
            <View style={styles.acclamation}>
              <Text style={styles.rubric}>Acclamation{l.ref_verset ? ` · ${l.ref_verset}` : ''}</Text>
              <LiturgyText html={l.verset_evangile} />
            </View>
          ) : null}
          {l.intro_lue ? <Text style={styles.introLue}>{plainText(l.intro_lue)}</Text> : null}
          {l.refrain_psalmique ? (
            <View style={styles.refrain}>
              <Text style={styles.rubric}>R/</Text>
              <LiturgyText html={l.refrain_psalmique} />
            </View>
          ) : null}
          <LiturgyText html={l.contenu} />
        </Section>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 10 },
  label: { color: C.red, fontSize: 12, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase', flexShrink: 1 },
  ref: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  sectionTitle: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 26, marginBottom: 12 },
  para: { color: C.text, fontFamily: SERIF, fontSize: 18, lineHeight: 29, marginBottom: 12 },
  poem: { fontStyle: 'italic' },
  verseNum: { color: C.gold, fontSize: 11, fontWeight: '700', fontFamily: undefined },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  antienne: { color: C.text, fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, lineHeight: 26, marginBottom: 12 },
  rubric: { color: C.red, fontWeight: '700', fontStyle: 'normal', fontFamily: undefined, fontSize: 13 },
  introLue: { color: C.muted, fontStyle: 'italic', fontSize: 15, marginBottom: 12 },
  refrain: { backgroundColor: 'rgba(224,122,107,0.08)', borderRadius: 10, padding: 12, paddingBottom: 0, marginBottom: 14 },
  acclamation: { backgroundColor: 'rgba(255,209,102,0.06)', borderRadius: 10, padding: 12, paddingBottom: 0, marginBottom: 14 },
});
