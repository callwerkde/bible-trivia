import { create } from 'zustand';
import { supabase } from './supabase';
import { useAccount } from './account';
import { useApp } from '../store';

/*
 * Your progress in the Tent of Testimony library (table tot_progress): which items you've
 * finished, and the one you opened last. Kept on the phone so it shows at once and works
 * offline; changes made offline are sent when the app is next online. Signed out, it
 * stays on the phone.
 */

type Saved = { done: number[]; last: number | null; add: number[]; del: number[] };
const key = () => `bt-tot:${useAccount.getState().session?.user.id ?? 'guest'}`;
function read(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(key()) ?? 'null') as Saved | null;
    if (v) return { done: v.done ?? [], last: v.last ?? null, add: v.add ?? [], del: v.del ?? [] };
  } catch {
    /* fall through */
  }
  return { done: [], last: null, add: [], del: [] };
}
function write(s: Saved) {
  try {
    localStorage.setItem(key(), JSON.stringify(s));
  } catch {
    /* storage full or blocked */
  }
}

interface TotState {
  done: Set<number>;
  last: number | null;
  /** Load from the phone, then send changes made offline and fetch the account's list. */
  load: () => Promise<void>;
  setDone: (id: number, on: boolean) => Promise<void>;
  setLast: (id: number) => void;
}

export const useTot = create<TotState>((set, get) => ({
  done: new Set(read().done),
  last: read().last,

  async load() {
    const s = read();
    set({ done: new Set(s.done), last: s.last });
    const db = supabase;
    const me = useAccount.getState().session?.user.id;
    if (!db || !me || !navigator.onLine) return;
    try {
      if (s.add.length) {
        const r = await db.from('tot_progress').upsert(s.add.map((item_id) => ({ user_id: me, item_id })), { onConflict: 'user_id,item_id', ignoreDuplicates: true });
        if (r.error) throw r.error;
      }
      if (s.del.length) {
        const r = await db.from('tot_progress').delete().eq('user_id', me).in('item_id', s.del);
        if (r.error) throw r.error;
      }
      const { data, error } = await db.from('tot_progress').select('item_id').eq('user_id', me);
      if (error) throw error;
      const done = (data as { item_id: number }[]).map((r) => r.item_id);
      const now = read();
      write({ ...now, done, add: [], del: [] });
      set({ done: new Set(done) });
    } catch {
      /* stays on the phone; sent next time */
    }
  },

  async setDone(id, on) {
    const s = read();
    const done = new Set(get().done);
    if (on) done.add(id);
    else done.delete(id);
    const add = new Set(s.add);
    const del = new Set(s.del);
    if (on) {
      add.add(id);
      del.delete(id);
    } else {
      del.add(id);
      add.delete(id);
    }
    write({ ...s, done: [...done], add: [...add], del: [...del] });
    set({ done });
    // Finishing a message or lesson counts toward the daily streak, like reading.
    if (on) useApp.getState().markReadingDay();
    void get().load();
  },

  setLast(id) {
    write({ ...read(), last: id });
    set({ last: id });
  },
}));
