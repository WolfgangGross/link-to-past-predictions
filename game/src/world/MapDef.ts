import type { Character, Facing, Sheet, TileRef } from "./tiles";

export type Cell = readonly [number, number]; // [col, row] in tiles

/** A block of tiles from one sheet placed at a cell; null leaves a hole. */
export interface Prop {
  sheet: Sheet;
  at: Cell;
  tiles: (number | null)[][];
  /** Solid props block movement. Wall props (windows, pictures) are drawn over the wall layer. */
  solid?: boolean;
  wall?: boolean;
  /** Drawn above furniture (a monitor on a desk). Implies nothing about collision. */
  top?: boolean;
}

/** An area the player can interact with (facing it + confirm) or trigger by walking in. */
export interface Spot {
  id: string;
  at: Cell;
  size?: Cell;
  trigger?: "interact" | "touch";
  /** Exit marker: a bobbing arrow (pointing this way) with a caption, drawn over a touch spot. */
  exit?: { label: string; arrow: "down" | "left" | "right" };
}

export interface NpcDef {
  id: string;
  /** Shown as a name tag above the head. */
  name: string;
  who: Character;
  at: Cell;
  facing: Facing;
  scale?: number;
  /** Multiplies the sprite colours; the urban pack has only six people. */
  tint?: number;
}

export interface MapDef {
  key: string;
  legend: Record<string, TileRef>;
  /** ASCII layers, one char per tile. Space = empty. */
  floor: string[];
  walls: string[];
  props: Prop[];
  spots: Spot[];
  npcs: NpcDef[];
  spawn: { at: Cell; facing: Facing };
  /** Windows that show the sky (sun, clouds, rain, thunder or night) instead of a static tile. */
  /** Where the Phone of Priors glows until Ada picks it up. */
  phone?: Cell;
  windows?: { at: Cell; size: Cell }[];
  /** White pitch markings in tile units: lines [x1, y1, x2, y2], circles [x, y, r], rects [x, y, w, h]. */
  markings?: { lines?: number[][]; circles?: number[][]; rects?: number[][] };
}
