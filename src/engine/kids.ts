/**
 * Kids: very simple Bible games for young children (content/kids/kids.json).
 *   Kids Quiz   — three big choices, often with a picture
 *   Yes or No   — simple statements
 *   Who Am I?   — "I built a big boat…"
 *   Picture Match and Story Order — their own screens (KidsMatch, KidsOrder)
 * Every answer points to its verse, shown after answering.
 */
import data from '../../content/kids/kids.json';
import storyData from '../../content/kids/stories.json';
import type { ArtKey, Question } from './types';

type Ref = [string, number, number];
type Line = [string, string, string, string];
interface QuizItem {
  id: string;
  ref: Ref;
  art?: string;
  en: Line;
  ta: Line;
}
interface YesNo {
  id: string;
  ref: Ref;
  answer: boolean;
  en: string;
  ta: string;
  why?: { en: string; ta: string };
}
export interface MatchPair {
  id: string;
  art: ArtKey;
  en: string;
  ta: string;
  thing: { en: string; ta: string };
}
export interface StoryStep {
  en: string;
  ta: string;
  art?: ArtKey;
}
export interface Story {
  id: string;
  ref: Ref;
  en: string;
  ta: string;
  steps: StoryStep[];
}

const D = data as unknown as { quiz: QuizItem[]; yesno: YesNo[]; who: QuizItem[]; match: MatchPair[]; order: Story[] };

// The answer is written first in the file; the options are shown in a fixed shuffled order
// (the same for everyone), so the answer isn't always on top.
function spread(id: string, n: number): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % n;
}
function multipleChoice(prefix: string, x: QuizItem, tag: string): Question {
  const at = spread(prefix + x.id, 3);
  const place = (opts: string[]) => {
    const [right, ...wrong] = opts;
    const out = [...wrong];
    out.splice(at, 0, right);
    return out;
  };
  const [b, c, v] = x.ref;
  return {
    id: `kd-${prefix}-${x.id}`,
    type: 'mcq',
    book: b,
    chapter: c,
    verse: v,
    difficulty: 1,
    answer: at,
    en: { q: x.en[0], options: place(x.en.slice(1)) },
    ta: { q: x.ta[0], options: place(x.ta.slice(1)) },
    tags: ['kids', tag],
    ...(x.art ? { art: x.art as ArtKey } : {}),
  };
}

export const KIDS_QUIZ: Question[] = D.quiz.map((x) => multipleChoice('q', x, 'kids-quiz'));
export const KIDS_WHO: Question[] = D.who.map((x) => multipleChoice('who', x, 'kids-who'));
export const KIDS_YESNO: Question[] = D.yesno.map((x) => ({
  id: `kd-tf-${x.id}`,
  type: 'tf',
  book: x.ref[0],
  chapter: x.ref[1],
  verse: x.ref[2],
  difficulty: 1,
  answer: x.answer,
  en: { q: x.en, ...(x.why ? { explain: x.why.en } : {}) },
  ta: { q: x.ta, ...(x.why ? { explain: x.why.ta } : {}) },
  tags: ['kids', 'kids-yesno'],
}));
/** Picture stories: four pages each (src/screens/KidsStories.tsx), then three questions. */
export interface StoryPage {
  scene: string;
  ref: Ref;
  en: string;
  ta: string;
}
export interface PictureStory {
  id: string;
  en: string;
  ta: string;
  pages: StoryPage[];
  quiz: { ref: Ref; en: Line; ta: Line }[];
}
export const PICTURE_STORIES = storyData as unknown as PictureStory[];
/** The questions after each picture story (ids kd-st-<story>-<n>). */
export const STORY_QUESTIONS: Question[] = PICTURE_STORIES.flatMap((s) => s.quiz.map((q, i) => multipleChoice(`st-${s.id}`, { id: String(i + 1), ref: q.ref, en: q.en, ta: q.ta }, 'kids-story')));
export const storyQuestionIds = (story: string) => STORY_QUESTIONS.filter((q) => q.id.startsWith(`kd-st-${story}-`)).map((q) => q.id);

export const KIDS_QUESTIONS: Question[] = [...KIDS_QUIZ, ...KIDS_YESNO, ...KIDS_WHO, ...STORY_QUESTIONS];

export const KIDS_MATCH: MatchPair[] = D.match;
export const KIDS_STORIES: Story[] = D.order;

export type KidsGame = 'kids' | 'kidsTf' | 'kidsWho';
export const kidsPool = (game: KidsGame): Question[] => (game === 'kidsTf' ? KIDS_YESNO : game === 'kidsWho' ? KIDS_WHO : KIDS_QUIZ);
