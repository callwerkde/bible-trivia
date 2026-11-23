import type { ReactElement } from 'react';
import { C, Eye, Ground, INK, Person as P, Waves, line } from './kit';
import { Animal, Bird, Hills, Light, Night, Oak, Palm, Sack, StarPt, Stick, Wheel } from './sceneKit';

/*
 * Story pictures, part A: the creation, Noah and the flood, and the Red Sea and David and Goliath.
 * Each picture is drawn in the 160 x 120 box used by the other scenes.
 */

const G = 104;

/** A little plant with two leaves. */
const Sprout = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x} ${y} V${y - 8} M${x} ${y - 4} q-5 -1 -6 -5 M${x} ${y - 4} q5 -1 6 -5`} fill="none" stroke={C.paleDeep} strokeWidth={2.4} strokeLinecap="round" />
);

/** A small flower on a stem. */
const Flower = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x} ${y} V${y - 8}`} fill="none" stroke={C.paleDeep} strokeWidth={2} strokeLinecap="round" />
    <circle cx={x} cy={y - 11} r={4} fill={C.redSoft} {...line} strokeWidth={1.6} />
    <circle cx={x} cy={y - 11} r={1.4} fill={C.bread} />
  </g>
);

/** A fluffy grey-blue cloud centred on (x, y). */
const Cloud = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle cx={x - 12} cy={y} r={9} fill={C.steel} {...line} strokeWidth={2.4} />
    <circle cx={x} cy={y - 5} r={12} fill={C.steel} {...line} strokeWidth={2.4} />
    <circle cx={x + 12} cy={y} r={9} fill={C.steel} {...line} strokeWidth={2.4} />
    <rect x={x - 21} y={y - 1} width={42} height={9} rx={4.5} fill={C.steel} />
  </g>
);

/** A crescent moon. */
const Moon = ({ x, y }: { x: number; y: number }) => (
  <path d={`M${x} ${y - 10} A11 11 0 1 0 ${x + 10} ${y + 8} A9 9 0 0 1 ${x} ${y - 10} Z`} fill={C.bread} {...line} strokeWidth={2.4} />
);

