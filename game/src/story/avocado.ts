// Scene 8 — the canteen's avocados (the book's "AI bullwhip"): a better local decision, a jumpier chain.

import { predictQuantiles, type NoSignal, type QuantilePrediction } from "../predict/api";
import { logJudgment, state, type JudgmentCard } from "../state";
import type { UIScene } from "../scenes/UIScene";

const RULE_ORDER = 40;
const WEEK = [
  { day: "Mon", menu: "pasta", temp_c: 14, team_event: 0 },
  { day: "Tue", menu: "avocado_toast", temp_c: 15, team_event: 0 },
  { day: "Wed", menu: "poke_bowl", temp_c: 13, team_event: 0 },
  { day: "Thu", menu: "burrito_bowl", temp_c: 12, team_event: 1 },
  { day: "Fri", menu: "schnitzel", temp_c: 11, team_event: 0 },
];

export const CARD: JudgmentCard = {
  title: "Avocados",
  falseNegative: "Order too few: no avocado toast after noon.",
  falsePositive: "Order too many: avocados in the bin.",
  whoBears: "The canteen saves. The distributor and the farm absorb the swings.",
  whoDecides: "Rosa, for her kitchen. Nobody decides for the whole chain.",
  oldRule: '"40 a day": wasteful, but it made everyone upstream predictable.',
};

let forecast: Promise<QuantilePrediction | NoSignal> | undefined;

export function prefetchForecast(): void {
  forecast ??= predictQuantiles(
    "avocados",
    WEEK.map((d, i) => ({ weekday: i, month: 10, menu: d.menu, temp_c: d.temp_c, team_event: d.team_event, holiday_week: 0 })),
  );
}

/**
 * How swings grow up the chain when 20 canteens order by forecast and each tier chases the trend
 * it sees (orders = demand + change in demand). Seeded, so every player sees the same chain.
 */
export function bullwhip(orders: number[]): { canteen: number; distributor: number; farm: number } {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const days = Array.from({ length: 20 }, (_, t) => orders[t % orders.length]);
  const demand = days.map((o) => Array.from({ length: 20 }, () => o * (0.85 + 0.3 * rand())).reduce((a, b) => a + b, 0));
  const chase = (xs: number[]) => xs.map((x, t) => Math.max(0, x + 1.2 * (x - (xs[t - 1] ?? x))));
  const distributor = chase(demand);
  const farm = chase(distributor);
  const swing = (xs: number[]) => (Math.max(...xs) - Math.min(...xs)) / (xs.reduce((a, b) => a + b, 0) / xs.length);
  return { canteen: swing(days), distributor: swing(distributor), farm: swing(farm) };
}

export async function avocados(ui: UIScene): Promise<void> {
  if (state.avocados) {
    await ui.dialogue.say(`Rosa: "Next week's order is in. Let's see what Hakan says."`);
    return;
  }
  await ui.dialogue.say([
    'Rosa (canteen): "Forty avocados a day. Every day. Some days I bin twenty. Some days I run out by noon."',
    'Rosa: "The rule: ORDER 40 A DAY. Hakan, my distributor, loves me. Same order every week for six years."',
  ]);
  ui.setClock("12:15");
  const pick = await ui.dialogue.choose("Next week's order?", ["Follow the rule: 40 a day", "Ask the phone for a forecast"]);
  if (pick === 0) return decide(WEEK.map(() => RULE_ORDER), "rule");

  await ui.phone.open();
  const oneIn = await ui.phone.pick("YOUR JUDGMENT", "Running out of avocados is OK once in...", [2, 5, 10, 20], (v) => `${v} days`, 1);
  const level = 1 - 1 / oneIn;
  ui.phone.thinking("NEXT WEEK'S AVOCADOS");
  prefetchForecast();
  const result = await forecast!;
  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. Forty a day, as always.");
    await ui.phone.close();
    return decide(WEEK.map(() => RULE_ORDER), "no_signal", level);
  }

  ui.phone.showDistributions(
    "AVOCADOS USED",
    WEEK.map((d, i) => ({ label: `${d.day} ${d.menu.replace("_", " ")}`, q: result.rows[i] })),
    { min: 0, max: 70, deadline: RULE_ORDER, format: (v) => `${v}` },
    [`Red: the rule's 40. ${result.trainRows} past days.`],
  );
  const orders = result.rows.map((q) => Math.round(q[level]));
  const waste = (order: number[]) => order.reduce((sum, o, i) => sum + Math.max(0, o - result.rows[i][0.5]), 0);
  await ui.dialogue.say([
    `Order ${orders.join(", ")}. Out of stock about once in ${oneIn} days.`,
    `Expected waste: ${Math.round(waste(WEEK.map(() => RULE_ORDER)))} avocados a week with the rule, ${Math.round(waste(orders))} with the forecast.`,
  ]);
  const swings = bullwhip(orders);
  ui.phone.showBars(
    "ORDER SWINGS UPSTREAM",
    [
      { label: "Canteen", value: swings.canteen, text: `${swings.canteen.toFixed(1)}x` },
      { label: "Distributor", value: swings.distributor, text: `${swings.distributor.toFixed(1)}x` },
      { label: "Farm", value: swings.farm, text: `${swings.farm.toFixed(1)}x` },
    ],
    Math.max(3, swings.farm),
    ["If 20 canteens all do this. With the rule, every swing is 0."],
  );
  await ui.dialogue.say([
    "Twenty canteens in Freiburg got the same phone. Each one orders smarter, and together they order in waves.",
    "Hakan sees the waves and orders extra \"just in case\". The farm sees bigger waves still.",
  ]);
  await ui.phone.close();
  await decide(orders, "prediction", level);
  state.messages.push({ from: "Hakan", text: "Rosa's orders jump from 6 to 56 now. So does everyone's. I'm ordering double, just in case." });
  await ui.card.show(CARD);
}

async function decide(orders: number[], choice: "rule" | "prediction" | "no_signal", level?: number): Promise<void> {
  state.avocados = { orders };
  logJudgment({ scene: "avocados", clock: "12:15", choice, threshold: level, action: orders.join("/"), costOn: "others" }, CARD);
}
