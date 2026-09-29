import type * as Phaser from "phaser";
import { apiLog, type ApiCall, type CallTrace } from "../predict/api";
import { DOWN, UP } from "./keys";
import { createOverlay, escapeHtml } from "./overlay";

// Tokyo Night again, like the Terminal: the phone's network inspector is a developer tool.
const T = { bg: 0x1a1b26, border: 0x414868, fg: 0xc0caf5, dim: 0x565f89, blue: 0x7aa2f7, green: 0x9ece6a, orange: 0xff9e64, red: 0xf7768e, teal: 0x73daca };
type Color = keyof typeof T;

const ITEMS_IN_SUMMARY = 1;

interface Seg {
  t: string;
  c: Color;
  bold?: boolean;
}
type Line = Seg[];
/** A run of segments that stays together when a long line wraps. */
type Group = Seg[];

const P = (t: string): Seg => ({ t, c: "dim" });
const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));

function scalar(v: unknown): Seg {
  if (typeof v === "number") return { t: num(v), c: "orange" };
  if (typeof v === "string") return { t: JSON.stringify(v), c: "green" };
  return { t: String(v), c: "red" };
}

/** Flat JSON value as groups, so arrays and objects can wrap between items. */
function groups(v: unknown): Group[] {
  if (Array.isArray(v)) return [[P("[")], ...v.flatMap((item, i) => withComma(groups(item), i < v.length - 1)), [P("]")]];
  if (typeof v === "object" && v !== null) {
    const entries = Object.entries(v);
    return [[P("{")], ...entries.flatMap(([k, val], i) => withComma(pair(k, val), i < entries.length - 1)), [P("}")]];
  }
  return [[scalar(v)]];
}

function pair(k: string, v: unknown): Group[] {
  const [first, ...rest] = groups(v);
  return [[{ t: JSON.stringify(k), c: "blue" }, P(": "), ...first], ...rest];
}

function withComma(gs: Group[], comma: boolean): Group[] {
  const out = gs.map((g) => [...g]);
  out[out.length - 1].push(P(comma ? ", " : " "));
  return out;
}

/** Greedy wrap of groups into lines of at most `cols` characters; continuation lines are indented. */
function flow(gs: Group[], indent: number, cols: number): Line[] {
  const lines: Line[] = [];
  let line: Line = [{ t: " ".repeat(indent), c: "dim" }];
  let len = indent;
  for (const g of gs) {
    const w = g.reduce((n, s) => n + s.t.length, 0) - (g.at(-1)!.t.length - g.at(-1)!.t.trimEnd().length); // trailing spaces may overhang
    if (len + w > cols && len > indent) {
      lines.push(line);
      line = [{ t: " ".repeat(indent + 2), c: "dim" }];
      len = indent + 2;
    }
    line.push(...g);
    len += w;
  }
  lines.push(line);
  return lines;
}

/** Pretty-printed object: one key per line, arrays one item per line, long items wrapped. `limit` cuts arrays short. */
function pretty(obj: Record<string, unknown>, cols: number, limit = Infinity, bare = false): Line[] {
  const lines: Line[] = bare ? [] : [[P("{")]];
  const entries = Object.entries(obj);
  entries.forEach(([k, v], ei) => {
    const key: Seg[] = [P("  "), { t: JSON.stringify(k), c: "blue" }, P(": ")];
    const tail = ei < entries.length - 1 ? "," : "";
    if (Array.isArray(v) && v.some((x) => typeof x === "object" && x !== null)) {
      lines.push([...key, P("[")]);
      v.slice(0, limit).forEach((item, i) => {
        const more = i < v.length - 1;
        lines.push(...flow(withComma(groups(item), more), 4, cols));
      });
      if (v.length > limit) lines.push([P(`    … ${v.length - limit} more`)]);
      lines.push([P(`  ]${tail}`)]);
    } else {
      const [first, ...rest] = pair(k, v);
      const flowed = flow([first, ...rest], 2, cols);
      flowed[flowed.length - 1].push(P(tail));
      lines.push(...flowed);
    }
  });
  if (!bare) lines.push([P("}")]);
  return lines;
}

