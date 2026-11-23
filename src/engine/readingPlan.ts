/**
 * Reading plans: the books in order, N chapters a day from a start date, with optional
 * rest days. Everything (which chapters on which day, what's due today, the finish
 * date) is worked out here from those few numbers, so the server only stores them.
 */
import { CHAPTERS } from './drill';
import { BOOKS, BOOK_BY_CODE } from '../i18n/books';

export interface PlanSpec {
  books: string[];
  /** A fixed number a day (null when the plan is set by its length instead). */
  chapters_per_day: number | null;
  /** Finish in this many reading days: the chapters are spread evenly. */
  days_total?: number | null;
  /** Bible order, or Old and New Testament side by side. */
  reading_order?: 'canonical' | 'mixed';
  /** yyyy-mm-dd */
  start_date: string;
  /** 0 = Sunday … 6 = Saturday */
  rest_days: number[];
  /** A Tent of Testimony plan: these tot.org.in lessons in order, chapters_per_day of them a day. */
  tot_items?: number[];
}

/** A plan of Tent of Testimony lessons rather than Bible chapters. */
export const isTotPlan = (p: Pick<PlanSpec, 'tot_items'>) => Boolean(p.tot_items?.length);
/** The lessons of day n of a Tent of Testimony plan. */
export function totDayItems(p: PlanSpec, day: number): number[] {
  const k = Math.max(1, p.chapters_per_day ?? 1);
  return (p.tot_items ?? []).slice((day - 1) * k, day * k);
}

export type Chapter = { b: string; c: number };

