import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs: string[] = [];
p.on("pageerror", (e) => errs.push(e.message));
await p.addInitScript(() => {
  const w = window as any;
  const c = AudioNode.prototype.connect;
  (AudioNode.prototype as any).connect = function (dest: any, ...a: any[]) {
    if (dest instanceof AudioDestinationNode) {
      const an = dest.context.createAnalyser(); an.fftSize = 2048; w.__an = an;
      c.call(this, an);
    }
    return c.call(this, dest, ...a);
  };
  w.__peak = () => { const d = new Float32Array(2048); let m = 0, rms = 0; for (let i = 0; i < 40; i++) {} w.__an.getFloatTimeDomainData(d); for (const v of d) { m = Math.max(m, Math.abs(v)); rms += v * v; } return [m, Math.sqrt(rms / d.length)]; };
});
for (const map of ["home", "street", "office", "field", "evening"]) {
  await p.goto(`http://localhost:5173/?map=${map}`);
  await p.waitForTimeout(800);
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(3000);
  let peak = 0, rms = 0;
  for (let i = 0; i < 40; i++) { const [m, r] = await p.evaluate(() => (window as any).__peak()); peak = Math.max(peak, m); rms = Math.max(rms, r); await p.waitForTimeout(100); }
  console.log(map, "peak", peak.toFixed(3), "rms", rms.toFixed(3));
}
console.log(errs);
await b.close();
