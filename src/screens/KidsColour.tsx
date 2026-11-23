import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Eraser, House, RotateCcw, Share2, Undo2 } from 'lucide-react';
import { useApp, useT } from '../store';
import { spring } from '../motion/springs';
import { cue } from '../feedback';
import { Pressable } from '../components/Pressable';
import { STROKE } from '../components/icons';
import { LangToggle } from '../components/LangToggle';
import { Illustration } from '../art/Illustrations';
import { KidsPortrait } from '../art/KidsPeople';
import { INK } from '../art/kit';
import { useBackStep } from '../hooks/useBackStep';
import { useKids } from '../online/kids';
import type { ArtKey } from '../engine/types';

/*
 * Colouring pages (kids): the app's own pictures, shown white with their outlines. Pick a
 * crayon and tap a part to fill it. Kept on the phone (see online/kids.ts); Share makes a
 * picture with "Coloured by <name>" for WhatsApp and the like.
 */

type Page = { id: string; art: string; en: string; ta: string };
export const COLOUR_PAGES: Page[] = [
  { id: 'ark', art: 'ark', en: "Noah's ark", ta: 'நோவாவின் பேழை' },
  { id: 'p-noah', art: 'p:noah', en: 'Noah', ta: 'நோவா' },
  { id: 'lion', art: 'lion', en: 'The lion', ta: 'சிங்கம்' },
  { id: 'p-daniel', art: 'p:daniel', en: 'Daniel', ta: 'தானியேல்' },
  { id: 'fish', art: 'fish', en: 'The big fish', ta: 'பெரிய மீன்' },
  { id: 'p-jonah', art: 'p:jonah', en: 'Jonah', ta: 'யோனா' },
  { id: 'p-david', art: 'p:david', en: 'David the shepherd', ta: 'மேய்ப்பனாகிய தாவீது' },
  { id: 'sheep', art: 'sheep', en: 'The sheep', ta: 'ஆடு' },
  { id: 'harp', art: 'harp', en: "David's harp", ta: 'தாவீதின் சுரமண்டலம்' },
  { id: 'p-moses', art: 'p:moses', en: 'Moses', ta: 'மோசே' },
  { id: 'bush', art: 'bush', en: 'The burning bush', ta: 'எரியும் முட்செடி' },
  { id: 'p-joseph', art: 'p:joseph', en: 'Joseph', ta: 'யோசேப்பு' },
  { id: 'coat', art: 'coat', en: 'The coat of many colours', ta: 'பலவருணமான அங்கி' },
  { id: 'ladder', art: 'ladder', en: "Jacob's ladder", ta: 'யாக்கோபின் ஏணி' },
  { id: 'dove', art: 'dove', en: 'The dove', ta: 'புறா' },
  { id: 'star', art: 'star', en: 'The star', ta: 'நட்சத்திரம்' },
  { id: 'p-wisemen', art: 'p:wisemen', en: 'The wise men', ta: 'சாஸ்திரிகள்' },
  { id: 'camel', art: 'camel', en: 'The camel', ta: 'ஒட்டகம்' },
  { id: 'donkey', art: 'donkey', en: 'The donkey', ta: 'கழுதை' },
  { id: 'p-jesus', art: 'p:jesus', en: 'Jesus the Good Shepherd', ta: 'நல்ல மேய்ப்பராகிய இயேசு' },
  { id: 'loaves', art: 'loaves', en: 'Five loaves and two fish', ta: 'ஐந்து அப்பங்களும் இரண்டு மீன்களும்' },
  { id: 'boat', art: 'boat', en: 'The fishing boat', ta: 'மீன்பிடி படகு' },
  { id: 'p-peter', art: 'p:peter', en: 'Peter', ta: 'பேதுரு' },
  { id: 'tree', art: 'tree', en: "Zacchaeus' tree", ta: 'சகேயுவின் மரம்' },
  { id: 'crown', art: 'crown', en: 'The crown', ta: 'கிரீடம்' },
  { id: 'p-ruth', art: 'p:ruth', en: 'Ruth', ta: 'ரூத்' },
  { id: 'p-rebekah', art: 'p:rebekah', en: 'Rebekah', ta: 'ரெபெக்காள்' },
  { id: 'well', art: 'well', en: 'The well', ta: 'கிணறு' },
  { id: 'tent', art: 'tent', en: "Abraham's tent", ta: 'ஆபிரகாமின் கூடாரம்' },
  { id: 'raven', art: 'raven', en: 'The raven', ta: 'காகம்' },
];

