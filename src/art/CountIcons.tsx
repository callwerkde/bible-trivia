import type { ReactElement } from 'react';
import { C, Eye, Ground, INK, line } from './kit';
import { Animal, Bird, Camel, StarPt } from './sceneKit';

/*
 * Pictures for the counting game: N small things (1..12) to count.
 * Each CountIcon is drawn centred at (0,0), about 24-28 units across.
 * CountPicture lays n of them out in neat rows (no overlaps) in a 160 x 120 box.
 */

export type CountKind = 'loaf' | 'fish' | 'stone' | 'basket' | 'jar' | 'sheep' | 'star' | 'coin' | 'lamp' | 'dove' | 'tablet' | 'camel';

export const COUNT_KINDS: CountKind[] = ['loaf', 'fish', 'stone', 'basket', 'jar', 'sheep', 'star', 'coin', 'lamp', 'dove', 'tablet', 'camel'];

/** One small object drawn centred at (0,0), about 24 units wide (it will be placed and scaled by CountPicture). */
export function CountIcon({ kind }: { kind: CountKind }): ReactElement {
  switch (kind) {
    case 'loaf':
      return (
        <g>
          <path d="M-12 7 Q-13 -9 0 -9 Q13 -9 12 7 Z" fill={C.bread} {...line} />
          <path d="M-6 -2 L-2 -6 M2 -2 L6 -6" fill="none" {...line} strokeWidth={2} />
        </g>
      );
    case 'fish':
      return (
        <g>
          <path d="M8 0 L14 -6 V6 Z" fill={C.steel} {...line} strokeWidth={2.4} />
          <path d="M-3 -5 Q1 -11 5 -5 Z" fill={C.steel} {...line} strokeWidth={2.4} />
          <ellipse cx={-2} cy={0} rx={10} ry={6.5} fill={C.steel} {...line} />
          <Eye x={-6} y={-1.5} r={1.8} />
          <path d="M-11 2.5 q2 2 4 0" fill="none" {...line} strokeWidth={1.6} />
        </g>
      );
    case 'stone':
      return (
        <g>
          <path d="M-11 6 Q-14 -6 -4 -8 Q4 -11 9 -5 Q15 0 11 6 Q2 10 -11 6 Z" fill={C.steelSoft} {...line} />
          <Eye x={-4} y={-1} r={1.8} />
          <Eye x={4} y={-1} r={1.8} />
          <path d="M-2 3 q2 2 4 0" fill="none" {...line} strokeWidth={1.6} />
        </g>
      );
    case 'basket':
      return (
        <g>
          <path d="M-10 -10 Q0 -20 10 -10" fill="none" {...line} strokeWidth={2.6} />
          <path d="M-12 -5 H12 L9 9 Q0 12 -9 9 Z" fill={C.woodSoft} {...line} />
          <path d="M-10 0 H10 M-9 4.5 H9" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <rect x={-13} y={-8} width={26} height={4} rx={2} fill={C.wood} {...line} strokeWidth={2} />
        </g>
      );
    case 'jar':
      return (
        <g>
          <path d="M-7 -9 H7 Q13 -3 11 4 Q10 11 0 11 Q-10 11 -11 4 Q-13 -3 -7 -9 Z" fill={C.redSoft} {...line} />
          <path d="M-5 -9 V-13 H5 V-9" fill={C.redSoft} {...line} strokeWidth={2.4} />
          <rect x={-6.5} y={-15} width={13} height={3.5} rx={1.5} fill={C.red} {...line} strokeWidth={2.4} />
          <path d="M-12 0 Q0 4 12 0" fill="none" stroke={C.bread} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'sheep':
      return <Animal kind="sheep" x={-5.25} y={10.5} s={0.75} />;
    case 'star':
      return <StarPt x={0} y={0} r={13} fill={C.bread} />;
    case 'coin':
      return (
        <g>
          <circle cx={0} cy={0} r={11} fill={C.steelSoft} {...line} />
          <circle cx={0} cy={0} r={6.5} fill="none" stroke={C.steel} strokeWidth={1.8} />
          <path d="M-4 -4 Q-1 -7 3 -6" fill="none" stroke={C.white} strokeWidth={2} strokeLinecap="round" />
        </g>
      );
    case 'lamp':
      return (
        <g>
          <path d="M0 -17 Q-6 -10 -3.5 -5.5 Q0 -3.5 3.5 -5.5 Q6 -10 0 -17 Z" fill={C.bread} {...line} strokeWidth={2.4} />
          <path d="M-12 -2 H12 Q11 7 0 7 Q-11 7 -12 -2 Z" fill={C.redSoft} {...line} />
          <path d="M10 -1 L16 -4 L14 2 Z" fill={C.redSoft} {...line} strokeWidth={2.4} />
          <path d="M-5 7 V10 H5 V7" fill="none" {...line} strokeWidth={2} />
        </g>
      );
    case 'dove':
      return <Bird x={-0.9} y={4.7} s={0.72} />;
    case 'tablet':
      return (
        <g>
          <path d="M-10 12 V-5 Q-10 -13 0 -13 Q10 -13 10 -5 V12 Z" fill={C.bread} {...line} />
          <path d="M-5 -5 H5 M-5 0 H5 M-5 5 H5" fill="none" {...line} strokeWidth={1.8} />
        </g>
      );
    case 'camel':
      return <Camel x={-6.5} y={13.7} s={0.36} />;
  }
}

const WAVE = `M8 106 ${Array.from({ length: 12 }, () => 'q6 -4 12 0').join(' ')}`;

/** A whole picture: `n` objects of `kind`, spread out neatly in rows so they are easy to count (no overlaps), on a soft background (light sand ground line or water for fish). Must work for every n from 1 to 12. */
export function CountPicture({ kind, n }: { kind: CountKind; n: number }): ReactElement {
  const count = Math.max(1, Math.min(12, Math.round(n)));
  const rows = count <= 4 ? 1 : count <= 8 ? 2 : 3;
  const cols = Math.ceil(count / rows);
  const x0 = 8;
  const y0 = 6;
  const areaW = 144;
  const areaH = 96;
  const cellW = areaW / cols;
  const cellH = areaH / rows;
  const s = Math.min(2.8, (Math.min(cellW, cellH) * 0.8) / 26);
  const fish = kind === 'fish';
  const lastRowCount = count - (rows - 1) * cols;

  const items: ReactElement[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const inRow = r === rows - 1 ? lastRowCount : cols;
    const cx = x0 + cellW * (c + 0.5 + (cols - inRow) / 2);
    const cy = y0 + cellH * (r + 0.5);
    items.push(
      <g key={i} transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${s.toFixed(3)})`}>
        <CountIcon kind={kind} />
      </g>,
    );
  }

  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%">
      <rect x={4} y={4} width={152} height={112} rx={14} fill={fish ? C.water : C.sand} opacity={0.3} />
      {fish ? <path d={WAVE} fill="none" {...line} strokeWidth={2} /> : <Ground y={106} />}
      {items}
    </svg>
  );
}
