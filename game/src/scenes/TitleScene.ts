import * as Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH, textStyle } from "../theme";
import { CONFIRM, nextKey } from "../ui/keys";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    const cx = WIDTH / 2;
    this.add.text(cx, 96, "A LINK TO", textStyle(8, COLORS.muted)).setOrigin(0.5);
    this.add.text(cx, 124, "PAST PREDICTIONS", textStyle(24, COLORS.accent)).setOrigin(0.5);
    this.add
      .text(cx, 170, "A day of predictions, and the judgment they need.", textStyle(8, COLORS.paper))
      .setOrigin(0.5);
    const start = this.add.text(cx, 236, "PRESS SPACE", textStyle(8, COLORS.paper)).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.add
      .text(cx, HEIGHT - 28, "Predictions live from TabPFN-3.5 - Prior Labs Hackathon 2026", textStyle(8, COLORS.muted))
      .setOrigin(0.5);

    void nextKey(this, CONFIRM).then(() => {
      this.cameras.main.fadeOut(300, 14, 14, 18);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("bedroom"));
    });
  }
}
