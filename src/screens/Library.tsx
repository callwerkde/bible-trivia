import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Church, ExternalLink, House, MessageSquare, PenLine, Play, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { LangToggle } from '../components/LangToggle';
import { useBackStep } from '../hooks/useBackStep';
import { chapterText } from '../engine/bible';
import { formatRef } from '../i18n/books';
import { doneIn, isVideo, loadTot, nextIn, openUrl, sectionItems, totIndex, ytThumb, totRefLabel, type TotCatalog, type TotItem, type TotPlace, type TotRef, type TotSection, type TotSeries } from '../engine/tot';
import { useTot } from '../online/tot';
import { useAccount } from '../online/account';
import { createTask, myCommunities, type Community } from '../online/community';

const SECTION_ICON: Record<TotSection['id'], LucideIcon> = {
  messages: MessageSquare,
  study: BookOpen,
  history: Church,
  pioneers: Users,
  articles: PenLine,
};

/**
 * The Tent of Testimony library (tot.org.in): Tamil messages, Bible studies, church
 * history, pioneers of faith and articles. Each item opens on tot.org.in or YouTube; here
 * you keep track of what you've finished, and group admins can send items as tasks.
 */
export function Library({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const [cat, setCat] = useState<TotCatalog | null>(null);
  const [failed, setFailed] = useState(false);
  const done = useTot((s) => s.done);
  const last = useTot((s) => s.last);
  const [sectionId, setSectionId] = useState<TotSection['id'] | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [open, setOpen] = useState<TotPlace | null>(null);

  useEffect(() => {
    void loadTot().then(setCat, () => setFailed(true));
    void useTot.getState().load();
  }, []);
  const index = useMemo(() => (cat ? totIndex(cat) : null), [cat]);
  const section = cat?.sections.find((s) => s.id === sectionId) ?? null;
  const series = section?.series.find((s) => s.id === seriesId) ?? (section?.series.length === 1 ? section.series[0] : null);
  const name = (x: { en: string; ta: string }) => (uiLang === 'en' ? x.en : x.ta);

  // The phone's Back goes up one level: series → section → library.
  const inSeries = Boolean(series && (section?.series.length ?? 0) > 1);
  useBackStep(Boolean(section), () => {
    setSectionId(null);
    setSeriesId(null);
  });
  useBackStep(inSeries && Boolean(seriesId), () => setSeriesId(null));
  const back = () => {
    if (seriesId && inSeries) setSeriesId(null);
    else if (section) {
      setSectionId(null);
      setSeriesId(null);
    } else onExit();
  };

  // Continue: the item you opened last if it isn't done, else the next one in its series.
  const lastPlace = last != null ? index?.get(last) : undefined;
  const cont = lastPlace ? (done.has(lastPlace.item.id) ? (() => { const n = nextIn(lastPlace.series, done); return n ? index!.get(n.id)! : null; })() : lastPlace) : null;
  const starter = !cont && cat ? index!.get(cat.sections.find((s) => s.id === 'study')?.series.find((x) => x.id === 'hebrews')?.items[0]?.id ?? cat.sections[0].series[0].items[0].id) ?? null : null;
  const feature = cont ?? starter;

  const openItem = (p: TotPlace) => {
    setOpen(p);
    useTot.getState().setLast(p.item.id);
  };

  return (
    <div className="screen library" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={section ? back : onExit} aria-label={section ? t.back : t.tabPlay} title={section ? t.back : t.tabPlay}>
          {section ? <ChevronLeft size={20} strokeWidth={STROKE} /> : <House size={19} strokeWidth={STROKE} />}
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{inSeries ? name(section!) : section ? t.totTitle : t.groupLearn}</p>
          <h1 className="title">{inSeries ? name(series!) : section ? name(section) : t.totTitle}</h1>
        </div>
        <LangToggle compact />
      </header>

      {uiLang === 'en' && <p className="lib-tamil-only glass">{t.totTamilOnly}</p>}
      {failed && !cat && <p className="caption note">{t.totOffline}</p>}

      {cat && !section && (
        <motion.div key="home" className="lib-home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.calm}>
          <p className="caption lib-lead">
            {t.totLead}{' '}
            <a className="lib-src" href={cat.source} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} strokeWidth={STROKE} /> tot.org.in
            </a>
          </p>
          {feature && (
            <button className="lib-card glass lib-continue" onClick={() => openItem(feature)}>
              <span className="eyebrow">{cont ? t.totContinue : t.totStart}</span>
              <span className="lib-continue-row">
                <Thumb item={feature.item} />
                <span className="grow">
                  <span className="caption">
                    {name(feature.section)}
                    {feature.section.series.length > 1 && ` · ${name(feature.series)}`}
                  </span>
                  <strong lang="ta">{label(feature.item)}</strong>
                  <span className="caption">{t.totDoneOf(doneIn(feature.series.items, done), feature.series.items.length)}</span>
                </span>
              </span>
              <Bar value={doneIn(feature.series.items, done) / feature.series.items.length} />
            </button>
          )}
          <div className="lib-grid">
            {cat.sections.map((s) => {
              const items = sectionItems(s);
              const Icon = SECTION_ICON[s.id] ?? BookOpen;
              const n = doneIn(items, done);
              return (
                <button key={s.id} className="lib-tile glass" onClick={() => setSectionId(s.id)}>
                  <span className="lib-icon">
                    <Icon size={20} strokeWidth={STROKE} />
                  </span>
                  <strong>{name(s)}</strong>
                  <span className="caption">{t.totCount[s.id](items.length)}</span>
                  <Bar value={n / items.length} />
                </button>
              );
            })}
            <div className="lib-tile glass is-you">
              <span className="lib-icon">
                <Check size={20} strokeWidth={STROKE} />
              </span>
              <strong>{t.totYou}</strong>
              <span className="caption">{t.totDoneTotal(done.size)}</span>
            </div>
          </div>
        </motion.div>
      )}

      {cat && section && !series && (
        <motion.div key={`s-${section.id}`} className="lib-list" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring.calm}>
          {section.by && <p className="caption lib-lead" lang="ta">{section.by}</p>}
          {section.series.map((x) => {
            const n = doneIn(x.items, done);
            const next = nextIn(x, done);
            return (
              <button key={x.id} className="lib-card glass lib-series" onClick={() => setSeriesId(x.id)}>
                <span className="grow">
                  <strong>{name(x)}</strong>
                  <span className="caption">{n === x.items.length ? t.totAllDone : t.totDoneOf(n, x.items.length)}</span>
                  {next && n > 0 && (
                    <span className="caption lib-next" lang="ta">
                      {t.totContinue}: {label(next)}
                    </span>
                  )}
                  <Bar value={n / x.items.length} />
                </span>
                <ChevronRight size={18} strokeWidth={STROKE} className="menu-chevron" />
              </button>
            );
          })}
        </motion.div>
      )}

      {cat && section && series && (
        <motion.div key={`x-${series.id}`} className="lib-list" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring.calm}>
          <p className="caption lib-count">{t.totDoneOf(doneIn(series.items, done), series.items.length)}</p>
          <Bar value={doneIn(series.items, done) / series.items.length} />
          <SeriesList series={series} section={section} done={done} onOpen={openItem} />
        </motion.div>
      )}

      <Sheet open={open !== null} onClose={() => setOpen(null)} label={open?.item.ta ?? ''}>
        {open && <ItemSheet place={open} done={done.has(open.item.id)} />}
      </Sheet>
    </div>
  );
}

