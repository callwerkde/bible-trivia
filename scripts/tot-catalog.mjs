#!/usr/bin/env node
/**
 * Builds the Tent of Testimony (சாட்சியின் கூடாரம், tot.org.in) library catalogue:
 * public/packs/tot.json — sections → series → items, each item with its title, link,
 * YouTube video (if any) and Bible verses (from the title). Only titles and links are
 * kept: the messages themselves open on tot.org.in or YouTube.
 *
 *   npm run content:tot
 *
 * Re-run it to pick up new messages. It reads the site's own menus, one page at a time.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://www.tot.org.in/tamil/wiki/';
const OUT = 'public/packs/tot.json';
const VERSION_FILE = 'src/engine/totVersion.ts';

// English names for the menus (the titles themselves stay in Tamil).
const SERIES_EN = {
  christ: 'Christ',
  'gods-eternal-plan': "God's eternal plan",
  'eternal-life': 'Eternal life',
  gospel: 'The gospel',
  milton: 'The cross',
  'christian-living': 'Christian living',
  'church-fellowship': 'Church and fellowship',
  books: 'Books of the Bible',
  'holy-spirit': 'The Holy Spirit',
  'service-servants': 'Service and servants',
  leviticus: 'Leviticus',
  hebrews: 'Hebrews',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

async function get(path) {
  const url = path.startsWith('http') ? path : BASE + path;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'bible-trivia-catalog/1.0' } });
      if (r.ok) return await r.text();
      if (r.status === 404) return '';
    } catch {
      /* retry */
    }
    await sleep(1500 * (i + 1));
  }
  throw new Error(`could not fetch ${url}`);
}

