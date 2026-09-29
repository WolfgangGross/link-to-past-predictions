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
    ...Array.from({ length: 8 }, () => "g".repeat(16)),
    "^".repeat(16),
    "s".repeat(16),
  ],
  walls: Array.from({ length: 10 }, () => " ".repeat(16)),
  props: [
    // Goals (rope barriers) and benches, trees around the pitch.
    { sheet: "urban", at: [0, 3], tiles: [[217], [217], [217]], solid: true },
    { sheet: "urban", at: [15, 3], tiles: [[217], [217], [217]], solid: true },
    { sheet: "urban", at: [4, 7], tiles: [[270, 271]], solid: true },
    { sheet: "urban", at: [10, 7], tiles: [[270, 271]], solid: true },
    ...[3, 12].map((x) => ({ sheet: "urban" as const, at: [x, 0] as const, tiles: [[313], [340]], solid: true })),
  ],
  markings: {
    rects: [[1, 2, 14, 5], [1, 3.2, 2, 2.6], [13, 3.2, 2, 2.6]],
    lines: [[8, 2, 8, 7]],
    circles: [[8, 4.5, 1.3]],
  },
  spots: [{ id: "leave", at: [0, 8], size: [2, 2], trigger: "touch", exit: { label: "HOME", arrow: "left" } }],
  npcs: [
    { id: "mia", name: "Mia", who: "mia", at: [6, 6.4], facing: "down", scale: 0.85 },
    { id: "physio", name: "Physio", who: "sam", at: [7.5, 6.4], facing: "left", tint: 0xffd0d0 },
    { id: "coach", name: "Coach", who: "elder", at: [11, 6], facing: "left", tint: 0xd0ffd0 },
    { id: "kid1", name: "Kid", who: "leo", at: [4, 4.5], facing: "right", scale: 0.8, tint: 0xd0ffd0 },
    { id: "kid2", name: "Kid", who: "mia", at: [12, 3.5], facing: "left", scale: 0.8, tint: 0xffe0a0 },
    { id: "kid3", name: "Kid", who: "leo", at: [13, 5.5], facing: "left", scale: 0.8, tint: 0xffe0a0 },
  ],
  spawn: { at: [8, 8.5], facing: "up" },
};
