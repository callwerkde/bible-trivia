import type { ReactElement, ReactNode } from 'react';
import { C, Eye, Ground, INK, Person as P, Smile, Waves, line } from './kit';
import { Animal, Bubble, Camel, Hills, Light, Night, Oak, Palm, StarPt, Stick, Town } from './sceneKit';

/*
 * Story pictures, part B: Daniel and the lions, Jonah, and the birth, life, death and
 * resurrection of Jesus, as told to children.
 */

/** A soft blue sky filling the picture. */
const Sky = ({ fill = C.steelSoft }: { fill?: string }) => <rect x={4} y={4} width={152} height={112} rx={14} fill={fill} />;

/** The lion's den: a rock cave with a dark opening and a sandy floor. Children stand on the floor at y=104. */
const Den = ({ children }: { children?: ReactNode }) => (
  <>
    <rect x={4} y={4} width={152} height={112} rx={20} fill={C.wood} {...line} />
    <path d="M14 104 V52 Q14 16 80 16 Q146 16 146 52 V104 Z" fill={C.night} />
    <path d="M10 104 H150 V112 H10 Z" fill={C.sand} />
    {children}
  </>
);

/** A friendly lion with a round mane. Feet at (x, y), facing right (or left with `flip`). `lying` lies down asleep. */
function Lion({ x, y, s = 1, flip, lying }: { x: number; y: number; s?: number; flip?: boolean; lying?: boolean }) {
  const transform = `translate(${x} ${y}) scale(${flip ? -s : s} ${s})`;
  if (lying) {
    return (
      <g transform={transform}>
        <path d="M-16 -12 q-9 -2 -9 -11 q5 0 7 4" fill="none" {...line} strokeWidth={2.4} />
        <ellipse cx={-2} cy={-9} rx={19} ry={9} fill={C.bread} {...line} />
        <ellipse cx={-4} cy={-1} rx={6} ry={3} fill={C.bread} {...line} strokeWidth={2} />
        <circle cx={18} cy={-12} r={13} fill={C.mane} {...line} />
        <circle cx={21} cy={-9} r={8} fill={C.bread} {...line} strokeWidth={2.2} />
        <path d="M17 -11 q2 2 4 0 M24 -11 q2 2 4 0" fill="none" {...line} strokeWidth={1.6} />
        <Smile x={22} y={-5} w={5} />
      </g>
    );
  }
  return (
    <g transform={transform}>
      <path d="M-12 -8 V0 M-6 -8 V0 M7 -8 V0 M13 -8 V0" {...line} />
      <path d="M-16 -16 q-10 -4 -8 -14" fill="none" {...line} strokeWidth={2.6} />
      <ellipse cx={0} cy={-16} rx={17} ry={9} fill={C.bread} {...line} />
      <circle cx={20} cy={-30} r={15} fill={C.mane} {...line} />
      <circle cx={22} cy={-26} r={9} fill={C.bread} {...line} strokeWidth={2.2} />
      <Eye x={24} y={-29} r={2} />
      <Smile x={22} y={-21} w={6} />
      <ellipse cx={28} cy={-24} rx={2.5} ry={2} fill={INK} />
    </g>
  );
}

