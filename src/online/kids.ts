import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';
import { useAccount } from './account';
import { dayKey } from '../engine/picker';

/*
 * Kids progress: finished picture stories, learned memory verses and coloured pictures.
 * Everything is kept on the phone as the child plays. Once a day, and only when something
 * changed, the whole lot is saved to the account in one write (table kids_progress), so a
 * new phone can pick it up. Nothing is saved for every tap.
 */

export interface KidsData {
  /** Picture stories read to the end (story ids). */
  stories: string[];
  /** Memory verses learned (verse ids). */
  verses: string[];
  /** Colouring pages: page id → colour for each part (index → colour). */
  colouring: Record<string, Record<string, string>>;
  /** The child's name, written on shared pictures (kept here, not sent anywhere else). */
  name: string;
}

interface KidsState extends KidsData {
  /** Changed since the last save to the account. */
  dirty: boolean;
  savedOn: string | null;
  storyDone: (id: string) => void;
  verseLearned: (id: string) => void;
  setColour: (page: string, part: string, colour: string | null) => void;
  clearPage: (page: string) => void;
  setName: (name: string) => void;
}

const empty: KidsData = { stories: [], verses: [], colouring: {}, name: '' };

export const useKids = create<KidsState>()(
  persist(
    (set) => ({
      ...empty,
      dirty: false,
      savedOn: null,
      storyDone: (id) => set((s) => (s.stories.includes(id) ? s : { stories: [...s.stories, id], dirty: true })),
      verseLearned: (id) => set((s) => (s.verses.includes(id) ? s : { verses: [...s.verses, id], dirty: true })),
      setColour: (page, part, colour) =>
        set((s) => {
          const fills = { ...(s.colouring[page] ?? {}) };
          if (colour) fills[part] = colour;
          else delete fills[part];
          return { colouring: { ...s.colouring, [page]: fills }, dirty: true };
        }),
      clearPage: (page) =>
        set((s) => {
          const c = { ...s.colouring };
          delete c[page];
          return { colouring: c, dirty: true };
        }),
      setName: (name) => set({ name: name.slice(0, 30) }),
    }),
    { name: 'bt-kids', version: 1 },
  ),
);

/**
 * Once a day: send what changed, or (on a phone with nothing yet) bring back what the
 * account has. Safe to call often: it does nothing more than once a day.
 */
export async function syncKids(): Promise<void> {
  const db = supabase;
  const me = useAccount.getState().session?.user.id;
  if (!db || !me || !navigator.onLine) return;
  const s = useKids.getState();
  const today = dayKey();
  if (s.savedOn === today) return;
  try {
    if (s.dirty) {
      const data: KidsData = { stories: s.stories, verses: s.verses, colouring: s.colouring, name: '' };
      const { error } = await db.from('kids_progress').upsert({ user_id: me, data, updated_at: new Date().toISOString() });
      if (error) throw error;
      useKids.setState({ dirty: false, savedOn: today });
      return;
    }
    // Nothing new on this phone: if it's empty, bring back the account's copy.
    if (!s.stories.length && !s.verses.length && !Object.keys(s.colouring).length) {
      const { data, error } = await db.from('kids_progress').select('data').eq('user_id', me).maybeSingle();
      if (error) throw error;
      const d = (data?.data ?? null) as Partial<KidsData> | null;
      if (d) useKids.setState({ stories: d.stories ?? [], verses: d.verses ?? [], colouring: d.colouring ?? {} });
    }
    useKids.setState({ savedOn: today });
  } catch {
    /* try again next time the app opens */
  }
}
