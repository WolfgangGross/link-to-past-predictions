import * as Phaser from "phaser";
import { Dialogue } from "../ui/Dialogue";
import { Phone } from "../ui/Phone";
import { COLORS, textStyle } from "../theme";

/** Runs on top of every world scene and owns the dialogue box, the phone and the clock. */
export class UIScene extends Phaser.Scene {
  dialogue!: Dialogue;
  phone!: Phone;
  private clock!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ui", active: true });
  }

  create(): void {
    this.input.keyboard!.addCapture("TAB,SPACE,UP,DOWN,LEFT,RIGHT");
    this.dialogue = new Dialogue(this);
    this.phone = new Phone(this);
    this.clock = this.add.text(12, 10, "", textStyle(8, COLORS.paper)).setDepth(80);
  }

  setClock(time: string): void {
    this.clock.setText(time);
  }
}

export function ui(scene: Phaser.Scene): UIScene {
  return scene.scene.get("ui") as UIScene;
}
