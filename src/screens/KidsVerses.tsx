import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Check, ChevronLeft, ChevronRight, House, RotateCcw } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { LangToggle } from '../components/LangToggle';
import { Illustration } from '../art/Illustrations';
import { useBackStep } from '../hooks/useBackStep';
import { useKids } from '../online/kids';
import { formatRef } from '../i18n/books';
import { shuffle } from '../engine/picker';
import data from '../../content/kids/verses.json';
import type { ArtKey } from '../engine/types';

export interface KidsVerse {
  id: string;
  ref: [string, number, number];
  en: string;
  ta: string;
  art?: ArtKey;
}
export const KIDS_VERSES = data as unknown as KidsVerse[];

/** The word blocks of a verse: one word each, or two words together for longer verses. */
export function blocksOf(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= 10) return words;
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 2) out.push(words.slice(i, i + 2).join(' '));
  return out;
}

/** Which blocks are missing in step 2: the 2–3 longest (never the first). */
function gapsOf(blocks: string[]): number[] {
  const n = blocks.length <= 3 ? 1 : blocks.length <= 6 ? 2 : 3;
  return blocks
    .map((b, i) => ({ i, len: b.replace(/[^\p{L}]/gu, '').length }))
    .filter((x) => x.i > 0 || blocks.length === 1)
    .sort((a, b) => b.len - a.len)
    .slice(0, n)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/**
 * Kids' memory verses: read the verse, fill in the missing words, then put all the word
 * blocks in order. A verse put together is marked learned.
 */
export function KidsVerses({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const learned = useKids((s) => s.verses);
  const [open, setOpen] = useState<number | null>(null);
  useBackStep(open !== null, () => setOpen(null));

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={open === null ? onExit : () => setOpen(null)} aria-label={open === null ? t.tabPlay : t.back} title={open === null ? t.tabPlay : t.back}>
          {open === null ? <House size={19} strokeWidth={STROKE} /> : <ChevronLeft size={20} strokeWidth={STROKE} />}
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupKids}</p>
          <h1 className="title">{t.kvTitle}</h1>
        </div>
        <LangToggle compact />
      </header>

      {open === null ? (
        <>
          <p className="caption kids-lead">{t.kvLead}</p>
          <p className="caption kids-count">{t.kvLearned(learned.length, KIDS_VERSES.length)}</p>
          <div className="kv-list">
            {KIDS_VERSES.map((v, i) => (
              <button key={v.id} className={`kv-card glass ${learned.includes(v.id) ? 'is-done' : ''}`} onClick={() => setOpen(i)}>
                <span className="kv-check">{learned.includes(v.id) ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                <span className="grow">
                  <strong lang={uiLang}>{v[uiLang]}</strong>
                  <span className="caption">{formatRef(uiLang, v.ref[0], v.ref[1], v.ref[2])}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <VersePlay key={open} verse={KIDS_VERSES[open]} onNext={() => setOpen(open + 1 < KIDS_VERSES.length ? open + 1 : null)} />
      )}
    </div>
  );
}

type Step = 'read' | 'gaps' | 'order' | 'done';

function VersePlay({ verse, onNext }: { verse: KidsVerse; onNext: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const other = uiLang === 'en' ? 'ta' : 'en';
  const ref = formatRef(uiLang, verse.ref[0], verse.ref[1], verse.ref[2]);
  const blocks = useMemo(() => blocksOf(verse[uiLang]), [verse, uiLang]);
  const gaps = useMemo(() => gapsOf(blocks), [blocks]);
  const [step, setStep] = useState<Step>('read');
  const [round, setRound] = useState(0);
  // Step 2: how many of the gaps are filled. Step 3: how many blocks are placed.
  const [filled, setFilled] = useState(0);
  const [used, setUsed] = useState<number[]>([]);
  const placed = used.length;
  const [wrong, setWrong] = useState<number | null>(null);
  const gapChoices = useMemo(() => shuffle(gaps.map((g) => ({ g, text: blocks[g] }))), [gaps, blocks, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderChoices = useMemo(() => shuffle(blocks.map((text, i) => ({ i, text }))), [blocks, round]); // eslint-disable-line react-hooks/exhaustive-deps

  const shake = (k: number) => {
    cue('wrong');
    setWrong(k);
    setTimeout(() => setWrong(null), 450);
  };
  function pickGap(g: number) {
    if (g === gaps[filled]) {
      cue('correct');
      if (filled + 1 === gaps.length) setTimeout(() => setStep('order'), 600);
      setFilled(filled + 1);
    } else shake(g);
  }
  function pickBlock(i: number) {
    // Blocks with the same words are interchangeable.
    if (blocks[i] === blocks[placed]) {
      if (placed + 1 === blocks.length) {
        cue('complete');
        useKids.getState().verseLearned(verse.id);
        setTimeout(() => setStep('done'), 400);
      } else cue('correct');
      setUsed([...used, i]);
    } else shake(i);
  }
  const usedOrder = new Set(used);

  return (
    <motion.div className="kv-play" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring.calm}>
      <div className="kv-steps" aria-hidden>
        {(['read', 'gaps', 'order'] as const).map((s, i) => (
          <span key={s} className={`kv-dot ${step === s ? 'is-on' : ''} ${(['read', 'gaps', 'order', 'done'] as Step[]).indexOf(step) > i ? 'is-done' : ''}`} />
        ))}
      </div>
      {verse.art && (
        <div className="kv-art">
          <Illustration name={verse.art} />
        </div>
      )}

      {step === 'read' && (
        <>
          <p className="caption">{t.kvRead}</p>
          <blockquote className="kv-verse glass">
            <p className="verse" lang={uiLang}>
              {verse[uiLang]}
            </p>
            {qLang === 'both' && (
              <p className="verse tl-sec" lang={other}>
                {verse[other]}
              </p>
            )}
            <cite className="caption">
              <BookOpen size={13} strokeWidth={STROKE} /> {ref}
            </cite>
          </blockquote>
          <Pressable className="btn btn-primary" onClick={() => setStep('gaps')}>
            {t.kvStart} <ChevronRight size={17} strokeWidth={STROKE} />
          </Pressable>
        </>
      )}

      {step === 'gaps' && (
        <>
          <p className="caption">{t.kvGaps}</p>
          <div className="kv-verse glass kv-built" lang={uiLang}>
            {blocks.map((b, i) => {
              const gi = gaps.indexOf(i);
              const show = gi === -1 || gi < filled;
              return (
                <span key={i} className={`kv-word ${gi === -1 ? '' : 'is-gap'} ${gi === filled ? 'is-next' : ''}`}>
                  {show ? b : ' '.repeat(Math.max(4, Math.min(10, b.length)))}
                </span>
              );
            })}
          </div>
          <div className="kv-blocks">
            {gapChoices.map(({ g, text }) =>
              gaps.indexOf(g) < filled ? null : (
                <motion.button key={g} className="kv-block" onClick={() => pickGap(g)} animate={wrong === g ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.4 }} lang={uiLang}>
                  {text}
                </motion.button>
              ),
            )}
          </div>
        </>
      )}

      {(step === 'order' || step === 'done') && (
        <>
          <p className="caption">{step === 'done' ? t.kvDone : t.kvOrder}</p>
          <div className="kv-verse glass kv-built" lang={uiLang}>
            {blocks.slice(0, placed).map((b, i) => (
              <motion.span key={i} className="kv-word is-placed" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.calm}>
                {b}
              </motion.span>
            ))}
            {step !== 'done' && <span className="kv-word is-next">{' '.repeat(6)}</span>}
          </div>
          {step === 'order' && (
            <div className="kv-blocks">
              {orderChoices.map(({ i, text }) =>
                usedOrder.has(i) ? null : (
                  <motion.button key={i} className="kv-block" onClick={() => pickBlock(i)} animate={wrong === i ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.4 }} lang={uiLang}>
                    {text}
                  </motion.button>
                ),
              )}
            </div>
          )}
          {step === 'done' && (
            <motion.div className="kids-done glass" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
              <strong>{t.kvWell}</strong>
              <span className="caption">
                <BookOpen size={14} strokeWidth={STROKE} /> {ref}
              </span>
              <Pressable className="btn btn-primary" onClick={onNext}>
                {t.kvNext} <ChevronRight size={17} strokeWidth={STROKE} />
              </Pressable>
              <button
                className="link kids-reset"
                onClick={() => {
                  setStep('read');
                  setFilled(0);
                  setUsed([]);
                  setRound((r) => r + 1);
                }}
              >
                <RotateCcw size={14} strokeWidth={STROKE} /> {t.koReset}
              </button>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
