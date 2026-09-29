import type * as Phaser from "phaser";
import { WIDTH } from "../theme";
import { MONO } from "../theme";

// Text drawn into the 640x360 canvas is resampled when the canvas is scaled up, which smears small glyphs.
// The developer-tool surfaces (network panel, desktop) are HTML laid over the canvas instead: crisp at any size.
// All sizes are in game pixels: `calc(var(--k) * Npx)`, where --k is the canvas scale.

const STYLE = `
.gm-overlay { position: fixed; z-index: 10; box-sizing: border-box; font-family: ${MONO}; color: #c0caf5; background: #1a1b26;
  font-size: calc(var(--k) * 8px); line-height: 1.35; white-space: pre; overflow: hidden; -webkit-font-smoothing: antialiased; }
.gm-overlay .b { font-weight: 700; }
.gm-overlay .c-fg { color: #c0caf5 } .gm-overlay .c-dim { color: #6b74a0 } .gm-overlay .c-blue { color: #7aa2f7 }
.gm-overlay .c-green { color: #9ece6a } .gm-overlay .c-orange { color: #ff9e64 } .gm-overlay .c-red { color: #f7768e } .gm-overlay .c-teal { color: #73daca }
`;

let injected = false;

/** Creates a fixed-position element that tracks a rectangle of the game canvas (game pixel coordinates). */
export function createOverlay(scene: Phaser.Scene, box: { x: number; y: number; w: number; h: number }): { el: HTMLDivElement; place: () => number } {
  if (!injected) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);
    injected = true;
  }
  const el = document.createElement("div");
  el.className = "gm-overlay";
  el.style.display = "none";
  document.body.append(el);
  const place = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    const k = r.width / WIDTH;
    Object.assign(el.style, {
      left: `${r.left + box.x * k}px`,
      top: `${r.top + box.y * k}px`,
      width: `${box.w * k}px`,
      height: `${box.h * k}px`,
    });
    el.style.setProperty("--k", String(k));
    return k;
  };
  window.addEventListener("resize", place);
  scene.scale.on("resize", place);
  scene.events.once("shutdown", () => el.remove());
  place();
  return { el, place };
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
