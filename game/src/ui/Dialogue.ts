import * as Phaser from "phaser";
import { COLORS, WIDTH, textStyle } from "../theme";
import { CONFIRM, DOWN, UP, nextKey } from "./keys";
import { sfx } from "../audio";
import { portraitKey, type Mood } from "./portraits";

const BOX = { x: 16, y: 256, w: WIDTH - 32, h: 92, pad: 14 };
const CHAR_MS = 18;
const FACE = 120; // taller than the box: the portrait rises above its top edge
const FACE_Y = BOX.h - 8 - FACE;
const TEXT_X = 8 + FACE + 12;

/** A line of text, optionally with its own expression for Ada. */
export type Line = string | { text: string; mood: Mood };

/** Zelda-style text box: typewriter lines and simple menus. */
export class Dialogue {
  private readonly scene: Phaser.Scene;
  private readonly box: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly face: Phaser.GameObjects.Image;
  private readonly more: Phaser.GameObjects.Triangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.ink, 0.96).fillRoundedRect(0, 0, BOX.w, BOX.h, 6);
    bg.lineStyle(2, COLORS.paper, 1).strokeRoundedRect(1, 1, BOX.w - 2, BOX.h - 2, 6);
    bg.fillStyle(COLORS.ink, 1).fillRect(8, FACE_Y, FACE, FACE);
    bg.lineStyle(2, COLORS.paper, 1).strokeRect(8, FACE_Y, FACE, FACE);
    this.face = scene.add.image(8, FACE_Y, portraitKey("neutral")).setOrigin(0).setDisplaySize(FACE, FACE);
    this.text = scene.add.text(TEXT_X, BOX.pad, "", textStyle(8, COLORS.paper, BOX.w - TEXT_X - BOX.pad));
    this.more = scene.add.triangle(BOX.w - 20, BOX.h - 14, 0, 0, 10, 0, 5, 6, COLORS.accent);
    scene.tweens.add({ targets: this.more, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.box = scene.add.container(BOX.x, BOX.y, [bg, this.face, this.text, this.more]).setDepth(100).setVisible(false);
  }

  /** Autopilot: returns the option to pick without asking, or undefined to ask the player. */
  autopick?: (prompt: string, options: string[]) => number | undefined;
  /** Called with every answered menu, so tomorrow's autopilot can replay it. */
  onChoice?: (prompt: string, index: number) => void;

  /** For the playtest script: what the box is waiting for. */
  mode: "closed" | "typing" | "line" | "choice" = "closed";

  get isOpen(): boolean {
    return this.box.visible;
  }

  /** Ada's face for the lines that don't name their own mood. */
  async say(lines: Line | Line[], mood: Mood = "neutral"): Promise<void> {
    this.box.setVisible(true);
    for (const line of Array.isArray(lines) ? lines : [lines]) {
      this.show(typeof line === "string" ? mood : line.mood);
      await this.type(typeof line === "string" ? line : line.text);
      this.more.setVisible(true);
      this.mode = "line";
      await nextKey(this.scene, CONFIRM);
      sfx.select();
    }
    this.box.setVisible(false);
    this.mode = "closed";
  }

  /** `initial` is the option the cursor starts on. `autoOverride` replaces yesterday's remembered pick when the autopilot is on. */
  async choose(prompt: string, options: string[], initial = 0, autoOverride?: number, mood: Mood = "thinking"): Promise<number> {
    this.box.setVisible(true);
    this.show(mood);
    this.more.setVisible(false);
    await this.type(prompt);
    const auto = this.autopick ? (autoOverride ?? this.autopick(prompt, options)) : undefined;
    if (auto !== undefined && auto < options.length) {
      this.text.setText([prompt, "", `> ${options[auto]}`, "", "(The phone chose for you, with your lines from yesterday.)"].join("\n"));
      this.mode = "line";
      await nextKey(this.scene, CONFIRM);
      this.box.setVisible(false);
      this.mode = "closed";
      this.onChoice?.(prompt, auto);
      return auto;
    }
    let selected = initial;
    const render = () =>
      this.text.setText(
        [prompt, "", ...options.map((o, i) => `${i === selected ? ">" : " "} ${o}`)].join("\n"),
      );
    render();
    this.mode = "choice";
    for (;;) {
      const key = await nextKey(this.scene, [...CONFIRM, ...UP, ...DOWN]);
      if (CONFIRM.includes(key)) {
        sfx.select();
        break;
      }
      sfx.move();
      selected = (selected + (UP.includes(key) ? -1 : 1) + options.length) % options.length;
      render();
    }
    this.box.setVisible(false);
    this.mode = "closed";
    this.onChoice?.(prompt, selected);
    return selected;
  }

  private show(mood: Mood): void {
    // Portraits are pre-scaled to FACE px and shown 1:1. Resize on every swap: the UI scene is built before they load.
    this.face.setTexture(portraitKey(mood)).setDisplaySize(FACE, FACE);
  }

  /** Types a line out; a confirm press skips to the full line. */
  private type(line: string): Promise<void> {
    this.mode = "typing";
    this.more.setVisible(false);
    this.text.setText("");
    return new Promise((resolve) => {
      let shown = 0;
      let done = false;
      const keyboard = this.scene.input.keyboard!;
      const finish = () => {
        if (done) return;
        done = true;
        timer.remove();
        keyboard.off("keydown", skip);
        this.text.setText(line);
        resolve();
      };
      const skip = (e: KeyboardEvent) => {
        if (CONFIRM.includes(e.code) && !e.repeat) finish();
      };
      const timer = this.scene.time.addEvent({
        delay: CHAR_MS,
        loop: true,
        callback: () => {
          shown++;
          this.text.setText(line.slice(0, shown));
          if (shown % 2 === 0 && line[shown - 1] !== " ") sfx.blip();
          if (shown >= line.length) finish();
        },
      });
      // Register the skip handler after the key press that opened this line has been handled.
      this.scene.time.delayedCall(0, () => {
        if (!done) keyboard.on("keydown", skip);
      });
    });
  }
}
