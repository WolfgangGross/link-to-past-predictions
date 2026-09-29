// Kenney CC0 sheets, all 16×16. A tile is addressed as [sheet, index] with the index counted row-major from 0.

export const SHEETS = {
  rpg: { url: "assets/kenney/rpg.png", columns: 57, count: 57 * 31, spacing: 1 },
  indoor: { url: "assets/kenney/indoor.png", columns: 27, count: 27 * 18, spacing: 1 },
  urban: { url: "assets/kenney/urban.png", columns: 27, count: 27 * 18, spacing: 0 },
} as const;

export type Sheet = keyof typeof SHEETS;
export type TileRef = readonly [Sheet, number];

const ORDER: Sheet[] = ["rpg", "indoor", "urban"];

/** First global id of each sheet when all three are attached to one Phaser tilemap. */
export const FIRST_GID: Record<Sheet, number> = (() => {
  const out = {} as Record<Sheet, number>;
  let next = 1;
  for (const s of ORDER) {
    out[s] = next;
    next += SHEETS[s].count;
  }
  return out;
})();

export const gid = ([sheet, index]: TileRef): number => FIRST_GID[sheet] + index;

export const SHEET_ORDER = ORDER;

// ---- Characters (RPG Urban Pack): 6 people × 3 rows (idle, walk A, walk B) × 4 facings.
export type Facing = "left" | "down" | "up" | "right";
const FACING_COL: Record<Facing, number> = { left: 0, down: 1, up: 2, right: 3 };

export const CHARACTERS = {
  mia: 0, // red hair, green shirt
  ada: 1, // long brown hair, red shirt
  elder: 2, // grey hair
  worker: 3, // hard hat
  sam: 4, // bald, grey shirt
  leo: 5, // dark hair
} as const;
export type Character = keyof typeof CHARACTERS;

export function charFrame(who: Character, facing: Facing, step: 0 | 1 | 2 = 0): number {
  return (CHARACTERS[who] * 3 + step) * 27 + 23 + FACING_COL[facing];
}
