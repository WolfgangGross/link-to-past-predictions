import * as Phaser from "phaser";
import { TILE, WORLD_ZOOM } from "../theme";
import { CONFIRM } from "../ui/keys";
import { ui, type UIScene } from "../scenes/UIScene";
import { state } from "../state";
import { FIRST_GID, SHEETS, SHEET_ORDER, charFrame, gid, type Character, type Facing } from "./tiles";
import type { MapDef, Spot } from "./MapDef";
import { MAPS, STORIES } from "./registry";

const SPEED = 90;

export interface StoryContext {
  ui: UIScene;
  world: WorldScene;
}

export interface Story {
  onEnter?: (ctx: StoryContext) => Promise<void>;
  /** Handlers keyed by spot id or NPC id. */
  interact: Record<string, (ctx: StoryContext) => Promise<void>>;
}

interface Npc {
  sprite: Phaser.Physics.Arcade.Sprite;
  who: Character;
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

  constructor() {
    super("world");
  }

  init(data: { map: string }): void {
    this.def = MAPS[data.map];
    this.story = STORIES[data.map];
    this.npcs.clear();
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
      const target = prop.wall ? wallDecor : prop.solid ? furniture : decor;
      prop.tiles.forEach((row, dy) =>
        row.forEach((index, dx) => {
          if (index !== null) target.putTileAt(gid([prop.sheet, index]), prop.at[0] + dx, prop.at[1] + dy);
        }),
      );
    }
    walls.setCollisionByExclusion([-1]);
    furniture.setCollisionByExclusion([-1]);

    this.physics.world.setBounds(0, 0, width * TILE, height * TILE);
    const [sx, sy] = def.spawn.at;
    this.player = this.physics.add.sprite((sx + 0.5) * TILE, (sy + 0.5) * TILE, "urban-sprites", charFrame("ada", def.spawn.facing));
    this.player.setCollideWorldBounds(true).setSize(10, 7).setOffset(3, 9);
    this.facing = def.spawn.facing;
    this.physics.add.collider(this.player, [walls, furniture]);

    for (const n of def.npcs) {
      const sprite = this.physics.add.sprite((n.at[0] + 0.5) * TILE, (n.at[1] + 0.5) * TILE, "urban-sprites", charFrame(n.who, n.facing));
      sprite.setScale(n.scale ?? 1).setImmovable(true).setSize(10, 7).setOffset(3, 9);
      (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.physics.add.collider(this.player, sprite);
      this.npcs.set(n.id, { sprite, who: n.who });
    }

    const cam = this.cameras.main;
    cam.setZoom(WORLD_ZOOM).setBounds(0, 0, width * TILE, height * TILE).startFollow(this.player, true);
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

  update(): void {
    for (const s of [this.player, ...[...this.npcs.values()].map((n) => n.sprite)]) s.setDepth(s.y);
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
    this.checkTouch();
  }

  // ---- API for story scripts -------------------------------------------------

  /** Leaves this map and enters another. */
  goto(map: string): void {
    this.leaving = true;
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

  private spotRect(spot: Spot, grow = 0): Phaser.Geom.Rectangle {
    const [w, h] = spot.size ?? [1, 1];
    return new Phaser.Geom.Rectangle(spot.at[0] * TILE - grow, spot.at[1] * TILE - grow, w * TILE + grow * 2, h * TILE + grow * 2);
  }

  private async interact(): Promise<void> {
    const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[this.facing];
    const px = this.player.x + dir[0] * 12;
    const py = this.player.y + 4 + dir[1] * 12;
    for (const [id, npc] of this.npcs) {
      if (npc.sprite.getBounds().contains(px, py) && this.story.interact[id]) {
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
    }
  }
}
