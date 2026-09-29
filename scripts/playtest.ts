// Headless playthrough of the current build with screenshots. Uses the system Chromium.
// Run: npx tsx scripts/playtest.ts [url] [screenshot-dir]
// Makes at most one live prediction (cached by the server after the first run).

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5173/";
const outDir = process.argv[3] ?? "playtest-shots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

let shot = 0;
const snap = async (name: string) => {
  const file = path.join(outDir, `${String(++shot).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("shot", file);
};
const wait = (ms: number) => page.waitForTimeout(ms);
const hold = async (p: Page, key: string, ms: number) => {
  await p.keyboard.down(key);
  await wait(ms);
  await p.keyboard.up(key);
  await wait(80);
};
const tap = async (key: string, pause = 250) => {
  await page.keyboard.press(key);
  await wait(pause);
};
/** Advance n dialogue lines, letting each finish typing first. */
const advance = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await wait(1600);
    await tap("Space", 150);
  }
};

await page.goto(url);
await page.locator("canvas").waitFor();
await wait(1500);
await snap("title");

await tap("Space", 900);
await wait(800);
await snap("intro");
await advance(2);

// Walk up beside the nightstand, face it, pick up the phone.
await hold(page, "ArrowUp", 450);
await hold(page, "ArrowLeft", 60);
await tap("Space", 400);
await wait(1200);
await snap("phone-found");
await advance(4);

// Down, right past the desk, up to the window.
await hold(page, "ArrowDown", 300);
await hold(page, "ArrowRight", 1500);
await hold(page, "ArrowUp", 500);
await tap("Space", 300);
await advance(2);
await wait(1200);
await snap("umbrella-choice");
await tap("ArrowDown");
await tap("Space", 600);
for (let i = 0; i < 3; i++) await tap("ArrowLeft", 120);
await snap("threshold-dial");
await tap("Space", 300);
await snap("phone-thinking");
await wait(9000);
await snap("prediction");
await advance(2);

// To the door.
await hold(page, "ArrowDown", 1300);
await hold(page, "ArrowLeft", 650);
await hold(page, "ArrowDown", 300);
await tap("Space", 300);
await wait(1500);
await snap("outside");

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await browser.close();
