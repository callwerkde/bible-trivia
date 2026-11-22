import { dayKey } from '../engine/picker';
import { POPULAR, loadMcqIndex, pickBooks } from '../engine/mcq';
import { BOOKS } from '../i18n/books';

/**
 * Keeps questions on the phone for offline play. Once a day, while online, it
 * quietly downloads (the service worker keeps them in the "question-packs" cache):
 *   - the popular books and Who Said It?
 *   - the books for the next 3 days' Daily Challenge
 *   - 3 more books each day, until the whole Bible is there
 * The files are refreshed from the server whenever they're used online, so
 * fixes and new Tamil translations arrive by themselves.
 */
const CACHE = 'question-packs';
const KEY = 'bt-stocked-on';

/** Book codes whose multiple-choice questions are on this phone. */
export async function cachedBooks(): Promise<Set<string>> {
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    return new Set(keys.map((r) => /\/packs\/mcq\/([0-9A-Z]{3})\.json$/.exec(new URL(r.url).pathname)?.[1]).filter((b): b is string => Boolean(b)));
  } catch {
    return new Set();
  }
}

const BIBLE = BOOKS.map((b) => b.code);

/** Files are only kept offline once the service worker looks after this page. On the very
 *  first visit it takes a few seconds to start, so wait for it (up to 30 s). */
function controlled(): Promise<boolean> {
  const sw = navigator.serviceWorker;
  if (!sw) return Promise.resolve(false);
  if (sw.controller) return Promise.resolve(true);
  return new Promise((done) => {
    const timer = setTimeout(() => done(false), 30_000);
    sw.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        done(true);
      },
      { once: true },
    );
  });
}
const bibleUrl = (b: string) => `/packs/bible/${b}.json`;

/** How many books of the Bible text are on this phone (out of 66). */
export async function bibleBooksSaved(): Promise<number> {
  if (!('caches' in window)) return 0;
  const found = await Promise.all(BIBLE.map((b) => caches.match(bibleUrl(b)).then(Boolean, () => false)));
  return found.filter(Boolean).length;
}

// Books someone needs soon (their group's next readings and tasks) are saved first.
// Kept on the phone so the next background save starts with them too.
const FIRST_KEY = 'bt-bible-first';
const readFirst = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FIRST_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/** Save these books before the rest (newest wishes first), starting now. */
export function bibleFirst(books: string[]) {
  const wanted = books.filter((b) => BIBLE.includes(b));
  if (!wanted.length) return;
  const list = [...new Set([...wanted, ...readFirst()])].slice(0, 30);
  try {
    localStorage.setItem(FIRST_KEY, JSON.stringify(list));
  } catch {
    /* fine: they're still saved first this time */
  }
  void saveBible().catch(() => {});
}

let saving: Promise<number> | null = null;
/** Saves the whole Bible (English and Tamil, about 3 MB) for reading offline, one book at
 *  a time: first the books asked for with bibleFirst, then the rest in Bible order.
 *  Returns how many books are saved. */
export function saveBible(onProgress?: (saved: number) => void): Promise<number> {
  saving ??= (async () => {
    try {
      if (!('caches' in window) || !(await controlled())) return bibleBooksSaved();
      const flags = await Promise.all(BIBLE.map((b) => caches.match(bibleUrl(b)).then(Boolean, () => false)));
      const have = new Set(BIBLE.filter((_, i) => flags[i]));
      const failed = new Set<string>();
      onProgress?.(have.size);
      for (;;) {
        // Looked up again each time, so books asked for while saving jump the queue.
        const next = [...readFirst(), ...BIBLE].find((b) => BIBLE.includes(b) && !have.has(b) && !failed.has(b));
        if (!next || !navigator.onLine) break;
        const ok = await fetch(bibleUrl(next)).then((r) => r.ok, () => false);
        if (ok) {
          have.add(next);
          onProgress?.(have.size);
        } else failed.add(next);
      }
      return have.size;
    } finally {
      saving = null;
    }
  })();
  return saving;
}

const idle = () => new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 300)));

export async function stockUp(force = false) {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (!navigator.onLine || conn?.saveData || !('caches' in window)) return;
  // Packs are only kept once the service worker looks after this page.
  if (!(await controlled())) return;
  // The Bible text first (small, and needed for the reading plans), until it's all there.
  await saveBible().catch(() => {});
  const today = dayKey();
  try {
    if (!force && localStorage.getItem(KEY) === today) return;
  } catch {
    /* storage blocked: stock up anyway */
  }

  const index = await loadMcqIndex().catch(() => null);
  if (!index) return;
  const all = Object.keys(index.books);
  const have = await cachedBooks();
  const days = [0, 1, 2].map((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return dayKey(d);
  });
  const daily = days.flatMap((d) => pickBooks(`daily:${d}`, 4));
  const more = all.filter((b) => !have.has(b) && !POPULAR.includes(b) && !daily.includes(b)).slice(0, 3);
  const books = [...new Set([...POPULAR.filter((b) => all.includes(b)), ...daily, ...more])].filter((b) => !have.has(b));

  const urls = ['/packs/mcq/who.json', '/packs/uw/index.json', ...books.map((b) => `/packs/mcq/${b}.json`)];
  for (const url of urls) {
    if (!navigator.onLine) return;
    await idle();
    await fetch(url).catch(() => {});
  }
  try {
    localStorage.setItem(KEY, today);
  } catch {
    /* fine */
  }
}
