import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { UIScene } from "./scenes/UIScene";
import { WorldScene } from "./world/WorldScene";
import { COLORS, FONT, HEIGHT, WIDTH, css } from "./theme";

// Phaser draws text to canvas, so the pixel font must be loaded before the first frame.
await document.fonts.load(`8px ${FONT}`);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: css(COLORS.night),
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { debug: false } },
  // Order matters: the UI scene renders on top of the world.
  scene: [BootScene, TitleScene, WorldScene, UIScene],
});

// Handle for scripts/playtest.ts (and curious players with devtools).
(window as unknown as { __game: Phaser.Game }).__game = game;