const CODES = BOOKS.map((b) => b.code);
export const PRESETS: { id: string; books: string[] }[] = [
  { id: 'bible', books: CODES },
  { id: 'nt', books: CODES.slice(39) },
  { id: 'ot', books: CODES.slice(0, 39) },
  { id: 'gospels', books: ['MAT', 'MRK', 'LUK', 'JHN'] },
  { id: 'psapro', books: ['PSA', 'PRO'] },
  { id: 'torah', books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'] },
];

const OT = new Set(CODES.slice(0, 39));
const flat = (books: string[]) => books.flatMap((b) => Array.from({ length: CHAPTERS[b] ?? 0 }, (_, i) => ({ b, c: i + 1 })));

/** Every chapter of the plan, in reading order. 'mixed' weaves the Old and New Testament
 *  together so both move forward at the same pace and finish together. */
export function chapterList(books: string[], order: PlanSpec['reading_order'] = 'canonical'): Chapter[] {
  if (order !== 'mixed') return flat(books);
  const ot = flat(books.filter((b) => OT.has(b)));
  const nt = flat(books.filter((b) => !OT.has(b)));
  if (!ot.length || !nt.length) return [...ot, ...nt];
  const out: Chapter[] = [];
  let i = 0;
  let j = 0;
  while (i < ot.length || j < nt.length) {
    if (j >= nt.length || (i < ot.length && (i + 1) / ot.length <= (j + 1) / nt.length)) out.push(ot[i++]);
    else out.push(nt[j++]);
  }
  return out;
}

const chaptersOf = (p: PlanSpec) => chapterList(p.books, p.reading_order);

export function totalDays(p: PlanSpec): number {
  if (isTotPlan(p)) return Math.max(1, Math.ceil(p.tot_items!.length / Math.max(1, p.chapters_per_day ?? 1)));
  const n = chaptersOf(p).length;
  if (p.days_total) return Math.max(1, Math.min(p.days_total, n));
  return Math.ceil(n / Math.max(1, p.chapters_per_day ?? 1));
}

/** The chapters for day n (1-based). A plan set by length spreads them evenly. */
export function chaptersFor(p: PlanSpec, day: number): Chapter[] {
  if (isTotPlan(p)) return [];
  const all = chaptersOf(p);
  if (p.days_total) {
    const d = totalDays(p);
    return all.slice(Math.floor(((day - 1) * all.length) / d), Math.floor((day * all.length) / d));
  }
  const n = Math.max(1, p.chapters_per_day ?? 1);
  return all.slice((day - 1) * n, day * n);
}

/** The fewest and most chapters on any day ("3–4 chapters a day"). */
export function dailyRange(p: PlanSpec): [number, number] {
  if (isTotPlan(p)) return [Math.max(1, p.chapters_per_day ?? 1), Math.max(1, p.chapters_per_day ?? 1)];
  const n = chaptersOf(p).length;
  const d = totalDays(p);
  if (!p.days_total) return [Math.min(n, p.chapters_per_day ?? 1), Math.min(n, p.chapters_per_day ?? 1)];
  return [Math.floor(n / d), Math.ceil(n / d)];
}

/** Reading days from the start date up to and including an end date. */
export function readingDaysBetween(p: Pick<PlanSpec, 'start_date' | 'rest_days'>, end: Date): number {
  const d = parse(p.start_date);
  let n = 0;
  for (let i = 0; i < 4000 && d <= end; i++) {
    if (!p.rest_days.includes(d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** Common choices for which days to read. */
export const WEEK_PATTERNS: Record<'every' | 'weekdays' | 'weekends', number[]> = {
  every: [],
  weekdays: [0, 6],
  weekends: [1, 2, 3, 4, 5],
};

const DAY = 86_400_000;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isRest = (p: PlanSpec, d: Date) => p.rest_days.includes(d.getDay());

/** The calendar date of reading day n. */
export function dateOfDay(p: PlanSpec, day: number): Date {
  const d = parse(p.start_date);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    if (!isRest(p, d)) {
      n++;
      if (n === day) return d;
    }
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** How many reading days have come round by this date (0 before the start). */
export function daysDue(p: PlanSpec, on: Date = new Date()): number {
  const start = parse(p.start_date);
  const end = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  if (end < start) return 0;
  const span = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  let n = 0;
  const d = new Date(start);
  for (let i = 0; i < span; i++) {
    if (!isRest(p, d)) n++;
    d.setDate(d.getDate() + 1);
  }
  return Math.min(n, totalDays(p));
}

export const finishDate = (p: PlanSpec) => dateOfDay(p, totalDays(p));

/** How many days past today's reading someone may read ahead (keeps the group together). */
export const READ_AHEAD = 2;

export interface PlanStatus {
  total: number;
  due: number;
  done: number;
  /** Due days not read yet. */
  behind: number;
  /** The first day not read yet (or null when finished). */
  next: number | null;
  todayIsRest: boolean;
  started: boolean;
  finished: boolean;
  /** Days read past today's due day. */
  ahead: number;
  /** The next day may be read now (not more than READ_AHEAD days ahead). */
  canRead: boolean;
  /** When the next day opens, if it's locked. */
  opensOn: Date | null;
}

export function planStatus(p: PlanSpec, doneDays: Set<number>, on: Date = new Date()): PlanStatus {
  const total = totalDays(p);
  const due = daysDue(p, on);
  let behind = 0;
  for (let d = 1; d <= due; d++) if (!doneDays.has(d)) behind++;
  let next: number | null = null;
  for (let d = 1; d <= total; d++)
    if (!doneDays.has(d)) {
      next = d;
      break;
    }
  const canRead = next !== null && next <= due + READ_AHEAD;
  let ahead = 0;
  for (let d = due + 1; d <= total && doneDays.has(d); d++) ahead++;
  return {
    total,
    due,
    done: doneDays.size,
    behind,
    next,
    todayIsRest: isRest(p, on),
    started: on >= parse(p.start_date),
    finished: next === null,
    ahead: behind ? 0 : ahead,
    canRead,
    opensOn: next !== null && !canRead ? dateOfDay(p, next - READ_AHEAD) : null,
  };
}

/** "Matthew 27–28; Mark 1" for a list of chapters. */
export function chaptersLabel(chapters: Chapter[], lang: 'en' | 'ta'): string {
  const groups: { b: string; from: number; to: number }[] = [];
  for (const ch of chapters) {
    const g = groups[groups.length - 1];
    if (g && g.b === ch.b && ch.c === g.to + 1) g.to = ch.c;
    else groups.push({ b: ch.b, from: ch.c, to: ch.c });
  }
  return groups.map((g) => `${BOOK_BY_CODE[g.b]?.[lang] ?? g.b} ${g.from === g.to ? g.from : `${g.from}–${g.to}`}`).join('; ');
}
