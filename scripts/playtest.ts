// Scripted headless playthrough with screenshots, driven by the game's own UI state (window.__game).
// Run: npx tsx scripts/playtest.ts [url] [screenshot-dir] [--rule]
//   --rule  follow the old rules instead of asking the phone (no predictions shown)

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const useRules = process.argv.includes("--rule");
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
}

// Runs in the page; the game is untyped from here.
const uiState = (): Promise<UiState> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ui = (window as any).__game.scene.getScene("ui");
    return { dialog: ui.dialogue.mode, text: ui.dialogue.text.text, dialing: ui.phone.dialing, card: ui.card.isOpen };
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
    const s = await until((s) => s.dialog === "line" || s.dialog === "choice" || s.dialing || s.card || s.dialog === "closed", "dialogue");
    if (s.dialog !== "line") return s;
    console.log("  >", s.text.replace(/\n/g, " "));
    await press("Space");
    await page.waitForTimeout(150);
    const after = await uiState();
    if (after.dialog === "closed" && !after.dialing && !after.card) {
      await page.waitForTimeout(200);
      const settled = await uiState();
      if (settled.dialog === "closed" && !settled.dialing && !settled.card) return settled;
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
  for (let i = 0; i < index; i++) await press("ArrowDown");
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

console.log("umbrella");
await teleport(4, 3, "up");
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
await teleport(20.6, 3.45, "up");
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

console.log("school run");
await teleport(11.5, 13, "down");
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
await teleport(8, 7.1, "up");
await talk();
await shot("cafe");
await teleport(22, 7.1, "up");
await talk();
await teleport(36.5, 11.5, "right");
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowRight");
await until((s) => s.dialog === "line", "tram");
await read().catch(() => undefined); // the build ends with a page reload

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await browser.close();
