import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Check, ChevronLeft, ChevronRight, House, ListChecks } from 'lucide-react';
import type { ReactElement } from 'react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { LangToggle } from '../components/LangToggle';
import { useBackStep } from '../hooks/useBackStep';
import { useKids } from '../online/kids';
import { PICTURE_STORIES, type PictureStory } from '../engine/kids';
import { formatRef } from '../i18n/books';
import { STORY_SCENES_A } from '../art/StoryScenesA';
import { STORY_SCENES_B } from '../art/StoryScenesB';

const SCENES: Record<string, () => ReactElement> = { ...STORY_SCENES_A, ...STORY_SCENES_B };
export const STORY_SCENE_IDS = Object.keys(SCENES);

function Scene({ id }: { id: string }) {
  const Art = SCENES[id];
  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%" role="presentation">
      {Art ? <Art /> : null}
    </svg>
  );
}

/**
 * Picture stories (kids): a Bible story in four pictures with a sentence or two each.
 * Swipe (or tap the arrows) through the pages; at the end, three questions on the story.
 */
export function KidsStories({ onExit, onQuiz }: { onExit: () => void; onQuiz: (story: string) => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const done = useKids((s) => s.stories);
  const [open, setOpen] = useState<PictureStory | null>(null);
  useBackStep(open !== null, () => setOpen(null));

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={open ? () => setOpen(null) : onExit} aria-label={open ? t.back : t.tabPlay} title={open ? t.back : t.tabPlay}>
          {open ? <ChevronLeft size={20} strokeWidth={STROKE} /> : <House size={19} strokeWidth={STROKE} />}
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupKids}</p>
          <h1 className="title">{open ? open[uiLang] : t.stTitle}</h1>
        </div>
        <LangToggle compact />
      </header>
      {open ? (
        <StoryPages
          key={open.id}
          story={open}
          onQuiz={() => {
            useKids.getState().storyDone(open.id);
            onQuiz(open.id);
          }}
        />
      ) : (
        <>
          <p className="caption kids-lead">{t.stLead}</p>
          <p className="caption kids-count">{t.stDone(done.length, PICTURE_STORIES.length)}</p>
          <div className="st-list">
            {PICTURE_STORIES.map((s) => (
              <button key={s.id} className={`st-card glass ${done.includes(s.id) ? 'is-done' : ''}`} onClick={() => setOpen(s)}>
                <span className="st-thumb">
                  <Scene id={s.pages[0].scene} />
                </span>
                <span className="st-name">
                  {done.includes(s.id) && <Check size={15} strokeWidth={3} />}
                  <strong lang={uiLang}>{s[uiLang]}</strong>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StoryPages({ story, onQuiz }: { story: PictureStory; onQuiz: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const qLang = useApp((s) => s.qLang);
  const other = uiLang === 'en' ? 'ta' : 'en';
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState(1);
  const page = story.pages[at];
  const last = at === story.pages.length - 1;
  const go = (n: number) => {
    if (n < 0 || n >= story.pages.length) return;
    setDir(n > at ? 1 : -1);
    setAt(n);
  };

  return (
    <div className="st-reader">
      <div className="st-frame glass">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={at}
            className="st-page"
            custom={dir}
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={spring.calm}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50) go(at + 1);
              else if (info.offset.x > 50) go(at - 1);
            }}
          >
            <div className="st-picture">
              <Scene id={page.scene} />
            </div>
            <p className="st-text" lang={uiLang}>
              {page[uiLang]}
            </p>
            {qLang === 'both' && (
              <p className="st-text tl-sec" lang={other}>
                {page[other]}
              </p>
            )}
            <span className="caption st-ref">
              <BookOpen size={13} strokeWidth={STROKE} /> {formatRef(uiLang, page.ref[0], page.ref[1], page.ref[2])}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="st-nav">
        <button className="icon-btn glass" onClick={() => go(at - 1)} disabled={at === 0} aria-label={t.back}>
          <ChevronLeft size={22} strokeWidth={STROKE} />
        </button>
        <div className="st-dots" aria-label={t.stPage(at + 1, story.pages.length)}>
          {story.pages.map((_, i) => (
            <button key={i} className={`st-dot ${i === at ? 'is-on' : ''}`} onClick={() => go(i)} aria-label={t.stPage(i + 1, story.pages.length)} />
          ))}
        </div>
        <button className="icon-btn glass" onClick={() => go(at + 1)} disabled={last} aria-label={t.kgNext}>
          <ChevronRight size={22} strokeWidth={STROKE} />
        </button>
      </div>
      {last && (
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.sheet}>
          <Pressable className="btn btn-primary st-quiz" onClick={onQuiz}>
            <ListChecks size={18} strokeWidth={STROKE} /> {t.stQuiz}
          </Pressable>
        </motion.div>
      )}
    </div>
  );
}
