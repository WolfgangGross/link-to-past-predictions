// Scene 4 — the school run (the book's airport example): leave early by rule, or later by prediction.

import { predictQuantiles, type NoSignal, type QuantilePrediction } from "../predict/api";
import { logJudgment, state, type JudgmentCard } from "../state";
import { willItRain } from "./umbrella";
import type { UIScene } from "../scenes/UIScene";

export const ROUTES = [
  { id: "car_main_road", label: "Car, main road" },
  { id: "car_old_town", label: "Car, old town" },
  { id: "bike_path", label: "Bike path" },
] as const;
type Route = (typeof ROUTES)[number];

const DEPARTURES = [45, 55, 65]; // minutes after 7:00
export const SCHOOL_STARTS = 75; // 8:15
const WEEKDAY = 1; // Tuesday
const HERD_MINUTES = 6; // when every parent's phone sends them down the same road

export const clock = (m: number) => `${7 + Math.floor(m / 60)}:${String(Math.floor(m) % 60).padStart(2, "0")}`;

export const CARD: JudgmentCard = {
  title: "The school run",
  falseNegative: "Leave too late: Mia misses the start of class.",
  falsePositive: "Leave too early: twenty minutes standing at the gate.",
  whoBears: "Mia if you're late. You if you're early. The gate cafe if nobody waits.",
  whoDecides: "You. And every other parent whose phone gives the same advice.",
  oldRule: '"Leave 30 minutes early". The gate cafe was built around it.',
};

let traffic: Promise<QuantilePrediction | NoSignal> | undefined;

/** 3 departures × 3 routes in one call. Needs the rain, so it starts once the umbrellas are settled. */
export async function prefetchTraffic(): Promise<QuantilePrediction | NoSignal> {
  if (!traffic) {
    const rain = (await willItRain()) ? 1 : 0;
    traffic ??= predictQuantiles(
      "traffic",
      DEPARTURES.flatMap((d) => ROUTES.map((r) => ({ route: r.id, depart_min: d, weekday: WEEKDAY, rain, roadworks_old_town: 1 }))),
    );
  }
  return traffic;
}

const rowIndex = (depart: number, route: Route) => DEPARTURES.indexOf(depart) * ROUTES.length + ROUTES.indexOf(route);

/** Draws a travel time from the predicted quantiles (piecewise-linear inverse CDF, stretched tails). */
function sampleMinutes(q: Record<number, number>): number {
  const levels = Object.keys(q).map(Number).sort((a, b) => a - b);
  const u = Math.random();
  if (u <= levels[0]) return q[levels[0]] - (levels[0] - u) * 10;
  for (let i = 1; i < levels.length; i++) {
    const [a, b] = [levels[i - 1], levels[i]];
    if (u <= b) return q[a] + ((q[b] - q[a]) * (u - a)) / (b - a);
  }
  const last = levels[levels.length - 1];
  return q[last] + (u - last) * 400;
}

export async function schoolRun(ui: UIScene): Promise<void> {
  ui.setClock("07:45");
  await ui.dialogue.say([
    "7:45. Shoes on. School starts at 8:15.",
    "The rule: LEAVE 30 MINUTES EARLY. You'll wait at the gate, but you're never late.",
  ]);
  const pick = await ui.dialogue.choose("When do you leave?", ["Follow the rule: leave now", "Ask the phone"]);
  if (pick === 0) return depart(45, ROUTES[0], "rule");

  await ui.phone.open();
  const oneIn = await ui.phone.pick("YOUR JUDGMENT", "Being late is OK once in...", [2, 5, 10, 20, 50], (v) => `${v} runs`, 2);
  const level = 1 - 1 / oneIn; // 0.5 … 0.98: exactly the quantiles the server returns
  ui.phone.thinking("THE SCHOOL RUN");
  const result = await prefetchTraffic();
  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. The rule it is: leave now.");
    await ui.phone.close();
    return depart(45, ROUTES[0], "no_signal", level);
  }

  // The latest departure that still makes it at your level; ties go to the faster median.
  let best: { depart: number; route: Route } | undefined;
  for (const d of DEPARTURES) {
    for (const r of ROUTES) {
      const q = result.rows[rowIndex(d, r)];
      if (d + q[level] > SCHOOL_STARTS) continue;
      if (!best || d > best.depart || (d === best.depart && q[0.5] < result.rows[rowIndex(best.depart, best.route)][0.5])) best = { depart: d, route: r };
    }
  }
  const shown = best?.depart ?? DEPARTURES[0];
  ui.phone.showDistributions(
    `LEAVING AT ${clock(shown)}`,
    ROUTES.map((r) => {
      const q = result.rows[rowIndex(shown, r)];
      return { label: r.label, q: Object.fromEntries(Object.entries(q).map(([k, v]) => [k, shown + v])) };
    }),
    { min: shown + 5, max: SCHOOL_STARTS + 10, deadline: SCHOOL_STARTS, format: clock },
    [`Red line: school starts.`, `${result.trainRows.toLocaleString("en")} past runs.`],
  );
  if (!best) {
    await ui.dialogue.say("Not even leaving now is safe enough for your line. The phone agrees with the rule.");
    await ui.phone.close();
    return depart(45, ROUTES[0], "prediction", level);
  }

  const gained = best.depart - 45;
  await ui.dialogue.say([
    `The phone: leave at ${clock(best.depart)}, ${best.route.label.toLowerCase()}. Late about once in ${oneIn} runs.`,
    gained > 0 ? `That's ${gained} more minutes at home.` : "No time to win today.",
  ]);
  const go = await ui.dialogue.choose("Well?", [`Leave at ${clock(best.depart)}`, "Leave now anyway"]);
  await ui.phone.close();
  if (go === 1) return depart(45, ROUTES[0], "rule", level);
  if (gained > 0) await ui.dialogue.say(`${gained} extra minutes: pancakes with Mia. Sam steals one.`);
  return depart(best.depart, best.route, "prediction", level);
}

async function depart(at: number, route: Route, choice: "rule" | "prediction" | "no_signal", level?: number): Promise<void> {
  const result = await (traffic ?? Promise.resolve(undefined));
  let travel = result?.ok ? sampleMinutes(result.rows[rowIndex(at, route)]) : 17;
  // The phone learned from mornings when nobody had it. Now every parent follows the same advice.
  const herd = choice === "prediction" && route.id !== "bike_path";
  if (herd) travel += HERD_MINUTES;
  const arrive = Math.round(at + Math.max(5, travel));
  const late = arrive > SCHOOL_STARTS;
  state.schoolRun = { depart: at, route: route.id, arrive, late, herd };
  logJudgment(
    { scene: "school_run", clock: clock(at), choice, threshold: level, action: `${clock(at)}, ${route.label.toLowerCase()}`, costOn: "family", outcome: late ? "late" : "on time" },
    CARD,
  );
}
