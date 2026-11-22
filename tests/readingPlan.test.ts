import { describe, expect, it } from 'vitest';
import { chaptersFor, chaptersLabel, chapterList, dailyRange, dateOfDay, daysDue, finishDate, isoDay, planStatus, readingDaysBetween, totalDays, PRESETS } from '../src/engine/readingPlan';

const nt = PRESETS.find((p) => p.id === 'nt')!.books;
// Monday 5 January 2026
const plan = { books: ['MAT', 'MRK'], chapters_per_day: 3, start_date: '2026-01-05', rest_days: [] as number[] };

describe('reading plans', () => {
  it('knows the size of the Bible', () => {
    expect(chapterList(PRESETS[0].books)).toHaveLength(1189);
    expect(chapterList(nt)).toHaveLength(260);
  });
  it('splits chapters into days', () => {
    expect(totalDays(plan)).toBe(Math.ceil((28 + 16) / 3));
    expect(chaptersLabel(chaptersFor(plan, 1), 'en')).toBe('Matthew 1–3');
    // day 10: Matthew 28, Mark 1–2
    expect(chaptersLabel(chaptersFor(plan, 10), 'en')).toBe('Matthew 28; Mark 1–2');
  });
  it('counts due days and skips rest days', () => {
    expect(daysDue(plan, new Date(2026, 0, 4))).toBe(0);
    expect(daysDue(plan, new Date(2026, 0, 5))).toBe(1);
    expect(daysDue(plan, new Date(2026, 0, 11))).toBe(7);
    const noSundays = { ...plan, rest_days: [0] };
    expect(daysDue(noSundays, new Date(2026, 0, 11))).toBe(6); // Sunday the 11th is a rest day
    expect(isoDay(dateOfDay(noSundays, 7))).toBe('2026-01-12');
    expect(finishDate(plan) >= new Date(2026, 0, 5)).toBe(true);
  });
  it('works out what is behind and what is next', () => {
    const st = planStatus(plan, new Set([1, 2]), new Date(2026, 0, 9)); // 5 days due
    expect(st.due).toBe(5);
    expect(st.behind).toBe(3);
    expect(st.next).toBe(3);
    const done = planStatus(plan, new Set(Array.from({ length: totalDays(plan) }, (_, i) => i + 1)), new Date(2026, 5, 1));
    expect(done.finished).toBe(true);
  });
});

describe('reading plans by length', () => {
  const bible = PRESETS[0].books;
  it('spreads the whole Bible over a year exactly', () => {
    const p = { books: bible, chapters_per_day: null, days_total: 365, start_date: '2026-01-01', rest_days: [] as number[] };
    expect(totalDays(p)).toBe(365);
    const all = Array.from({ length: 365 }, (_, i) => chaptersFor(p, i + 1));
    expect(all.flat()).toHaveLength(1189);
    expect(Math.min(...all.map((d) => d.length))).toBe(3);
    expect(Math.max(...all.map((d) => d.length))).toBe(4);
    expect(isoDay(finishDate(p))).toBe('2026-12-31');
  });
  it('weekdays only in a year', () => {
    const rest = [0, 6];
    const days = readingDaysBetween({ start_date: '2026-01-01', rest_days: rest }, new Date(2026, 11, 31));
    expect(days).toBe(261);
    const p = { books: bible, chapters_per_day: null, days_total: days, start_date: '2026-01-01', rest_days: rest };
    expect(dailyRange(p)).toEqual([4, 5]);
    expect(dateOfDay(p, 1).getDay()).not.toBe(0);
  });
  it('weaves the Old and New Testament together', () => {
    const list = chapterList(bible, 'mixed');
    expect(list).toHaveLength(1189);
    // halfway through, both testaments are about half done
    const half = list.slice(0, 595);
    const nt = half.filter((c) => ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', 'REV'].includes(c.b) || c.b.endsWith('CO')).length;
    expect(nt).toBeGreaterThan(60);
    expect(list[list.length - 1]).toEqual({ b: 'REV', c: 22 });
  });
});

describe('reading ahead', () => {
  const plan = { books: ['MAT'], chapters_per_day: 1, start_date: '2026-01-05', rest_days: [] as number[] };
  it('allows two days ahead, then waits', () => {
    const on = new Date(2026, 0, 7); // day 3 is due
    expect(planStatus(plan, new Set([1, 2, 3]), on)).toMatchObject({ next: 4, canRead: true, ahead: 0 });
    expect(planStatus(plan, new Set([1, 2, 3, 4]), on)).toMatchObject({ next: 5, canRead: true, ahead: 1 });
    const two = planStatus(plan, new Set([1, 2, 3, 4, 5]), on);
    expect(two).toMatchObject({ next: 6, canRead: false, ahead: 2 });
    expect(isoDay(two.opensOn!)).toBe('2026-01-08'); // day 6 opens when day 4 is due
  });
  it('lets someone behind read their first unread day', () => {
    expect(planStatus(plan, new Set([1]), new Date(2026, 0, 9))).toMatchObject({ next: 2, canRead: true, behind: 4 });
  });
});
