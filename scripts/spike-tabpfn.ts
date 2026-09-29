// Week-1 spike: measure live TabPFN REST latency for the game's request shapes.
// Run: npm run spike   (each prediction costs >= 10K tokens; this script makes 6)

import { TabPFNClient, type Row, type Cell, type Timings } from "../server/tabpfn.js";

const client = new TabPFNClient({ apiKey: process.env.TABPFN_API_KEY ?? "" });

// Deterministic PRNG so runs are comparable.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

function playerRows(n: number): { X: Row[]; y: Cell[] } {
  const X: Row[] = [];
  const y: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const costOn = pick(["self", "others", "kids"]);
    const pressure = Math.round(rand() * 10);
    const risk = Math.round(rand() * 100) / 100;
    X.push({
      scene: pick(["umbrella", "sick_kid", "school_run", "gpu", "avocado", "final"]),
      cost_on: costOn,
      time_pressure: pressure,
      predicted_risk: risk,
      revealed: rand() < 0.5,
      prev_choice: pick(["rule", "prediction"]),
      day: 1 + Math.floor(rand() * 2),
      clock_min: 390 + Math.floor(rand() * 800),
    });
    // Persona: follows the prediction unless the cost lands on others and the risk is high.
    const followsPrediction = costOn === "others" ? risk < 0.2 : pressure > 4 || risk < 0.5;
    y.push(followsPrediction !== rand() < 0.15 ? "prediction" : "rule");
  }
  return { X, y };
}

function trafficRows(n: number): { X: Row[]; y: Cell[] } {
  const X: Row[] = [];
  const y: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const route = pick(["A", "B", "C"]);
    const depart = 420 + Math.floor(rand() * 90);
    const rain = rand() < 0.3;
    const schoolDay = rand() < 0.7;
    const base = { A: 14, B: 18, C: 22 }[route]!;
    const rush = Math.max(0, 1 - Math.abs(depart - 465) / 30) * (route === "A" ? 12 : 5);
    const tail = rand() < 0.08 ? 10 + rand() * 25 : 0; // heavy-tailed incidents
    X.push({ route, depart_min: depart, rain, school_day: schoolDay });
    y.push(Math.round((base + rush * (schoolDay ? 1 : 0.3) + (rain ? 4 : 0) + tail + rand() * 3) * 10) / 10);
  }
  return { X, y };
}

function symptomRows(n: number): { X: Row[]; y: Cell[] } {
  const mild = ["my nose is runny", "i sneezed a bit", "my throat tickles", "i'm just tired", "nothing hurts"];
  const sick = ["my head is hot", "my tummy is grumpy and i feel hot", "i coughed all night", "everything hurts", "i feel shivery"];
  const X: Row[] = [];
  const y: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const contagious = rand() < 0.35;
    const temp = Math.round((contagious ? 37.6 + rand() * 1.6 : 36.4 + rand() * 1.0) * 10) / 10;
    X.push({ said: pick(contagious ? sick : mild), temperature_c: temp, days_since_onset: Math.floor(rand() * 5) });
    y.push(contagious ? "contagious" : "fine");
  }
  return { X, y };
}

async function measure(label: string, fn: (t: Timings) => Promise<unknown>) {
  const timings: Timings = {};
  const start = performance.now();
  try {
    const out = await fn(timings);
    const total = performance.now() - start;
    const steps = Object.entries(timings).map(([k, v]) => `${k}=${(v / 1000).toFixed(2)}s`).join(" ");
    console.log(`\n■ ${label}\n  total=${(total / 1000).toFixed(2)}s  ${steps}\n  result=${JSON.stringify(out).slice(0, 220)}`);
  } catch (err) {
    console.log(`\n■ ${label}\n  FAILED after ${((performance.now() - start) / 1000).toFixed(2)}s: ${(err as Error).message}`);
  }
}

const player = playerRows(41);
const playerTest: Row[] = [{ scene: "final", cost_on: "kids", time_pressure: 7, predicted_risk: 0.15, revealed: true, prev_choice: "prediction", day: 1, clock_min: 1230 }];
let playerFitId = "";

await measure("A  player model, 40 rows, v3.5, cold fit + predict", async (t) => {
  playerFitId = await client.fit(player.X.slice(0, 40), player.y.slice(0, 40), "classification", {}, t);
  return (await client.predict(playerFitId, playerTest, "classification", { output_type: "probas" }, t)).prediction;
});

await measure("B  player model, 41 rows (new decision logged), v3.5-fast, fit + predict", async (t) => {
  const id = await client.fit(player.X, player.y, "classification", { modelPath: "v3.5-fast_default" }, t);
  return (await client.predict(id, playerTest, "classification", { output_type: "probas" }, t)).prediction;
});

await measure("C  re-predict on existing fit (static dataset path)", async (t) => {
  const test = [{ ...playerTest[0], cost_on: "others", predicted_risk: 0.4 }];
  return (await client.predict(playerFitId, test, "classification", { output_type: "probas" }, t)).prediction;
});

const traffic = trafficRows(2000);
const trafficTest: Row[] = ["A", "B", "C"].map((route) => ({ route, depart_min: 460, rain: true, school_day: true }));
let trafficFitId = "";

await measure("D1 traffic regression, 2K rows, fit_with_cache, quantiles", async (t) => {
  trafficFitId = await client.fit(traffic.X, traffic.y, "regression", { fitMode: "fit_with_cache" }, t);
  return (await client.predict(trafficFitId, trafficTest, "regression", { output_type: "quantiles", quantiles: [0.1, 0.5, 0.9] }, t)).prediction;
});

await measure("D2 traffic regression, cached re-predict", async (t) => {
  const test = trafficTest.map((r) => ({ ...r, depart_min: 440, rain: false }));
  return (await client.predict(trafficFitId, test, "regression", { output_type: "quantiles", quantiles: [0.1, 0.5, 0.9] }, t)).prediction;
});

const symptoms = symptomRows(150);
await measure("E  text column (kid symptoms), 150 rows, fit + predict", async (t) => {
  const id = await client.fit(symptoms.X, symptoms.y, "classification", {}, t);
  const test = [{ said: "my head is hot and my tummy is grumpy", temperature_c: 37.9, days_since_onset: 1 }];
  return (await client.predict(id, test, "classification", { output_type: "probas" }, t)).prediction;
});
