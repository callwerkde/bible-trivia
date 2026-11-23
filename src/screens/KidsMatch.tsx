import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { House, RotateCcw } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { LangToggle } from '../components/LangToggle';
import { Illustration } from '../art/Illustrations';
import { KIDS_MATCH, type MatchPair } from '../engine/kids';
import { shuffle } from '../engine/picker';

type Card = { key: string; pair: MatchPair; side: 'person' | 'picture' };

/** A new board: 6 pairs, each a person card and a picture card, shuffled. */
function deal(): Card[] {
  const pairs = shuffle([...KIDS_MATCH]).slice(0, 6);
  return shuffle(pairs.flatMap((pair) => [
    { key: `${pair.id}-p`, pair, side: 'person' as const },
    { key: `${pair.id}-i`, pair, side: 'picture' as const },
  ]));
}

/**
 * Picture Match (kids): turn over two cards and match each Bible person with their
 * picture: Noah and the ark, Daniel and the lions, David and the sling…
 */
export function KidsMatch({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const both = qLang === 'both';
  const other = uiLang === 'en' ? 'ta' : 'en';
  const [cards, setCards] = useState<Card[]>(deal);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [tries, setTries] = useState(0);
  const done = found.size * 2 === cards.length;

  // Two cards open: a match stays face up; otherwise both turn back after a moment.
  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open.map((i) => cards[i]);
    if (a.pair.id === b.pair.id) {
      cue('correct');
      setFound((f) => new Set(f).add(a.pair.id));
      setOpen([]);
      return;
    }
    const id = setTimeout(() => setOpen([]), 1100);
    return () => clearTimeout(id);
  }, [open, cards]);
  useEffect(() => {
    if (done) cue('complete');
  }, [done]);

  function flip(i: number) {
    if (open.length >= 2 || open.includes(i) || found.has(cards[i].pair.id)) return;
    cue('tap');
    if (open.length === 1) setTries((n) => n + 1);
    setOpen([...open, i]);
  }
  function again() {
    setCards(deal());
    setOpen([]);
    setFound(new Set());
    setTries(0);
  }

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={onExit} aria-label={t.tabPlay} title={t.tabPlay}>
          <House size={19} strokeWidth={STROKE} />
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupKids}</p>
          <h1 className="title">{t.kmTitle}</h1>
        </div>
        <LangToggle compact />
      </header>
      <p className="caption kids-lead">{t.kmLead}</p>
      <p className="caption kids-count">{t.kmMoves(tries)}</p>

      <div className="km-grid">
        {cards.map((c, i) => {
          const up = open.includes(i) || found.has(c.pair.id);
          const matched = found.has(c.pair.id);
          const label = c.side === 'person' ? c.pair : c.pair.thing;
          return (
            <button key={c.key} className={`km-card ${up ? 'is-up' : ''} ${matched ? 'is-matched' : ''}`} onClick={() => flip(i)} aria-label={up ? label[uiLang] : '?'}>
              <motion.span className="km-inner" animate={{ rotateY: up ? 180 : 0 }} transition={spring.calm}>
                <span className="km-face km-back" aria-hidden>
                  ?
                </span>
                <span className={`km-face km-front is-${c.side}`}>
                  {c.side === 'picture' && (
                    <span className="km-art">
                      <Illustration name={c.pair.art} />
                    </span>
                  )}
                  <strong lang={uiLang}>{label[uiLang]}</strong>
                  {both && <span className="km-sec" lang={other}>{label[other]}</span>}
                </span>
              </motion.span>
            </button>
          );
        })}
      </div>

      {done && (
        <motion.div className="kids-done glass" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
          <strong>{t.kmDone}</strong>
          <span className="caption">{t.kmMoves(tries)}</span>
          <Pressable className="btn btn-primary" onClick={again}>
            <RotateCcw size={17} strokeWidth={STROKE} /> {t.kmAgain}
          </Pressable>
        </motion.div>
      )}
    </div>
  );
}
