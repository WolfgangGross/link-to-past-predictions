import * as Phaser from "phaser";
import { CHARACTERS, SHEETS, SHEET_ORDER, charFrame, type Character, type Facing } from "../world/tiles";
import { fakeMorning } from "../state";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const s of SHEET_ORDER) this.load.image(s, SHEETS[s].url);
    this.load.spritesheet("urban-sprites", SHEETS.urban.url, { frameWidth: 16, frameHeight: 16 });
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
    const jump = new URLSearchParams(window.location.search).get("map");
    if (jump) {
      fakeMorning();
      this.scene.start("world", { map: jump });
    } else {
      this.scene.start("title");
    }
  }
}