/** A small fish leaping out of the water. */
const Fish = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x - 9} ${y} L${x - 15} ${y - 5} V${y + 5} Z`} fill={C.redSoft} {...line} strokeWidth={2} />
    <ellipse cx={x} cy={y} rx={9} ry={5} fill={C.redSoft} {...line} strokeWidth={2.2} />
    <Eye x={x + 4} y={y - 1} r={1.6} />
  </g>
);

/** Two music notes. */
const Notes = ({ x, y }: { x: number; y: number }) => (
  <g>
    <path d={`M${x} ${y} V${y - 14} L${x + 10} ${y - 17} V${y - 3}`} fill="none" {...line} strokeWidth={2.2} />
    <ellipse cx={x - 2.5} cy={y} rx={3.5} ry={2.6} fill={INK} />
    <ellipse cx={x + 7.5} cy={y - 3} rx={3.5} ry={2.6} fill={INK} />
  </g>
);

/** The two tall walls of sea water, with the dry path between them (x 54 to 106). */
const SeaWalls = () => (
  <>
    <path d="M6 116 V40 Q14 30 22 40 Q30 50 38 40 Q46 30 54 40 V116 Z" fill={C.water} {...line} />
    <path d="M106 116 V40 Q114 30 122 40 Q130 50 138 40 Q146 30 154 40 V116 Z" fill={C.water} {...line} />
    <path d="M16 70 q4 -4 8 0 M28 84 q4 -4 8 0 M120 70 q4 -4 8 0 M132 84 q4 -4 8 0" fill="none" {...line} strokeWidth={2} />
    <path d="M54 94 H106 V116 H54 Z" fill={C.sand} {...line} />
  </>
);

/* ---------- The creation ---------- */

/** God said, "Let there be light": a bright light over the dark, empty world. */
const CreationLight = () => (
  <>
    <Night />
    <Light x={80} y={44} r={14} />
    <path d="M10 116 Q80 74 150 116 Z" fill={C.wood} {...line} />
  </>
);

/** God made the sky, the sea and the dry land, with grass, plants and trees. */
const CreationLand = () => (
  <>
    <rect x={6} y={6} width={148} height={108} rx={20} fill={C.steelSoft} />
    <path d="M86 74 q8 -6 16 0 t16 0 t16 0 t16 0 H154 V116 H86 Z" fill={C.water} />
    <path d="M86 74 q8 -6 16 0 t16 0 t16 0 t16 0 H154" fill="none" {...line} />
    <path d="M96 94 q6 -5 12 0 t12 0 t12 0" fill="none" {...line} strokeWidth={2} />
    <path d="M6 110 Q30 84 70 92 Q82 95 86 104 V114 H6 Z" fill={C.pale} {...line} />
    <Oak x={26} y={104} s={0.75} />
    <Palm x={64} y={102} s={0.7} />
    <Sprout x={12} y={112} />
    <Sprout x={46} y={112} />
    <Sprout x={78} y={110} />
  </>
);

/** God made the sun, the moon, the birds, the fish and the animals. */
const CreationAnimals = () => (
  <>
    <rect x={6} y={6} width={148} height={108} rx={20} fill={C.steelSoft} />
    <Light x={132} y={24} r={10} />
    <Moon x={26} y={26} />
    <Bird x={60} y={34} s={0.8} />
    <Bird x={86} y={20} s={0.6} />
    <Fish x={136} y={84} />
    <path d="M112 104 q8 -6 16 0 t16 0 t16 0 t8 0 V116 H112 Z" fill={C.water} />
    <path d="M112 104 q8 -6 16 0 t16 0 t16 0 t8 0" fill="none" {...line} />
    <path d="M6 100 Q60 94 114 100 V114 Q114 116 112 116 H8 Q6 116 6 114 Z" fill={C.pale} {...line} />
    <Animal kind="sheep" x={20} y={106} s={0.66} />
    <Animal kind="donkey" x={54} y={106} s={0.7} />
    <Animal kind="horse" x={92} y={106} s={0.62} />
  </>
);

/** God made Adam and Eve in a green garden. */
const CreationPeople = () => (
  <>
    <Hills />
    <Ground />
    <Oak x={24} y={G} s={0.8} />
    <Flower x={40} y={112} />
    <Flower x={84} y={112} />
    <Flower x={122} y={110} />
    <P x={60} y={G} s={1} robe={C.pale} />
    <P x={98} y={G} s={1} woman robe={C.redSoft} />
    <Animal kind="goat" x={138} y={G} s={0.6} flip />
  </>
);

/* ---------- Noah and the flood ---------- */

/** Noah builds the big wooden ark with his hammer. */
const NoahBuild = () => (
  <>
    <Ground />
    <Light x={30} y={24} r={9} />
    <path d="M12 84 H112 L102 104 H22 Z" fill={C.woodSoft} {...line} />
    <rect x={22} y={58} width={80} height={26} fill={C.sand} {...line} />
    <path d="M22 68 H102 M22 76 H102 M46 58 V84 M70 58 V84 M94 58 V84" fill="none" {...line} strokeWidth={2.4} />
    <P x={128} y={G} s={1} beard="white" robe={C.steel} hands={[[-12, -18], [14, -42]]}>
      <path d="M14 -42 L16 -60" fill="none" stroke={C.wood} strokeWidth={3.4} strokeLinecap="round" />
      <rect x={9} y={-68} width={14} height={9} rx={2} fill={C.steelSoft} {...line} strokeWidth={2} />
    </P>
  </>
);

/** The finished ark with a ramp; the animals walk up to the door where Noah waits. */
const NoahAnimals = () => (
  <>
    <Hills />
    <Ground />
    <rect x={76} y={46} width={76} height={46} fill={C.woodSoft} {...line} />
    <rect x={70} y={38} width={88} height={10} rx={3} fill={C.wood} {...line} />
    <path d="M74 92 H152 L142 104 H84 Z" fill={C.wood} {...line} />
    <path d="M80 66 H148 M80 80 H148" fill="none" {...line} strokeWidth={2} />
    <rect x={84} y={56} width={12} height={11} fill={C.steelSoft} {...line} strokeWidth={2} />
    <rect x={130} y={56} width={12} height={11} fill={C.steelSoft} {...line} strokeWidth={2} />
    <rect x={100} y={64} width={16} height={28} fill={C.night} {...line} strokeWidth={2.4} />
    <path d="M68 104 L100 91 V97 L76 106 Z" fill={C.bread} {...line} strokeWidth={2.4} />
    <Animal kind="sheep" x={12} y={104} s={0.44} />
    <Animal kind="sheep" x={24} y={104} s={0.44} />
    <Bird x={36} y={101} s={0.44} />
    <Animal kind="donkey" x={48} y={104} s={0.46} />
    <Animal kind="donkey" x={60} y={104} s={0.46} />
    <Bird x={70} y={100} s={0.44} />
    <P x={108} y={92} s={0.6} beard="white" robe={C.steel} hands={[[-12, -18], [14, -30]]} />
  </>
);

/** Rain falls from grey clouds while the ark floats on the big waves. */
const NoahRain = () => (
  <>
    <Cloud x={36} y={24} />
    <Cloud x={96} y={18} />
    <Cloud x={132} y={30} />
    {[[10, 36], [20, 50], [30, 40], [144, 44], [152, 56], [140, 58], [12, 64], [136, 62]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} L${x - 5} ${y + 12}`} fill="none" stroke={C.steel} strokeWidth={2.6} strokeLinecap="round" />
    ))}
    <Waves y={94} fill={C.steelSoft} />
    <path d="M26 66 H136 L124 88 H38 Z" fill={C.wood} {...line} />
    <rect x={56} y={52} width={52} height={16} fill={C.woodSoft} {...line} />
    <rect x={66} y={56} width={10} height={8} fill={C.steelSoft} {...line} strokeWidth={2} />
    <path d="M30 70 H132" fill="none" {...line} strokeWidth={2} />
    <Waves y={84} fill={C.water} />
  </>
);

