import * as Phaser from "phaser";
import { HEIGHT, WIDTH, textStyle } from "../theme";
import { CONFIRM, nextKey } from "./keys";

// Tokyo Night, Omarchy's default theme.
const T = { bg: 0x1a1b26, panel: 0x16161e, fg: 0xc0caf5, dim: 0x565f89, blue: 0x7aa2f7, green: 0x9ece6a, orange: 0xff9e64, border: 0x414868 };

export interface TermLine {
  text: string;
  win?: "left" | "right";
  color?: keyof typeof T;
  /** Type the line out like a command. */
  typed?: boolean;
  pause?: number;
}

const GAP = 8;
const BAR = 16;

/** Full-screen Omarchy desktop: a waybar and two tiled Hyprland windows. */
export class Terminal {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly panes: Record<"left" | "right", { x: number; y: number; w: number; h: number; lines: Phaser.GameObjects.Text[] }>;
  isOpen = false;
  /** For the playtest script: all lines printed, waiting for SPACE. */
  waiting = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const g = scene.add.graphics();
    g.fillStyle(T.bg, 1).fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(T.panel, 1).fillRect(0, 0, WIDTH, BAR);
    const leftW = Math.round((WIDTH - GAP * 3) * 0.58);
    const rightW = WIDTH - GAP * 3 - leftW;
    const top = BAR + GAP;
    const h = HEIGHT - top - GAP;
    g.lineStyle(2, T.blue, 1).strokeRect(GAP, top, leftW, h);
    g.lineStyle(2, T.border, 1).strokeRect(GAP * 2 + leftW, top, rightW, h);
    const bar = [
      scene.add.text(8, 4, "1  2  3", textStyle(8, T.blue)),
      scene.add.text(WIDTH / 2, 4, "omarchy", textStyle(8, T.dim)).setOrigin(0.5, 0),
      scene.add.text(WIDTH - 8, 4, "09:02   100%", textStyle(8, T.fg)).setOrigin(1, 0),
    ];
    this.panes = {
      left: { x: GAP + 8, y: top + 8, w: leftW - 16, h: h - 16, lines: [] },
      right: { x: GAP * 2 + leftW + 8, y: top + 8, w: rightW - 16, h: h - 16, lines: [] },
    };
    this.root = scene.add.container(0, 0, [g, ...bar]).setDepth(110).setVisible(false);
  }

  async play(script: TermLine[]): Promise<void> {
    for (const pane of Object.values(this.panes)) {
      pane.lines.forEach((l) => l.destroy());
      pane.lines = [];
    }
    this.isOpen = true;
    this.root.setVisible(true).setAlpha(0);
    await this.tween({ alpha: 1 }, 250);
    for (const line of script) await this.print(line);
    const hint = this.scene.add.text(WIDTH - 16, HEIGHT - 20, "SPACE", textStyle(8, T.dim)).setOrigin(1, 0);
    this.root.add(hint);
    this.waiting = true;
    await nextKey(this.scene, CONFIRM);
    this.waiting = false;
    hint.destroy();
    await this.tween({ alpha: 0 }, 250);
    this.root.setVisible(false);
    this.isOpen = false;
  }

  private async print(line: TermLine): Promise<void> {
    const pane = this.panes[line.win ?? "left"];
    const y = pane.y + pane.lines.reduce((sum, l) => sum + l.height + 4, 0);
    const text = this.scene.add.text(pane.x, y, "", textStyle(8, T[line.color ?? "fg"], pane.w));
    this.root.add(text);
    pane.lines.push(text);
    // Scroll: drop the oldest lines when the pane is full.
    while (pane.lines.length > 1 && text.y + 24 > pane.y + pane.h) {
      const first = pane.lines.shift()!;
      const dy = first.height + 4;
      first.destroy();
      pane.lines.forEach((l) => (l.y -= dy));
    }
    if (line.typed) {
      for (let i = 1; i <= line.text.length; i++) {
        text.setText(line.text.slice(0, i));
        await this.wait(28);
      }
    } else {
      text.setText(line.text);
    }
    await this.wait(line.pause ?? (line.typed ? 350 : 140));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  private tween(props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) => this.scene.tweens.add({ targets: this.root, ...props, duration, onComplete: () => resolve() }));
  }
}