const CRAYONS = ['#e5484d', '#f5a524', '#ffd54f', '#8fd694', '#3aa76d', '#7cc7f2', '#3b82f6', '#8b5cf6', '#f472b6', '#9c7656', '#e8b98f', '#9ca3af'];
const isInk = (f: string) => f.toLowerCase() === INK || f === 'none' || f.startsWith('url') || f === 'currentColor';

/**
 * The picture, drawn once and then coloured directly: every filled shape (not the ink
 * outlines and dots) becomes a white part with a number that a tap can fill.
 */
const ColourArt = memo(function ColourArt({ art, fills, onTap }: { art: string; fills: Record<string, string>; onTap?: (part: string, el: SVGElement) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    root.querySelectorAll<SVGElement>('svg *').forEach((el, i) => {
      if (Number(el.getAttribute('opacity') ?? 1) < 0.5) return;
      const f = el.getAttribute('fill');
      const st = el.getAttribute('stroke');
      if (f && !isInk(f)) {
        // A filled shape: white until coloured.
        el.dataset.part = String(i);
        el.setAttribute('fill', fills[String(i)] ?? '#ffffff');
      } else if (st && !isInk(st) && Number(el.getAttribute('stroke-width') ?? 0) >= 4) {
        // A thick coloured line (a rainbow band, a staff): pale until coloured.
        el.dataset.part = String(i);
        el.dataset.stroke = '1';
        el.setAttribute('stroke', fills[String(i)] ?? '#e3e7eb');
      }
    });
    // Colours come from the store after this: the picture itself never re-renders.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={box}
      className="cl-art"
      onClick={(e) => {
        const el = (e.target as Element).closest<SVGElement>('[data-part]');
        if (el && onTap) onTap(el.dataset.part!, el);
      }}
    >
      {art.startsWith('p:') ? <KidsPortrait id={art.slice(2)} /> : <Illustration name={art as ArtKey} />}
    </div>
  );
});

