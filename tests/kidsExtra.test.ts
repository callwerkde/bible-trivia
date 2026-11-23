import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ART_KEYS } from '../src/art/Illustrations';
import { PORTRAIT_IDS } from '../src/art/KidsPeople';
import { COUNT_KINDS } from '../src/art/CountIcons';
import { STORY_SCENES_A } from '../src/art/StoryScenesA';
import { STORY_SCENES_B } from '../src/art/StoryScenesB';
import { PICTURE_STORIES, STORY_QUESTIONS, storyQuestionIds } from '../src/engine/kids';
import verses from '../content/kids/verses.json';
import count from '../content/kids/count.json';
import odd from '../content/kids/odd.json';

const bible = (b: string) => JSON.parse(readFileSync(`public/packs/bible/${b}.json`, 'utf8')) as { en: string[][]; ta: string[][] };
const artOk = (a: string) => (a.startsWith('p:') ? PORTRAIT_IDS.includes(a.slice(2)) : (ART_KEYS as string[]).includes(a));

describe('Kids memory verses', () => {
  it('are the exact words of the Bible (KJV and BSI)', () => {
    for (const v of verses) {
      const [b, c, n] = v.ref as [string, number, number];
      const d = bible(b);
      expect(d.en[c - 1][n - 1].replace(/’/g, "'"), v.id).toContain(v.en.replace(/\.$/, ''));
      expect(d.ta[c - 1][n - 1], v.id).toContain(v.ta.replace(/\.$/, ''));
    }
  });
});

describe('Count it', () => {
  it('counts 1 to 12 of a thing the picture can draw', () => {
    for (const c of count) {
      expect(c.n, c.id).toBeGreaterThanOrEqual(1);
      expect(c.n, c.id).toBeLessThanOrEqual(12);
      expect(COUNT_KINDS, c.id).toContain(c.kind);
    }
  });
});

describe('Odd one out', () => {
  it('has three from the story and one from another, all with pictures', () => {
    const items = odd.items as Record<string, { art: string; story: string }>;
    for (const s of odd.sets) {
      for (const k of s.keep) expect(items[k].story, s.id).toBe(s.story);
      expect(items[s.odd].story, s.id).not.toBe(s.story);
      for (const k of [...s.keep, s.odd]) expect(artOk(items[k].art), `${s.id} ${k}`).toBe(true);
    }
  });
});

describe('Picture stories', () => {
  const scenes = { ...STORY_SCENES_A, ...STORY_SCENES_B };
  it('draws every page and asks three questions', () => {
    for (const s of PICTURE_STORIES) {
      expect(s.pages, s.id).toHaveLength(4);
      for (const p of s.pages) expect(scenes[p.scene], p.scene).toBeTypeOf('function');
      expect(storyQuestionIds(s.id), s.id).toHaveLength(3);
    }
    for (const q of STORY_QUESTIONS) expect(new Set(q.en.options).size, q.id).toBe(3);
  });
});
