import * as Phaser from "phaser";
import { COLORS, WIDTH, textStyle } from "../theme";
import { sfx } from "../audio";

/** A small, non-blocking notice at the top of the screen (the phone's sealed guesses). */
export class Toast {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Graphics;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.graphics();
    this.text = scene.add.text(0, 0, "", textStyle(8, COLORS.paper)).setOrigin(0.5, 0);
    this.root = scene.add.container(WIDTH / 2, 8, [this.bg, this.text]).setDepth(140).setAlpha(0);
  }

  show(message: string, ms = 3500): void {
    sfx.ping();
    this.text.setText(message);
    const w = this.text.width + 20;
    this.bg.clear().fillStyle(COLORS.phoneBody, 0.95).fillRoundedRect(-w / 2, -5, w, this.text.height + 10, 6);
    this.bg.lineStyle(1, COLORS.accent, 1).strokeRoundedRect(-w / 2, -5, w, this.text.height + 10, 6);
    this.hideTimer?.remove();
    this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 150 });
    this.hideTimer = this.scene.time.delayedCall(ms, () => this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 300 }));
  }
}
