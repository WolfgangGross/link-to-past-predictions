import type * as Phaser from "phaser";

export const WIDTH = 640;
export const HEIGHT = 360;
export const TILE = 16;
export const WORLD_ZOOM = 2;

export const FONT = '"Press Start 2P", monospace';

export const COLORS = {
  night: 0x0e0e12,
  ink: 0x1b1b2a,
  paper: 0xf4ecd8,
  muted: 0x9a95a8,
  accent: 0xf2c14e,
  rain: 0x6fa8dc,
  danger: 0xe07a5f,
  good: 0x81b29a,
  phoneBody: 0x22222e,
  phoneScreen: 0x101820,
};

export const css = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

export function textStyle(size = 8, color = COLORS.paper, wrapWidth?: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: css(color),
    lineSpacing: 6,
    wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
  };
}
