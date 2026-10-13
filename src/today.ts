import { currentOffice } from './aelf';
import { BOOK_ORDER, bookMeta, clampChapter, TOTAL_CHAPTERS, type TranslationId } from './bible';
import { daysSince, longDate, shiftDay } from './dates';
import { formatRange, planById, planStatus } from './plans';
import type { Progress } from './storage';

export { shiftDay };

/** Objectif quotidien, en versets lus (un chapitre en compte souvent 20 à 40). */
export const DAILY_GOAL = 30;

/** Ce qu'une journée laisse dans le journal. `reading` est figé au changement de jour. */
export type DayLog = {
  verses: number;
  gospel: boolean;
  office: boolean;
  rosary: boolean;
  adoration: boolean;
  reading: boolean;
};

export const EMPTY_DAY: DayLog = { verses: 0, gospel: false, office: false, rosary: false, adoration: false, reading: false };

const GOSPELS = [40, 41, 42, 43];
const LETTERS = ['D', 'L', 'Ma', 'Me', 'J', 'V', 'S'];

export type ResumeTarget = { href: string; label: string; book?: number };

export type TodayTask = { id: 'gospel' | 'reading' | 'prayer'; label: string; done: boolean; href: string };

export type Step = { id: string; title: string; next: string; href: string; book?: number };

export type WeekCell = { date: string; letter: string; complete: boolean; isToday: boolean };

export type BookShare = { n: number; name: string; read: number; total: number };

export function readingDone(plans: Progress['plans'], verses: number, date: string, t: TranslationId): boolean {
  const active = activePlans(plans, date, t);
  if (active.length === 0) return verses >= DAILY_GOAL;
  return active.every((s) => s.status.todayComplete);
}

export function prayed(log: DayLog | undefined): boolean {
  return !!log && (log.office || log.rosary || log.adoration);
}

export function dayComplete(log: DayLog | undefined): boolean {
  return !!log && log.gospel && log.reading && prayed(log);
}

/** Série de jours complets. Aujourd'hui incomplet ne la casse pas : on compte jusqu'à hier. */
export function streakFrom(days: Record<string, DayLog>, date: string): number {
  let cursor = dayComplete(days[date]) ? date : shiftDay(date, -1);
  let n = 0;
  while (dayComplete(days[cursor]) && n < 2000) {
    n += 1;
    cursor = shiftDay(cursor, -1);
  }
  return n;
}

/** Journal du jour, avec la lecture recalculée (un plan commencé en cours de journée change la donne). */
export function liveLog(p: Progress, date = p.day): DayLog {
  const prev = p.days[date] ?? EMPTY_DAY;
  const verses = Math.max(prev.verses, date === p.day ? p.readToday.length : 0);
  return { ...prev, verses, reading: readingDone(p.plans, verses, date, p.translation) };
}

export function currentStreak(p: Progress, date = p.day): number {
  return streakFrom({ ...p.days, [date]: liveLog(p, date) }, date);
}

export function bookmarkLabel(p: Progress): string {
  const pos = p.positions[p.currentBook] ?? { chapter: 1, verse: 1 };
  const name = bookMeta(p.currentBook, p.translation)?.name ?? 'La suite';
  return `${name} ${clampChapter(p.currentBook, pos.chapter, p.translation)} t’attend`;
}

/** Une seule suite : une prière laissée en cours, puis le premier point incomplet, puis le marque-page. */
export function resumeTarget(p: Progress): ResumeTarget {
  if (p.rosary.session) return { href: '/chapelet', label: 'Reprendre le chapelet' };
  if (p.adoration.session) return { href: '/adoration', label: 'Reprendre l’adoration' };
  const log = liveLog(p);
  if (!log.gospel) return { href: '/messe', label: 'Lire l’Évangile' };
  const pending = activePlans(p.plans, p.day, p.translation).filter((s) => !s.status.todayComplete);
  if (pending.length > 0) {
    const first = pending[0];
    const behind = first.status.behind;
    const label = behind > 0 ? `${behind} chapitre${behind > 1 ? 's' : ''} à rattraper` : formatRange(first.status.today, p.translation);
    return { href: `/plan/${first.plan.id}`, label };
  }
  return { href: '/lecture', label: bookmarkLabel(p), book: p.currentBook };
}

