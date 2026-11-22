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
const bibleUrl = (b: string) => `/packs/bible/${b}.json`;

/** How many books of the Bible text are on this phone (out of 66). */
export async function bibleBooksSaved(): Promise<number> {
  if (!('caches' in window)) return 0;
  const found = await Promise.all(BIBLE.map((b) => caches.match(bibleUrl(b)).then(Boolean, () => false)));
  return found.filter(Boolean).length;
}

let saving: Promise<number> | null = null;
/** Saves the whole Bible (English and Tamil, about 3 MB) for reading offline, the books not
 *  on the phone yet, one at a time. Returns how many books are saved. */
export function saveBible(onProgress?: (saved: number) => void): Promise<number> {
  saving ??= (async () => {
    try {
      if (!('caches' in window) || !navigator.serviceWorker?.controller) return bibleBooksSaved();
      const have = await Promise.all(BIBLE.map((b) => caches.match(bibleUrl(b)).then(Boolean, () => false)));
      let n = have.filter(Boolean).length;
      onProgress?.(n);
      for (let i = 0; i < BIBLE.length; i++) {
        if (have[i]) continue;
        if (!navigator.onLine) break;
        const ok = await fetch(bibleUrl(BIBLE[i])).then((r) => r.ok, () => false);
        if (ok) onProgress?.(++n);
      }
      return n;
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
  if (!navigator.serviceWorker?.controller) return;
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
