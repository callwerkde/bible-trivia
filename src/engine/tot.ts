/**
 * The Tent of Testimony (சாட்சியின் கூடாரம், tot.org.in) library: Tamil messages, Bible
 * studies, church history, pioneers of faith and articles. Only titles and links are kept
 * here (public/packs/tot.json, built by scripts/tot-catalog.mjs); each item opens on
 * tot.org.in or YouTube. The content is in Tamil only.
 */
import { TOT_VERSION } from './totVersion';

export interface TotRef {
  b: string;
  c: number;
  v?: number;
  /** End chapter, when the passage runs across chapters (v2 is then in that chapter). */
  c2?: number;
  v2?: number;
}
/** "எபிரெயர் 4:14–16", "எபிரெயர் 1:1–5:10". */
export function totRefLabel(r: TotRef, lang: 'en' | 'ta', format: (lang: 'en' | 'ta', b: string, c: number, v?: number, v2?: number) => string): string {
  return r.c2 ? `${format(lang, r.b, r.c, r.v)}–${r.c2}:${r.v2}` : format(lang, r.b, r.c, r.v, r.v2);
}
export interface TotItem {
  /** The number at the end of its tot.org.in link (stable). */
  id: number;
  /** Its number in the series ("01 - …"), if it has one. */
  n: number | null;
  ta: string;
  url: string;
  /** YouTube video id, when the page has a video. */
  yt?: string;
  /** The Bible passage named in its title. */
  ref?: TotRef;
}
export interface TotSeries {
  id: string;
  ta: string;
  en: string;
  url: string;
  items: TotItem[];
}
export interface TotSection {
  id: 'messages' | 'study' | 'history' | 'pioneers' | 'articles';
  ta: string;
  en: string;
  by?: string;
  url: string;
  series: TotSeries[];
}
export interface TotCatalog {
  source: string;
  updated: string;
  count: number;
  sections: TotSection[];
}

/** Where an item sits: its section and series. */
export interface TotPlace {
  item: TotItem;
  series: TotSeries;
  section: TotSection;
}

let loading: Promise<TotCatalog> | null = null;
export function loadTot(): Promise<TotCatalog> {
  loading ??= fetch(`/packs/tot.json?v=${TOT_VERSION}`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<TotCatalog>;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** Every item by id, with its place. */
export function totIndex(c: TotCatalog): Map<number, TotPlace> {
  const m = new Map<number, TotPlace>();
  for (const section of c.sections) for (const series of section.series) for (const item of series.items) if (!m.has(item.id)) m.set(item.id, { item, series, section });
  return m;
}

export const isVideo = (i: TotItem) => Boolean(i.yt);
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const ytLink = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** Where tapping "watch" or "read" goes. */
export const openUrl = (i: TotItem) => (i.yt ? ytLink(i.yt) : i.url);

/** How many items of a list are done. */
export const doneIn = (items: TotItem[], done: Set<number>) => items.reduce((n, i) => n + (done.has(i.id) ? 1 : 0), 0);
export const sectionItems = (s: TotSection) => s.series.flatMap((x) => x.items);

/** The first item not done in a series (or null when all are). */
export const nextIn = (series: TotSeries, done: Set<number>) => series.items.find((i) => !done.has(i.id)) ?? null;