export function todayLine(p: Progress): string {
  const log = liveLog(p);
  const missing: string[] = [];
  if (!log.gospel) missing.push('l’Évangile');
  if (!log.reading) missing.push('la lecture');
  if (!prayed(log)) missing.push('une prière');
  if (missing.length === 0) return bookmarkLabel(p);
  if (missing.length === 1 && missing[0] === 'la lecture' && activePlans(p.plans, p.day, p.translation).length === 0)
    return bookmarkLabel(p);
  const sentence = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} et ${missing[missing.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function todayTasks(p: Progress): TodayTask[] {
  const log = liveLog(p);
  const active = activePlans(p.plans, p.day, p.translation);
  const pending = active.filter((s) => !s.status.todayComplete);
  const readingHref = pending[0] ? `/plan/${pending[0].plan.id}` : active[0] ? `/plan/${active[0].plan.id}` : '/lecture';
  const readingLabel =
    active.length === 0
      ? `${log.verses}/${DAILY_GOAL} versets`
      : pending[0]
        ? formatRange(pending[0].status.today, p.translation)
        : 'Lecture du jour';
  const prayerHref = p.rosary.session ? '/chapelet' : p.adoration.session ? '/adoration' : `/office/${currentOffice().id}`;
  return [
    { id: 'gospel', label: 'Évangile du jour', done: log.gospel, href: '/messe' },
    { id: 'reading', label: readingLabel, done: log.reading, href: readingHref },
    { id: 'prayer', label: prayerTaskLabel(log), done: prayed(log), href: prayerHref },
  ];
}

export function goalCaption(p: Progress): string {
  const n = p.readToday.length;
  if (n < DAILY_GOAL) return `${n}/${DAILY_GOAL} versets aujourd’hui`;
  if (!prayed(liveLog(p))) return `${n} versets. Il reste une prière.`;
  if (!dayComplete(liveLog(p))) return `${n} versets. ${todayLine(p)}`;
  return `${n} versets. ${bookmarkLabel(p)}`;
}

export function goalToast(p: Progress): { title: string; body: string } {
  const log = liveLog(p);
  if (!prayed(log)) return { title: 'Trente versets', body: 'Il reste une prière pour aujourd’hui.' };
  if (dayComplete(log)) return { title: 'La journée est faite', body: bookmarkLabel(p) };
  return { title: 'Trente versets', body: todayLine(p) };
}

export function weekStrip(p: Progress, date = p.day): WeekCell[] {
  const cells: WeekCell[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = shiftDay(date, -i);
    const log = day === date ? liveLog(p, date) : p.days[day];
    const [y, m, d] = day.split('-').map(Number);
    const letter = LETTERS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    cells.push({ date: day, letter, complete: dayComplete(log), isToday: day === date });
  }
  return cells;
}

/** La part lue de chaque livre, dans l'ordre de la Bible. */
export function bookShares(chaptersRead: string[], t: TranslationId): BookShare[] {
  const read = new Set(chaptersRead);
  return BOOK_ORDER.map((n) => {
    const book = bookMeta(n, t);
    let count = 0;
    for (let chapter = 1; chapter <= book.verses.length; chapter++) if (read.has(`${n}:${chapter}`)) count += 1;
    return { n, name: book.name, read: count, total: book.verses.length };
  });
}

export function bibleShare(chaptersRead: string[]): number {
  return chaptersRead.length / TOTAL_CHAPTERS;
}

/** Étapes atteintes, dans l'ordre où on les annonce. */
export function reachedSteps(p: Progress): Step[] {
  const steps: Step[] = [];
  const streak = currentStreak(p);
  if (streak >= 7) steps.push({ id: 'streak-7', title: '7 jours d’affilée', next: 'Continue jusqu’à 30.', href: '/lecture' });
  if (streak >= 30) steps.push({ id: 'streak-30', title: '30 jours d’affilée', next: 'La suite de la Bible t’attend.', href: '/lecture' });
  const shares = bookShares(p.chaptersRead, p.translation);
  for (const book of GOSPELS) {
    const share = shares.find((s) => s.n === book);
    if (!share || share.read < share.total) continue;
    const nextBook = book < 43 ? book + 1 : 44;
    const nextName = bookMeta(nextBook, p.translation).name;
    steps.push({
      id: `gospel-${book}`,
      title: `${share.name} est lu`,
      next: `${nextName} t’attend`,
      href: book < 43 ? '/lecture' : '/plans',
      book: book < 43 ? nextBook : undefined,
    });
  }
  for (const [id, state] of Object.entries(p.plans)) {
    const plan = planById(id);
    if (!plan || !planStatus(plan, state, p.day, p.translation).finished) continue;
    steps.push({ id: `plan-${id}`, title: `${plan.title} terminé`, next: 'Un autre plan t’attend.', href: '/plans' });
  }
  const share = bibleShare(p.chaptersRead);
  if (share >= 0.1) steps.push({ id: 'bible-10', title: 'Un dixième de la Bible', next: 'Le quart t’attend.', href: '/lecture' });
  if (share >= 0.25) steps.push({ id: 'bible-25', title: 'Un quart de la Bible', next: 'La moitié t’attend.', href: '/lecture' });
  if (share >= 0.5) steps.push({ id: 'bible-50', title: 'La moitié de la Bible', next: bookmarkLabel(p), href: '/lecture' });
  return steps;
}

export function unseenSteps(p: Progress): Step[] {
  const seen = new Set(p.seenMilestones);
  return reachedSteps(p).filter((step) => !seen.has(step.id));
}

export function agoPhrase(day: string | null, now: string): string {
  if (!day) return 'pas encore';
  const ago = daysSince(day, now);
  if (ago <= 0) return 'aujourd’hui';
  if (ago === 1) return 'hier';
  return `il y a ${ago} jours`;
}

/** « Dernière fois : hier · 3 au total. » pour le chapelet et l'adoration. */
export function lastTimeLabel(day: string | null, count: number, now: string, never: string): string {
  if (!day) return never;
  const ago = daysSince(day, now);
  const when = ago <= 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : `le ${longDate(day)}`;
  return `Dernière fois : ${when} · ${count} au total.`;
}

function prayerTaskLabel(log: DayLog): string {
  if (log.rosary) return 'Chapelet prié';
  if (log.adoration) return 'Adoration faite';
  if (log.office) return 'Office prié';
  return 'Une prière';
}

function activePlans(plans: Progress['plans'], date: string, t: TranslationId) {
  return Object.entries(plans).flatMap(([id, state]) => {
    const plan = planById(id);
    if (!plan) return [];
    const status = planStatus(plan, state, date, t);
    if (status.finished) return [];
    return [{ plan, status }];
  });
}