const links = (html) => [...html.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1].trim(), text: decode(m[2]) }));
/** What a page offers: its recordings (mp3), and whether the message is written out. */
function mediaOf(page) {
  // (Some links have plain spaces in them: encode them so they play everywhere.)
  const audio = [...new Set([...page.matchAll(/data-mp3="([^"]+)"/g)].map((m) => encodeURI(decodeURI(m[1].trim()))).filter((u) => /^https?:\/\/\S+\.mp3$/i.test(u)))];
  const body = page.slice(Math.max(0, page.indexOf('event-section-2'))).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  const chars = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => decode(m[1])).filter((x) => x.length > 80).reduce((n, x) => n + x.length, 0);
  return { ...(audio.length ? { audio } : {}), ...(chars > 2000 ? { text: true } : {}) };
}

const idOf = (href) => Number(/\/(\d+)\/?$/.exec(href)?.[1] ?? 0);

// Tamil book names → codes (for the verses in titles like "எபிரெயர் 4:14-16").
const BOOKS = [...readFileSync('src/i18n/books.ts', 'utf8').matchAll(/\['([0-9A-Z]{3})', '[^']*', '([^']+)'\]/g)].map((m) => ({ code: m[1], ta: m[2] }));
function refIn(text) {
  for (const b of BOOKS) {
    // Across chapters: "எபிரெயர் 1:1-5:10".
    const x = new RegExp(`${b.ta}\\s*(\\d+)\\s*:\\s*(\\d+)\\s*-\\s*(\\d+)\\s*:\\s*(\\d+)`).exec(text);
    if (x) return { b: b.code, c: Number(x[1]), v: Number(x[2]), c2: Number(x[3]), v2: Number(x[4]) };
    const m = new RegExp(`${b.ta}\\s*(\\d+)\\s*[:.]\\s*(\\d+)(?:\\s*-\\s*(\\d+)(?!\\s*[:.]\\d))?`).exec(text);
    if (m && text.includes(`${m[1]}:`)) return { b: b.code, c: Number(m[1]), v: Number(m[2]), ...(m[3] ? { v2: Number(m[3]) } : {}) };
  }
  return null;
}

/** "02 - எபிரெயர் 1:1-4 - குமாரனில் …" → number 2, verses, and the title "குமாரனில் …". */
function tidyTitle(raw, seriesTa) {
  const parts = raw.split(/\s+[-–]\s*|\s*[-–]\s+/).map((s) => s.trim()).filter(Boolean);
  let n = null;
  const m = /^(\d{1,3})\s*-?\s*(.*)$/.exec(parts[0] ?? '');
  if (m) {
    n = Number(m[1]);
    if (m[2]) parts[0] = m[2];
    else parts.shift();
  }
  const ref = refIn(raw);
  const keep = parts.filter((p) => p !== seriesTa && !(ref && refIn(p) && p.replace(/[\d:.\s-]/g, '') === (BOOKS.find((b) => b.code === ref.b)?.ta ?? '')));
  const title = keep
    .join(' - ')
    // "எபிரெயர் 11.3 - …" → "…" (but never cut a word: "கிறிஸ்துவே …" stays whole).
    .replace(new RegExp(`^${seriesTa}(?:\\s+[\\d.:]+)?\\s*[-–]\\s+`), '')
    .replace(/\s*[-–]\s*\d+\s*:\s*\d+(?:\s*-\s*\d+)?\s*$/, '')
    .replace(/[\s\-–]+$/, '')
    .trim();
  return { n, ref, title: title || raw };
}

async function main() {
  const home = await get('miltons/3');
  const menu = links(home).filter((l) => l.href.startsWith(BASE) && l.text);
  const navSet = new Set(links(home).map((l) => l.href));
  const menuOf = (re) => menu.filter((l) => re.test(l.href.slice(BASE.length))).filter((l, i, a) => a.findIndex((x) => x.href === l.href) === i);

  /** The items listed on a series page (links that aren't part of the site menu). */
  async function itemsOn(path, seriesTa) {
    const html = await get(path);
    const seen = new Set();
    const list = links(html).filter((l) => l.href.startsWith(BASE) && !navSet.has(l.href) && l.text && idOf(l.href) && !seen.has(l.href) && seen.add(l.href));
    const items = [];
    for (const l of list) {
      await sleep(250);
      const page = await get(l.href);
      const yt = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/.exec(page)?.[1] ?? null;
      const { n, ref, title } = tidyTitle(l.text, seriesTa);
      items.push({ id: idOf(l.href), n, ta: title, url: l.href, ...(yt ? { yt } : {}), ...mediaOf(page), ...(ref ? { ref } : {}) });
      process.stdout.write('.');
    }
    return items;
  }

  const sections = [];

  // Messages: one series per topic.
  const topics = menuOf(/^miltons\/[^/]+\/\d+$/);
  const msgSeries = [];
  for (const t of topics) {
    const slug = t.href.slice(BASE.length).split('/')[1];
    msgSeries.push({ id: slug, ta: t.text, en: SERIES_EN[slug] ?? slug, url: t.href, items: await itemsOn(t.href, t.text) });
  }
  sections.push({ id: 'messages', ta: 'செய்திகள்', en: 'Messages', by: 'மில்டன் இராஜேந்திரம்', url: BASE + 'miltons/3', series: msgSeries });

  // Bible study: one series per book.
  const studies = menuOf(/^bible_study\/[^/]+\/\d+$/);
  const studySeries = [];
  for (const s of studies) {
    const slug = s.href.slice(BASE.length).split('/')[1].toLowerCase();
    studySeries.push({ id: slug, ta: s.text, en: SERIES_EN[slug] ?? slug, url: s.href, items: await itemsOn(s.href, s.text) });
  }
  sections.push({ id: 'study', ta: 'வேத ஆய்வு', en: 'Bible study', url: BASE + 'bible_study/204', series: studySeries });

  sections.push({ id: 'history', ta: 'சபை வரலாறு', en: 'Church history', url: BASE + 'church-history/1', series: [{ id: 'history', ta: 'சபை வரலாறு', en: 'Church history', url: BASE + 'church-history/1', items: await itemsOn('church-history/1', 'சபை வரலாறு') }] });
  sections.push({ id: 'pioneers', ta: 'முன்னோடிகள்', en: 'Pioneers of faith', url: BASE + 'pioneers/2', series: [{ id: 'pioneers', ta: 'முன்னோடிகள்', en: 'Pioneers of faith', url: BASE + 'pioneers/2', items: await itemsOn('pioneers/2', 'முன்னோடிகள்') }] });

  // Articles: one page per author (the menu under கட்டுரைகள்).
  const authors = menuOf(/^resources\/articles2\/[^/]+\/\d+$/);
  const articles = [];
  for (const a of authors) {
    await sleep(250);
    const page = await get(a.href);
    const yt = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/.exec(page)?.[1] ?? null;
    articles.push({ id: idOf(a.href), n: null, ta: a.text, url: a.href, ...(yt ? { yt } : {}), ...mediaOf(page) });
  }
  sections.push({ id: 'articles', ta: 'கட்டுரைகள்', en: 'Articles', url: authors[0]?.href ?? BASE, series: [{ id: 'articles', ta: 'கட்டுரைகள்', en: 'Articles', url: authors[0]?.href ?? BASE, items: articles }] });

  // The day each item was first seen, kept from the last catalogue, so the app can mark
  // new messages ("New"). Items already there before dates were kept get an old date.
  let before = null;
  try {
    before = JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    /* first run */
  }
  const today = new Date().toISOString().slice(0, 10);
  const known = new Map();
  for (const sec of before?.sections ?? []) for (const ser of sec.series) for (const it of ser.items) known.set(it.id, it.added ?? '2026-11-01');
  for (const sec of sections) for (const ser of sec.series) for (const it of ser.items) it.added = known.get(it.id) ?? (before ? today : '2026-11-01');

  const count = sections.reduce((n, s) => n + s.series.reduce((k, x) => k + x.items.length, 0), 0);
  // Nothing changed on the site: leave the files alone (no commit, no new version).
  if (before && JSON.stringify(before.sections) === JSON.stringify(sections)) {
    console.log(`\nno changes: ${count} items, as before`);
    return;
  }
  const added = [...sections.flatMap((s) => s.series.flatMap((x) => x.items))].filter((i) => i.added === today && before);
  const catalog = { source: 'https://www.tot.org.in/tamil', updated: today, count, sections };
  mkdirSync('public/packs', { recursive: true });
  writeFileSync(OUT, JSON.stringify(catalog));
  // A version tag so phones fetch the new list instead of a saved old one.
  let hash = 0;
  for (const ch of JSON.stringify(sections)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  writeFileSync(VERSION_FILE, `// Written by scripts/tot-catalog.mjs: changes whenever the catalogue does.\nexport const TOT_VERSION = '${(hash >>> 0).toString(36)}';\n`);
  if (added.length) console.log(`\nnew: ${added.length} — ${added.map((i) => i.ta).join(' | ')}`);
  console.log(`\nwrote ${OUT}: ${count} items in ${sections.length} sections`);
  for (const s of sections) console.log(`  ${s.en}: ${s.series.map((x) => `${x.en} ${x.items.length}`).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
