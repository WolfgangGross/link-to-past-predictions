// Scripted headless playthrough with screenshots, driven by the game's own UI state (window.__game).
// Run: npx tsx scripts/playtest.ts [url] [screenshot-dir] [--rule]
//   --rule  follow the old rules instead of asking the phone (no predictions shown)

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const useRules = process.argv.includes("--rule");
const autopilot = process.argv.includes("--autopilot");
const url = args[0] ?? "http://localhost:5173/";
const outDir = args[1] ?? "playtest-shots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

interface UiState {
  dialog: string;
  text: string;
  dialing: boolean;
  card: boolean;
  report: boolean;
  terminal: boolean;
}

// Runs in the page; the game is untyped from here.
const uiState = (): Promise<UiState> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = (window as any).__game.scene.getScene("ui");
    return {
      dialog: ui.dialogue.mode,
      text: ui.dialogue.text.text,
      dialing: ui.phone.dialing,
      card: ui.card.isOpen,
      report: ui.report.isOpen,
      terminal: ui.terminal.waiting,
    };
  });

async function until(pred: (s: UiState) => boolean, what: string, timeoutMs = 30_000): Promise<UiState> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const s = await uiState();
    if (pred(s)) return s;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}; state=${JSON.stringify(s)}`);
    await page.waitForTimeout(100);
  }
}

let shotN = 0;
async function shot(name: string) {
  const file = path.join(outDir, `${String(++shotN).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("  shot", file);
}

const press = async (key: string) => {
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
};

/** Advance dialogue lines until a choice, the dial, a card, or the box closes. Logs each line. */
async function read(): Promise<UiState> {
  for (;;) {
    const s = await until((s) => s.dialog === "line" || s.dialog === "choice" || s.dialing || s.card || s.report || s.dialog === "closed", "dialogue");
    if (s.dialog !== "line") return s;
    console.log("  >", s.text.replace(/\n/g, " "));
    await press("Space");
    await page.waitForTimeout(150);
    const after = await uiState();
    if (after.dialog === "closed" && !after.dialing && !after.card && !after.report) {
      await page.waitForTimeout(200);
      const settled = await uiState();
      if (settled.dialog === "closed" && !settled.dialing && !settled.card && !settled.report) return settled;
    }
  }
}

/** Interact (or start) and read until the next decision point. */
async function talk(): Promise<UiState> {
  await press("Space");
  await until((s) => s.dialog === "line" || s.dialog === "choice", "dialogue to open");
  return read();
}

async function choose(index: number) {
  const s = await until((s) => s.dialog === "choice", "choice");
  console.log("  ?", s.text.replace(/\n/g, " | "), "->", index);
  const cursor = s.text.split("\n").slice(2).findIndex((l: string) => l.startsWith(">")); // where the cursor starts
  for (let i = cursor; i !== index; i += index > cursor ? 1 : -1) await press(index > cursor ? "ArrowDown" : "ArrowUp");
  await press("Space");
}

async function dial(steps: number) {
  await until((s) => s.dialing, "dial");
  const key = steps < 0 ? "ArrowLeft" : "ArrowRight";
  for (let i = 0; i < Math.abs(steps); i++) await press(key);
  await press("Space");
}

async function closeCard(name: string) {
  await until((s) => s.card, "card");
  await shot(name);
  await press("Space");
}

/** Keep advancing dialogue lines until the UI reaches a state (a card, a choice, ...). */
async function readUntil(pred: (s: UiState) => boolean, what: string, timeoutMs = 60_000): Promise<UiState> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const s = await uiState();
    if (pred(s)) return s;
    if (Date.now() > end) throw new Error(`Timed out reading until ${what}; state=${JSON.stringify(s)}`);
    if (s.dialog === "line") {
      console.log("  >", s.text.replace(/\n/g, " "));
      await press("Space");
    }
    await page.waitForTimeout(150);
  }
}

/** Keep advancing dialogue until the world has switched to the given map. */
async function readUntilMap(key: string, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while ((await page.evaluate(() => (window as any).__game.scene.getScene("world").mapKey)) !== key) {
    if (Date.now() > end) throw new Error(`Timed out waiting for map ${key}`);
    const s = await uiState();
    if (s.dialog === "line") {
      console.log("  >", s.text.replace(/\n/g, " "));
      await press("Space");
    }
    await page.waitForTimeout(150);
  }
}

async function walk(key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function teleport(col: number, row: number, facing: string) {
  await page.evaluate(
    ([c, r, f]) => (window as any).__game.scene.getScene("world").teleport(c, r, f), // eslint-disable-line @typescript-eslint/no-explicit-any
    [col, row, facing] as const,
  );
  await page.waitForTimeout(150);
}

// ---------------------------------------------------------------------------------------------

await page.goto(url);
await page.locator("canvas").waitFor();
await page.waitForTimeout(1200);
await shot("title");

console.log("intro");
await talk();

console.log("phone");
await teleport(3, 3.5, "up");
await talk();
await page.waitForTimeout(7000); // the phone seals its guesses about you (~5 s live call)
await shot("sealed-guess");

console.log("umbrella");
await teleport(8, 3, "up");
await talk();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await dial(-3);
  await until((s) => s.dialog === "line", "rain prediction");
  await shot("rain-prediction");
  await read();
  await closeCard("umbrella-card");
}
await read();

