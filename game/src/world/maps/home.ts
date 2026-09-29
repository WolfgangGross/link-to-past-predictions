import type { MapDef } from "../MapDef";

// Open-plan flat: bedroom (top-left), kids' corner (top-right), kitchen (bottom-left), living (bottom-right).
export const home: MapDef = {
  key: "home",
  legend: {
    "┌": ["rpg", 700],
    "─": ["rpg", 698],
    "┐": ["rpg", 701],
    "│": ["rpg", 756],
    "└": ["rpg", 757],
    "┘": ["rpg", 758],
    U: ["rpg", 873],
    W: ["rpg", 868],
    ".": ["rpg", 119],
    ",": ["rpg", 120],
  },
  floor: [
    ...Array.from({ length: 3 }, () => " ".repeat(18)),
    ...Array.from({ length: 5 }, () => ` ${".".repeat(16)} `),
    ...Array.from({ length: 2 }, () => ` ${",".repeat(7)}${".".repeat(9)} `),
    `${" ".repeat(9)}.${" ".repeat(8)}`,
  ],
  walls: [
    `┌${"─".repeat(16)}┐`,
    `│${"U".repeat(16)}│`,
    `│${"W".repeat(16)}│`,
    ...Array.from({ length: 7 }, () => `│${" ".repeat(16)}│`),
    `└${"─".repeat(8)} ${"─".repeat(7)}┘`,
  ],
  props: [
    // The weather window is drawn by WeatherWindow; the door leads out to the school run.
    { sheet: "indoor", at: [3, 1], tiles: [[341]], wall: true },
    { sheet: "indoor", at: [13, 1], tiles: [[341]], wall: true },
    { sheet: "urban", at: [9, 10], tiles: [[283]], wall: true },
    // Bedroom: double bed, nightstand (with the phone), wardrobe.
    { sheet: "indoor", at: [1, 3], tiles: [[13, 12], [40, 39]], solid: true },
    { sheet: "indoor", at: [3, 3], tiles: [[5]], solid: true },
    { sheet: "indoor", at: [5, 3], tiles: [[363, 364], [390, 391]], solid: true },
    // Kids' corner: Mia's and Leo's beds, a toy chest.
    { sheet: "indoor", at: [11, 3], tiles: [[9, 8]], solid: true },
    { sheet: "indoor", at: [15, 3], tiles: [[63, 62]], solid: true },
    { sheet: "indoor", at: [13, 3], tiles: [[82]], solid: true },
    // Middle: dining table with two chairs.
    { sheet: "indoor", at: [8, 6], tiles: [[243, 244, 245]], solid: true },
    { sheet: "indoor", at: [7, 6], tiles: [[84]], solid: true },
    { sheet: "indoor", at: [11, 6], tiles: [[83]], solid: true },
    // Kitchen: fridge, counters, stove.
    { sheet: "indoor", at: [1, 8], tiles: [[416], [443]], solid: true },
    { sheet: "indoor", at: [2, 8], tiles: [[324, 332, 356, 331, 325]], solid: true },
    { sheet: "indoor", at: [7, 8], tiles: [[392]], solid: true },
    // Living: bookshelf, desk with the home laptop, plant.
    { sheet: "indoor", at: [12, 8], tiles: [[320, 321], [347, 348]], solid: true },
    { sheet: "indoor", at: [15, 9], tiles: [[139, 140]], solid: true },
    { sheet: "indoor", at: [16, 8], tiles: [[16]], solid: true },
  ],
  windows: [{ at: [8, 1], size: [2, 2] }],
  phone: [3, 3],
  spots: [
    { id: "nightstand", at: [3, 3] },
    { id: "window", at: [8, 1], size: [2, 2] },
    { id: "wardrobe", at: [5, 3], size: [2, 2] },
    { id: "desk", at: [15, 9], size: [2, 1] },
    { id: "bookshelf", at: [12, 8], size: [2, 2] },
    { id: "fridge", at: [1, 8], size: [1, 2] },
    { id: "door", at: [9, 10], trigger: "touch", exit: { label: "SCHOOL", arrow: "down" } },
  ],
  npcs: [
    { id: "charles", name: "Charles", who: "sam", at: [4, 9], facing: "up" },
    { id: "mia", name: "Mia", who: "mia", at: [11.6, 5], facing: "down", scale: 0.85 },
    { id: "leo", name: "Leo", who: "leo", at: [15.6, 2.8], facing: "down", scale: 0.75 },
  ],
  spawn: { at: [4, 5], facing: "down" },
};

// The same flat in the evening: dinner, the day's results, and bed.
export const evening: MapDef = {
  ...home,
  key: "evening",
  // The front door is shut for the night, and the window shows it. The phone is in Ada's pocket.
  props: [...home.props, { sheet: "urban", at: [9, 10], tiles: [[283]], solid: true }],
  phone: undefined,
  spots: [
    ...home.spots.filter((s) => s.id !== "door" && s.id !== "nightstand"),
    { id: "bed", at: [1, 3], size: [2, 2] },
  ],
  npcs: [
    { id: "charles", name: "Charles", who: "sam", at: [7, 5.9], facing: "right" },
    { id: "mia", name: "Mia", who: "mia", at: [11, 5.9], facing: "left", scale: 0.85 },
    { id: "leo", name: "Leo", who: "leo", at: [9, 7.5], facing: "up", scale: 0.75 },
  ],
  spawn: { at: [13, 6], facing: "up" },
};
