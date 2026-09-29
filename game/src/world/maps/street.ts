import type { MapDef } from "../MapDef";

// School street: school and gate café at the top, the road with roadworks, the tram stop on the right.
export const street: MapDef = {
  key: "street",
  legend: {
    // urban pack
    s: ["urban", 36], // pavement
    "^": ["urban", 9], // pavement, kerb on top
    _: ["urban", 63], // pavement, kerb below
    r: ["urban", 406], // asphalt
    "-": ["urban", 433], // lane marking
    "#": ["urban", 435], // zebra crossing
    g: ["urban", 28], // grass
    // school roof (grey) and red brick facade
    a: ["urban", 89],
    b: ["urban", 90],
    c: ["urban", 91],
    d: ["urban", 116],
    e: ["urban", 117],
    f: ["urban", 118],
    h: ["urban", 143],
    i: ["urban", 144],
    j: ["urban", 145],
    k: ["urban", 16],
    l: ["urban", 17],
    m: ["urban", 19],
    n: ["urban", 43],
    o: ["urban", 44],
    p: ["urban", 46],
    q: ["urban", 97],
    t: ["urban", 98],
    u: ["urban", 100],
    // cafe roof (beige) and orange facade
    A: ["urban", 81],
    B: ["urban", 82],
    C: ["urban", 83],
    D: ["urban", 135],
    E: ["urban", 136],
    F: ["urban", 137],
    K: ["urban", 124],
    L: ["urban", 125],
    M: ["urban", 127],
    Q: ["urban", 205],
    T: ["urban", 206],
    U: ["urban", 208],
  },
  floor: [
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
    "ssssssssssssssssssssssssssssssssssssssss",
    "________________________________________",
    "rrrrrrrrrrrrrrrrrrrrrrr##rrrrrrrrrrrrrrr",
    "-r-r-r-r-r-r-r-r-r-r-r-##r-r-r-r-r-r-r-r",
    "rrrrrrrrrrrrrrrrrrrrrrr##rrrrrrrrrrrrrrr",
    "^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
    "ssssssssssssssssssssssssssssssssssssssss",
    "gggggggggggggggggggggggggggggggggggggggg",
    "gggggggggggggggggggggggggggggggggggggggg",
  ],
  walls: [
    "      ABBBBC  abbbbbbbbbbbbbbbbbbbc     ",
    "      DEEEEF  deeeeeeeeeeeeeeeeeeef     ",
    "      KLLLLM  hiiiiiiiiiiiiiiiiiiij     ",
    "      QTTTTU  klllllllllllllllllllm     ",
    "              nooooooooooooooooooop     ",
    "              qtttttttt  tttttttttu     ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
  ],
  props: [
    // School windows and doors.
    ...[16, 18, 20, 26, 28, 30].map((x) => ({ sheet: "urban" as const, at: [x, 3] as const, tiles: [[281]], wall: true })),
    ...[16, 18, 20, 26, 28, 30].map((x) => ({ sheet: "urban" as const, at: [x, 4] as const, tiles: [[308]], wall: true })),
    { sheet: "urban", at: [23, 5], tiles: [[285, 285]] },
    // Cafe awning and window.
    { sheet: "urban", at: [6, 4], tiles: [[328, 329, 329, 330, 331, 332]], solid: true },
    { sheet: "urban", at: [8, 3], tiles: [[309]], wall: true },
    // Roadworks on the road (old town side).
    { sheet: "urban", at: [3, 8], tiles: [[221, 222, 222, 222, 223]], solid: true },
    { sheet: "urban", at: [3, 10], tiles: [[221, 222, 222, 222, 223]], solid: true },
    // Street furniture.
    { sheet: "urban", at: [12, 5], tiles: [[164], [191]], solid: true },
    { sheet: "urban", at: [34, 5], tiles: [[164], [191]], solid: true },
    { sheet: "urban", at: [14, 12], tiles: [[270, 271]], solid: true },
    { sheet: "urban", at: [38, 13], tiles: [[168], [195]], solid: true },
    // Autumn trees.
    ...[2, 6, 10, 30, 34].map((x) => ({ sheet: "urban" as const, at: [x, 13] as const, tiles: [[313], [340]], solid: true })),
    { sheet: "urban", at: [36, 1], tiles: [[313], [340]], solid: true },
    { sheet: "urban", at: [2, 2], tiles: [[313], [340]], solid: true },
  ],
  spots: [
    { id: "gate", at: [23, 5], size: [2, 1] },
    { id: "tram", at: [38, 11], size: [2, 2], trigger: "touch" },
  ],
  npcs: [
    { id: "cafe", who: "sam", at: [8, 6], facing: "down" },
    { id: "nurse", who: "elder", at: [22, 6], facing: "down" },
    { id: "mia", who: "mia", at: [24, 6.2], facing: "down", scale: 0.85 },
    { id: "worker", who: "worker", at: [5, 9], facing: "right" },
  ],
  spawn: { at: [23.5, 12], facing: "up" },
};
