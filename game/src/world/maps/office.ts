import type { MapDef, Prop } from "../MapDef";

const desk = (x: number, y: number): Prop[] => [
  { sheet: "indoor", at: [x, y], tiles: [[0, 1, 2]], solid: true },
  { sheet: "indoor", at: [x + 1, y], tiles: [[129]], top: true },
  { sheet: "indoor", at: [x + 1, y + 1], tiles: [[217]], solid: true },
];

// Prior Labs, Freiburg: open-plan desks, a meeting room with a whiteboard, the canteen.
export const office: MapDef = {
  key: "office",
  legend: {
    "┌": ["rpg", 700],
    "─": ["rpg", 698],
    "┐": ["rpg", 701],
    "│": ["rpg", 756],
    "└": ["rpg", 757],
    "┘": ["rpg", 758],
    U: ["rpg", 873],
    W: ["rpg", 868],
    ".": ["rpg", 120],
    ",": ["rpg", 119],
  },
  floor: [
    "                              ",
    "                              ",
    "                              ",
    " ............................ ",
    " ............................ ",
    " ............................ ",
    " ............................ ",
    " ............................ ",
    " ............................ ",
    " ............................ ",
    " .............,,,,,,,,,,,,,,, ",
    " .............,,,,,,,,,,,,,,, ",
    " .............,,,,,,,,,,,,,,, ",
    " .............,,,,,,,,,,,,,,, ",
    " .............,,,,,,,,,,,,,,, ",
    " .............,,,,,,,,,,,,,,, ",
    "            ..                ",
  ],
  walls: [
    "┌────────────────────────────┐",
    "│UUUUUUUUUUUUUUUUUUUUUUUUUUUU│",
    "│WWWWWWWWWWWWWWWWWWWWWWWWWWWW│",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "│                            │",
    "└───────────  ───────────────┘",
  ].map((r) => r.padEnd(30)),
  props: [
    // Windows, whiteboard, pictures.
    ...[3, 7, 11].map((x) => ({ sheet: "rpg" as const, at: [x, 1] as const, tiles: [[158], [215]], wall: true })),
    { sheet: "indoor", at: [18, 1], tiles: [[343, 344, 345]], wall: true },
    { sheet: "indoor", at: [25, 1], tiles: [[340]], wall: true },
    // Desks: Ada's (top-left) and colleagues'.
    ...desk(2, 4),
    ...desk(7, 4),
    ...desk(2, 8),
    ...desk(7, 8),
    // Meeting room table with chairs.
    { sheet: "indoor", at: [17, 5], tiles: [[112, 113, 113, 113, 115]], solid: true },
    { sheet: "indoor", at: [17, 4], tiles: [[218, null, 218, null, 218]], solid: true },
    { sheet: "indoor", at: [17, 6], tiles: [[217, null, 217, null, 217]], solid: true },
    // Canteen: counter, fridge, tables, benches.
    { sheet: "indoor", at: [16, 11], tiles: [[324, 332, 356, 357, 331, 325]], solid: true },
    { sheet: "indoor", at: [22, 11], tiles: [[392]], solid: true },
    { sheet: "indoor", at: [27, 10], tiles: [[416], [443]], solid: true },
    { sheet: "indoor", at: [17, 14], tiles: [[243, 244, 245]], solid: true },
    { sheet: "indoor", at: [23, 14], tiles: [[243, 244, 245]], solid: true },
    { sheet: "indoor", at: [17, 15], tiles: [[166, 167, 168]], solid: true },
    { sheet: "indoor", at: [23, 15], tiles: [[166, 167, 168]], solid: true },
    // Plants.
    { sheet: "indoor", at: [1, 3], tiles: [[16]], solid: true },
    { sheet: "indoor", at: [14, 3], tiles: [[17]], solid: true },
    { sheet: "indoor", at: [28, 3], tiles: [[16]], solid: true },
    { sheet: "indoor", at: [1, 15], tiles: [[17]], solid: true },
  ],
  spots: [
    { id: "adaDesk", at: [2, 4], size: [3, 1] },
    { id: "whiteboard", at: [18, 1], size: [3, 2] },
    { id: "rosa", at: [16, 11], size: [6, 1] }, // talk to Rosa across the counter
    { id: "exit", at: [12, 16], size: [2, 1], trigger: "touch" },
  ],
  npcs: [
    { id: "petra", who: "elder", at: [22, 5], facing: "left", tint: 0xd8c8ff },
    { id: "tomas", who: "sam", at: [8, 9.4], facing: "up", tint: 0xc8f0d0 },
    { id: "jonas", who: "leo", at: [8, 5.4], facing: "up", tint: 0xd0e0ff },
    { id: "rosa", who: "elder", at: [19, 10.2], facing: "down", tint: 0xffe0d0 },
  ],
  spawn: { at: [12.5, 15], facing: "up" },
};
