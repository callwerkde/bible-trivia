/**
 * Reading plans: the books in order, N chapters a day from a start date, with optional
 * rest days. Everything (which chapters on which day, what's due today, the finish
 * date) is worked out here from those few numbers, so the server only stores them.
 */
import { CHAPTERS } from './drill';
import { BOOKS, BOOK_BY_CODE } from '../i18n/books';

export interface PlanSpec {
  books: string[];
  chapters_per_day: number;
  /** yyyy-mm-dd */
  start_date: string;
  /** 0 = Sunday … 6 = Saturday */
  rest_days: number[];
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

/** Every chapter of the plan, in order. */
export function chapterList(books: string[]): Chapter[] {
  return books.flatMap((b) => Array.from({ length: CHAPTERS[b] ?? 0 }, (_, i) => ({ b, c: i + 1 })));
}

export const totalDays = (p: PlanSpec) => Math.ceil(chapterList(p.books).length / Math.max(1, p.chapters_per_day));

/** The chapters for day n (1-based). */
export function chaptersFor(p: PlanSpec, day: number): Chapter[] {
  const all = chapterList(p.books);
  const n = Math.max(1, p.chapters_per_day);
  return all.slice((day - 1) * n, day * n);
}

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
  return {
    total,
    due,
    done: doneDays.size,
    behind,
    next,
    todayIsRest: isRest(p, on),
    started: on >= parse(p.start_date),
    finished: next === null,
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
