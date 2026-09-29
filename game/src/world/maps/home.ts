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
    "                        ",
    "                        ",
    "                        ",
    " ...................... ",
    " ...................... ",
    " ...................... ",
    " ...................... ",
    " ...................... ",
    " ...................... ",
    " ,,,,,,,,,............. ",
    " ,,,,,,,,,............. ",
    " ,,,,,,,,,............. ",
    " ,,,,,,,,,............. ",
    " ,,,,,,,,,............. ",
    "           ..           ",
  ],
  walls: [
    "┌──────────────────────┐",
    "│UUUUUUUUUUUUUUUUUUUUUU│",
    "│WWWWWWWWWWWWWWWWWWWWWW│",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "│                      │",
    "└──────────  ──────────┘",
  ],
  props: [
    // Windows and a picture on the back wall.
    { sheet: "rpg", at: [4, 1], tiles: [[158], [215]], wall: true },
    { sheet: "rpg", at: [12, 1], tiles: [[158], [215]], wall: true },
    { sheet: "rpg", at: [19, 1], tiles: [[158], [215]], wall: true },
    { sheet: "indoor", at: [8, 1], tiles: [[341]], wall: true },
    // Bedroom: double bed, nightstand, wardrobe.
    { sheet: "indoor", at: [1, 3], tiles: [[13, 12], [40, 39]], solid: true },
    { sheet: "indoor", at: [3, 3], tiles: [[5]], solid: true },
    { sheet: "indoor", at: [7, 3], tiles: [[363, 364], [390, 391]], solid: true },
    // Kids' corner: Mia's and Leo's beds, a toy chest.
    { sheet: "indoor", at: [16, 3], tiles: [[9, 8]], solid: true },
    { sheet: "indoor", at: [20, 3], tiles: [[63, 62]], solid: true },
    { sheet: "indoor", at: [18, 3], tiles: [[82]], solid: true },
    // Kitchen: fridge, counters, stove, dining table.
    { sheet: "indoor", at: [1, 9], tiles: [[416], [443]], solid: true },
    { sheet: "indoor", at: [3, 9], tiles: [[324, 332, 356, 331, 325]], solid: true },
    { sheet: "indoor", at: [8, 9], tiles: [[392]], solid: true },
    { sheet: "indoor", at: [3, 12], tiles: [[243, 244, 245]], solid: true },
    { sheet: "indoor", at: [2, 12], tiles: [[84]], solid: true },
    { sheet: "indoor", at: [6, 12], tiles: [[83]], solid: true },
    // Living: bookshelf, bench, desk with the home laptop, plants.
    { sheet: "indoor", at: [14, 9], tiles: [[320, 321], [347, 348]], solid: true },
    { sheet: "indoor", at: [17, 11], tiles: [[166, 167, 168]], solid: true },
    { sheet: "indoor", at: [20, 12], tiles: [[139, 140]], solid: true },
    { sheet: "indoor", at: [22, 9], tiles: [[16]], solid: true },
    { sheet: "indoor", at: [13, 13], tiles: [[17]], solid: true },
  ],
  spots: [
    { id: "nightstand", at: [3, 3] },
    { id: "window", at: [4, 1], size: [1, 2] },
    { id: "wardrobe", at: [7, 3], size: [2, 2] },
    { id: "desk", at: [20, 12], size: [2, 1] },
    { id: "fridge", at: [1, 9], size: [1, 2] },
    { id: "door", at: [11, 14], size: [2, 1], trigger: "touch" },
  ],
  npcs: [
    { id: "sam", who: "sam", at: [5, 10.4], facing: "up" },
    { id: "mia", who: "mia", at: [17, 5], facing: "down", scale: 0.85 },
    { id: "leo", who: "leo", at: [20.6, 2.8], facing: "down", scale: 0.75 },
  ],
  spawn: { at: [3, 5], facing: "down" },
};

// The same flat in the evening: dinner, the day's results, and bed.
export const evening: MapDef = {
  ...home,
  key: "evening",
  spots: [
    ...home.spots.filter((s) => s.id !== "door" && s.id !== "nightstand"),
    { id: "bed", at: [1, 3], size: [2, 2] },
  ],
  npcs: [
    { id: "sam", who: "sam", at: [3.5, 11.4], facing: "right" },
    { id: "mia", who: "mia", at: [18, 12.4], facing: "down", scale: 0.85 },
    { id: "leo", who: "leo", at: [19.5, 12.4], facing: "down", scale: 0.75 },
  ],
  spawn: { at: [11.5, 12.5], facing: "up" },
};
