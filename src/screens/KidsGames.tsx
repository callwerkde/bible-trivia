import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ChevronRight, House, RotateCcw } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { LangToggle } from '../components/LangToggle';
import { Illustration } from '../art/Illustrations';
import { KidsPortrait } from '../art/KidsPeople';
import { CountPicture, type CountKind } from '../art/CountIcons';
import { formatRef } from '../i18n/books';
import { shuffle } from '../engine/picker';
import type { ArtKey } from '../engine/types';
import oddData from '../../content/kids/odd.json';
import countData from '../../content/kids/count.json';

/*
 * Two small kids' games:
 *   Odd one out — four pictures, three from one Bible story; tap the one that doesn't belong.
 *   Count it    — count the things in the picture (loaves, fish, stones…) and tap the number.
 * Rounds of 8, no timer; a wrong tap wiggles and lets them try again.
 */

type Text = { en: string; ta: string };
type Thing = Text & { art: string; story: string };
type OddSet = { id: string; story: string; keep: string[]; odd: string };
const ODD = oddData as unknown as { items: Record<string, Thing>; stories: Record<string, Text>; sets: OddSet[] };
type CountItem = Text & { id: string; kind: CountKind; n: number; ref: [string, number, number] };
export const COUNT_ITEMS = countData as unknown as CountItem[];
export const ODD_SETS = ODD.sets;
export const ODD_ITEMS = ODD.items;

const ROUND = 8;

function Header({ title, onExit }: { title: string; onExit: () => void }) {
  const t = useT();
  return (
    <header className="recall-head">
      <Pressable className="chip glass" onClick={onExit} aria-label={t.tabPlay} title={t.tabPlay}>
        <House size={19} strokeWidth={STROKE} />
      </Pressable>
      <div className="grow">
        <p className="eyebrow">{t.groupKids}</p>
        <h1 className="title">{title}</h1>
      </div>
      <LangToggle compact />
    </header>
  );
}

function Finished({ right, total, onAgain }: { right: number; total: number; onAgain: () => void }) {
  const t = useT();
  return (
    <motion.div className="kids-done glass" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
      <strong>{t.kgDone}</strong>
      <span className="caption">{t.kgFirstTry(right, total)}</span>
      <Pressable className="btn btn-primary" onClick={onAgain}>
        <RotateCcw size={17} strokeWidth={STROKE} /> {t.kmAgain}
      </Pressable>
    </motion.div>
  );
}

/** A thing's picture: a Bible person's portrait or one of the app's pictures. */
function ThingArt({ art }: { art: string }) {
  return art.startsWith('p:') ? <KidsPortrait id={art.slice(2)} /> : <Illustration name={art as ArtKey} />;
}

export function KidsOdd({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const [game, setGame] = useState(0);
  const round = useMemo(() => shuffle([...ODD.sets]).slice(0, ROUND).map((s) => ({ ...s, cards: shuffle([...s.keep, s.odd]) })), [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(0);
  const [found, setFound] = useState(false);
  const [missed, setMissed] = useState(false);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const set = round[at];
  const done = at >= round.length;

  function tap(key: string) {
    if (found) return;
    if (key === set.odd) {
      cue('correct');
      setFound(true);
      if (!missed) setRight((r) => r + 1);
    } else {
      cue('wrong');
      setMissed(true);
      setWrong(key);
      setTimeout(() => setWrong(null), 450);
    }
  }
  const next = () => {
    setAt(at + 1);
    setFound(false);
    setMissed(false);
  };
  const again = () => {
    setGame((g) => g + 1);
    setAt(0);
    setRight(0);
    setFound(false);
    setMissed(false);
  };

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <Header title={t.ooTitle} onExit={onExit} />
      {done ? (
        <Finished right={right} total={round.length} onAgain={again} />
      ) : (
        <>
          <p className="caption kids-count">{t.kgOf(at + 1, round.length)}</p>
          <h2 className="ko-story">{t.ooAsk(ODD.stories[set.story][uiLang])}</h2>
          <div className="oo-grid">
            {set.cards.map((key) => {
              const thing = ODD.items[key];
              const isOdd = key === set.odd;
              return (
                <motion.button
                  key={`${set.id}-${key}`}
                  className={`oo-card glass ${found && isOdd ? 'is-odd' : ''} ${found && !isOdd ? 'is-fit' : ''}`}
                  onClick={() => tap(key)}
                  animate={wrong === key ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <span className="oo-art">
                    <ThingArt art={thing.art} />
                  </span>
                  <strong lang={uiLang}>{thing[uiLang]}</strong>
                </motion.button>
              );
            })}
          </div>
          {found && (
            <motion.div className="kids-done glass" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
              <strong>{t.ooRight}</strong>
              <span className="caption">{t.ooWhy(ODD.items[set.odd][uiLang], ODD.stories[ODD.items[set.odd].story][uiLang])}</span>
              <Pressable className="btn btn-primary" onClick={next}>
                {t.kgNext} <ChevronRight size={17} strokeWidth={STROKE} />
              </Pressable>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

export function KidsCount({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const [game, setGame] = useState(0);
  const round = useMemo(() => shuffle([...COUNT_ITEMS]).slice(0, ROUND), [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(0);
  const [found, setFound] = useState(false);
  const [missed, setMissed] = useState(false);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const item = round[at];
  const done = at >= round.length;

  function tap(n: number) {
    if (found) return;
    if (n === item.n) {
      cue('correct');
      setFound(true);
      if (!missed) setRight((r) => r + 1);
    } else {
      cue('wrong');
      setMissed(true);
      setWrong(n);
      setTimeout(() => setWrong(null), 450);
    }
  }
  const next = () => {
    setAt(at + 1);
    setFound(false);
    setMissed(false);
  };
  const again = () => {
    setGame((g) => g + 1);
    setAt(0);
    setRight(0);
    setFound(false);
    setMissed(false);
  };

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <Header title={t.ciTitle} onExit={onExit} />
      {done ? (
        <Finished right={right} total={round.length} onAgain={again} />
      ) : (
        <>
          <p className="caption kids-count">{t.kgOf(at + 1, round.length)}</p>
          <h2 className="ko-story">{item[uiLang]}</h2>
          <div className="ci-picture glass">
            <CountPicture kind={item.kind} n={item.n} />
          </div>
          <p className="caption">{t.ciCount}</p>
          <div className="ci-numbers">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <motion.button
                key={n}
                className={`ci-num ${found && n === item.n ? 'is-right' : ''}`}
                onClick={() => tap(n)}
                animate={wrong === n ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
              >
                {n}
              </motion.button>
            ))}
          </div>
          {found && (
            <motion.div className="kids-done glass" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
              <strong>{t.ciRight(item.n)}</strong>
              <span className="caption">
                <BookOpen size={14} strokeWidth={STROKE} /> {t.koRead(formatRef(uiLang, item.ref[0], item.ref[1], item.ref[2]))}
              </span>
              <Pressable className="btn btn-primary" onClick={next}>
                {t.kgNext} <ChevronRight size={17} strokeWidth={STROKE} />
              </Pressable>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
