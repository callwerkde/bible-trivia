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
import { KIDS_STORIES } from '../engine/kids';
import { shuffle } from '../engine/picker';
import { formatRef } from '../i18n/books';

/** The steps of a story in a mixed-up order (never already in the right order). */
function mixed(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let k = 0; k < 10; k++) {
    const s = shuffle([...order]);
    if (s.some((v, i) => v !== i)) return s;
  }
  return order.reverse();
}

/**
 * Story Order (kids): tap the parts of a Bible story in the order they happened.
 * A right tap puts the next number on it; a wrong tap gives a little shake.
 */
export function KidsOrder({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const both = qLang === 'both';
  const other = uiLang === 'en' ? 'ta' : 'en';
  const [storyAt, setStoryAt] = useState(() => Math.floor(Math.random() * KIDS_STORIES.length));
  const [round, setRound] = useState(0);
  const story = KIDS_STORIES[storyAt];
  const shown = useMemo(() => mixed(story.steps.length), [story, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const done = placed.length === story.steps.length;

  function tap(step: number) {
    if (placed.includes(step) || done) return;
    if (step === placed.length) {
      cue(placed.length + 1 === story.steps.length ? 'complete' : 'correct');
      setPlaced([...placed, step]);
    } else {
      cue('wrong');
      setShake(step);
      setTimeout(() => setShake(null), 500);
    }
  }
  const next = () => {
    setStoryAt((storyAt + 1) % KIDS_STORIES.length);
    setPlaced([]);
    setRound((r) => r + 1);
  };
  const reset = () => {
    setPlaced([]);
    setRound((r) => r + 1);
  };

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={onExit} aria-label={t.tabPlay} title={t.tabPlay}>
          <House size={19} strokeWidth={STROKE} />
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupKids}</p>
          <h1 className="title">{t.koTitle}</h1>
        </div>
        <LangToggle compact />
      </header>
      <p className="caption kids-lead">{t.koLead}</p>
      <h2 className="ko-story" lang={uiLang}>
        {story[uiLang]}
        {both && <span className="km-sec" lang={other}>{story[other]}</span>}
      </h2>

      <div className="ko-steps">
        {shown.map((step) => {
          const s = story.steps[step];
          const n = placed.indexOf(step);
          return (
            <motion.button
              key={`${story.id}-${round}-${step}`}
              className={`ko-step glass ${n >= 0 ? 'is-placed' : ''}`}
              onClick={() => tap(step)}
              animate={shake === step ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.4 }}
              layout
            >
              <span className="ko-num" aria-hidden>
                {n >= 0 ? n + 1 : ''}
              </span>
              {s.art && (
                <span className="ko-art">
                  <Illustration name={s.art} />
                </span>
              )}
              <span className="grow ko-text">
                <strong lang={uiLang}>{s[uiLang]}</strong>
                {both && <span className="km-sec" lang={other}>{s[other]}</span>}
              </span>
            </motion.button>
          );
        })}
      </div>

      {done ? (
        <motion.div className="kids-done glass" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
          <strong>{t.koRight}</strong>
          <span className="caption">
            <BookOpen size={14} strokeWidth={STROKE} /> {t.koRead(formatRef(uiLang, story.ref[0], story.ref[1], story.ref[2]))}
          </span>
          <Pressable className="btn btn-primary" onClick={next}>
            {t.koNext} <ChevronRight size={17} strokeWidth={STROKE} />
          </Pressable>
        </motion.div>
      ) : (
        placed.length > 0 && (
          <button className="link kids-reset" onClick={reset}>
            <RotateCcw size={14} strokeWidth={STROKE} /> {t.koReset}
          </button>
        )
      )}
    </div>
  );
}