/** "13 - கிறிஸ்துவின் …" when the item has a number. */
const label = (i: TotItem) => (i.n != null ? `${String(i.n).padStart(2, '0')} - ${i.ta}` : i.ta);

function Bar({ value }: { value: number }) {
  return (
    <span className="lib-bar" aria-hidden>
      <motion.i initial={false} animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} transition={spring.calm} />
    </span>
  );
}

function Thumb({ item, big }: { item: TotItem; big?: boolean }) {
  if (!item.yt) {
    return (
      <span className={`lib-thumb is-text ${big ? 'is-big' : ''}`} aria-hidden>
        <BookOpen size={big ? 30 : 20} strokeWidth={STROKE} />
      </span>
    );
  }
  return (
    <span className={`lib-thumb ${big ? 'is-big' : ''}`} style={{ backgroundImage: `url(${ytThumb(item.yt)})` }} aria-hidden>
      <i>
        <Play size={big ? 22 : 13} strokeWidth={STROKE} />
      </i>
    </span>
  );
}

const refText = (r: TotRef, lang: 'en' | 'ta' = 'ta') => totRefLabel(r, lang, formatRef);

function SeriesList({ series, section, done, onOpen }: { series: TotSeries; section: TotSection; done: Set<number>; onOpen: (p: TotPlace) => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  return (
    <div className="lib-items glass is-solid">
      {series.items.map((i, k) => {
        const on = done.has(i.id);
        return (
          <div key={i.id} className={`lib-item ${on ? 'is-done' : ''}`}>
            <button className="lib-item-main" onClick={() => onOpen({ item: i, series, section })}>
              <span className="lib-num">{i.n ?? k + 1}</span>
              <span className="grow">
                <span className="lib-item-title" lang="ta">
                  {i.ta}
                </span>
                <span className="caption lib-item-meta">
                  {isVideo(i) ? <Play size={11} strokeWidth={STROKE} /> : <BookOpen size={11} strokeWidth={STROKE} />} {isVideo(i) ? t.totVideo : t.totText}
                  {i.ref && <span lang={uiLang}> · {refText(i.ref, uiLang)}</span>}
                </span>
              </span>
            </button>
            <button
              className={`cm-check lib-check ${on ? 'is-on' : ''}`}
              aria-pressed={on}
              aria-label={on ? t.totIsDone : t.totMarkDone}
              onClick={() => {
                if (!on) cue('correct');
                void useTot.getState().setDone(i.id, !on);
              }}
            >
              {on && <Check size={15} strokeWidth={2.8} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ItemSheet({ place, done }: { place: TotPlace; done: boolean }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const { item, series, section } = place;
  const name = (x: { en: string; ta: string }) => (uiLang === 'en' ? x.en : x.ta);
  // The verses named in the title, in Tamil (and English too in Both).
  const [verses, setVerses] = useState<{ ta: string[]; en: string[] } | null>(null);
  const [showVerses, setShowVerses] = useState(false);
  useEffect(() => {
    if (!showVerses || !item.ref || verses) return;
    const r = item.ref;
    void chapterText(r.b, r.c).then((ch) => {
      if (!ch) return;
      const a = (r.v ?? 1) - 1;
      // Across chapters: this chapter from the first verse to its end.
      const b = r.c2 ? ch.ta.length : (r.v2 ?? (r.v ? r.v : ch.ta.length));
      setVerses({ ta: ch.ta.slice(a, b), en: ch.en.slice(a, b) });
    });
  }, [showVerses, item.ref, verses]);

  // Admins can send this item to one of their groups as a task.
  const signedIn = useAccount((s) => Boolean(s.session));
  const [groups, setGroups] = useState<Community[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    if (signedIn) void myCommunities().then((g) => setGroups((g ?? []).filter((x) => x.role === 'owner' || x.role === 'admin')));
  }, [signedIn]);

  return (
    <div className="tl-panel lib-sheet">
      <span className="caption">
        {name(section)}
        {section.series.length > 1 && ` · ${name(series)}`}
        {item.n != null && ` · ${item.n}`}
      </span>
      <h2 className="title" lang="ta">
        {item.ta}
      </h2>
      <div className="lib-chips">
        <span>
          {isVideo(item) ? <Play size={12} strokeWidth={STROKE} /> : <BookOpen size={12} strokeWidth={STROKE} />} {isVideo(item) ? t.totVideo : t.totText}
        </span>
        {item.ref && (
          <span lang={uiLang}>
            <BookOpen size={12} strokeWidth={STROKE} /> {refText(item.ref, uiLang)}
          </span>
        )}
      </div>
      {item.yt && (
        <a href={openUrl(item)} target="_blank" rel="noopener noreferrer" className="lib-video">
          <Thumb item={item} big />
        </a>
      )}
      <a className="btn btn-primary" href={openUrl(item)} target="_blank" rel="noopener noreferrer">
        {item.yt ? <Play size={17} strokeWidth={STROKE} /> : <ExternalLink size={17} strokeWidth={STROKE} />} {item.yt ? t.totWatch : t.totOpenRead}
      </a>
      {item.yt && (
        <a className="link lib-notes" href={item.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} strokeWidth={STROKE} /> {t.totPage}
        </a>
      )}
      {item.ref && (
        <Pressable className="btn glass" onClick={() => setShowVerses(!showVerses)} aria-expanded={showVerses}>
          <BookOpen size={17} strokeWidth={STROKE} /> {t.totReadVerses(refText(item.ref, uiLang))}
        </Pressable>
      )}
      {showVerses && verses && (
        <div className="lib-verses glass">
          {verses.ta.map((v, k) => (
            <p key={k} className="verse" lang="ta">
              <sup>{(item.ref!.v ?? 1) + k}</sup> {v}
              {(qLang === 'both' || uiLang === 'en') && verses.en[k] && (
                <span className="tl-sec" lang="en">
                  {' '}
                  {verses.en[k]}
                </span>
              )}
            </p>
          ))}
        </div>
      )}
      <Pressable
        className={`btn ${done ? 'glass lib-done' : 'lib-mark'}`}
        onClick={() => {
          if (!done) cue('correct');
          void useTot.getState().setDone(item.id, !done);
        }}
      >
        <Check size={17} strokeWidth={STROKE} /> {done ? t.totIsDone : t.totMarkDone}
      </Pressable>
      {groups && groups.length > 0 && !picking && !sent && (
        <Pressable className="btn glass" onClick={() => (groups.length === 1 ? void send(groups[0]) : setPicking(true))}>
          <Send size={17} strokeWidth={STROKE} /> {t.totSendGroup}
        </Pressable>
      )}
      {picking && (
        <div className="lib-pick">
          <span className="caption">{t.totPickGroup}</span>
          {groups!.map((g) => (
            <button key={g.id} className="cm-set-row" onClick={() => void send(g)}>
              <Users size={18} strokeWidth={STROKE} />
              <span className="grow">{g.name}</span>
              <ChevronRight size={16} strokeWidth={STROKE} />
            </button>
          ))}
        </div>
      )}
      {sent && <p className="caption form-msg is-ok">{sent}</p>}
    </div>
  );

  async function send(g: Community) {
    setPicking(false);
    try {
      await createTask(g.id, {
        title: item.ta.slice(0, 120),
        note: '',
        ref: item.ref ? { b: item.ref.b, c: item.ref.c, ...(item.ref.v ? { v: item.ref.v } : {}), ...(item.ref.v2 && !item.ref.c2 ? { v2: item.ref.v2 } : {}) } : null,
        kind: item.yt ? 'watch' : 'read',
        link: openUrl(item),
        parts: [],
        due_on: null,
        tot_items: [item.id],
      });
      cue('complete');
      setSent(t.totSentTo(g.name));
    } catch {
      setSent(t.cmFailed);
    }
  }
}
