#!/usr/bin/env node
// Builds public/packs/timeline.json from content/timeline/timeline.json (the
// Bible Lives Timeline: people, events, eras). Checks every entry first.
//   npm run content:timeline
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const src = JSON.parse(readFileSync(new URL('content/timeline/timeline.json', ROOT), 'utf8'));
const books = new Set([...readFileSync(new URL('src/i18n/books.ts', ROOT), 'utf8').matchAll(/\['([0-9A-Z]{3})'/g)].map((m) => m[1]));
const errors = [];
const cats = new Set(src.cats.map((c) => c.id));
const ids = new Set();
const year = (y, where) => (Number.isInteger(y) && y !== 0 && y >= -4300 && y <= 200) || errors.push(`${where}: bad year ${y}`);
const refs = (rs, where) => rs?.forEach((r) => (books.has(r.b) && (!r.to || books.has(r.to))) || errors.push(`${where}: bad book in ${JSON.stringify(r)}`));
for (const e of src.events) year(e.y, e.en), refs(e.refs, e.en);
for (const e of src.world) year(e.y, e.en);
for (const p of src.people) {
  if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`);
  ids.add(p.id);
  if (!cats.has(p.cat)) errors.push(`${p.id}: unknown group ${p.cat}`);
  if (p.born != null) year(p.born, p.id), year(p.died, p.id);
  if (p.active) year(p.active.from, p.id), year(p.active.to, p.id);
  if (p.born == null && !p.active) errors.push(`${p.id}: needs born/died or active years`);
  p.events.forEach((e) => year(e.y, p.id));
  refs(p.refs, p.id);
  // Family: every relative needs a name and (if given) a real book; links must point at someone on the timeline.
  const f = p.family ?? {};
  for (const r of [f.father, f.mother, ...(f.spouses ?? []), ...(f.children ?? []), ...(f.siblings ?? [])].filter(Boolean)) {
    if (!r.en) errors.push(`${p.id}: family member without a name`);
    if (r.ref) refs([r.ref], `${p.id} family ${r.en}`);
  }
}
const allIds = new Set(src.people.map((p) => p.id));
for (const p of src.people) {
  const f = p.family ?? {};
  for (const r of [f.father, f.mother, ...(f.spouses ?? []), ...(f.children ?? []), ...(f.siblings ?? [])].filter(Boolean))
    if (r.id && !allIds.has(r.id)) errors.push(`${p.id}: family link to unknown ${r.id}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const { about, ...out } = src;
const json = JSON.stringify(out);
writeFileSync(new URL('public/packs/timeline.json', ROOT), json);
// A version tag for the address, so phones with an older saved copy fetch the new one.
const version = createHash('sha256').update(json).digest('hex').slice(0, 10);
writeFileSync(new URL('src/engine/timelineVersion.ts', ROOT), `// Written by scripts/build-timeline.mjs\nexport const TIMELINE_VERSION = '${version}';\n`);
const missing = [...src.people.flatMap((p) => [p.name, p.title]), ...src.events].filter((t) => !t.ta).length;
console.log(`timeline: ${src.people.length} people, ${src.events.length} events, ${src.world.length} world events${missing ? ` (${missing} without Tamil)` : ''}`);
