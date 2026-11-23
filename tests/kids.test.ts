import { describe, expect, it } from 'vitest';
import { KIDS_MATCH, KIDS_QUESTIONS, KIDS_QUIZ, KIDS_STORIES, KIDS_WHO, KIDS_YESNO } from '../src/engine/kids';
import { ART_KEYS } from '../src/art/Illustrations';
import { CHAPTERS } from '../src/engine/drill';
import data from '../content/kids/kids.json';

describe('Kids games', () => {
  it('has unique ids', () => {
    const ids = KIDS_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('asks three choices in both languages, with the right answer in place', () => {
    const raw = [...data.quiz, ...data.who];
    for (const q of [...KIDS_QUIZ, ...KIDS_WHO]) {
      expect(q.en.options, q.id).toHaveLength(3);
      expect(q.ta.options, q.id).toHaveLength(3);
      const src = raw.find((x) => q.id.endsWith(`-${x.id}`) && (q.id.startsWith('kd-q-') ? data.quiz.includes(x) : data.who.includes(x)))!;
      expect(q.en.options![q.answer as number], q.id).toBe(src.en[1]);
      expect(q.ta.options![q.answer as number], q.id).toBe(src.ta[1]);
      expect(new Set(q.en.options).size, q.id).toBe(3);
    }
  });
  it('has yes and no answers in both', () => {
    expect(KIDS_YESNO.some((q) => q.answer === true)).toBe(true);
    expect(KIDS_YESNO.some((q) => q.answer === false)).toBe(true);
    for (const q of KIDS_YESNO) if (q.answer === false) expect(q.en.explain && q.ta.explain, q.id).toBeTruthy();
  });
  it('points every answer to a real chapter', () => {
    const refs = [...KIDS_QUESTIONS.map((q) => [q.book, q.chapter] as const), ...KIDS_STORIES.map((s) => [s.ref[0], s.ref[1]] as const)];
    for (const [b, c] of refs) {
      expect(CHAPTERS[b], b).toBeTruthy();
      expect(c, b).toBeLessThanOrEqual(CHAPTERS[b]);
    }
  });
  it('only uses pictures that exist', () => {
    const arts = [...KIDS_QUESTIONS.map((q) => q.art), ...KIDS_MATCH.map((m) => m.art), ...KIDS_STORIES.flatMap((s) => s.steps.map((x) => x.art))].filter(Boolean);
    for (const a of arts) expect(ART_KEYS, a).toContain(a);
  });
  it('has stories of four steps and enough pairs for a board', () => {
    for (const s of KIDS_STORIES) expect(s.steps, s.id).toHaveLength(4);
    expect(KIDS_MATCH.length).toBeGreaterThanOrEqual(6);
  });
});