/** A rainbow over the ark on a green hill, a dove with a leaf, and Noah happy. */
const NoahRainbow = () => (
  <>
    <rect x={6} y={6} width={148} height={108} rx={20} fill={C.steelSoft} />
    <path d="M28 108 A52 52 0 0 1 132 108" fill="none" stroke={C.red} strokeWidth={6} />
    <path d="M34 108 A46 46 0 0 1 126 108" fill="none" stroke={C.bread} strokeWidth={6} />
    <path d="M40 108 A40 40 0 0 1 120 108" fill="none" stroke={C.pale} strokeWidth={6} />
    <path d="M6 108 Q40 84 80 90 Q120 84 154 108 V116 H6 Z" fill={C.pale} {...line} />
    <path d="M30 96 H76 L70 106 H36 Z" fill={C.wood} {...line} />
    <rect x={40} y={84} width={24} height={12} fill={C.woodSoft} {...line} strokeWidth={2.4} />
    <Bird x={54} y={34} s={0.9} leaf />
    <P x={118} y={102} s={0.9} pose="raise" beard="white" robe={C.steel} mood="smile" />
  </>
);

/* ---------- The Red Sea and David and Goliath ---------- */

/** God's people walk toward the sea, while Pharaoh chases in his chariot. */
const RedSeaChase = () => (
  <>
    <Hills />
    <path d="M4 70 q6 -6 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V116 H4 Z" fill={C.water} />
    <path d="M4 70 q6 -6 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0" fill="none" {...line} />
    <Ground />
    <P x={14} y={G} s={0.7} pose="walk" beard="dark" robe={C.steel} hands={[[-13, -20], [14, -22]]} />
    <P x={32} y={G} s={0.68} pose="walk" woman robe={C.redSoft} headcloth={C.sand} />
    <P x={46} y={G} child s={1} pose="walk" robe={C.pale} />
    <path d="M100 88 H138 L132 98 H106 Z" fill={C.bread} {...line} />
    <P x={122} y={88} s={0.85} flip pose="point" nemes robe={C.steel} hands={[[-12, -18], [26, -40]]} />
    <Wheel x={112} y={100} r={8} />
    <Wheel x={132} y={100} r={8} />
    <Animal kind="horse" x={152} y={86} s={0.38} flip />
  </>
);

