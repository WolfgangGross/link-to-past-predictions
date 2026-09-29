import type * as Phaser from "phaser";
import { HEIGHT, WIDTH } from "../theme";
import { CONFIRM, nextKey } from "./keys";
import { createOverlay, escapeHtml } from "./overlay";
import { sfx } from "../audio";

// Tokyo Night, Omarchy's default theme. Drawn as HTML over the canvas so the text stays crisp (see overlay.ts).
export interface TermLine {
  text: string;
  win?: "left" | "right";
  color?: "fg" | "dim" | "blue" | "green" | "orange";
  /** Type the line out like a command. */
  typed?: boolean;
  pause?: number;
}

const CSS = `
.gm-term { white-space: normal; display: none; opacity: 0; transition: opacity 250ms; background: #1a1b26; font-size: calc(var(--k) * 9px); }
.gm-term .bar { display: flex; justify-content: space-between; align-items: center; height: calc(var(--k) * 16px); padding: 0 calc(var(--k) * 8px); background: #16161e; color: #6b74a0; }
.gm-term .bar .ws { color: #7aa2f7; letter-spacing: 0.2em; }
.gm-term .wins { position: absolute; left: calc(var(--k) * 8px); right: calc(var(--k) * 8px); top: calc(var(--k) * 24px); bottom: calc(var(--k) * 8px); display: flex; gap: calc(var(--k) * 8px); }
.gm-term .win { display: flex; flex-direction: column; min-width: 0; border: calc(var(--k) * 2px) solid #414868; }
.gm-term .win.left { flex: 58; border-color: #7aa2f7; }
.gm-term .win.right { flex: 42; }
.gm-term .win .title { padding: calc(var(--k) * 2px) calc(var(--k) * 8px); background: rgba(65, 72, 104, 0.35); color: #6b74a0; }
.gm-term .win.left .title { color: #7aa2f7; }
.gm-term .win .text { flex: 1; overflow: hidden; padding: calc(var(--k) * 8px); white-space: pre-wrap; word-break: break-word; }
.gm-term .win .text > div { margin-bottom: calc(var(--k) * 2px); }
.gm-term .hint { position: absolute; right: calc(var(--k) * 16px); bottom: calc(var(--k) * 12px); color: #6b74a0; }
`;

/** Full-screen Omarchy desktop: a waybar and two tiled Hyprland windows. */
export class Terminal {
  private readonly scene: Phaser.Scene;
  private readonly el: HTMLDivElement;
  private readonly panes: Record<"left" | "right", HTMLDivElement>;
  private readonly hint: HTMLDivElement;
  isOpen = false;
  /** For the playtest script: all lines printed, waiting for SPACE. */
  waiting = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { el } = createOverlay(scene, { x: 0, y: 0, w: WIDTH, h: HEIGHT });
    el.classList.add("gm-term");
    el.style.zIndex = "20";
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    el.innerHTML = `
      <div class="bar"><span class="ws">1 2 3</span><span>omarchy</span><span class="c-fg">09:02   100%</span></div>
      <div class="wins">
        <div class="win left"><div class="title">ada@posteriorlabs  ~/tabpfn</div><div class="text"></div></div>
        <div class="win right"><div class="title">train_chunked_attention.py</div><div class="text"></div></div>
      </div>
      <div class="hint">SPACE</div>`;
    this.el = el;
    this.panes = { left: el.querySelector(".left .text")!, right: el.querySelector(".right .text")! };
    this.hint = el.querySelector(".hint")!;
  }

  async play(script: TermLine[]): Promise<void> {
    for (const pane of Object.values(this.panes)) pane.replaceChildren();
    this.hint.style.visibility = "hidden";
    this.isOpen = true;
    this.el.style.display = "block";
    void this.el.offsetHeight; // apply display before fading in
    this.el.style.opacity = "1";
    await this.wait(250);
    for (const line of script) await this.print(line);
    this.hint.style.visibility = "visible";
    this.waiting = true;
    await nextKey(this.scene, CONFIRM);
    this.waiting = false;
    this.el.style.opacity = "0";
    await this.wait(250);
    this.el.style.display = "none";
    this.isOpen = false;
  }

  private async print(line: TermLine): Promise<void> {
    const pane = this.panes[line.win ?? "left"];
    const div = document.createElement("div");
    div.className = `c-${line.color ?? "fg"}`;
    pane.append(div);
    if (line.typed) {
      for (let i = 1; i <= line.text.length; i++) {
        div.innerHTML = escapeHtml(line.text.slice(0, i)) + '<span class="c-dim">▌</span>';
        pane.scrollTop = pane.scrollHeight;
        if (i % 2 === 0) sfx.key();
        await this.wait(28);
      }
      div.textContent = line.text;
    } else {
      div.textContent = line.text;
      sfx.key();
    }
    pane.scrollTop = pane.scrollHeight;
    await this.wait(line.pause ?? (line.typed ? 350 : 140));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }
}
