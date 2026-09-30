import * as Phaser from "phaser";
import { COLORS, HEIGHT, WIDTH, css, textStyle } from "../theme";
import { CONFIRM, nextKey } from "../ui/keys";
import { state } from "../state";
import { music, sfx } from "../audio";
import { playIntro } from "../ui/IntroVideo";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    music.play("title");
    const cx = WIDTH / 2;
    this.add.text(cx, 96, "A LINK TO", textStyle(8, COLORS.muted)).setOrigin(0.5);
    this.add.text(cx, 124, "PAST PREDICTIONS", textStyle(24, COLORS.accent)).setOrigin(0.5);
    this.add
      .text(cx, 170, "A day of predictions, and the judgment they need.", textStyle(8, COLORS.paper))
      .setOrigin(0.5);
    if (state.day > 0) {
      const note = state.autopilot ? "The phone will decide for you today." : "The phone remembers yesterday.";
      this.add.text(cx, 206, `DAY ${state.day + 1}  -  ${note}`, textStyle(8, COLORS.rain)).setOrigin(0.5);
    }
    const start = this.add.text(cx, 236, "PRESS SPACE", textStyle(8, COLORS.paper)).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.rainbowSwipe(cx, HEIGHT - 28, "Predictions live from TabPFN-3.5");

    void nextKey(this, CONFIRM).then(async () => {
      sfx.win();
      if (state.day === 0) {
        music.play(undefined);
        await playIntro("assets/intro.mp4");
        this.scene.start("world", { map: "home" });
        return;
      }
      this.cameras.main.fadeOut(300, 14, 14, 18);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("world", { map: "home" }));
    });
  }

  /** Muted line with a rainbow band sweeping across it, letter by letter. */
  private rainbowSwipe(cx: number, y: number, str: string): void {
    const measure = (t: string) => {
      const probe = this.add.text(0, 0, t, textStyle(8)).setVisible(false);
      const w = probe.width;
      probe.destroy();
      return w;
    };
    const total = measure(str);
    const left = cx - total / 2;
    const letters = [...str].map((ch, i) => {
      const x = left + measure(str.slice(0, i));
      return { x, text: this.add.text(x, y, ch, textStyle(8, COLORS.muted)).setOrigin(0, 0.5) };
    });
    const band = 70;
    const sweep = { t: 0 };
    this.tweens.add({
      targets: sweep,
      t: 1,
      duration: 2200,
      repeat: -1,
      repeatDelay: 900,
      onUpdate: () => {
        const bandX = left - band + sweep.t * (total + band * 2);
        for (const { x, text } of letters) {
          const d = (x - bandX) / band; // -1..1 inside the band
          if (Math.abs(d) >= 1) {
            text.setColor(css(COLORS.muted));
            continue;
          }
          const c = Phaser.Display.Color.HSVToRGB((d + 1) / 2, 0.75, 1) as Phaser.Types.Display.ColorObject;
          text.setColor(Phaser.Display.Color.RGBToString(c.r, c.g, c.b, 255, "#"));
        }
      },
    });
  }
}
