import { Fragment, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ChevronDown, ChevronRight, Crown, History, House } from 'lucide-react';
import data from '../../content/genealogy/jesus.json';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { LangToggle } from '../components/LangToggle';
import { verseWords } from '../engine/bible';
import { refLabel, type Lang, type TRef } from '../engine/timeline';

/** One name in the family line. `alt` is the familiar Old Testament form (Phares = Perez). */
interface GNode {
  en: string;
  ta: string;
  alt?: string;
  ref: TRef;
  lk?: TRef;
  mother?: { en: string; ta: string };
  /** The same person on the Bible Timeline. */
  tl?: string | null;
}
type Line = 'before' | 'shared' | 'matthew' | 'luke' | 'end' | 'skipped';
const D = data as unknown as {
  promise: TRef[];
  before: GNode[];
  shared: GNode[];
  matthew: GNode[];
  luke: GNode[];
  mary: GNode;
  jesus: GNode;
  generations: TRef[];
  omitted: (GNode & { after: string })[];
};

type Cell = { n: GNode; skipped?: boolean } | null;
/**
 * The two lines after David, one row per generation (Luke's count). They line up where the
 * Bible lines them up: Solomon/Nathan (sons of David), Salathiel and Zorobabel (in both), and
 * Joseph beside Mary. Between those, Matthew's names (and the kings he skips, from
 * 1 Chronicles 3) are spread over the rows; an empty cell means his line runs on.
 */
function generationRows(): { left: Cell; right: GNode; gen: number }[] {
  const right = [...D.luke, D.mary];
  const left: Cell[] = right.map(() => null);
  const m = D.matthew;
  const at = (en: string) => m.findIndex((x) => x.en === en);
  const sal = right.findIndex((x) => x.en === 'Salathiel');
  // Solomon … Jechonias, with the skipped kings put back in their places.
  const first: Cell[] = [];
  for (const n of m.slice(0, at('Salathiel'))) {
    first.push({ n });
    for (const o of D.omitted.filter((x) => x.after === n.en)) first.push({ n: o, skipped: true });
  }
  // First and last of a stretch stay next to their neighbours (Jechonias begat Salathiel, Jacob
  // begat Joseph); the rows left over fall in between.
  const spread = (cells: Cell[], from: number, rows: number) =>
    cells.forEach((c, i) => (left[from + (cells.length > 1 ? Math.round((i * (rows - 1)) / (cells.length - 1)) : 0)] = c));
  spread(first, 0, sal);
  left[sal] = { n: m[at('Salathiel')] };
  left[sal + 1] = { n: m[at('Zorobabel')] };
  const rest = m.slice(at('Zorobabel') + 1, -1).map((n) => ({ n }));
  spread(rest, sal + 2, right.length - 1 - (sal + 2));
  left[right.length - 1] = { n: m[m.length - 1] }; // Joseph, beside Mary
  return right.map((r, i) => ({ left: left[i], right: r, gen: i + 1 }));
}
const ROWS = generationRows();
type View = 'both' | 'matthew' | 'luke';