interface Row {
  gap?: boolean;
  line: Line;
}

const heading = (text: string): Row => ({ gap: true, line: [{ t: text, c: "blue", bold: true }] });
const rows = (lines: Line[]): Row[] => lines.map((line) => ({ line }));
const plain = (text: string, c: Color = "fg"): Row => ({ line: [{ t: text, c }] });

function build(call: ApiCall, full: boolean, cols: number): Row[] {
  const { trace, ...wire } = (call.response ?? {}) as Record<string, unknown> & { trace?: CallTrace };
  const limit = full ? Infinity : ITEMS_IN_SUMMARY;
  const failed = (call.status ?? 0) >= 400;
  const out: Row[] = [heading("browser  →  our server"), plain("POST /api/predict", "teal"), ...rows(pretty(call.request, cols, limit, !full))];
  if (trace) {
    const p = trace.predictParams;
    const cached = wire.cached === true;
    out.push(
      heading("our server  →  api.priorlabs.ai"),
      plain(`POST /tabpfn/fit       ${cached ? "as in the first call" : trace.fit === "fitted" ? "fitted now" : "reused fit"}`, "orange"),
      plain("POST /tabpfn/predict", "orange"),
      full
        ? plain(`model_path ${trace.modelPath} · task ${trace.task}`, "fg")
        : plain(`${trace.modelPath} · ${trace.task} · ${p.output_type} · ${wire.trainRows} rows × ${trace.columns.length} cols`, "fg"),
      ...(full ? rows(pretty({ predict_params: p }, cols)) : []),
      ...(full
        ? [plain(`train set: ${wire.trainRows} rows × ${trace.columns.length} cols, ${trace.trainSampleNote}:`, "dim"), ...rows(pretty({ columns: trace.columns, rows: trace.trainSample }, cols))]
        : []),
    );
  } else {
    out.push(heading("our server  →  api.priorlabs.ai"), plain("POST /tabpfn/fit        the past = train set", "orange"), plain("POST /tabpfn/predict    your rows = test set", "orange"));
  }
  const timings = Object.entries(trace?.timings ?? {}).filter(([k]) => k === "fit" || k === "predict");
  const origin = wire.cached ? "cached, no tokens" : "live";
  out.push(
    heading(`api  →  browser   ${call.status} · ${call.ms} ms · ${origin}`),
    ...rows(pretty(wire, cols, limit, !full).map((l) => l.map((s) => (failed && s.c === "green" ? { ...s, c: "red" as Color } : s)))),
  );
  if (timings.length && !wire.cached) out.push(plain(`TabPFN API: ${timings.map(([k, v]) => `${k} ${Math.round(v)} ms`).join(" · ")}`, "dim"));
  if (!full) out.push(plain("F: full payload", "dim"));
  return out;
}

function buildLive(call: ApiCall, cols: number): Row[] {
  const dots = ".".repeat(1 + (Math.floor(performance.now() / 300) % 3));
  return [
    heading("browser  →  our server"),
    plain("POST /api/predict", "teal"),
    ...rows(pretty(call.request, cols, ITEMS_IN_SUMMARY)),
    heading("our server  →  api.priorlabs.ai"),
    plain("POST /tabpfn/fit        the past = train set", "orange"),
    plain("POST /tabpfn/predict    your rows = test set", "orange"),
    plain(`waiting ${((performance.now() - call.startedAt) / 1000).toFixed(1)}s${dots}`, "dim"),
  ];
}

const CHAR_EM = 0.6; // JetBrains Mono advance, in em
const FONT_PX = 8; // game pixels
const CSS = `
.gm-api { border: calc(var(--k) * 2px) solid #414868; border-radius: calc(var(--k) * 6px); display: flex; flex-direction: column; }
.gm-api header { display: flex; justify-content: space-between; padding: calc(var(--k) * 5px) calc(var(--k) * 10px) calc(var(--k) * 3px); }
.gm-api .body { flex: 1; overflow-y: auto; padding: 0 calc(var(--k) * 10px) calc(var(--k) * 6px); scrollbar-width: thin; scrollbar-color: #7aa2f7 #2a2c3d; }
.gm-api .gap { margin-top: calc(var(--k) * 5px); }
`;

