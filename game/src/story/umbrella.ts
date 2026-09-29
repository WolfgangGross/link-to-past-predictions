// Scene 1 — the umbrella: rule → prediction → threshold → action → ripple.

import { predictClasses, type ClassPrediction, type NoSignal } from "../predict/api";
import { weatherMornings } from "../data/weather-mornings";
import { logJudgment, state } from "../state";
import type { UIScene } from "../scenes/UIScene";

// Real, held-out Freiburg mornings the model has never seen, chosen for an uncertain sky (day 1, replays).
const TODAY_DATES = ["2025-09-30", "2025-10-06", "2025-09-26"];
const today = weatherMornings.find((m) => m.date === TODAY_DATES[0])!;

const BASE_RATE = 0.195; // share of rainy school runs in the training data

let rain: Promise<ClassPrediction | NoSignal> | undefined;
let shown: ClassPrediction | undefined; // what the player saw on the phone
let rainedOnSchoolRun: boolean | undefined;

/** Start the TabPFN call as soon as the phone is in hand, so it is ready at the window. */
function prefetchRain(): void {
  rain ??= predictClasses("weather", today.features);
}

export async function pickUpPhone(ui: UIScene): Promise<void> {
  await ui.dialogue.say([
    "Something on the nightstand is glowing...",
    "A phone? It isn't yours. The screen reads: IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
    "You got the PHONE OF PRIORS! It knows the past. It predicts. It does not decide.",
    "(Press TAB to look at it.)",
  ]);
  state.hasPhone = true;
  prefetchRain();
}

export async function lookOutOfWindow(ui: UIScene): Promise<void> {
  if (state.umbrellas !== undefined) {
    await ui.dialogue.say(state.umbrellas ? "Umbrellas are packed. Whatever happens now, happens." : "No umbrellas today. Fingers crossed.");
    return;
  }
  if (!state.hasPhone) {
    await ui.dialogue.say("Grey sky over Freiburg. Will it rain on the school run?");
    return;
  }

  await ui.dialogue.say([
    "Grey sky over Freiburg. The school run leaves at 8:00.",
    "House rule: ALWAYS PACK UMBRELLAS. Cheap. Reliable. Leo loses one a month.",
  ]);
  const pick = await ui.dialogue.choose("Umbrellas?", ["Follow the rule: pack them", "Ask the phone"]);
  if (pick === 0) {
    decide(true, "rule");
    await ui.dialogue.say("Umbrellas packed. The rule never needs a forecast.");
    return;
  }

  await ui.phone.open();
  const threshold = await ui.phone.dial(
    "YOUR JUDGMENT",
    "Pack umbrellas if the chance of rain is at least...",
  );
  ui.phone.thinking("RAIN ON THE SCHOOL RUN");
  prefetchRain();
  const result = await rain!;

  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. The rule it is: umbrellas packed.");
    await ui.phone.close();
    decide(true, "no_signal", threshold);
    return;
  }

  shown = result;
  const p = result.probs.rain;
  const take = p >= threshold;
  ui.phone.showProbability("RAIN ON THE SCHOOL RUN", p, threshold, [
    `Learned from ${result.trainRows.toLocaleString("en")} real Freiburg mornings.`,
    "No training. Just the past.",
  ]);
  await ui.dialogue.say([
    `The phone says ${pct(p)}. Your line is ${pct(threshold)}.`,
    take ? "That's over your line: umbrellas packed." : "That's under your line: no umbrellas today.",
  ]);
  await ui.phone.close();
  decide(take, "prediction", threshold, p);
}

export async function leaveHouse(ui: UIScene): Promise<boolean> {
  if (state.umbrellas === undefined) {
    await ui.dialogue.say("Wait. Umbrellas or not? Better check the sky from the window first.");
    return false;
  }
  // The world samples from the phone's own probability, even if you never looked: 30% comes true 3 times in 10.
  const result = rain ? await rain : undefined;
  const chance = result?.ok ? result.probs.rain : BASE_RATE;
  rainedOnSchoolRun ??= Math.random() < chance;
  const lines = rainedOnSchoolRun
    ? state.umbrellas
      ? ["It rains. Everyone stays dry.", "Leo loses his umbrella anyway. The rule has costs too."]
      : ["It pours. Mia and Leo arrive soaked.", `Mia: "The phone said only ${pct(chance)}!"`, "Unlikely things still happen, just not often."]
    : state.umbrellas
      ? ["Not a drop. Three umbrellas carried for nothing.", "A false positive: cheap, but not free."]
      : ["Dry all the way. Hands free."];
  await ui.dialogue.say([
    "8:00. Out the door with Mia and Leo...",
    ...lines,
    "A false negative soaks the kids. A false positive costs an umbrella. The phone did the maths. You chose the line.",
  ]);
  const last = state.judgments.at(-1);
  if (last) last.outcome = rainedOnSchoolRun ? "rain" : "dry";
  return true;
}

function decide(umbrellas: boolean, choice: "rule" | "prediction" | "no_signal", threshold?: number, predicted?: number): void {
  state.umbrellas = umbrellas;
  logJudgment({
    scene: "umbrella",
    clock: "06:40",
    choice,
    threshold,
    predicted,
    action: umbrellas ? "umbrellas" : "no_umbrellas",
  });
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export function phoneSummary(): string[] {
  if (!shown) return ["No predictions yet.", "Look out of the window."];
  return [`Rain on the school run: ${pct(shown.probs.rain)}`, `From ${shown.trainRows.toLocaleString("en")} past mornings.`];
}