/** Jesus' family line in Matthew 1 and Luke 3: two lines that meet at David. */
export function Genealogy({ onExit, onOpenTimeline }: { onExit: () => void; onOpenTimeline: (id: string) => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const lang: Lang = qLang === 'both' ? uiLang : qLang;
  const both = qLang === 'both';
  const [view, setView] = useState<View>('both');
  const [adam, setAdam] = useState(false);
  const [open, setOpen] = useState<{ n: GNode; line: Line; prev?: GNode; next?: GNode } | null>(null);

  const name = (n: GNode) => (lang === 'ta' ? n.ta : n.en);
  const show = (n: GNode, line: Line, list: GNode[], i: number) => setOpen({ n, line, prev: list[i - 1], next: list[i + 1] });

  const Node = ({ n, line, list, i, big }: { n: GNode; line: Line; list: GNode[]; i: number; big?: boolean }) => {
    const husband = line === 'matthew' && i === D.matthew.length - 1 && view === 'both';
    const inBoth = line !== 'shared' && line !== 'before' && (n.en === 'Zorobabel' || n.en === 'Salathiel');
    return (
      <button className={`gen-node is-${line} ${big ? 'is-big' : ''} ${n.en === 'David' ? 'is-david' : ''}`} onClick={() => show(n, line, list, i)}>
        {n.en === 'David' && <Crown size={15} strokeWidth={STROKE} className="gen-crown" />}
        <span className="gen-name">
          <strong lang={lang}>{husband ? t.genJosephHusband : name(n)}</strong>
          {lang === 'en' && n.alt && <span className="gen-alt">({n.alt})</span>}
          {both && <span className="gen-sec" lang={lang === 'en' ? 'ta' : 'en'}>{lang === 'en' ? n.ta : n.en}</span>}
        </span>
        {n.mother && <span className="gen-mother">{t.genMother(lang === 'ta' ? n.mother.ta : n.mother.en)}</span>}
        {inBoth && <span className="gen-both">{t.genInBoth}</span>}
      </button>
    );
  };

  const Column = ({ list, line, fourteen }: { list: GNode[]; line: Line; fourteen?: boolean }) => (
    <div className={`gen-col is-${line}`}>
      {list.map((n, i) => (
        <Fragment key={`${n.en}-${i}`}>
          <Node n={n} line={line} list={list} i={i} />
          {/* Matthew 1:17: fourteen generations, then fourteen, then fourteen */}
          {fourteen && line === 'matthew' && n.en === 'Jechonias' && <Divider text={t.genFourteen[1]} />}
        </Fragment>
      ))}
    </div>
  );

  const Divider = ({ text }: { text: string }) => (
    <button className="gen-divider" onClick={() => setOpen({ n: { en: text, ta: text, ref: D.generations[0] }, line: 'end' })}>
      <span>{text}</span>
    </button>
  );

  const jesus = (
    <div className="gen-jesus">
      <button className="gen-node is-big is-jesus" onClick={() => setOpen({ n: D.jesus, line: 'end' })}>
        <span className="gen-name">
          <strong lang={lang}>{name(D.jesus)}</strong>
          {both && <span className="gen-sec" lang={lang === 'en' ? 'ta' : 'en'}>{lang === 'en' ? D.jesus.ta : D.jesus.en}</span>}
        </span>
        <span className="gen-mother">{t.genSonOfDavid} · {refLabel(D.jesus.ref, lang)} · {refLabel(D.jesus.lk!, lang)}</span>
      </button>
    </div>
  );

  return (
    <div className="screen genealogy" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={onExit} aria-label={t.tabPlay} title={t.tabPlay}>
          <House size={19} strokeWidth={STROKE} />
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupLearn}</p>
          <h1 className="title">{t.genTitle}</h1>
        </div>
        <LangToggle compact />
      </header>

      <div className="gen-lead glass">
        <p>{t.genLead}</p>
        <h3 className="eyebrow">{t.genPromise}</h3>
        <div className="tl-refs">
          {D.promise.map((r, i) => (
            <button key={i} className="tl-ref glass" onClick={() => setOpen({ n: { en: refLabel(r, 'en'), ta: refLabel(r, 'ta'), ref: r }, line: 'end' })}>
              <BookOpen size={14} strokeWidth={STROKE} /> {refLabel(r, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="segmented small" role="tablist">
        {(
          [
            ['both', t.genBoth],
            ['matthew', t.genJoseph],
            ['luke', t.genMary],
          ] as const
        ).map(([v, label]) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''} onClick={() => setView(v)}>
            {view === v && <motion.span layoutId="seg-gen" className="segmented-thumb" transition={spring.calm} />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="gen-flow">
        {/* Luke goes on from Abraham to Adam (and God); folded away to start with. */}
        {view !== 'matthew' && (
          <>
            <button className="gen-fold glass" onClick={() => setAdam(!adam)} aria-expanded={adam}>
              <ChevronDown size={16} strokeWidth={STROKE} style={{ transform: adam ? 'rotate(180deg)' : undefined, transition: 'transform 0.25s' }} />
              {t.genFromAdam(D.before.length + 1)}
            </button>
            {adam && (
              <motion.div className="gen-col is-before" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={spring.calm}>
                <div className="gen-god">{t.genAdamOfGod}</div>
                {D.before.map((n, i) => (
                  <Node key={`${n.en}-${i}`} n={n} line="before" list={D.before} i={i} />
                ))}
              </motion.div>
            )}
          </>
        )}

        <p className="gen-label">{view === 'both' ? t.genShared : view === 'matthew' ? t.genSolomonLine : t.genNathanLine}</p>
        <div className="gen-col is-shared">
          {D.shared.map((n, i) => (
            <Node key={n.en} n={n} line="shared" list={D.shared} i={i} big={n.en === 'David'} />
          ))}
        </div>
        {view !== 'luke' && <Divider text={t.genFourteen[0]} />}

        {view === 'both' ? (
          <>
            <div className="gen-split" aria-hidden>
              <i />
            </div>
            <div className="gen-rows">
              <div className="gen-row gen-row-head">
                <span className="gen-num">{t.genGen}</span>
                <span className="gen-label">{t.genSolomonLine}</span>
                <span className="gen-label">{t.genNathanLine}</span>
              </div>
              {ROWS.map(({ left, right, gen }, i) => {
                const isLast = i === ROWS.length - 1;
                const li = left && !left.skipped ? D.matthew.indexOf(left.n) : -1;
                return (
                  <div key={gen} className={`gen-row ${isLast ? 'is-last' : ''} ${left && !left.skipped && left.n.en === right.en ? 'is-match' : ''}`}>
                    <span className="gen-num">{gen}</span>
                    {left ? (
                      left.skipped ? (
                        <button className="gen-node is-matthew is-skipped" onClick={() => setOpen({ n: left.n, line: 'skipped' })}>
                          <span className="gen-name">
                            <strong lang={lang}>{lang === 'ta' ? left.n.ta : left.n.en}</strong>
                          </span>
                          <span className="gen-mother">{t.genNotInMatthew}</span>
                        </button>
                      ) : (
                        <Node n={left.n} line="matthew" list={D.matthew} i={li} />
                      )
                    ) : (
                      <span className="gen-runs" aria-hidden />
                    )}
                    {isLast ? (
                      <button className="gen-node is-luke" onClick={() => setOpen({ n: D.mary, line: 'luke' })}>
                        <span className="gen-name">
                          <strong lang={lang}>{name(D.mary)}</strong>
                        </span>
                        <span className="gen-mother">{refLabel({ b: 'LUK', c: 3, v: 23 }, lang)}</span>
                      </button>
                    ) : (
                      <Node n={right} line="luke" list={D.luke} i={i} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="caption gen-note">{t.genRowsNote}</p>
            <div className="gen-merge" aria-hidden>
              <i />
            </div>
          </>
        ) : view === 'matthew' ? (
          <>
            <Column list={D.matthew} line="matthew" fourteen />
            <p className="caption gen-note">{t.genJesusBorn}</p>
            <Divider text={t.genFourteen[2]} />
          </>
        ) : (
          <>
            <Column list={D.luke} line="luke" />
            <p className="caption gen-note">{t.genMaryNote}</p>
          </>
        )}
        {jesus}
        {view === 'both' && <p className="caption gen-note">{t.genMaryNote}</p>}
      </div>

      <Sheet open={open !== null} onClose={() => setOpen(null)} label={t.genTitle}>
        {open && <NodeSheet key={open.n.en + open.line} open={open} lang={lang} onOpenTimeline={onOpenTimeline} />}
      </Sheet>
    </div>
  );
}

function NodeSheet({ open, lang, onOpenTimeline }: { open: { n: GNode; line: Line; prev?: GNode; next?: GNode }; lang: Lang; onOpenTimeline: (id: string) => void }) {
  const t = useT();
  const { n, line, prev, next } = open;
  const isVerseOnly = line === 'end' && n !== D.jesus;
  // In each list the older name comes first, so the previous one is the father.
  return (
    <div className="tl-panel gen-sheet">
      {!isVerseOnly && (
        <>
          <h2 className="title" lang={lang}>
            {lang === 'ta' ? n.ta : n.en}
            {lang === 'en' && n.alt ? ` (${n.alt})` : ''}
          </h2>
          <p className="tl-panel-title" lang={lang === 'en' ? 'ta' : 'en'}>
            {lang === 'en' ? n.ta : n.en}
          </p>
          {(prev || next) && (
            <dl className="tl-facts">
              {prev && (
                <>
                  <dt>{t.genFather}</dt>
                  <dd>{lang === 'ta' ? prev.ta : prev.en}</dd>
                </>
              )}
              {next && (
                <>
                  <dt>{t.genSon}</dt>
                  <dd>{lang === 'ta' ? next.ta : next.en}</dd>
                </>
              )}
            </dl>
          )}
          {n.mother && <p className="caption">{t.genMother(lang === 'ta' ? n.mother.ta : n.mother.en)}</p>}
          {line === 'skipped' && <p className="caption">{t.genSkipped}</p>}
        </>
      )}
      <VerseText r={n.ref} />
      {n.lk && <VerseText r={n.lk} />}
      {n.tl && (
        <button className="btn glass small gen-tl-link" onClick={() => onOpenTimeline(n.tl!)}>
          <History size={16} strokeWidth={STROKE} /> {t.genOnTimeline} <ChevronRight size={15} strokeWidth={STROKE} />
        </button>
      )}
    </div>
  );
}

/** A verse (or a few) in the chosen language(s). */
function VerseText({ r }: { r: TRef }) {
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const [w, setW] = useState<{ en: string; ta: string } | null>(null);
  useEffect(() => {
    void verseWords(r.b, r.c ?? 1, r.v ?? 1, r.v2).then(setW);
  }, [r.b, r.c, r.v, r.v2]);
  const langs: Lang[] = qLang === 'both' ? [uiLang, uiLang === 'en' ? 'ta' : 'en'] : [qLang];
  return (
    <figure className="gen-verse glass">
      <figcaption className="caption">
        <BookOpen size={14} strokeWidth={STROKE} /> {refLabel(r, uiLang)}
      </figcaption>
      {w &&
        langs.map((l, i) => (
          <p key={l} className={`verse ${i ? 'tl-sec' : ''}`} lang={l}>
            {w[l]}
          </p>
        ))}
    </figure>
  );
}