/** Network inspector beside the phone: the real request, the TabPFN calls behind it, and the real response. */
export class ApiPanel {
  private readonly scene: Phaser.Scene;
  private readonly el: HTMLDivElement;
  private readonly hintEl: HTMLSpanElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly place: () => number;
  private timer?: Phaser.Time.TimerEvent;
  private watching = false;
  private hidden = false;
  private shown = false;
  private done?: ApiCall;
  private full = false;

  constructor(scene: Phaser.Scene, box: { x: number; y: number; w: number; h: number }) {
    this.scene = scene;
    const { el, place } = createOverlay(scene, box);
    this.el = el;
    this.place = place;
    el.classList.add("gm-api");
    if (!document.getElementById("gm-api-style")) {
      const style = document.createElement("style");
      style.id = "gm-api-style";
      style.textContent = CSS;
      document.head.append(style);
    }
    el.innerHTML = '<header class="c-dim"><span class="b">NETWORK</span><span class="hint"></span></header><div class="body"></div>';
    this.hintEl = el.querySelector(".hint")!;
    this.bodyEl = el.querySelector(".body")!;
    scene.input.keyboard!.on("keydown", (e: KeyboardEvent) => {
      if (!this.shown) return;
      if (e.code === "KeyC" && !e.repeat) this.setHidden(!this.hidden);
      else if (this.hidden) return;
      else if (e.code === "KeyF" && !e.repeat && this.done) this.toggleFull();
      else if (UP.includes(e.code)) this.bodyEl.scrollBy({ top: -this.lineHeight() * 2 });
      else if (DOWN.includes(e.code)) this.bodyEl.scrollBy({ top: this.lineHeight() * 2 });
    });
  }

  /** Follow the next /api/predict call for `dataset`: live request while it runs, then the response. */
  watch(dataset: string): void {
    this.stop();
    this.shown = true;
    this.watching = true;
    this.done = undefined;
    this.full = false;
    this.hintEl.textContent = "C hide";
    this.el.style.display = this.hidden ? "none" : "";
    this.render([plain("waiting for a request...", "dim")]);
    const tick = () => {
      const call = apiLog.inflight[dataset];
      const done = apiLog.last[dataset];
      if (call) this.render(buildLive(call, this.cols()));
      else if (done) {
        // Finished (possibly before the phone asked): show the whole exchange and stop polling.
        this.done = done;
        this.show();
        this.stop();
      }
    };
    tick();
    if (this.watching) this.timer = this.scene.time.addEvent({ delay: 200, loop: true, callback: tick });
  }

  hide(): void {
    this.stop();
    this.shown = false;
    this.el.style.display = "none";
  }

  private stop(): void {
    this.timer?.remove();
    this.timer = undefined;
    this.watching = false;
  }

  private setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.el.style.display = this.shown && !hidden ? "" : "none";
  }

  private lineHeight(): number {
    return parseFloat(getComputedStyle(this.bodyEl).lineHeight) || 16;
  }

  /** Characters per line at the current scale, so long JSON wraps between items instead of mid-token. */
  private cols(): number {
    const k = this.place();
    const inner = this.bodyEl.clientWidth - 2 * 10 * k - 8;
    return Math.max(30, Math.floor(inner / (FONT_PX * k * CHAR_EM)));
  }

  private show(): void {
    if (!this.done) return;
    this.hintEl.textContent = this.full ? "F summary  ↑↓ scroll" : "C hide  F full  ↑↓ scroll";
    this.render(build(this.done, this.full, this.cols()));
    this.bodyEl.scrollTop = 0;
  }

  private toggleFull(): void {
    this.full = !this.full;
    this.show();
  }

  private render(rows: Row[]): void {
    this.bodyEl.innerHTML = rows
      .map((row) => `<div${row.gap ? ' class="gap"' : ""}>${row.line.map((s) => `<span class="c-${s.c}${s.bold ? " b" : ""}">${escapeHtml(s.t)}</span>`).join("") || " "}</div>`)
      .join("");
  }
}
