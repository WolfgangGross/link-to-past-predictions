import * as Phaser from "phaser";
import { COLORS, HEIGHT, TILE, WIDTH, WORLD_ZOOM, css, textStyle } from "../theme";
import { CONFIRM } from "../ui/keys";
import { ui, type UIScene } from "../scenes/UIScene";
import { state } from "../state";
import { FIRST_GID, SHEETS, SHEET_ORDER, charFrame, gid, type Character, type Facing } from "./tiles";
import type { MapDef, Spot } from "./MapDef";
import { MAPS, STORIES } from "./registry";
import { WeatherWindow, type Sky } from "./weather";
import { ambience, music, sfx } from "../audio";

const SPEED = 90;

export interface StoryContext {
  ui: UIScene;
  world: WorldScene;
}

export interface Story {
  onEnter?: (ctx: StoryContext) => Promise<void>;
  /** Handlers keyed by spot id or NPC id. */
  interact: Record<string, (ctx: StoryContext) => Promise<void>>;
  /** What the windows show; re-read after every interaction. */
  sky?: () => Sky;
}

interface Npc {
  sprite: Phaser.Physics.Arcade.Sprite;
  who: Character;
}

/** A tiny caption that follows a sprite; drawn at double resolution so it stays crisp under the 2× camera. */
interface Tag {
  text: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Sprite;
}

/** One scene for every map: builds the tilemap from a MapDef and runs that map's story handlers. */
export class WorldScene extends Phaser.Scene {
  private def!: MapDef;
  private story!: Story;
  private player!: Phaser.Physics.Arcade.Sprite;
  private readonly npcs = new Map<string, Npc>();
  private facing: Facing = "down";
  private busy = false;
  private leaving = false;
  private keys!: Record<"up" | "down" | "left" | "right" | "w" | "a" | "s" | "d", Phaser.Input.Keyboard.Key>;
  private lastTouched?: string;
  private readonly tags: Tag[] = [];
  private windows: WeatherWindow[] = [];
  private phone?: Phaser.GameObjects.Image;
  private stepClock = 0;

  constructor() {
    super("world");
  }

  init(data: { map: string }): void {
    this.def = MAPS[data.map];
    this.story = STORIES[data.map];
    this.npcs.clear();
    this.tags.length = 0;
    this.windows = [];
    this.phone = undefined;
    this.lastTouched = undefined;
    this.leaving = false;
  }

