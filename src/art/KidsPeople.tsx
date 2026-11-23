import type { ReactElement } from 'react';
import { C, Ground, INK, Person as P, Waves, line } from './kit';
import { AltarSm, Animal, Bird, Coins, Hills, Night, Sheaf, StarPt, Stick, Throne, WellSm } from './sceneKit';

/*
 * Portraits for Picture Match (kids): each Bible person with the thing they are known by,
 * in the same cartoon style as the other pictures (viewBox 0 0 160 120).
 */

const GY = 108;

/** Stars scattered over a night sky. */
const Stars = ({ pts }: { pts: [number, number, number?][] }) => (
  <>
    {pts.map(([x, y, r], i) => (
      <StarPt key={i} x={x} y={y} r={r ?? 4} />
    ))}
  </>
);

/** A small fish, nose at (x, y). */
const Fish = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0 q12 -10 24 0 q-12 10 -24 0 Z M24 0 l8 -6 v12 Z" fill={C.steel} {...line} strokeWidth={2} />
    <circle cx={6} cy={-1.5} r={1.3} fill={INK} />
  </g>
);

/** Noah, his hand up for the dove with the olive leaf, a rainbow behind. */
const Noah = () => (
  <>
    {[
      [60, C.red],
      [53, C.bread],
      [46, C.pale],
      [39, C.steel],
    ].map(([r, c]) => (
      <path key={c as string} d={`M${80 - (r as number)} 100 A${r} ${r} 0 0 1 ${80 + (r as number)} 100`} fill="none" stroke={c as string} strokeWidth={6} />
    ))}
    <Ground y={GY} />
    <P x={74} y={GY} s={1.2} beard="white" robe={C.pale} hands={[[-12, -18], [18, -58]]}>
      <Bird x={26} y={-66} s={0.5} leaf />
    </P>
  </>
);

/** Jonah in the sea, surprised, a fish's tail beside him. */
const Jonah = () => (
  <>
    <P x={72} y={112} s={1.15} beard="dark" robe={C.steel} mood="wow" pose="raise" />
    <path d="M118 92 q8 -20 22 -24 q-6 12 -2 24 Z" fill={C.steel} {...line} strokeWidth={2.4} />
    <Waves y={94} />
  </>
);

/** Daniel kneeling to pray by his open window. */
const Daniel = () => (
  <>
    <rect x={98} y={16} width={44} height={44} rx={4} fill={C.steelSoft} {...line} />
    <path d="M120 16 V60 M98 38 H142" {...line} strokeWidth={2.4} />
    <Ground y={GY} />
    <P x={66} y={GY} s={1.25} pose="kneel" beard="dark" robe={C.red} look={1} hands={[[12, -44], [15, -46]]} />
  </>
);

/** David the young shepherd with his crook and a lamb. */
const David = () => (
  <>
    <Hills y={GY} />
    <Ground y={GY} />
    <P x={64} y={GY} s={1.25} robe={C.red} hair={C.wood} hands={[[-12, -18], [16, -30]]}>
      <Stick x={16} y1={-64} y2={0} crook />
    </P>
    <Animal x={118} y={GY} s={0.8} />
  </>
);

/** Moses with his staff and the two tablets of stone. */
const Moses = () => (
  <>
    <Ground y={GY} />
    <P x={76} y={GY} s={1.25} beard="white" robe={C.red} hands={[[-16, -32], [14, -36]]}>
      <Stick x={-16} y1={-74} y2={0} />
      <path d="M8 -26 V-44 Q8 -50 13 -50 Q18 -50 18 -44 V-26 Z M18 -26 V-44 Q18 -50 23 -50 Q28 -50 28 -44 V-26 Z" fill={C.steelSoft} {...line} strokeWidth={2} />
    </P>
  </>
);

/** Joseph in his coat of many colours. */
const Joseph = () => (
  <>
    <Ground y={GY} />
    <P x={80} y={GY} s={1.3} stripes robe={C.red} hands={[[-20, -40], [20, -40]]} />
  </>
);

/** Jacob asleep on a stone under the stars. */
const Jacob = () => (
  <>
    <Night />
    <Stars pts={[[28, 26], [52, 16, 3], [118, 20], [140, 40, 3], [96, 30, 3]]} />
    <rect x={58} y={88} width={30} height={20} rx={8} fill={C.steelSoft} {...line} />
    <P x={78} y={GY} s={1.15} pose="sit" seat={false} mood="sleep" beard="dark" robe={C.steel} />
  </>
);

/** Zacchaeus, a short man looking up, his money beside him. */
const Zacchaeus = () => (
  <>
    <Ground y={GY} />
    <P x={72} y={GY} s={1.0} beard="dark" robe={C.bread} sash={C.red} mood="wow" hands={[[-14, -50], [16, -22]]} />
    <Coins x={112} y={GY} n={4} />
  </>
);

/** Elijah praying with his hands up, fire on the altar. */
const Elijah = () => (
  <>
    <Ground y={GY} />
    <AltarSm x={118} y={GY} s={1.1} fire />
    <P x={58} y={GY} s={1.25} pose="raise" beard="dark" headcloth={C.wood} robe={C.sand} />
  </>
);

/** Peter the fisherman holding his net, a fish at his feet. */
const Peter = () => (
  <>
    <Waves y={100} />
    <P x={66} y={104} s={1.2} beard="dark" robe={C.steel} sash={C.bread} hands={[[-12, -18], [22, -32]]}>
      <path d="M22 -34 L42 -6 L8 -2 Z" fill="none" {...line} strokeWidth={2} />
      <path d="M26 -28 L16 -3 M32 -20 L24 -3 M14 -16 H36 M12 -9 H39" fill="none" {...line} strokeWidth={1.4} />
    </P>
    <Fish x={104} y={90} s={0.9} />
  </>
);

