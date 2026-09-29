import * as Phaser from "phaser";
import { Dialogue } from "../ui/Dialogue";
import { Phone } from "../ui/Phone";
import { CardView } from "../ui/Card";
import { Terminal } from "../ui/Terminal";
import { ReportView } from "../ui/Report";
import { Toast } from "../ui/Toast";
import { hooks } from "../state";
import { audioHooks } from "../audio";
import { revealGuess } from "../predict/player";
import { COLORS, textStyle } from "../theme";

/** Runs on top of every world scene and owns the dialogue box, the phone and the clock. */
export class UIScene extends Phaser.Scene {
  dialogue!: Dialogue;
  phone!: Phone;
  card!: CardView;
  terminal!: Terminal;
  report!: ReportView;
  toast!: Toast;
  private clock!: Phaser.GameObjects.Text;
  private clockBox!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: "ui", active: true });
  }

  create(): void {
    this.input.keyboard!.addCapture("TAB,SPACE,UP,DOWN,LEFT,RIGHT");
    this.dialogue = new Dialogue(this);
    this.phone = new Phone(this);
    this.card = new CardView(this);
    this.terminal = new Terminal(this);
    this.report = new ReportView(this);
    this.toast = new Toast(this);
    hooks.onJudgment = (j) => {
      const line = revealGuess(j);
      if (line) this.toast.show(line, 4500);
    };
    audioHooks.onMute = (muted) => this.toast.show(muted ? "Sound off  (M)" : "Sound on  (M)", 1500);
    this.clockBox = this.add.graphics().setDepth(79);
    this.clock = this.add.text(16, 13, "", textStyle(10, COLORS.accent)).setDepth(80);
  }

  /** The clock sits on a dark plate with a gold rim, so it reads against any map. */
  setClock(time: string): void {
    this.clock.setText(time);
    const w = Math.ceil(this.clock.width) + 16;
    const h = Math.ceil(this.clock.height) + 12;
    this.clockBox
      .clear()
      .fillStyle(COLORS.ink, 0.92)
      .fillRoundedRect(10, 8, w, h, 4)
      .lineStyle(2, COLORS.accent, 1)
      .strokeRoundedRect(10, 8, w, h, 4);
  }
}

export function ui(scene: Phaser.Scene): UIScene {
  return scene.scene.get("ui") as UIScene;
}
