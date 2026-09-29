// Drive the game with a key script and take screenshots. Uses the system Chromium.
// Run: npx tsx scripts/shot.ts <url> <out-prefix> <steps...>
// Steps: Space | ArrowUp | hold:ArrowUp:400 | wait:1000 | shot:name
// Example: npx tsx scripts/shot.ts http://localhost:5173/ /tmp/s Space wait:1500 shot:home

import { chromium } from "playwright-core";

const [url, prefix, ...steps] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url);
await page.locator("canvas").waitFor();
await page.waitForTimeout(1200);

for (const step of steps) {
  const [cmd, a, b] = step.split(":");
  if (cmd === "wait") await page.waitForTimeout(Number(a));
  else if (cmd === "shot") {
    await page.screenshot({ path: `${prefix}-${a}.png` });
    console.log(`${prefix}-${a}.png`);
  } else if (cmd === "hold") {
    await page.keyboard.down(a);
    await page.waitForTimeout(Number(b));
    await page.keyboard.up(a);
    await page.waitForTimeout(80);
  } else {
    await page.keyboard.press(cmd);
    await page.waitForTimeout(250);
  }
}
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
await browser.close();
