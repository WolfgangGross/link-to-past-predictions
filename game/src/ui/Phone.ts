import * as Phaser from "phaser";
import { COLORS, WIDTH, textStyle } from "../theme";
import { ApiPanel } from "./ApiPanel";
import { CONFIRM, DOWN, LEFT, RIGHT, UP, nextKey } from "./keys";
import { sfx } from "../audio";

export interface PhonePage {
  title: string;
  lines: string[];
}

const W = 200;
const H = 244;
const OPEN_X = WIDTH - W - 16;
const SCREEN = { x: 8, y: 26, w: W - 16, h: H - 60 };
const INNER = SCREEN.w - 16;
const STEP = 12; // pixels per arrow-key press when a page is taller than the screen

/** The Phone of Priors: shows predictions and asks for your threshold. */
export class Phone {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly content: Phaser.GameObjects.Container;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly api: ApiPanel;
  private thinkingTimer?: Phaser.Time.TimerEvent;
  private opened = false;
  /** Set while the current page is taller than the screen; UP/DOWN scroll it. */
  private scroll?: { text: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; top: number; viewH: number; max: number; pos: number };

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
    this.api = new ApiPanel(scene, { x: 16, y: 12, w: OPEN_X - 32, h: H });
    scene.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (!this.opened || !this.scroll) return;
      if (UP.includes(e.code)) this.scrollBy(-STEP);
      else if (DOWN.includes(e.code)) this.scrollBy(STEP);
    });
  }

  /** Autopilot: returns yesterday's value for this question, or undefined to ask the player. */
  autoValue?: (question: string) => number | undefined;
  /** Called with every dial/pick answer, so tomorrow's autopilot can replay it. */
  onValue?: (question: string, value: number) => void;

  /** For the playtest script: true while the threshold dial waits for input. */
  dialing = false;

  get isOpen(): boolean {
    return this.opened;
  }

  open(): Promise<void> {
    if (this.opened) return Promise.resolve();
    this.opened = true;
    sfx.phoneOpen();
    return this.slideTo(OPEN_X);
  }

  close(): Promise<void> {
    if (!this.opened) return Promise.resolve();
    this.opened = false;
    sfx.phoneClose();
    this.stopThinking();
    this.api.hide();
    return this.slideTo(WIDTH + 8);
  }

  showLines(heading: string, lines: string[], hint = ""): void {
    this.reset(hint);
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    const top = 24;
    const body = this.add(this.scene.add.text(0, top, lines.join("\n\n"), textStyle(8, COLORS.paper, INNER)).setLineSpacing(4));
    const viewH = SCREEN.h - 10 - top - 4;
    if (body.height <= viewH) return;
    // Too long for the screen: show a window onto the text and a scroll bar beside it.
    body.setCrop(0, 0, INNER, viewH);
    const bar = this.add(this.scene.add.graphics());
    this.scroll = { text: body, bar, top, viewH, max: body.height - viewH, pos: 0 };
    this.scrollBy(0);
  }

  private scrollBy(delta: number): void {
    const s = this.scroll;
    if (!s) return;
    s.pos = Phaser.Math.Clamp(s.pos + delta, 0, s.max);
    s.text.setCrop(0, s.pos, INNER, s.viewH).setY(s.top - s.pos); // the crop keeps its place inside the texture, so shift the text up
    const thumb = Math.max(10, Math.round((s.viewH * s.viewH) / (s.viewH + s.max)));
    const y = s.top + Math.round(((s.viewH - thumb) * s.pos) / s.max);
    s.bar.clear().fillStyle(COLORS.ink, 1).fillRect(INNER + 3, s.top, 3, s.viewH).fillStyle(COLORS.accent, 1).fillRect(INNER + 3, y, 3, thumb);
  }

  /** TAB view: flip through pages until TAB or Escape closes the phone. */
  async browse(pages: PhonePage[]): Promise<void> {
    let i = 0;
    const render = () => this.showLines(`${pages[i].title}  ${i + 1}/${pages.length}`, pages[i].lines, "<-/-> page  TAB close");
    render();
    await this.open();
    for (;;) {
      const key = await nextKey(this.scene, [...LEFT, ...RIGHT, "Tab", "Escape"]);
      if (key === "Tab" || key === "Escape") break;
      i = (i + (LEFT.includes(key) ? -1 : 1) + pages.length) % pages.length;
      render();
    }
    await this.close();
  }

  thinking(heading: string, dataset: string): void {
    this.reset("asking TabPFN-3.5");
    this.api.watch(dataset);
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    const dots = this.add(this.scene.add.text(0, 60, "", textStyle(16, COLORS.paper)));
    let n = 0;
    this.thinkingTimer = this.scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        sfx.think(n);
        dots.setText(".".repeat((n++ % 4) + 1));
      },
    });
  }

  showProbability(heading: string, p: number, threshold: number | undefined, lines: string[]): void {
    this.reset("SPACE continue");
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    sfx.result();
    this.add(this.scene.add.text(0, 30, `${Math.round(p * 100)}%`, textStyle(24, COLORS.paper)));
    this.drawBar(70, p, threshold);
    this.add(this.scene.add.text(0, 92, lines.join("\n"), textStyle(8, COLORS.muted, INNER)));
  }

  /** Lets the player set a threshold (0–100%) before seeing the prediction. */
  async dial(heading: string, question: string, initial = 50, step = 5, op: ">=" | "<" = ">="): Promise<number> {
    const auto = this.autoValue?.(question);
    if (auto !== undefined) {
      this.showLines("AUTOPILOT", [question, `${op} ${Math.round(auto * 100)}%`, "Your line from yesterday."], "");
      await new Promise((r) => this.scene.time.delayedCall(1200, r));
      return auto;
    }
    let value = initial;
    const render = () => {
      this.reset("<-/-> adjust  SPACE ok");
      this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
      this.add(this.scene.add.text(0, 24, question, textStyle(8, COLORS.paper, INNER)));
      this.add(this.scene.add.text(0, 86, `${op} ${value}%`, textStyle(16, COLORS.accent)));
      this.drawBar(116, 0, value / 100);
    };
    render();
    this.dialing = true;
    for (;;) {
      const key = await nextKey(this.scene, [...CONFIRM, ...LEFT, ...RIGHT]);
      if (CONFIRM.includes(key)) {
        this.dialing = false;
        this.onValue?.(question, value / 100);
        return value / 100;
      }
      sfx.tick();
      value = Phaser.Math.Clamp(value + (LEFT.includes(key) ? -step : step), 0, 100);
      render();
    }
  }

  /** Like dial(), but over a fixed list of values (e.g. "1 in 10"). Returns the chosen value. */
  async pick<T extends number>(heading: string, question: string, values: T[], format: (v: T) => string, initial = 0): Promise<T> {
    const auto = this.autoValue?.(question);
    if (auto !== undefined && values.includes(auto as T)) {
      this.showLines("AUTOPILOT", [question, format(auto as T), "Your answer from yesterday."], "");
      await new Promise((r) => this.scene.time.delayedCall(1200, r));
      return auto as T;
    }
    let i = initial;
    const render = () => {
      this.reset("<-/-> adjust  SPACE ok");
      this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
      this.add(this.scene.add.text(0, 24, question, textStyle(8, COLORS.paper, INNER)));
      this.add(this.scene.add.text(0, 96, format(values[i]), textStyle(16, COLORS.accent, INNER)));
    };
    render();
    this.dialing = true;
    for (;;) {
      const key = await nextKey(this.scene, [...CONFIRM, ...LEFT, ...RIGHT]);
      if (CONFIRM.includes(key)) {
        this.dialing = false;
        this.onValue?.(question, values[i]);
        return values[i];
      }
      sfx.tick();
      i = Phaser.Math.Clamp(i + (LEFT.includes(key) ? -1 : 1), 0, values.length - 1);
      render();
    }
  }

  /**
   * Box plots on a shared axis: box = 25–75%, whiskers = 10–98%, tick = median.
   * `deadline` draws a red line. Up to 5 rows stack label over bar; more rows go label | bar.
   */
  showDistributions(
    heading: string,
    rows: { label: string; q: Record<number, number> }[],
    axis: { min: number; max: number; deadline?: number; format: (v: number) => string },
    lines: string[],
  ): void {
    this.reset("SPACE continue");
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    const dense = rows.length > 5;
    const rowH = dense ? 17 : rows.length > 3 ? 24 : 30;
    const x0 = dense ? 84 : 0;
    const w = INNER - x0;
    const g = this.add(this.scene.add.graphics());
    const x = (v: number) => x0 + Math.round(((Phaser.Math.Clamp(v, axis.min, axis.max) - axis.min) / (axis.max - axis.min)) * w);
    rows.forEach((r, i) => {
      const y = 22 + i * rowH;
      this.add(this.scene.add.text(0, y, r.label, textStyle(8, COLORS.paper)));
      const by = dense ? y : y + 11;
      g.lineStyle(1, COLORS.muted, 1).lineBetween(x(r.q[0.1]), by + 4, x(r.q[0.98]), by + 4);
      g.fillStyle(COLORS.rain, 1).fillRect(x(r.q[0.25]), by, Math.max(2, x(r.q[0.75]) - x(r.q[0.25])), 9);
      g.fillStyle(COLORS.paper, 1).fillRect(x(r.q[0.5]) - 1, by - 1, 2, 11);
    });
    if (axis.deadline !== undefined) {
      const dx = x(axis.deadline);
      g.fillStyle(COLORS.danger, 1).fillRect(dx - 1, 20, 2, rows.length * rowH);
    }
    const axisY = 24 + rows.length * rowH;
    this.add(this.scene.add.text(x0, axisY, axis.format(axis.min), textStyle(8, COLORS.muted)));
    this.add(this.scene.add.text(INNER, axisY, axis.format(axis.max), textStyle(8, COLORS.muted)).setOrigin(1, 0));
    if (lines.length) this.add(this.scene.add.text(0, axisY + 16, lines.join("\n"), textStyle(8, COLORS.muted, INNER)));
  }

  /** Horizontal bars, one per row, scaled to `max`. */
  showBars(heading: string, rows: { label: string; value: number; text: string }[], max: number, lines: string[]): void {
    this.reset("SPACE continue");
    this.add(this.scene.add.text(0, 0, heading, textStyle(8, COLORS.accent, INNER)));
    const g = this.add(this.scene.add.graphics());
    rows.forEach((r, i) => {
      const y = 24 + i * 30;
      this.add(this.scene.add.text(0, y, `${r.label}  ${r.text}`, textStyle(8, COLORS.paper, INNER)));
      g.fillStyle(COLORS.ink, 1).fillRect(0, y + 12, INNER, 8);
      g.fillStyle(r.value > max * 0.66 ? COLORS.danger : COLORS.rain, 1).fillRect(0, y + 12, Math.round((INNER * Math.min(r.value, max)) / max), 8);
    });
    this.add(this.scene.add.text(0, 30 + rows.length * 30, lines.join("\n"), textStyle(8, COLORS.muted, INNER)));
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
    this.scroll = undefined;
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
