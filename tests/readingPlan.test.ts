import { describe, expect, it } from 'vitest';
import { chaptersFor, chaptersLabel, chapterList, dateOfDay, daysDue, finishDate, isoDay, planStatus, totalDays, PRESETS } from '../src/engine/readingPlan';

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
