import * as Phaser from "phaser";

export type Sky = "sun" | "clouds" | "rain" | "thunder" | "night";

const PALETTE: Record<Sky, number> = { sun: 0x8ecae6, clouds: 0xa9b4c0, rain: 0x6f8296, thunder: 0x3b4159, night: 0x14172b };
const FRAME = 0x7a4f2a;
const FRAME_LIGHT = 0xa9743f;

/** A window that shows the weather: a few pixel shapes redrawn ten times a second, clipped to the glass by construction. */
export class WeatherWindow {
  private readonly g: Phaser.GameObjects.Graphics;
  private sky: Sky = "clouds";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly w: number,
    private readonly h: number,
  ) {
    this.g = scene.add.graphics().setDepth(1);
    const timer = scene.time.addEvent({ delay: 100, loop: true, callback: () => this.draw() });
    scene.events.once("shutdown", () => timer.remove());
    this.draw();
  }

  set(sky: Sky): void {
    if (sky === this.sky) return;
    this.sky = sky;
    this.draw();
  }

  private draw(): void {
    const { g, x, y, w, h, sky } = this;
    const t = this.scene.time.now;
    const pad = 3;
    const ix = x + pad;
    const iy = y + pad;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    g.clear();

    const flash = sky === "thunder" && t % 3200 < 160;
    g.fillStyle(flash ? 0xf4f1d0 : PALETTE[sky]).fillRect(ix, iy, iw, ih);

    if (sky === "sun") {
      const cx = ix + iw * 0.68;
      const cy = iy + ih * 0.32;
      const pulse = Math.floor(t / 400) % 2;
      g.fillStyle(0xffe27a);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + (pulse ? Math.PI / 8 : 0);
        g.fillRect(Math.round(cx + Math.cos(a) * 7) - 1, Math.round(cy + Math.sin(a) * 7) - 1, 2, 2);
      }
      g.fillStyle(0xffd23f).fillCircle(cx, cy, 4.5);
      this.cloud(ix + 2, iy + ih - 8, 0xffffff, 0.7);
    } else if (sky === "clouds") {
      this.cloud(ix + 1 + ((t / 900) % 3), iy + 3, 0xffffff, 1);
      this.cloud(ix + iw * 0.35, iy + ih * 0.5, 0xdfe5ea, 1);
    } else if (sky === "night") {
      g.fillStyle(0xf4ecd8);
      for (const [sx, sy] of [[3, 3], [16, 6], [9, 12], [19, 17], [5, 19]]) g.fillRect(ix + sx, iy + sy, 1, 1);
      g.fillStyle(0xf4ecd8).fillCircle(ix + iw * 0.66, iy + ih * 0.3, 4);
      g.fillStyle(PALETTE.night).fillCircle(ix + iw * 0.66 + 2, iy + ih * 0.3 - 1, 3.5);
    } else {
      const dark = sky === "thunder";
      this.cloud(ix, iy + 1, dark ? 0x565d78 : 0x8894a3, 1);
      this.cloud(ix + iw * 0.4, iy + 3, dark ? 0x4a5069 : 0x7a8797, 1);
      const drops = dark ? 14 : 9;
      g.fillStyle(dark ? 0x9fc3e8 : 0xb8d8f2);
      for (let i = 0; i < drops; i++) {
        const dx = (i * 37 + 5) % iw;
        const dy = ((i * 53 + t / (dark ? 9 : 14)) % (ih - 10)) + 8;
        g.fillRect(ix + dx, iy + dy, 1, dark ? 3 : 2);
      }
      if (flash) {
        g.fillStyle(0xfff36b);
        g.fillRect(ix + 12, iy + 8, 2, 4).fillRect(ix + 10, iy + 12, 2, 3).fillRect(ix + 12, iy + 15, 2, 4);
      }
    }

    // Frame and mullions, over the glass.
    g.lineStyle(3, FRAME).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    g.fillStyle(FRAME).fillRect(x + w / 2 - 1, iy, 2, ih).fillRect(ix, y + h / 2 - 1, iw, 2);
    g.fillStyle(FRAME_LIGHT).fillRect(x, y, w, 1).fillRect(x - 2, y + h, w + 4, 2);
  }

  private cloud(x: number, y: number, color: number, scale: number): void {
    this.g.fillStyle(color);
    this.g.fillRect(x, y + 3 * scale, 13 * scale, 3 * scale);
    this.g.fillCircle(x + 4 * scale, y + 3 * scale, 3 * scale);
    this.g.fillCircle(x + 8 * scale, y + 2 * scale, 3.5 * scale);
  }
}
