import type { MapDef } from "../MapDef";

// The pitch behind the school: Mia's final.
export const field: MapDef = {
  key: "field",
  legend: {
    g: ["urban", 28],
    s: ["urban", 36],
    "^": ["urban", 9],
  },
  floor: [
    ...Array.from({ length: 13 }, () => "g".repeat(28)),
    "^".repeat(28),
    "s".repeat(28),
  ],
  walls: Array.from({ length: 15 }, () => " ".repeat(28)),
  props: [
    // Goals (rope barriers) and benches, trees around the pitch.
    { sheet: "urban", at: [0, 5], tiles: [[217], [217], [217]], solid: true },
    { sheet: "urban", at: [27, 5], tiles: [[217], [217], [217]], solid: true },
    { sheet: "urban", at: [9, 12], tiles: [[270, 271]], solid: true },
    { sheet: "urban", at: [16, 12], tiles: [[270, 271]], solid: true },
    ...[2, 7, 20, 25].map((x) => ({ sheet: "urban" as const, at: [x, 0] as const, tiles: [[313], [340]], solid: true })),
  ],
  markings: {
    rects: [[1, 2, 26, 9], [1, 4, 3, 5], [24, 4, 3, 5]],
    lines: [[14, 2, 14, 11]],
    circles: [[14, 6.5, 1.6]],
  },
  spots: [{ id: "leave", at: [0, 13], size: [2, 2], trigger: "touch" }],
  npcs: [
    { id: "mia", who: "mia", at: [12, 10.5], facing: "down", scale: 0.85 },
    { id: "physio", who: "sam", at: [13.5, 10.5], facing: "left", tint: 0xffd0d0 },
    { id: "coach", who: "elder", at: [16, 11], facing: "left", tint: 0xd0ffd0 },
    { id: "kid1", who: "leo", at: [6, 6], facing: "right", scale: 0.8, tint: 0xd0ffd0 },
    { id: "kid2", who: "mia", at: [20, 5], facing: "left", scale: 0.8, tint: 0xffe0a0 },
    { id: "kid3", who: "leo", at: [22, 8], facing: "left", scale: 0.8, tint: 0xffe0a0 },
  ],
  spawn: { at: [13, 13.5], facing: "up" },
};
