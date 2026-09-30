import * as Phaser from "phaser";
import { CHARACTERS, SHEETS, SHEET_ORDER, charFrame, type Character, type Facing } from "../world/tiles";
import { fakeMorning, state } from "../state";
import { loadMemory } from "../memory";
import { MOODS, portraitKey, portraitUrl } from "../ui/portraits";
import type { UIScene } from "./UIScene";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const s of SHEET_ORDER) this.load.image(s, SHEETS[s].url);
    for (const m of MOODS) this.load.image(portraitKey(m), portraitUrl(m));
    this.load.spritesheet("urban-sprites", SHEETS.urban.url, { frameWidth: 16, frameHeight: 16 });
  }

  /** Loads what the phone remembers, records today's answers, and switches on the autopilot if asked to. */
  private startDay(): void {
    const memory = loadMemory();
    state.day = memory.day;
    state.autopilot = memory.autopilot && memory.day > 0;
    const ui = this.scene.get("ui") as UIScene;
    ui.dialogue.onChoice = (prompt, index) => (state.choiceLog[prompt] = index);
    ui.phone.onValue = (question, value) => (state.dialLog[question] = value);
    if (state.autopilot) {
      ui.dialogue.autopick = (prompt) => memory.choices[prompt];
      ui.phone.autoValue = (question) => memory.dials[question];
    }
  }

  create(): void {
    const facings: Facing[] = ["left", "down", "up", "right"];
    for (const who of Object.keys(CHARACTERS) as Character[]) {
      for (const f of facings) {
        this.anims.create({
          key: `${who}-walk-${f}`,
          frames: [1, 0, 2, 0].map((step) => ({ key: "urban-sprites", frame: charFrame(who, f, step as 0 | 1 | 2) })),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
    // Exit marker: a yellow arrow pointing down (rotated in place for the other directions).
    const g = this.make.graphics({}, false);
    g.fillStyle(0x1b1b2a).fillTriangle(0, 0, 13, 0, 6.5, 9);
    g.fillStyle(0xf2c14e).fillTriangle(2, 1.5, 11, 1.5, 6.5, 6.5);
    g.generateTexture("arrow", 13, 9);
    g.destroy();

    // The Phone of Priors, lying on the nightstand, and its glow.
    const p = this.make.graphics({}, false);
    p.fillStyle(0x1b1b2a).fillRect(0, 0, 8, 12);
    p.fillStyle(0x22222e).fillRect(1, 1, 6, 10);
    p.fillStyle(0x7fdcff).fillRect(2, 2, 4, 7);
    p.fillStyle(0xf4ecd8).fillRect(3, 3, 2, 1).fillRect(3, 5, 2, 1);
    p.generateTexture("phone", 8, 12);
    p.clear().fillStyle(0x7fdcff).fillCircle(12, 12, 12);
    p.generateTexture("phone-glow", 24, 24);
    p.destroy();

    this.startDay();
    const jump = new URLSearchParams(window.location.search).get("map");
    if (jump) {
      fakeMorning();
      this.scene.start("world", { map: jump });
    } else {
      this.scene.start("title");
    }
  }
}