console.log("leo");
await teleport(15.6, 3.45, "up");
await talk();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await read();
  await dial(0);
  await until((s) => s.dialog === "line", "leo prediction");
  await shot("leo-prediction");
  await press("Space");
  await page.waitForTimeout(300);
  await until((s) => s.dialog === "line", "what moves it");
  await shot("leo-what-moves-it");
  const s = await read();
  if (s.dialog === "choice") {
    await shot("leo-whose-line");
    await choose(0);
    await read();
  }
  await closeCard("leo-card");
}
await read();

await page.waitForTimeout(6500); // sealing the school-run guess
console.log("school run");
await teleport(9, 9, "down");
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(400);
await page.keyboard.up("ArrowDown");
await until((s) => s.dialog === "line", "door dialogue");
await read();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await dial(0); // "late once in 10 runs"
  await until((s) => s.dialog === "line", "traffic prediction", 60_000);
  await shot("school-run-distributions");
  await read();
  await choose(0);
}
await read();

console.log("street");
await readUntilMap("street");
await page.waitForTimeout(600);
await shot("street-arrival");
const arrival = await read();
if (arrival.card) await closeCard("school-run-card");
await teleport(3, 7.1, "up");
await talk();
await shot("cafe");
await teleport(11, 7.1, "up");
await talk();
await teleport(18.5, 10.5, "right");
await walk("ArrowRight", 500);
await readUntilMap("office");

console.log("office");
await page.waitForTimeout(7000);
await read();
await teleport(2, 4, "up");
await press("Space");
await until((s) => s.terminal, "terminal", 30_000);
await shot("omarchy-claude");
await press("Space");
await until((s) => s.dialog === "line", "after terminal");
await read();

console.log("gpu");
await teleport(18, 4, "left");
await talk();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await until((s) => s.dialog === "line", "gpu ranking", 60_000);
  await shot("gpu-ranking");
  await readUntil((s) => s.dialog === "choice", "whose ranking");
  await choose(0);
  await readUntil((s) => s.card, "gpu card");
  await closeCard("gpu-card");
}
await read();

console.log("avocados");
await teleport(13.5, 9.1, "up");
await talk();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await dial(0);
  await until((s) => s.dialog === "line", "avocado forecast", 60_000);
  await shot("avocado-forecast");
  await press("Space");
  await page.waitForTimeout(300);
  await until((s) => s.dialog === "line", "waste line");
  await press("Space");
  await page.waitForTimeout(300);
  await until((s) => s.dialog === "line", "bullwhip");
  await shot("bullwhip");
  await readUntil((s) => s.card, "avocado card");
  await closeCard("avocado-card");
}
await read();

console.log("to the field");
await teleport(9, 10, "down");
await walk("ArrowDown", 400);
await readUntilMap("field");

console.log("field");
await page.waitForTimeout(7000);
await read();
await teleport(8.5, 6.4, "left");
await talk();
await choose(useRules ? 0 : 1);
if (!useRules) {
  await until((s) => s.dialog === "line", "reinjury", 60_000);
  await shot("reinjury");
  await read();
  await dial(0);
  await read();
  await choose(1);
  await readUntil((s) => s.card, "final card");
  await closeCard("final-card");
}
await read();
await teleport(2.5, 8.5, "left");
await walk("ArrowLeft", 500);
await readUntilMap("evening");

console.log("evening");
await page.waitForTimeout(600);
await read();
await teleport(3, 4, "left");
await press("Space");
await readUntil((s) => s.report, "report");
await shot("report-1");
await press("Space");
await page.waitForTimeout(300);
await shot("report-2");
await press("Space");
await page.waitForTimeout(300);
await shot("report-3");
await press("Space");
await readUntil((s) => s.dialog === "choice", "tomorrow");
await shot("tomorrow");
await choose(autopilot ? 0 : 1);
await read().catch(() => undefined); // ends with a reload into day 2

if (autopilot) {
  console.log("day 2 (autopilot)");
  await page.waitForTimeout(2500);
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(1200);
  await shot("day2-title");
  await talk();
  await teleport(3, 3.5, "up");
  await talk();
  await teleport(8, 3, "up");
  await talk();
  const s = await readUntil((s) => s.dialog === "line" && s.text.includes("The phone chose"), "autopilot choice");
  await shot("day2-autopilot");
  console.log("  autopilot:", s.text.replace(/\n/g, " | "));
  await readUntil((s) => s.card, "day 2 umbrella card");
  await shot("day2-umbrella-card");
}

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await browser.close();