/** Three wise men with crowns and gifts, following the star. */
const WiseMen = () => (
  <>
    <StarPt x={130} y={20} r={10} />
    <Ground y={GY} />
    {[
      [38, C.red, 'dark'],
      [80, C.steel, 'white'],
      [122, C.pale, 'dark'],
    ].map(([x, robe, beard], i) => (
      <P key={i} x={x as number} y={GY} s={0.95} crown robe={robe as string} beard={beard as 'dark' | 'white'} look={1} hands={[[-12, -18], [14, -26]]}>
        <rect x={9} y={-33} width={11} height={9} rx={1.5} fill={C.bread} {...line} strokeWidth={1.8} />
      </P>
    ))}
  </>
);

/** The boy Samuel listening in the night, the lamp of God's house beside him. */
const Samuel = () => (
  <>
    <Night />
    <Stars pts={[[30, 24, 3], [140, 22, 3]]} />
    <path d="M110 92 q14 -3 24 4 q-10 7 -24 3 Z" fill={C.bread} {...line} strokeWidth={2.4} />
    <path d="M114 89 q-4 -8 2 -14 q2 8 4 10" fill={C.red} {...line} strokeWidth={2} />
    <rect x={104} y={98} width={36} height={8} rx={3} fill={C.wood} {...line} strokeWidth={2.4} />
    <P x={64} y={GY} child s={1.45} robe={C.white} sash={C.steel} mood="wow" look={1} hands={[[-12, -18], [11, -50]]} />
  </>
);

/** Abraham pointing up at the many stars. */
const Abraham = () => (
  <>
    <Night />
    <Stars pts={[[96, 18], [118, 30, 3], [138, 16], [108, 48, 3], [140, 56], [84, 38, 3], [126, 74, 3]]} />
    <P x={56} y={GY} s={1.2} beard="white" robe={C.steel} look={1} hands={[[-12, -18], [22, -64]]} />
  </>
);

/** Rebekah at the well with her water jar. */
const Rebekah = () => (
  <>
    <Ground y={GY} />
    <WellSm x={120} y={GY} />
    <P x={62} y={GY} s={1.25} woman headcloth={C.red} robe={C.steel} look={1} hands={[[-12, -18], [13, -58]]}>
      <path d="M6 -68 q-7 1 -7 9 q0 11 11 11 q11 0 11 -11 q0 -8 -7 -9 Z" fill={C.redSoft} {...line} strokeWidth={2} />
    </P>
  </>
);

/** Balaam with his stick, surprised to hear his donkey speak. */
const Balaam = () => (
  <>
    <Ground y={GY} />
    <P x={64} y={GY} s={1.25} beard="dark" headcloth={C.wood} robe={C.sand} mood="wow" hands={[[-12, -18], [18, -46]]}>
      <Stick x={18} y1={-78} y2={-30} />
    </P>
    <rect x={106} y={18} width={38} height={28} rx={12} fill={C.white} {...line} strokeWidth={2.6} />
    <path d="M114 46 l-6 10 l14 -10" fill={C.white} {...line} strokeWidth={2.2} />
    <text x={125} y={39} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK}>
      ?!
    </text>
  </>
);

/** Ruth in the field, gathering grain. */
const Ruth = () => (
  <>
    <Hills y={GY} fill={C.bread} />
    <Ground y={GY} />
    <Sheaf x={122} y={GY} s={1.1} />
    <P x={68} y={GY} s={1.25} woman headcloth={C.pale} robe={C.red} look={1} hands={[[-12, -18], [16, -28]]}>
      <path d="M14 -24 L24 -50 M17 -24 L30 -46 M11 -24 L18 -52" fill="none" stroke={C.wood} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M24 -50 q2 -6 5 -6 M30 -46 q3 -5 6 -4 M18 -52 q1 -6 4 -7" fill="none" stroke={C.bread} strokeWidth={4} strokeLinecap="round" />
    </P>
  </>
);

/** King Solomon on his throne, wearing his crown, a scroll in his hand. */
const Solomon = () => (
  <>
    <Ground y={GY} />
    <Throne x={84} y={GY} />
    <P x={84} y={GY} s={1.2} pose="sit" seat={false} beard="dark" crown robe={C.red} look={1} hands={[[-4, -20], [18, -26]]}>
      <rect x={14} y={-33} width={9} height={14} rx={3} fill={C.white} {...line} strokeWidth={1.8} />
    </P>
  </>
);

/** Jesus, the Good Shepherd, carrying a lamb. */
const Jesus = () => (
  <>
    <Hills y={GY} />
    <Ground y={GY} />
    <P x={78} y={GY} s={1.3} beard="dark" robe={C.white} sash={C.red} hands={[[-12, -30], [12, -30]]}>
      <Animal x={-12} y={-24} s={0.5} />
    </P>
  </>
);

const PORTRAITS: Record<string, () => ReactElement> = {
  noah: Noah,
  jonah: Jonah,
  daniel: Daniel,
  david: David,
  moses: Moses,
  joseph: Joseph,
  jacob: Jacob,
  zacchaeus: Zacchaeus,
  elijah: Elijah,
  peter: Peter,
  wisemen: WiseMen,
  samuel: Samuel,
  abraham: Abraham,
  rebekah: Rebekah,
  balaam: Balaam,
  ruth: Ruth,
  solomon: Solomon,
  jesus: Jesus,
};
export const PORTRAIT_IDS = Object.keys(PORTRAITS);

/** The person on a Picture Match card (nothing for an unknown id). */
export function KidsPortrait({ id }: { id: string }) {
  const Art = PORTRAITS[id];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%" role="presentation">
      <Art />
    </svg>
  );
}
