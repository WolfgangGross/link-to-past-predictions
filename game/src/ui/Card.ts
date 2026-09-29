import * as Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH, textStyle } from "../theme";
import { CONFIRM, nextKey } from "./keys";
import type { JudgmentCard } from "../state";

const W = 520;
const H = 300;

/** The Judgment Card: the book's five questions, answered for the decision just made. */
export class CardView {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  isOpen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.night, 0.6).fillRect(-(WIDTH - W) / 2, -(HEIGHT - H) / 2, WIDTH, HEIGHT);
    bg.fillStyle(COLORS.paper, 1).fillRoundedRect(0, 0, W, H, 8);
    bg.lineStyle(3, COLORS.accent, 1).strokeRoundedRect(2, 2, W - 4, H - 4, 8);
    this.body = scene.add.container(20, 18);
    this.root = scene.add.container((WIDTH - W) / 2, (HEIGHT - H) / 2, [bg, this.body]).setDepth(120).setVisible(false);
  }

  async show(card: JudgmentCard): Promise<void> {
    this.body.removeAll(true);
    const add = (y: number, text: string, color: number, size = 8, wrap = W - 40) =>
      this.body.add(this.scene.add.text(0, y, text, textStyle(size, color, wrap)));
    add(0, "JUDGMENT CARD", COLORS.danger);
    add(18, card.title, COLORS.ink, 16);
    const rows: [string, string][] = [
      ["If it's a miss", card.falseNegative],
      ["If it's a false alarm", card.falsePositive],
      ["Who bears it", card.whoBears],
      ["Who decides", card.whoDecides],
      ["The old rule", card.oldRule],
    ];
    rows.forEach(([label, value], i) => {
      const y = 52 + i * 38;
      add(y, label.toUpperCase(), COLORS.muted);
      add(y + 14, value, COLORS.ink);
    });
    add(H - 34, "The phone predicted. You chose the line.          SPACE", COLORS.muted);
    this.isOpen = true;
    this.root.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 150 });
    await nextKey(this.scene, CONFIRM);
    this.root.setVisible(false);
    this.isOpen = false;
  }
}
