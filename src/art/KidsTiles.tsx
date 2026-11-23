/*
 * Cartoon pictures for the kids' game tiles (stories, verses, odd one out, counting, colours).
 * Same style as ModeArt.tsx: viewBox 0 0 160 120, chunky ink outline, flat fills, no gradients,
 * one big friendly object with a smiling face and a soft shadow.
 */

const INK = '#1d2430';
const C = {
  green: '#2a9fc0',
  red: '#e0493e',
  redSoft: '#f08a6e',
  blue: '#3a7bd5',
  yellow: '#ffc83d',
  steelSoft: '#b9cfe2',
  sand: '#f3dfb8',
  wood: '#9c7656',
  woodSoft: '#c49b78',
  flame: '#f5a524',
  flameSoft: '#ffd27a',
  white: '#ffffff',
  cheek: '#f08a6e',
};
const line = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Eye({ x, y, r = 3.6 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={INK} />
      <circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill={C.white} />
    </g>
  );
}

function Face({ x, y, gap = 16, smile = 7, eye = 3.6 }: { x: number; y: number; gap?: number; smile?: number; eye?: number }) {
  return (
    <g>
      <Eye x={x - gap / 2} y={y} r={eye} />
      <Eye x={x + gap / 2} y={y} r={eye} />
      <ellipse cx={x - gap / 2 - 5} cy={y + 6} rx={3.4} ry={2.2} fill={C.cheek} opacity={0.7} />
      <ellipse cx={x + gap / 2 + 5} cy={y + 6} rx={3.4} ry={2.2} fill={C.cheek} opacity={0.7} />
      <path d={`M${x - smile / 2} ${y + 5} q${smile / 2} ${smile * 0.6} ${smile} 0`} fill="none" {...line} strokeWidth={2.4} />
    </g>
  );
}

const Shadow = ({ cx = 80, cy = 108, rx = 46 }: { cx?: number; cy?: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={6} fill={INK} opacity={0.08} />
);

/** A five-point star centred on (cx, cy). */
const starPoints = (cx: number, cy: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');

/** A tiny ark: a hull with a cabin on top. */
const TinyArk = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x - 16} ${y} H${x + 16} L${x + 11} ${y + 8} H${x - 11} Z`} fill={C.wood} {...line} strokeWidth={2.2} />
    <rect x={x - 8} y={y - 14} width={16} height={14} fill={C.woodSoft} {...line} strokeWidth={2.2} />
    <rect x={x - 2} y={y - 8} width={4} height={6} fill={C.steelSoft} {...line} strokeWidth={1.6} />
  </g>
);

/* ---------- Stories: an open picture book ---------- */
const Stories = () => (
  <>
    <Shadow />
    <path d="M10 44 Q46 30 80 42 Q114 30 150 44 V102 Q114 92 80 106 Q46 92 10 102 Z" fill={C.red} {...line} />
    <path d="M80 42 Q46 34 16 46 V96 Q46 88 80 100 Z" fill={C.white} {...line} strokeWidth={2.4} />
    <path d="M80 42 Q114 34 144 46 V96 Q114 88 80 100 Z" fill={C.white} {...line} strokeWidth={2.4} />
    <TinyArk x={42} y={86} />
    <polygon points={starPoints(116, 72, 13, 5.5)} fill={C.flame} {...line} strokeWidth={2.2} />
    <circle cx={80} cy={24} r={13} fill={C.sand} {...line} />
    <Face x={80} y={24} gap={9} smile={7} eye={2.6} />
  </>
);

/* ---------- Verses: three word blocks like toy bricks ---------- */
const Verses = () => (
  <>
    <Shadow />
    <rect x={26} y={84} width={108} height={24} rx={5} fill={C.green} {...line} />
    <path d="M40 96 h10 M56 96 h14 M76 96 h8 M90 96 h12 M108 96 h12" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" />
    <rect x={36} y={58} width={88} height={24} rx={5} fill={C.flame} {...line} />
    <path d="M48 70 h8 M62 70 h14 M84 70 h10 M100 70 h12" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" />
    <rect x={46} y={32} width={68} height={24} rx={5} fill={C.red} {...line} />
    <Face x={80} y={43} gap={16} smile={8} eye={2.8} />
  </>
);

/* ---------- Odd one out: three matching round things and one star, with a question mark ---------- */
const Odd = () => (
  <>
    <Shadow />
    <circle cx={26} cy={66} r={14} fill={C.blue} {...line} />
    <circle cx={60} cy={66} r={14} fill={C.blue} {...line} />
    <circle cx={94} cy={66} r={14} fill={C.blue} {...line} />
    <polygon points={starPoints(128, 66, 16, 7)} fill={C.red} {...line} />
    <Face x={128} y={68} gap={8} smile={5} eye={2} />
    <circle cx={134} cy={24} r={14} fill={C.white} {...line} />
    <path d="M129 19 Q129 11 134 11 Q139 11 139 17 Q139 21 134 23 V28" fill="none" {...line} strokeWidth={3} />
    <circle cx={134} cy={34} r={2} fill={INK} />
  </>
);

/* ---------- Count: five round loaves numbered 1 to 5, smiling ---------- */
const Count = () => (
  <>
    <Shadow cy={84} rx={70} />
    {[20, 50, 80, 110, 140].map((x, i) => (
      <g key={x}>
        <text x={x} y={38} textAnchor="middle" fontSize={15} fontWeight={700} fontFamily="sans-serif" fill={INK}>
          {i + 1}
        </text>
        <path d={`M${x - 15} 78 Q${x - 15} 54 ${x} 54 Q${x + 15} 54 ${x + 15} 78 Z`} fill={C.flameSoft} {...line} />
        <path d={`M${x - 8} 62 Q${x} 58 ${x + 8} 62`} fill="none" stroke={C.woodSoft} strokeWidth={2.4} strokeLinecap="round" />
        <Face x={x} y={70} gap={8} smile={5} eye={2.2} />
      </g>
    ))}
  </>
);

/* ---------- Colours: three chunky crayons and a smiling paint splash ---------- */
const Crayon = ({ x, color }: { x: number; color: string }) => (
  <g>
    <rect x={x - 9} y={26} width={18} height={52} rx={3} fill={color} {...line} />
    <rect x={x - 9} y={40} width={18} height={8} fill={C.white} {...line} strokeWidth={2} />
    <path d={`M${x - 9} 78 L${x} 96 L${x + 9} 78 Z`} fill={C.sand} {...line} />
    <path d={`M${x - 3} 90 L${x} 96 L${x + 3} 90 Z`} fill={INK} />
  </g>
);
const Colours = () => (
  <>
    <Shadow />
    <Crayon x={30} color={C.red} />
    <Crayon x={58} color={C.blue} />
    <Crayon x={86} color={C.yellow} />
    <path d="M108 58 Q110 42 124 44 Q132 32 144 40 Q152 48 146 58 Q154 66 146 76 Q144 90 130 88 Q120 96 110 86 Q100 80 104 70 Q100 64 108 58 Z" fill={C.green} {...line} />
    <Face x={126} y={66} gap={12} smile={7} eye={2.8} />
    <circle cx={98} cy={92} r={3} fill={C.green} {...line} strokeWidth={1.8} />
  </>
);

export function KidsStoriesArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <Stories />
    </svg>
  );
}
export function KidsVersesArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <Verses />
    </svg>
  );
}
export function KidsOddArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <Odd />
    </svg>
  );
}
export function KidsCountArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <Count />
    </svg>
  );
}
export function KidsColourArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <Colours />
    </svg>
  );
}
