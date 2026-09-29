import * as Phaser from "phaser";
import { COLORS, TILE, WORLD_ZOOM } from "../theme";
import { CONFIRM } from "../ui/keys";
import { state } from "../state";
import { leaveHouse, lookOutOfWindow, phoneSummary, pickUpPhone } from "../story/umbrella";
import { ui } from "./UIScene";

const ROOM_W = 20 * TILE;
const ROOM_H = 11 * TILE;
const SPEED = 90;

interface Interactable {
  rect: Phaser.Geom.Rectangle;
  run: () => Promise<void>;
}

// Placeholder art: flat rectangles until the Kenney tiles land.
export class BedroomScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private body_!: Phaser.Physics.Arcade.Body;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private facing = new Phaser.Math.Vector2(0, 1);
  private interactables: Interactable[] = [];
  private busy = false;

  constructor() {
    super("bedroom");
  }

  create(): void {
    this.cameras.main.setZoom(WORLD_ZOOM).centerOn(ROOM_W / 2, ROOM_H / 2 + 2).fadeIn(400, 14, 14, 18);
    const walls = this.physics.add.staticGroup();
    const solid = (x: number, y: number, w: number, h: number, color: number) => {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, color);
      walls.add(r);
      return r;
    };

    // Floor with planks, walls, door.
    this.add.rectangle(ROOM_W / 2, ROOM_H / 2, ROOM_W, ROOM_H, 0xb98b5e);
    const planks = this.add.graphics().lineStyle(1, 0x9c7249, 1);
    for (let y = 32; y < ROOM_H; y += 8) planks.lineBetween(16, y, ROOM_W - 16, y);
    solid(0, 0, ROOM_W, 32, 0x5b4a6b);
    solid(0, 32, 16, ROOM_H - 32, 0x4a3b58);
    solid(ROOM_W - 16, 32, 16, ROOM_H - 32, 0x4a3b58);
    solid(0, ROOM_H - 16, 144, 16, 0x4a3b58);
    solid(176, ROOM_H - 16, ROOM_W - 176, 16, 0x4a3b58);
    const door = solid(144, ROOM_H - 12, 32, 12, 0x6b4226);

    // Window with a grey Freiburg sky.
    this.add.rectangle(216, 16, 52, 24, 0xe8e2d0);
    this.add.rectangle(216, 16, 46, 18, 0x9aa7b8);
    this.add.rectangle(216, 16, 2, 18, 0xe8e2d0);

    // Furniture.
    solid(16, 32, 48, 64, 0x7a5230);
    this.add.rectangle(40, 64, 42, 50, 0x6b8fc8);
    this.add.rectangle(40, 42, 30, 10, COLORS.paper);
    const nightstand = solid(66, 34, 16, 16, 0x8a5a33);
    const phoneGlow = this.add.rectangle(74, 40, 6, 8, COLORS.accent);
    this.tweens.add({ targets: phoneGlow, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    const desk = solid(112, 32, 48, 18, 0x8a5a33);
    this.add.rectangle(136, 38, 16, 8, 0x22222e);
    const wardrobe = solid(256, 32, 48, 30, 0x6b4226);
    this.add.rectangle(160, 104, 96, 48, 0xa04e4e).setAlpha(0.8);

    // Ada (placeholder).
    this.player = this.add.rectangle(88, 72, 10, 14, COLORS.danger);
    this.physics.add.existing(this.player);
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body;
    this.body_.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, ROOM_W, ROOM_H);
    this.physics.add.collider(this.player, walls);

    const rect = (o: Phaser.GameObjects.Rectangle, grow = 6) =>
      new Phaser.Geom.Rectangle(o.x - o.width / 2 - grow, o.y - o.height / 2 - grow, o.width + grow * 2, o.height + grow * 2);
    const u = ui(this);
    this.interactables = [
      {
        rect: rect(nightstand),
        run: async () => {
          if (state.hasPhone) return u.dialogue.say("Just a nightstand now. And a glass of water.");
          await pickUpPhone(u);
          phoneGlow.destroy();
        },
      },
      { rect: new Phaser.Geom.Rectangle(188, 0, 56, 40), run: () => lookOutOfWindow(u) },
      { rect: rect(desk), run: () => u.dialogue.say("The home laptop. The real work happens at the office.") },
      { rect: rect(wardrobe), run: () => u.dialogue.say("Clothes for a long day. You're already dressed. Mostly.") },
      {
        rect: rect(door),
        run: async () => {
          if (await leaveHouse(u)) await this.endOfBuild();
        },
      },
    ];

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({ up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D" }) as typeof this.keys;
    kb.on("keydown", (e: KeyboardEvent) => {
      if (this.busy || e.repeat) return;
      if (CONFIRM.includes(e.code)) void this.interact();
      if (e.code === "Tab") void this.togglePhone();
    });

    u.setClock("06:30");
    void this.run(() => u.dialogue.say(["06:30. The alarm. Again.", "Two kids, one paper deadline, zero coffee. Let's go."]));
  }

  update(): void {
    const k = this.keys;
    const x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (this.busy || (x === 0 && y === 0)) {
      this.body_.setVelocity(0, 0);
      return;
    }
    const v = new Phaser.Math.Vector2(x, y).normalize();
    this.facing.copy(v);
    this.body_.setVelocity(v.x * SPEED, v.y * SPEED);
  }

  private async interact(): Promise<void> {
    const probe = new Phaser.Math.Vector2(this.player.x + this.facing.x * 12, this.player.y + this.facing.y * 12);
    const target = this.interactables.find((i) => i.rect.contains(probe.x, probe.y));
    if (target) await this.run(target.run);
  }

  private async togglePhone(): Promise<void> {
    if (!state.hasPhone) return;
    const phone = ui(this).phone;
    if (phone.isOpen) return void phone.close();
    phone.showLines("PREDICT", phoneSummary(), "TAB close");
    await phone.open();
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy = true;
    try {
      await fn();
    } finally {
      this.busy = false;
    }
  }

  private async endOfBuild(): Promise<void> {
    const u = ui(this);
    await u.dialogue.say([
      "To be continued: sick Leo, the school run, the office, and Mia's big final.",
      "Thanks for playing this early build!",
    ]);
    this.cameras.main.fadeOut(500, 14, 14, 18);
    this.cameras.main.once("camerafadeoutcomplete", () => window.location.reload());
  }
}
