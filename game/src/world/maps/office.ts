import type { MapDef, Prop } from "../MapDef";

const desk = (x: number, y: number): Prop[] => [
  { sheet: "indoor", at: [x, y], tiles: [[0, 1, 2]], solid: true },
  { sheet: "indoor", at: [x + 1, y], tiles: [[129]], top: true },
  { sheet: "indoor", at: [x + 1, y + 1], tiles: [[217]], solid: true },
];

// Posterior Labs, Freiburg: open-plan desks, a meeting room with a whiteboard, the canteen.
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
    ...Array.from({ length: 3 }, () => " ".repeat(20)),
    ...Array.from({ length: 4 }, () => ` ${".".repeat(18)} `),
    ...Array.from({ length: 4 }, () => ` ${".".repeat(9)}${",".repeat(9)} `),
    `${" ".repeat(9)}.${" ".repeat(10)}`,
  ],
  walls: [
    `┌${"─".repeat(18)}┐`,
    `│${"U".repeat(18)}│`,
    `│${"W".repeat(18)}│`,
    ...Array.from({ length: 8 }, () => `│${" ".repeat(18)}│`),
    `└${"─".repeat(8)} ${"─".repeat(9)}┘`,
  ],
  props: [
    // Windows, whiteboard, pictures, and the door out.
    ...[2, 6].map((x) => ({ sheet: "rpg" as const, at: [x, 1] as const, tiles: [[158], [215]], wall: true })),
    { sheet: "indoor", at: [13, 1], tiles: [[343, 344, 345]], wall: true },
    { sheet: "indoor", at: [17, 1], tiles: [[340]], wall: true },
    { sheet: "urban", at: [9, 11], tiles: [[283]], wall: true },
    // Desks: Ada's (top-left) and colleagues'.
    ...desk(2, 3),
    ...desk(6, 3),
    ...desk(2, 7),
    ...desk(6, 7),
    // Meeting room table with chairs.
    { sheet: "indoor", at: [12, 4], tiles: [[112, 113, 113, 113, 115]], solid: true },
    { sheet: "indoor", at: [12, 3], tiles: [[218, null, 218, null, 218]], solid: true },
    { sheet: "indoor", at: [12, 5], tiles: [[217, null, 217, null, 217]], solid: true },
    // Canteen: counter, stove, fridge, table.
    { sheet: "indoor", at: [11, 8], tiles: [[324, 332, 356, 357, 331, 325]], solid: true },
    { sheet: "indoor", at: [17, 8], tiles: [[392]], solid: true },
    { sheet: "indoor", at: [18, 8], tiles: [[416], [443]], solid: true },
    { sheet: "indoor", at: [13, 10], tiles: [[243, 244, 245]], solid: true },
    // Plants.
    { sheet: "indoor", at: [1, 3], tiles: [[16]], solid: true },
    { sheet: "indoor", at: [18, 3], tiles: [[16]], solid: true },
    { sheet: "indoor", at: [1, 10], tiles: [[17]], solid: true },
  ],
  spots: [
    { id: "adaDesk", at: [2, 3], size: [3, 1] },
    { id: "whiteboard", at: [13, 1], size: [3, 2] },
    { id: "rosa", at: [11, 8], size: [6, 1] }, // talk to Rosa across the counter
    { id: "exit", at: [9, 11], trigger: "touch", exit: { label: "PITCH", arrow: "down" } },
  ],
  npcs: [
    { id: "petra", name: "Petra", who: "ada", at: [17, 4], facing: "left", tint: 0xd8c8ff },
    { id: "tomas", name: "Tomas", who: "sam", at: [7, 8.4], facing: "up", tint: 0xc8f0d0 },
    { id: "jonas", name: "Jonas", who: "leo", at: [7, 4.4], facing: "up", tint: 0xd0e0ff },
    { id: "rosa", name: "Rosa", who: "ada", at: [14, 7.2], facing: "down", tint: 0xffe0d0 },
  ],
  spawn: { at: [10.5, 9], facing: "up" },
};
