import { useState } from 'react';
import { Reorder, motion, useDragControls } from 'motion/react';
import { BookOpen, ChevronRight, GripVertical, House, RotateCcw } from 'lucide-react';
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

type Step = (typeof KIDS_STORIES)[number]['steps'][number];

/** One part of the story: its number once placed, a picture, and the words. */
function StepCard({ step, n, both, other }: { step: Step; n?: number; both: boolean; other: 'en' | 'ta' }) {
  const uiLang = useApp((s) => s.uiLang);
  return (
    <div className={`ko-step glass ${n ? 'is-placed' : ''}`}>
      <span className="ko-num" aria-hidden>
        {n ?? ''}
      </span>
      {step.art && (
        <span className="ko-art">
          <Illustration name={step.art} />
        </span>
      )}
      <span className="grow ko-text">
        <strong lang={uiLang}>{step[uiLang]}</strong>
        {both && <span className="km-sec" lang={other}>{step[other]}</span>}
      </span>
    </div>
  );
}

/** A step that can be tapped, or dragged by its handle (so the page still scrolls). */
function DragStep({ value, shake, onTap, onDrop, label, children }: { value: number; shake: boolean; onTap: () => void; onDrop: () => void; label: string; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="ko-item" whileDrag={{ scale: 1.03, zIndex: 5 }}>
      <motion.div className="ko-tap" role="button" tabIndex={0} onClick={onTap} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
        {children}
      </motion.div>
      <span className="ko-grip" onPointerDown={(e) => controls.start(e)} aria-label={label} title={label}>
        <GripVertical size={20} strokeWidth={2} />
      </span>
    </Reorder.Item>
  );
}

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
  // The steps put in order so far (numbered, locked) and the rest, which can be tapped or
  // dragged. Dragging the right step to the top of the rest locks it in, like a right tap.
  const [placed, setPlaced] = useState<number[]>([]);
  const [rest, setRest] = useState<number[]>(() => mixed(story.steps.length));
  const [shake, setShake] = useState<number | null>(null);
  const done = placed.length === story.steps.length;

  function place(step: number) {
    cue(placed.length + 1 === story.steps.length ? 'complete' : 'correct');
    setPlaced((p) => [...p, step]);
    setRest((r) => r.filter((x) => x !== step));
  }
  function tap(step: number) {
    if (done) return;
    if (step === placed.length) place(step);
    else {
      cue('wrong');
      setShake(step);
      setTimeout(() => setShake(null), 500);
    }
  }
  /** After a drag: lock in every step now at the top of the rest in the right order. */
  function dropped() {
    let n = placed.length;
    const lock: number[] = [];
    for (const step of rest) {
      if (step !== n) break;
      lock.push(step);
      n++;
    }
    if (!lock.length) return;
    cue(n === story.steps.length ? 'complete' : 'correct');
    setPlaced((p) => [...p, ...lock]);
    setRest((r) => r.filter((x) => !lock.includes(x)));
  }
  function start(at: number) {
    setPlaced([]);
    setRest(mixed(KIDS_STORIES[at].steps.length));
    setRound((r) => r + 1);
  }
  const next = () => {
    const at = (storyAt + 1) % KIDS_STORIES.length;
    setStoryAt(at);
    start(at);
  };
  const reset = () => start(storyAt);

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
        {placed.map((step, n) => (
          <StepCard key={`${story.id}-${round}-${step}`} step={story.steps[step]} n={n + 1} both={both} other={other} />
        ))}
        <Reorder.Group as="div" axis="y" values={rest} onReorder={setRest} className="ko-rest">
          {rest.map((step) => (
            <DragStep key={`${story.id}-${round}-${step}`} value={step} shake={shake === step} onTap={() => tap(step)} onDrop={dropped} label={t.koDrag}>
              <StepCard step={story.steps[step]} both={both} other={other} />
            </DragStep>
          ))}
        </Reorder.Group>
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