/** Moses holds out his hand over the sea and God opens a dry path through the water. */
const RedSeaPart = () => (
  <>
    <SeaWalls />
    <path d="M62 116 Q64 102 80 102 Q96 102 98 116 Z" fill={C.woodSoft} {...line} />
    <P x={80} y={102} s={0.95} pose="point" beard="white" robe={C.red} hands={[[-12, -18], [28, -40]]}>
      <Stick x={-14} y1={-62} y2={0} />
    </P>
  </>
);

/** The people walk through the middle of the sea on dry ground, a child with them. */
const RedSeaWalk = () => (
  <>
    <SeaWalls />
    <P x={66} y={G} s={0.62} pose="walk" beard="dark" robe={C.steel} hands={[[-13, -20], [14, -22]]} />
    <P x={84} y={G} s={0.6} pose="walk" woman robe={C.redSoft} headcloth={C.sand} />
    <P x={100} y={G} child s={0.9} pose="walk" robe={C.pale} mood="wow" />
  </>
);

/** On the dry shore beside the calm sea, Miriam and the women sing and dance with a tambourine. */
const RedSeaSing = () => (
  <>
    <rect x={6} y={6} width={148} height={108} rx={20} fill={C.steelSoft} />
    <path d="M6 84 q6 -5 12 0 t12 0 t12 0 t12 0 H60 V116 H6 Z" fill={C.water} />
    <path d="M6 84 q6 -5 12 0 t12 0 t12 0 t12 0 H60" fill="none" {...line} />
    <path d="M14 98 q6 -4 12 0 t12 0 M30 108 q6 -4 12 0" fill="none" {...line} strokeWidth={2} />
    <path d="M60 116 V104 Q100 94 154 102 V116 Z" fill={C.sand} {...line} />
    <P x={92} y={G} s={0.95} woman robe={C.redSoft} headcloth={C.white} mood="wow" pose="raise">
      <circle cx={18} cy={-70} r={8} fill={C.bread} {...line} strokeWidth={2.2} />
      <path d="M12 -74 l4 4 M20 -76 l-3 5" fill="none" {...line} strokeWidth={1.4} />
    </P>
    <P x={122} y={G} s={0.8} woman robe={C.pale} headcloth={C.white} pose="raise" mood="smile" />
    <P x={142} y={G} s={0.7} woman robe={C.bread} headcloth={C.steelSoft} pose="raise" mood="smile" />
    <Notes x={68} y={44} />
    <Notes x={112} y={36} />
  </>
);

/** A very big Goliath on a hill shouts, while small soldiers hide behind a rock. */
const DavidGoliathBig = () => (
  <>
    <Hills />
    <Ground y={110} />
    <P x={18} y={110} s={0.6} robe={C.pale} headcloth={C.white} />
    <P x={34} y={110} s={0.6} robe={C.red} headcloth={C.steelSoft} />
    <path d="M4 110 Q6 88 26 86 Q46 88 48 110 Z" fill={C.steelSoft} {...line} />
    <P x={106} y={110} s={1.1} flip robe={C.steel} beard="dark" headcloth={C.steelSoft} mood="angry" hands={[[-12, -18], [20, -36]]}>
      <Stick tip x={-30} y1={-80} y2={0} />
    </P>
    <path d="M78 40 l-4 -4 M76 54 h-6 M78 68 l-4 4" fill="none" {...line} strokeWidth={2.2} />
  </>
);

/** Young David kneels by a stream and picks up five smooth stones. */
const DavidStones = () => (
  <>
    <Hills />
    <Ground />
    <Waves y={106} />
    <P x={70} y={G} s={1} pose="kneel" robe={C.red} hair={C.wood} hands={[[-11, -20], [22, -24]]} />
    <circle cx={96} cy={100} r={4} fill={C.steelSoft} {...line} strokeWidth={2} />
    <circle cx={106} cy={98} r={3.5} fill={C.steelSoft} {...line} strokeWidth={2} />
    <circle cx={114} cy={102} r={4} fill={C.steelSoft} {...line} strokeWidth={2} />
    <circle cx={124} cy={99} r={3.2} fill={C.steelSoft} {...line} strokeWidth={2} />
    <circle cx={132} cy={101} r={3.6} fill={C.steelSoft} {...line} strokeWidth={2} />
    <Sack x={34} y={G} s={0.9} />
  </>
);