/** A little palm branch held in a hand. Its stick starts at (x, y). */
const Branch = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x} ${y} V${y - 24}`} fill="none" {...line} strokeWidth={2.4} />
    <path d={`M${x} ${y} V${y - 24}`} fill="none" stroke={C.wood} strokeWidth={1.2} />
    {[-60, -30, 0, 30, 60].map((a) => (
      <ellipse key={a} cx={x} cy={y - 32} rx={3.6} ry={10} fill={C.paleDeep} {...line} strokeWidth={1.6} transform={`rotate(${a} ${x} ${y - 24})`} />
    ))}
  </g>
);

/** A dark storm cloud. Centred at (x, y). */
const Cloud = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M-28 8 Q-36 8 -34 0 Q-32 -8 -22 -7 Q-20 -18 -6 -17 Q4 -26 14 -16 Q28 -16 28 -3 Q36 0 34 8 Z"
    fill={C.night}
    {...line}
    strokeWidth={2.6}
  />
);

/** A wooden cross on a hill, base at (x, 104), height h. */
const Cross = ({ x, h }: { x: number; h: number }) => (
  <g>
    <rect x={x - 3.5} y={104 - h} width={7} height={h} rx={1.5} fill={C.wood} {...line} strokeWidth={2.4} />
    <rect x={x - 14} y={104 - h * 0.72} width={28} height={6.5} rx={1.5} fill={C.wood} {...line} strokeWidth={2.4} />
  </g>
);

/** A rocky hillside with a tomb door (dark or lit, with a round stone). */
const Tomb = ({ doorFill, stoneX, stoneR = 22 }: { doorFill: string; stoneX: number; stoneR?: number }) => (
  <>
    <path d="M4 116 V72 Q18 38 60 36 Q100 32 116 60 Q132 44 156 64 V116 Z" fill={C.woodSoft} {...line} />
    <path d="M22 60 l6 3 M134 80 l5 -3 M40 92 l5 2" fill="none" stroke={INK} strokeWidth={2} opacity={0.4} />
    <path d="M60 104 V76 Q60 52 80 52 Q100 52 100 76 V104 Z" fill={doorFill} {...line} strokeWidth={2.4} />
    <circle cx={stoneX} cy={84} r={stoneR} fill={C.steelSoft} {...line} />
    <circle cx={stoneX} cy={84} r={stoneR * 0.5} fill="none" stroke={C.steel} strokeWidth={2} />
  </>
);

/* ---------- Daniel ---------- */

/** Daniel kneels in prayer by his open window; the city can be seen far away. */
const DnPray = () => (
  <>
    <rect x={4} y={4} width={152} height={112} rx={14} fill={C.sand} {...line} />
    <rect x={94} y={16} width={44} height={42} fill={C.water} {...line} />
    <Town x={116} y={56} s={0.55} />
    <path d="M116 16 V58 M94 36 H138" fill="none" stroke={INK} strokeWidth={2.4} />
    <rect x={88} y={56} width={56} height={6} rx={2} fill={C.wood} {...line} strokeWidth={2.4} />
    <path d="M4 104 H156 V116 H4 Z" fill={C.woodSoft} {...line} />
    <P x={66} y={104} pose="kneel" look={1} robe={C.steel} hair={C.wood} hands={[[-2, -32], [2, -32]]} />
  </>
);

/** Daniel calm between two lions in the den. */
const DnDen = () => (
  <Den>
    <Lion x={30} y={104} s={0.9} />
    <Lion x={130} y={104} s={0.9} flip />
    <P x={80} y={104} robe={C.steel} hair={C.wood} mood="smile" />
  </Den>
);

/** An angel stands beside Daniel; the lions lie down asleep with closed mouths. */
const DnAngel = () => (
  <Den>
    <circle cx={100} cy={58} r={44} fill={C.bread} opacity={0.3} />
    <circle cx={100} cy={58} r={30} fill={C.bread} opacity={0.3} />
    <Lion x={24} y={104} s={0.9} lying />
    <Lion x={140} y={104} s={0.9} lying flip />
    <P x={48} y={104} robe={C.steel} hair={C.wood} look={1} />
    <P
      x={96}
      y={104}
      s={0.95}
      wings
      robe={C.white}
      hair={C.bread}
      children={<ellipse cx={0} cy={-70} rx={11} ry={3.5} fill="none" stroke={C.bread} strokeWidth={3} />}
    />
  </Den>
);

/** The king, delighted, with open arms at the den; Daniel steps out smiling. */
const DnSafe = () => (
  <>
    <Sky />
    <Light x={28} y={26} r={11} />
    <path d="M76 104 Q80 46 116 46 Q150 46 152 104 Z" fill={C.wood} {...line} />
    <path d="M96 104 Q98 70 116 68 Q134 70 136 104 Z" fill={C.night} />
    <Hills />
    <Ground />
    <P x={50} y={104} robe={C.red} beard="white" crown hands={[[-24, -40], [24, -40]]} />
    <P x={118} y={104} pose="walk" robe={C.steel} hair={C.wood} hands={[[-14, -22], [22, -38]]} />
  </>
);

/* ---------- Jonah ---------- */

/** Jonah climbs aboard a ship, looking back worriedly at the land. */
const JnShip = () => (
  <>
    <Sky />
    <Light x={24} y={24} r={9} />
    <path d="M92 90 Q120 66 152 76 V92 H92 Z" fill={C.pale} {...line} />
    <Town x={124} y={78} s={0.7} />
    <Waves y={92} />
    <path d="M30 80 H128 L116 98 H42 Z" fill={C.wood} {...line} />
    <path d="M30 80 H128" stroke={C.woodSoft} strokeWidth={4} />
    <rect x={78} y={28} width={4} height={52} fill={C.wood} {...line} strokeWidth={2} />
    <path d="M82 32 Q108 46 104 78 H82 Z" fill={C.white} {...line} />
    <path d="M78 28 L68 32 L78 36 Z" fill={C.red} {...line} strokeWidth={2} />
    <P x={52} y={80} s={0.9} pose="walk" robe={C.bread} beard="dark" hair={C.night} look={-1} mood="sad" hands={[[-14, -22], [18, -28]]} />
  </>
);

/** A great storm: dark clouds, lightning, a tipping ship, and Jonah splashing into the sea. */
const JnStorm = () => (
  <>
    <Sky fill={C.steel} />
    <Cloud x={38} y={34} />
    <Cloud x={118} y={30} s={0.9} />
    <path d="M84 40 L70 64 H82 L74 88 L98 54 H85 L94 40 Z" fill={C.bread} {...line} strokeWidth={2.2} />
    <g transform="rotate(-14 80 80)">
      <path d="M36 74 H124 L114 92 H46 Z" fill={C.wood} {...line} />
      <rect x={78} y={30} width={4} height={46} fill={C.wood} {...line} strokeWidth={2} />
      <path d="M82 34 Q104 46 100 70 H82 Z" fill={C.white} {...line} />
      <P x={60} y={74} s={0.7} robe={C.pale} mood="wow" pose="raise" hair={C.wood} />
    </g>
    <P x={124} y={104} s={0.9} pose="raise" robe={C.bread} beard="dark" hair={C.night} mood="wow" />
    <Waves y={94} />
    {[
      [110, 90, 3],
      [134, 88, 3.5],
      [120, 80, 2.5],
      [146, 96, 2.5],
    ].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={C.steelSoft} {...line} strokeWidth={2} />
    ))}
  </>
);

/** Inside the great fish, Jonah kneels and prays in a round window in its tummy. */
const JnFish = () => (
  <>
    <rect x={4} y={4} width={152} height={112} rx={14} fill={C.water} />
    <path d="M4 110 Q40 100 80 108 T156 104 V116 H4 Z" fill={C.sand} {...line} />
    <path d="M16 110 q-8 -12 2 -22 M26 110 q6 -10 -2 -18" fill="none" stroke={C.paleDeep} strokeWidth={4} strokeLinecap="round" />
    {[
      [24, 36, 4],
      [34, 22, 3],
      [138, 24, 3.5],
      [144, 44, 2.5],
    ].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={C.white} {...line} strokeWidth={2} />
    ))}
    <path d="M30 62 L8 42 Q14 62 8 82 Z" fill={C.steel} {...line} />
    <path d="M62 34 Q76 14 96 34 Z" fill={C.steel} {...line} />
    <path d="M66 88 Q76 100 88 90 Z" fill={C.steel} {...line} />
    <ellipse cx={80} cy={62} rx={54} ry={30} fill={C.steel} {...line} />
    <path d="M100 40 q-4 22 0 44" fill="none" {...line} strokeWidth={2} />
    <ellipse cx={76} cy={66} rx={24} ry={18} fill={C.steelSoft} {...line} strokeWidth={2.6} />
    <P x={74} y={80} s={0.5} pose="kneel" robe={C.bread} beard="dark" hair={C.night} hands={[[-2, -32], [2, -32]]} />
    <Eye x={116} y={54} r={5} />
    <Smile x={118} y={70} w={12} />
  </>
);

/** Jonah points up and speaks to a small crowd before the great city gate. */
const JnNineveh = () => (
  <>
    <Sky />
    <rect x={34} y={46} width={96} height={58} fill={C.sand} {...line} />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <rect key={i} x={34 + i * 16} y={38} width={9} height={9} fill={C.sand} {...line} strokeWidth={2.4} />
    ))}
    <path d="M74 104 V84 Q86 70 98 84 V104 Z" fill={C.wood} {...line} />
    <Bubble x={12} y={10} w={36} h={20} tail={[52, 38]}>
      <path d="M20 17 H40 M20 23 H34" fill="none" {...line} strokeWidth={2} />
    </Bubble>
    <P x={56} y={104} robe={C.steel} beard="dark" look={1} pose="point" hands={[[-12, -20], [14, -62]]} />
    <P x={112} y={104} s={0.8} flip robe={C.pale} hair={C.wood} headcloth={C.white} hands={[[-14, -20], [12, -26]]} />
    <P x={132} y={104} child flip robe={C.bread} hair={C.night} mood="wow" />
    <P x={142} y={104} s={0.7} flip woman robe={C.redSoft} headcloth={C.steelSoft} hands={[[-14, -20], [14, -28]]} />
  </>
);

/* ---------- Jesus ---------- */

/** Mary, surprised, in a simple room while the angel Gabriel speaks to her. */
const XmAngel = () => (
  <>
    <rect x={4} y={4} width={152} height={112} rx={14} fill={C.steelSoft} />
    <rect x={14} y={18} width={30} height={40} fill={C.water} {...line} />
    <path d="M29 18 V58 M14 38 H44" fill="none" stroke={INK} strokeWidth={2.4} />
    <path d="M100 30 L120 30 L84 88 L56 88 Z" fill={C.bread} opacity={0.45} />
    <path d="M4 102 H156 V116 H4 Z" fill={C.woodSoft} {...line} />
    <P x={50} y={104} woman robe={C.redSoft} headcloth={C.steel} mood="wow" hands={[[-8, -44], [8, -44]]} />
    <P x={112} y={104} s={0.95} flip wings robe={C.white} hair={C.bread} pose="point" />
  </>
);

/** Joseph leads a donkey with Mary riding; a small town ahead, one window lit, at evening. */
const XmJourney = () => (
  <>
    <Sky fill={C.steel} />
    <Light x={30} y={30} r={9} />
    <Hills />
    <Town x={130} y={104} s={1} />
    <rect x={120} y={86} width={6} height={7} fill={C.bread} {...line} strokeWidth={1.8} />
    <Stick x={27} y1={44} y2={104} crook />
    <P x={40} y={104} s={0.95} pose="walk" robe={C.steel} beard="dark" headcloth={C.white} hands={[[-14, -20], [18, -30]]} />
    <Animal kind="donkey" x={84} y={104} flip />
    <P x={84} y={76} s={0.9} flip pose="sit" seat={false} woman robe={C.redSoft} headcloth={C.steel} mood="smile" hands={[[-4, -20], [14, -24]]} />
  </>
);

/** Baby Jesus in the manger, Mary kneeling, Joseph, a donkey, a sheep, and a star above. */
const XmManger = () => (
  <>
    <Night />
    <StarPt x={88} y={16} r={8} />
    <StarPt x={28} y={24} r={4} />
    <StarPt x={140} y={40} r={4} />
    <path d="M4 60 L80 30 L156 60 Z" fill={C.wood} {...line} />
    <rect x={6} y={58} width={148} height={46} fill={C.woodSoft} {...line} />
    <rect x={74} y={76} width={42} height={20} fill={C.wood} {...line} />
    <rect x={72} y={70} width={46} height={8} rx={3} fill={C.bread} {...line} strokeWidth={2} />
    <circle cx={80} cy={62} r={8} fill={C.skin} {...line} strokeWidth={2.2} />
    <path d="M73 57 q7 -6 14 0" fill="none" {...line} strokeWidth={2} />
    <Eye x={78} y={62} r={1.6} />
    <Smile x={81} y={66} w={6} />
    <ellipse cx={94} cy={70} rx={16} ry={6} fill={C.white} {...line} />
    <path d="M4 104 H156 V116 H4 Z" fill={C.bread} {...line} />
    <Animal kind="donkey" x={20} y={104} s={0.8} />
    <P x={60} y={104} s={0.95} pose="kneel" woman robe={C.redSoft} headcloth={C.steel} mood="smile" />
    <P x={124} y={104} s={0.95} flip robe={C.steel} beard="dark" />
    <Animal kind="sheep" x={146} y={104} s={0.5} flip />
  </>
);

/** Three wise men with crowns and gifts walk toward a house under a bright star, with a camel. */
const XmWisemen = () => (
  <>
    <Night />
    <StarPt x={138} y={22} r={9} />
    <StarPt x={20} y={20} r={4} />
    <StarPt x={60} y={24} r={3} />
    <StarPt x={96} y={14} r={3.5} />
    <StarPt x={34} y={46} r={3} />
    <path d="M122 104 V66 L138 52 L154 66 V104 Z" fill={C.sand} {...line} />
    <path d="M118 68 L138 48 L156 68 Z" fill={C.red} {...line} />
    <rect x={134} y={84} width={8} height={20} fill={C.wood} {...line} strokeWidth={2} />
    <rect x={126} y={72} width={7} height={7} fill={C.bread} {...line} strokeWidth={2} />
    <path d="M4 104 H156 V116 H4 Z" fill={C.paleDeep} {...line} />
    <Camel x={24} y={104} s={0.5} />
    {[
      { x: 66, robe: C.red, beard: 'dark' as const },
      { x: 88, robe: C.pale, beard: 'white' as const },
      { x: 106, robe: C.steel, beard: 'dark' as const },
    ].map((w, i) => (
      <P
        key={i}
        x={w.x}
        y={104}
        s={0.8}
        robe={w.robe}
        beard={w.beard}
        crown
        hands={[[-14, -20], [18, -36]]}
        children={<rect x={13} y={-44} width={12} height={10} rx={1.5} fill={C.bread} {...line} strokeWidth={2} />}
      />
    ))}
  </>
);

/** Jesus rides a donkey into Jerusalem; people wave palm branches beside the city walls. */
const EsDonkey = () => (
  <>
    <Sky />
    <rect x={112} y={54} width={40} height={50} fill={C.sand} {...line} />
    {[112, 123, 134, 145].map((x) => (
      <rect key={x} x={x} y={46} width={8} height={8} fill={C.sand} {...line} strokeWidth={2.4} />
    ))}
    <path d="M124 104 V88 Q132 78 140 88 V104 Z" fill={C.wood} {...line} />
    <Hills />
    <Ground />
    <Animal kind="donkey" x={72} y={104} />
    <P x={72} y={76} pose="sit" seat={false} robe={C.white} sash={C.red} beard="dark" hair={C.wood} />
    <P
      x={18}
      y={104}
      s={0.85}
      pose="raise"
      robe={C.pale}
      hair={C.night}
      children={
        <>
          <Branch x={-16} y={-58} />
          <Branch x={16} y={-58} />
        </>
      }
    />
    <P
      x={130}
      y={104}
      s={0.85}
      flip
      pose="raise"
      robe={C.steel}
      hair={C.wood}
      children={
        <>
          <Branch x={-16} y={-58} />
          <Branch x={16} y={-58} />
        </>
      }
    />
  </>
);

/** Three empty crosses on a small green hill at sunset. Gentle: no people. */
const EsCross = () => (
  <>
    <Sky />
    <circle cx={130} cy={84} r={16} fill={C.bread} {...line} />
    <path d="M4 104 Q40 88 80 92 Q120 96 156 84 V116 H4 Z" fill={C.paleDeep} {...line} />
    <Cross x={50} h={40} />
    <Cross x={80} h={54} />
    <Cross x={110} h={40} />
  </>
);

/** A rocky garden tomb with a big round stone in front of the door. */
const EsTomb = () => (
  <>
    <Sky />
    <Tomb doorFill={C.night} stoneX={80} />
    <Oak x={32} y={104} s={0.75} />
    <Palm x={130} y={104} s={0.85} />
  </>
);

/** Morning: the stone is rolled away, the tomb is empty and bright, Jesus stands outside, a friend is happy. */
const EsAlive = () => (
  <>
    <Sky />
    <Light x={138} y={18} r={10} />
    <Tomb doorFill={C.bread} stoneX={130} />
    <P x={54} y={104} robe={C.white} sash={C.red} beard="dark" hair={C.wood} hands={[[-24, -34], [22, -34]]} />
    <P x={18} y={104} s={0.85} woman pose="raise" robe={C.pale} headcloth={C.steel} />
  </>
);

export const STORY_SCENES_B: Record<string, () => ReactElement> = {
  // Daniel prayed to God three times every day by his open window.
  'dn-pray': DnPray,
  // Bad men made a law, and Daniel was put into a den of lions.
  'dn-den': DnDen,
  // God sent his angel and shut the lions' mouths.
  'dn-angel': DnAngel,
  // In the morning the king was very glad: Daniel was safe!
  'dn-safe': DnSafe,
  // God told Jonah to go to Nineveh, but Jonah ran away on a ship.
  'jn-ship': JnShip,
  // A great storm came, and the sailors threw Jonah into the sea.
  'jn-storm': JnStorm,
  // God sent a great fish to swallow Jonah. Inside the fish, Jonah prayed.
  'jn-fish': JnFish,
  // The fish put Jonah on dry land, and he went to Nineveh to tell God's message.
  'jn-nineveh': JnNineveh,
  // The angel Gabriel told Mary she would have a baby, the Son of God.
  'xm-angel': XmAngel,
  // Mary and Joseph went to Bethlehem. There was no room in the inn.
  'xm-journey': XmJourney,
  // Baby Jesus was born and laid in a manger. Angels told the shepherds.
  'xm-manger': XmManger,
  // Wise men followed a star and brought gifts to Jesus.
  'xm-wisemen': XmWisemen,
  // Jesus rode into Jerusalem on a donkey, and the people waved palm branches.
  'es-donkey': EsDonkey,
  // Jesus died on the cross for us.
  'es-cross': EsCross,
  // His friends laid his body in a tomb, and a big stone was rolled in front.
  'es-tomb': EsTomb,
  // On the third day, the stone was rolled away. Jesus is alive!
  'es-alive': EsAlive,
};
