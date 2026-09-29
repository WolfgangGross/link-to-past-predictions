import type { MapDef } from "../MapDef";

/** One row of buildings: the four-wide cafe at column 1, the twelve-wide school at column 7. */
const band = (cafe: string, school: string) => ` ${cafe}  ${school}`.padEnd(22);

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
    ...Array.from({ length: 6 }, () => "g".repeat(22)),
    "s".repeat(22),
    "_".repeat(22),
    `${"r".repeat(12)}##${"r".repeat(8)}`,
    `${"-r".repeat(6)}##${"-r".repeat(4)}`,
    "^".repeat(22),
    "s".repeat(22),
    "g".repeat(22),
  ],
  walls: [
    band("ABBC", `a${"b".repeat(10)}c`),
    band("DEEF", `d${"e".repeat(10)}f`),
    band("KLLM", `h${"i".repeat(10)}j`),
    band("QTTU", `k${"l".repeat(10)}m`),
    band("    ", `n${"o".repeat(10)}p`),
    band("    ", `q${"t".repeat(4)}  ${"t".repeat(4)}u`),
    ...Array.from({ length: 7 }, () => " ".repeat(22)),
  ],
  props: [
    // School windows and gate; cafe window, door and market stalls.
    ...[9, 11, 14, 16].map((x) => ({ sheet: "urban" as const, at: [x, 3] as const, tiles: [[281]], wall: true })),
    ...[9, 11, 14, 16].map((x) => ({ sheet: "urban" as const, at: [x, 4] as const, tiles: [[308]], wall: true })),
    { sheet: "urban", at: [12, 5], tiles: [[285, 285]] },
    { sheet: "urban", at: [1, 4], tiles: [[328, 329, 330, 332]], solid: true },
    { sheet: "urban", at: [2, 3], tiles: [[309]], wall: true },
    { sheet: "urban", at: [3, 3], tiles: [[283]], wall: true },
    // Roadworks on the road (old town side).
    { sheet: "urban", at: [1, 8], tiles: [[221, 222, 222, 223]], solid: true },
    // Street furniture and the tram stop sign.
    { sheet: "urban", at: [5, 5], tiles: [[164], [191]], solid: true },
    { sheet: "urban", at: [19, 5], tiles: [[164], [191]], solid: true },
    { sheet: "urban", at: [14, 11], tiles: [[270, 271]], solid: true },
    { sheet: "urban", at: [21, 8], tiles: [[166], [193]], solid: true },
    // Autumn trees.
    ...[2, 6, 10, 17].map((x) => ({ sheet: "urban" as const, at: [x, 11] as const, tiles: [[313], [340]], solid: true })),
    { sheet: "urban", at: [20, 1], tiles: [[313], [340]], solid: true },
    { sheet: "urban", at: [0, 5], tiles: [[313], [340]], solid: true },
  ],
  spots: [
    { id: "gate", at: [12, 5], size: [2, 1] },
    { id: "tram", at: [20, 10], size: [2, 2], trigger: "touch", exit: { label: "OFFICE", arrow: "right" } },
  ],
  npcs: [
    { id: "cafe", name: "Uwe", who: "sam", at: [3, 6], facing: "down" },
    { id: "nurse", name: "Nurse", who: "ada", at: [11, 6], facing: "down" },
    { id: "mia", name: "Mia", who: "mia", at: [13, 6.2], facing: "down", scale: 0.85 },
    { id: "worker", name: "Worker", who: "worker", at: [3, 9], facing: "up" },
  ],
  spawn: { at: [12, 11], facing: "up" },
};
