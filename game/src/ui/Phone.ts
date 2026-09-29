import * as Phaser from "phaser";
import { COLORS, WIDTH, textStyle } from "../theme";
import { CONFIRM, LEFT, RIGHT, nextKey } from "./keys";

const W = 200;
const H = 244;
const OPEN_X = WIDTH - W - 16;
const SCREEN = { x: 8, y: 26, w: W - 16, h: H - 60 };
const INNER = SCREEN.w - 16;

/** The Phone of Priors: shows predictions and asks for your threshold. */
export class Phone {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private readonly hint: Phaser.GameObjects.Text;
  private thinkingTimer?: Phaser.Time.TimerEvent;
  private opened = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const body = scene.add.graphics();
    body.fillStyle(COLORS.phoneBody, 1).fillRoundedRect(0, 0, W, H, 14);
    body.lineStyle(2, COLORS.muted, 1).strokeRoundedRect(1, 1, W - 2, H - 2, 14);
    body.fillStyle(COLORS.phoneScreen, 1).fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    const title = scene.add.text(14, 10, "PHONE OF PRIORS", textStyle(8, COLORS.accent));
    this.hint = scene.add.text(14, H - 26, "", textStyle(8, COLORS.muted));
    this.content = scene.add.container(SCREEN.x + 8, SCREEN.y + 10);
    this.root = scene.add.container(WIDTH + 8, 12, [body, title, this.content, this.hint]).setDepth(90);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  open(): Promise<void> {
    if (this.opened) return Promise.resolve();
    this.opened = true;
    return this.slideTo(OPEN_X);
  }

  close(): Promise<void> {
    if (!this.opened) return Promise.resolve();
    this.opened = false;
    this.stopThinking();
    return this.slideTo(WIDTH + 8);
  }

  showLines(heading: string, lines: string[], hint = ""): void {
    this.reset(hint);
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    this.add(this.scene.add.text(0, 24, lines.join("\n\n"), textStyle(8, COLORS.paper, INNER)));
  }

  thinking(heading: string): void {
    this.reset("asking TabPFN-3.5");
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    const dots = this.add(this.scene.add.text(0, 60, "", textStyle(16, COLORS.paper)));
    let n = 0;
    this.thinkingTimer = this.scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => dots.setText(".".repeat((n++ % 4) + 1)),
    });
  }

  showProbability(heading: string, p: number, threshold: number | undefined, lines: string[]): void {
    this.reset("SPACE continue");
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    this.add(this.scene.add.text(0, 30, `${Math.round(p * 100)}%`, textStyle(24, COLORS.paper)));
    this.drawBar(70, p, threshold);
    this.add(this.scene.add.text(0, 92, lines.join("\n"), textStyle(8, COLORS.muted, INNER)));
  }

  /** Lets the player set a threshold (0–100%) before seeing the prediction. */
  async dial(heading: string, question: string, initial = 50, step = 5): Promise<number> {
    let value = initial;
    const render = () => {
      this.reset("<-/-> adjust  SPACE ok");
      this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
      this.add(this.scene.add.text(0, 24, question, textStyle(8, COLORS.paper, INNER)));
      this.add(this.scene.add.text(0, 86, `>= ${value}%`, textStyle(16, COLORS.accent)));
      this.drawBar(116, 0, value / 100);
    };
    render();
    for (;;) {
      const key = await nextKey(this.scene, [...CONFIRM, ...LEFT, ...RIGHT]);
      if (CONFIRM.includes(key)) return value / 100;
      value = Phaser.Math.Clamp(value + (LEFT.includes(key) ? -step : step), 0, 100);
      render();
    }
  }

  private drawBar(y: number, fill: number, marker?: number): void {
    const g = this.add(this.scene.add.graphics());
    g.fillStyle(COLORS.ink, 1).fillRect(0, y, INNER, 10);
    g.fillStyle(COLORS.rain, 1).fillRect(0, y, Math.round(INNER * fill), 10);
    g.lineStyle(1, COLORS.muted, 1).strokeRect(0, y, INNER, 10);
    if (marker !== undefined) {
      const x = Math.round(INNER * marker);
      g.fillStyle(COLORS.accent, 1).fillRect(x - 1, y - 4, 2, 18);
    }
  }

  private reset(hint: string): void {
    this.stopThinking();
    this.content.removeAll(true);
    this.hint.setText(hint);
  }

  private stopThinking(): void {
    this.thinkingTimer?.remove();
    this.thinkingTimer = undefined;
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.content.add(obj);
    return obj;
  }

  private slideTo(x: number): Promise<void> {
    return new Promise((resolve) =>
      this.scene.tweens.add({ targets: this.root, x, duration: 220, ease: "Cubic.easeOut", onComplete: () => resolve() }),
    );
  }
}