  create(): void {
    const def = this.def;
    const width = def.walls[0].length;
    const height = def.walls.length;
    const map = this.make.tilemap({ width, height, tileWidth: TILE, tileHeight: TILE });
    const tilesets = SHEET_ORDER.map((s) => map.addTilesetImage(s, s, TILE, TILE, 0, SHEETS[s].spacing, FIRST_GID[s])!);
    const layer = (name: string) => map.createBlankLayer(name, tilesets)!;
    const floor = layer("floor");
    const decor = layer("decor");
    const walls = layer("walls");
    const wallDecor = layer("wallDecor");
    const furniture = layer("furniture");
    const onTop = layer("top");

    const paint = (target: Phaser.Tilemaps.TilemapLayer, rows: string[]) =>
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const ref = def.legend[ch];
          if (ref) target.putTileAt(gid(ref), x, y);
        }),
      );
    paint(floor, def.floor);
    paint(walls, def.walls);
    for (const prop of def.props) {
      const target = prop.top ? onTop : prop.wall ? wallDecor : prop.solid ? furniture : decor;
      prop.tiles.forEach((row, dy) =>
        row.forEach((index, dx) => {
          if (index !== null) target.putTileAt(gid([prop.sheet, index]), prop.at[0] + dx, prop.at[1] + dy);
        }),
      );
    }
    walls.setCollisionByExclusion([-1]);
    furniture.setCollisionByExclusion([-1]);
    if (def.markings) {
      const g = this.add.graphics().setDepth(decor.depth + 0.5).lineStyle(1, 0xffffff, 0.85);
      for (const [x1, y1, x2, y2] of def.markings.lines ?? []) g.lineBetween(x1 * TILE, y1 * TILE, x2 * TILE, y2 * TILE);
      for (const [x, y, r] of def.markings.circles ?? []) g.strokeCircle(x * TILE, y * TILE, r * TILE);
      for (const [x, y, w, h] of def.markings.rects ?? []) g.strokeRect(x * TILE, y * TILE, w * TILE, h * TILE);
    }

    this.physics.world.setBounds(0, 0, width * TILE, height * TILE);
    const [sx, sy] = def.spawn.at;
    this.player = this.physics.add.sprite((sx + 0.5) * TILE, (sy + 0.5) * TILE, "urban-sprites", charFrame("ada", def.spawn.facing));
    this.player.setCollideWorldBounds(true).setSize(10, 7).setOffset(3, 9);
    this.facing = def.spawn.facing;
    this.physics.add.collider(this.player, [walls, furniture]);
    this.tag("Ada", this.player);

    for (const n of def.npcs) {
      const sprite = this.physics.add.sprite((n.at[0] + 0.5) * TILE, (n.at[1] + 0.5) * TILE, "urban-sprites", charFrame(n.who, n.facing));
      sprite.setScale(n.scale ?? 1).setImmovable(true).setSize(10, 7).setOffset(3, 9);
      if (n.tint !== undefined) sprite.setTint(n.tint);
      (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.physics.add.collider(this.player, sprite);
      this.npcs.set(n.id, { sprite, who: n.who });
      this.tag(n.name, sprite);
    }

    for (const w of def.windows ?? []) this.windows.push(new WeatherWindow(this, w.at[0] * TILE, w.at[1] * TILE, w.size[0] * TILE, w.size[1] * TILE));
    if (def.phone) {
      const [px, py] = def.phone;
      this.phone = this.add.image((px + 0.5) * TILE, (py + 0.45) * TILE, "phone").setDepth(1);
      const glow = this.add.image(this.phone.x, this.phone.y, "phone-glow").setDepth(1).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.1, scale: 1.3, duration: 700, yoyo: true, repeat: -1 });
      this.phone.setData("glow", glow);
    }
    music.play(def.key);
    this.refreshSky();
    for (const spot of def.spots) if (spot.exit) this.exitMarker(spot);

    const cam = this.cameras.main;
    // A map smaller than the screen sits centred in it instead of hugging the top-left corner.
    const viewW = WIDTH / WORLD_ZOOM;
    const viewH = HEIGHT / WORLD_ZOOM;
    const padX = Math.max(0, viewW - width * TILE) / 2;
    const padY = Math.max(0, viewH - height * TILE) / 2;
    cam.setZoom(WORLD_ZOOM).setBounds(-padX, -padY, width * TILE + padX * 2, height * TILE + padY * 2).startFollow(this.player, true);
    cam.fadeIn(300, 14, 14, 18);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({ up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT", w: "W", a: "A", s: "S", d: "D" }) as typeof this.keys;
    kb.on("keydown", (e: KeyboardEvent) => {
      if (this.busy || this.leaving || e.repeat) return;
      if (CONFIRM.includes(e.code)) void this.interact();
      if (e.code === "Tab") void this.togglePhone();
    });

    if (this.story.onEnter) void this.run(this.story.onEnter);
  }

  update(_time: number, delta: number): void {
    for (const s of [this.player, ...[...this.npcs.values()].map((n) => n.sprite)]) s.setDepth(s.y);
    for (const { text, sprite } of this.tags) text.setPosition(Math.round(sprite.x), Math.round(sprite.y - sprite.displayHeight / 2 - 1));
    const k = this.keys;
    const x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (this.busy || this.leaving || (x === 0 && y === 0)) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(charFrame("ada", this.facing));
      return;
    }
    this.facing = Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up";
    const v = new Phaser.Math.Vector2(x, y).normalize().scale(SPEED);
    this.player.setVelocity(v.x, v.y);
    this.player.anims.play(`ada-walk-${this.facing}`, true);
    this.stepClock -= delta;
    if (this.stepClock <= 0) {
      sfx.step();
      this.stepClock = 270;
    }
    this.checkTouch();
  }

  // ---- API for story scripts -------------------------------------------------

  get mapKey(): string {
    return this.def.key;
  }

  /** Leaves this map and enters another. */
  goto(map: string): void {
    this.leaving = true;
    sfx.door();
    this.cameras.main.fadeOut(300, 14, 14, 18);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ map }));
  }

  /** Places the player on a tile (used by the playtest script and scene transitions). */
  teleport(col: number, row: number, facing: Facing = this.facing): void {
    this.player.setPosition((col + 0.5) * TILE, (row + 0.5) * TILE);
    this.facing = facing;
    this.player.setFrame(charFrame("ada", facing));
  }

  /** Turns an NPC to face the player. */
  faceNpc(id: string): void {
    const npc = this.npcs.get(id);
    if (!npc) return;
    const dx = this.player.x - npc.sprite.x;
    const dy = this.player.y - npc.sprite.y;
    const facing: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    npc.sprite.setFrame(charFrame(npc.who, facing));
  }

  // ---- internals -------------------------------------------------------------

  private tag(name: string, sprite: Phaser.GameObjects.Sprite): void {
    const text = this.add
      .text(0, 0, name, { ...textStyle(8, COLORS.paper), stroke: css(COLORS.ink), strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setResolution(4)
      .setDepth(100_000);
    this.tags.push({ text, sprite });
  }

  /** A bobbing arrow and a caption in front of a way out, so a doorway reads as one. */
  private exitMarker(spot: Spot): void {
    const exit = spot.exit!;
    const [w, h] = spot.size ?? [1, 1];
    const cx = (spot.at[0] + w / 2) * TILE;
    const cy = (spot.at[1] + h / 2) * TILE;
    // The arrow sits one tile before the exit, on the walkable side.
    const [dx, dy, angle] = { down: [0, -TILE, 0], left: [TILE, 0, 90], right: [-TILE, 0, -90] }[exit.arrow];
    const x = cx + dx;
    const y = cy + dy;
    const arrow = this.add.image(x, y, "arrow").setDepth(99_999).setAngle(angle);
    const bob = { down: [0, 3], left: [-3, 0], right: [3, 0] }[exit.arrow];
    this.tweens.add({ targets: arrow, x: x + bob[0], y: y + bob[1], duration: 450, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add
      .text(x, y - 9, exit.label, { ...textStyle(8, COLORS.accent), stroke: css(COLORS.ink), strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setResolution(4)
      .setDepth(99_999);
  }

  private refreshSky(): void {
    if (this.phone) {
      this.phone.setVisible(!state.hasPhone);
      (this.phone.getData("glow") as Phaser.GameObjects.Image).setVisible(!state.hasPhone);
    }
    const sky = this.story.sky?.();
    if (sky) for (const w of this.windows) w.set(sky);
    ambience.set(this.windows.length ? sky : undefined);
  }

  private spotRect(spot: Spot, grow = 0): Phaser.Geom.Rectangle {
    const [w, h] = spot.size ?? [1, 1];
    return new Phaser.Geom.Rectangle(spot.at[0] * TILE - grow, spot.at[1] * TILE - grow, w * TILE + grow * 2, h * TILE + grow * 2);
  }

  private async interact(): Promise<void> {
    const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[this.facing];
    const px = this.player.x + dir[0] * 12;
    const py = this.player.y + 4 + dir[1] * 12;
    for (const [id, npc] of this.npcs) {
      if (Phaser.Geom.Rectangle.Inflate(npc.sprite.getBounds(), 4, 4).contains(px, py) && this.story.interact[id]) {
        this.faceNpc(id);
        return this.run(this.story.interact[id]);
      }
    }
    const spot = this.def.spots.find((s) => s.trigger !== "touch" && this.spotRect(s, 2).contains(px, py));
    if (spot && this.story.interact[spot.id]) await this.run(this.story.interact[spot.id]);
  }

  private checkTouch(): void {
    const feet = this.player.body!.center;
    const spot = this.def.spots.find((s) => s.trigger === "touch" && this.spotRect(s).contains(feet.x, feet.y));
    if (spot?.id === this.lastTouched) return;
    this.lastTouched = spot?.id;
    if (spot && this.story.interact[spot.id]) void this.run(this.story.interact[spot.id]);
  }

  private async togglePhone(): Promise<void> {
    if (!state.hasPhone) return;
    await this.run(({ ui }) =>
      ui.phone.browse([
        { title: "PREDICT", lines: state.phoneNotes.length ? state.phoneNotes.slice(-4) : ["No predictions yet."] },
        { title: "MESSAGES", lines: state.messages.length ? state.messages.slice(-3).map((m) => `${m.from}: ${m.text}`) : ["No messages."] },
        { title: "JUDGMENTS", lines: state.cards.length ? state.cards.map((c, i) => `${c.title}: ${state.judgments[i]?.action ?? ""}`) : ["No decisions yet."] },
      ]),
    );
  }

  private async run(fn: (ctx: StoryContext) => Promise<void>): Promise<void> {
    this.busy = true;
    try {
      await fn({ ui: ui(this), world: this });
    } finally {
      this.busy = false;
      this.refreshSky();
    }
  }
}