/** David swings his sling over his head, and the stone flies toward Goliath. */
const DavidSling = () => (
  <>
    <Hills />
    <Ground y={110} />
    <P x={36} y={110} s={0.95} pose="raise" robe={C.red} hair={C.wood} />
    <path d="M6 49 A32 32 0 0 1 66 49" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
    <path d="M51 55 Q52 40 64 36" fill="none" {...line} strokeWidth={2.4} />
    <path d="M21 55 Q30 30 64 36" fill="none" {...line} strokeWidth={2.4} />
    <ellipse cx={70} cy={38} rx={8} ry={4.5} transform="rotate(-25 70 38)" fill={C.wood} {...line} strokeWidth={2.2} />
    <path d="M86 26 L94 23 M86 34 L93 33" fill="none" {...line} strokeWidth={2} />
    <circle cx={96} cy={28} r={4} fill={C.steelSoft} {...line} strokeWidth={2} />
    <P x={142} y={110} s={1} flip mood="wow" robe={C.steel} beard="dark" headcloth={C.steelSoft} />
  </>
);

/** Goliath lies flat on the ground, sleeping; David and the soldiers cheer. */
const DavidWin = () => (
  <>
    <Hills />
    <Ground y={108} />
    <P x={128} y={100} s={1} rot={-90} mood="sleep" robe={C.steel} beard="dark" headcloth={C.steelSoft} />
    <P x={34} y={110} s={0.95} pose="raise" robe={C.red} hair={C.wood} mood="smile" />
    <P x={70} y={86} s={0.55} pose="raise" mood="wow" robe={C.pale} headcloth={C.white} />
    <P x={92} y={86} s={0.55} pose="raise" mood="wow" robe={C.bread} headcloth={C.steelSoft} />
    <P x={144} y={110} s={0.7} pose="raise" mood="wow" robe={C.pale} headcloth={C.white} />
    <StarPt x={26} y={30} r={5} />
    <StarPt x={60} y={22} r={4} />
    <StarPt x={140} y={26} r={5} />
  </>
);

export const STORY_SCENES_A: Record<string, () => ReactElement> = {
  // The creation
  'creation-light': CreationLight, // dark night, a big bright light and a dark round earth
  'creation-land': CreationLand, // blue sky, sea, green land with trees and plants
  'creation-animals': CreationAnimals, // sun, moon, birds, a jumping fish, sheep, donkey and horse
  'creation-people': CreationPeople, // Adam and Eve in a green garden with a goat
  // Noah and the flood
  'noah-build': NoahBuild, // Noah with a hammer building the ark frame
  'noah-animals': NoahAnimals, // the ark with a ramp, animals walking up, Noah at the door
  'noah-rain': NoahRain, // grey clouds, rain, the ark floating on waves
  'noah-rainbow': NoahRainbow, // rainbow over the ark, a dove with a leaf, Noah happy
  // The Red Sea
  'redsea-chase': RedSeaChase, // people walk to the sea, Pharaoh chases in a chariot
  'redsea-part': RedSeaPart, // Moses' hand over the sea, the water split into walls
  'redsea-walk': RedSeaWalk, // people walk on dry ground between the walls of water
  'redsea-sing': RedSeaSing, // Miriam and the women sing and dance beside the sea
  // David and Goliath
  'dg-goliath': DavidGoliathBig, // big Goliath shouting, soldiers hiding behind a rock
  'dg-stones': DavidStones, // young David kneels by a stream and picks up stones
  'dg-sling': DavidSling, // David swings his sling, the stone flies at Goliath
  'dg-win': DavidWin, // Goliath lies down asleep, David and the soldiers cheer
};