export function KidsColour({ onExit }: { onExit: () => void }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const colouring = useKids((s) => s.colouring);
  const [open, setOpen] = useState<Page | null>(null);
  useBackStep(open !== null, () => setOpen(null));

  return (
    <div className="screen kids-screen" lang={uiLang}>
      <header className="recall-head">
        <Pressable className="chip glass" onClick={open ? () => setOpen(null) : onExit} aria-label={open ? t.back : t.tabPlay} title={open ? t.back : t.tabPlay}>
          {open ? <ChevronLeft size={20} strokeWidth={STROKE} /> : <House size={19} strokeWidth={STROKE} />}
        </Pressable>
        <div className="grow">
          <p className="eyebrow">{t.groupKids}</p>
          <h1 className="title">{open ? open[uiLang] : t.clTitle}</h1>
        </div>
        <LangToggle compact />
      </header>
      {open ? (
        <Colouring key={open.id} page={open} />
      ) : (
        <>
          <p className="caption kids-lead">{t.clLead}</p>
          <div className="cl-gallery">
            {COLOUR_PAGES.map((p) => (
              <button key={p.id} className="cl-thumb glass" onClick={() => setOpen(p)}>
                <ColourArt key={`${p.id}-${Object.keys(colouring[p.id] ?? {}).length}`} art={p.art} fills={colouring[p.id] ?? {}} />
                <span lang={uiLang}>{p[uiLang]}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Colouring({ page }: { page: Page }) {
  const t = useT();
  const uiLang = useApp((s) => s.uiLang);
  const name = useKids((s) => s.name);
  const [crayon, setCrayon] = useState<string>(CRAYONS[0]);
  const [history, setHistory] = useState<{ part: string; el: SVGElement; before: string }[]>([]);
  const [askName, setAskName] = useState(false);
  const [draft, setDraft] = useState(name);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => ({ ...(useKids.getState().colouring[page.id] ?? {}) }));

  const paint = (part: string, el: SVGElement) => {
    const attr = el.dataset.stroke ? 'stroke' : 'fill';
    const blank = el.dataset.stroke ? '#e3e7eb' : '#ffffff';
    const before = el.getAttribute(attr) ?? blank;
    const colour = crayon === '#ffffff' ? blank : crayon;
    if (before === colour) return;
    cue('tap');
    el.setAttribute(attr, colour);
    useKids.getState().setColour(page.id, part, crayon === '#ffffff' ? null : crayon);
    setHistory((h) => [...h.slice(-50), { part, el, before }]);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    last.el.setAttribute(last.el.dataset.stroke ? 'stroke' : 'fill', last.before);
    useKids.getState().setColour(page.id, last.part, last.before === '#ffffff' || last.before === '#e3e7eb' ? null : last.before);
    setHistory(history.slice(0, -1));
  };
  const clear = () => {
    if (!confirm(t.clClearConfirm)) return;
    useKids.getState().clearPage(page.id);
    setHistory([]);
    setRound((r) => r + 1);
  };

  async function share(who: string) {
    const svg = holder.current?.querySelector('svg');
    if (!svg) return;
    try {
      const blob = await pictureOf(svg, page[uiLang], who ? t.clBy(who) : '', t.appName);
      const file = new File([blob], `${page.id}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: page[uiLang], text: who ? t.clBy(who) : page[uiLang] });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${page.id}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        setMsg(t.clSaved);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(t.cmFailed);
    }
  }

  return (
    <motion.div className="cl-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.calm}>
      <div className="cl-canvas glass" ref={holder}>
        <ColourArt key={round} art={page.art} fills={round ? {} : initial} onTap={paint} />
      </div>
      <div className="cl-crayons" role="radiogroup" aria-label={t.clCrayons}>
        {CRAYONS.map((c) => (
          <button key={c} role="radio" aria-checked={crayon === c} className={`cl-crayon ${crayon === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => setCrayon(c)} aria-label={c} />
        ))}
        <button role="radio" aria-checked={crayon === '#ffffff'} className={`cl-crayon is-eraser ${crayon === '#ffffff' ? 'is-on' : ''}`} onClick={() => setCrayon('#ffffff')} aria-label={t.clEraser} title={t.clEraser}>
          <Eraser size={18} strokeWidth={STROKE} />
        </button>
      </div>
      <div className="cl-actions">
        <button className="btn glass small" onClick={undo} disabled={!history.length}>
          <Undo2 size={16} strokeWidth={STROKE} /> {t.clUndo}
        </button>
        <button className="btn glass small" onClick={clear}>
          <RotateCcw size={16} strokeWidth={STROKE} /> {t.koReset}
        </button>
        <Pressable className="btn btn-primary small" onClick={() => (name ? void share(name) : setAskName(true))}>
          <Share2 size={16} strokeWidth={STROKE} /> {t.clShare}
        </Pressable>
      </div>
      {askName && (
        <div className="cl-name glass">
          <label className="tl-formfield">
            <span className="caption">{t.clName}</span>
            <input className="field" maxLength={30} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.clNameHint} autoFocus />
          </label>
          <span className="caption">{t.clNameNote}</span>
          <Pressable
            className="btn btn-primary"
            onClick={() => {
              useKids.getState().setName(draft.trim());
              setAskName(false);
              void share(draft.trim());
            }}
          >
            <Share2 size={16} strokeWidth={STROKE} /> {t.clShare}
          </Pressable>
        </div>
      )}
      {name && !askName && (
        <button className="link kids-reset" onClick={() => setAskName(true)}>
          {t.clBy(name)} · {t.clChangeName}
        </button>
      )}
      {msg && <p className="caption form-msg is-ok">{msg}</p>}
    </motion.div>
  );
}

/** The coloured picture as a PNG, with its title and "Coloured by …" underneath. */
async function pictureOf(svg: SVGSVGElement, title: string, by: string, app: string): Promise<Blob> {
  const W = 1200;
  const H = 1080;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', '1200');
  clone.setAttribute('height', '900');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  await new Promise<void>((ok, fail) => {
    img.onload = () => ok();
    img.onerror = () => fail(new Error('image'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.drawImage(img, 0, 0, W, 900);
  g.fillStyle = '#e2f2f7';
  g.fillRect(0, 900, W, 180);
  g.fillStyle = '#11181c';
  g.textAlign = 'center';
  g.font = '700 46px "Noto Sans Tamil", Inter, system-ui, sans-serif';
  g.fillText(by || title, W / 2, 975);
  g.font = '500 30px "Noto Sans Tamil", Inter, system-ui, sans-serif';
  g.fillStyle = '#0e6a84';
  g.fillText(by ? `${title} · ${app}` : app, W / 2, 1035);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('png'))), 'image/png'));
}
