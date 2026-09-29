import * as Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH, textStyle } from "../theme";
import { CONFIRM, nextKey } from "./keys";
import { sfx } from "../audio";

export interface ReportPage {
  title: string;
  /** [label, value] rows, or plain paragraphs when label is empty. */
  rows: [string, string][];
}

/** The end-of-day report: full-screen pages on paper. */
export class ReportView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  isOpen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.night, 1).fillRect(0, 0, WIDTH, HEIGHT);
    bg.fillStyle(COLORS.paper, 1).fillRoundedRect(24, 16, WIDTH - 48, HEIGHT - 32, 8);
    bg.lineStyle(3, COLORS.accent, 1).strokeRoundedRect(26, 18, WIDTH - 52, HEIGHT - 36, 8);
    this.body = scene.add.container(48, 34);
    this.root = scene.add.container(0, 0, [bg, this.body]).setDepth(130).setVisible(false);
  }

  async show(pages: ReportPage[]): Promise<void> {
    this.isOpen = true;
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 300 });
    for (const [i, page] of pages.entries()) {
      sfx.page();
      this.render(page, `${i + 1}/${pages.length}   SPACE`);
      await nextKey(this.scene, CONFIRM);
    }
    this.root.setVisible(false);
    this.isOpen = false;
  }

  private render(page: ReportPage, footer: string): void {
    this.body.removeAll(true);
    const w = WIDTH - 96;
    const add = (x: number, y: number, text: string, color: number, size = 8, wrap = w) => {
      const t = this.scene.add.text(x, y, text, textStyle(size, color, wrap));
      this.body.add(t);
      return t;
    };
    add(0, 0, page.title, COLORS.danger, 16);
    let y = 30;
    for (const [label, value] of page.rows) {
      if (label) {
        add(0, y, label.toUpperCase(), COLORS.muted);
        y += 13 + add(0, y + 13, value, COLORS.ink).height + 9;
      } else {
        y += add(0, y, value, COLORS.ink).height + 10;
      }
    }
    add(w, HEIGHT - 70, footer, COLORS.muted).setOrigin(1, 0);
  }
}
