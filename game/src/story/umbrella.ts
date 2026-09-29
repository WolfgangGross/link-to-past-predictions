// Scene 1 — the umbrella: rule → prediction → threshold → action → ripple.

import { predictClasses, type ClassPrediction, type NoSignal } from "../predict/api";
import { rolls } from "../data/rolls";
import { logJudgment, pct, state, type JudgmentCard } from "../state";
import type { UIScene } from "../scenes/UIScene";
import type { Sky } from "../world/weather";
import { prefetchLeo } from "./leo";
import { prefetchTraffic } from "./schoolRun";
import { sfx } from "../audio";

const BASE_RATE = 0.195; // share of rainy school runs in the training data

const CARD: JudgmentCard = {
  title: "Umbrellas",
  falseNegative: "No umbrellas and it pours: soaked kids at school.",
  falsePositive: "Umbrellas and no rain: carried for nothing, one gets lost.",
  whoBears: "Mostly Mia and Leo. A little bit your wallet.",
  whoDecides: "You. The phone only did the maths.",
  oldRule: '"Always pack umbrellas": cheap, reliable, no forecast needed.',
};

/** What the flat's windows show: the sky at 06:30 (the held-out morning's own measurements), picked once so the glass and the text always agree. */
const morningSky: Sky = (() => {
  const f = rolls.morning.features;
  if (f.rain_last_3h_mm > 0.2) return f.rain_last_3h_mm >= 4 && f.wind_kmh >= 10 ? "thunder" : "rain";
  return f.cloud_cover_pct >= 60 ? "clouds" : "sun";
})();

export const currentSky = (): Sky => morningSky;

const SKY_LINE: Record<Sky, string> = {
  sun: "Sun over Freiburg.",
  clouds: "Grey sky over Freiburg.",
  rain: "Rain on the glass over Freiburg.",
  thunder: "Thunder rolls over Freiburg.",
  night: "Dark outside.",
};

let rain: Promise<ClassPrediction | NoSignal> | undefined;
let rainFalls: Promise<boolean> | undefined;

/**
 * Whether it rains on the school run. Decided once, as soon as the umbrellas are settled, by sampling
 * the phone's own probability (even if you never looked): 30% comes true 3 times in 10.
 */
export function willItRain(): Promise<boolean> {
  rainFalls ??= (async () => {
    const result = rain ? await rain : undefined;
    return Math.random() < (result?.ok ? result.rows[0].rain : BASE_RATE);
  })();
  return rainFalls;
}

/** Start the TabPFN call as soon as the phone is in hand, so it is ready at the window. */
export function prefetchRain(): void {
  rain ??= predictClasses("weather", [rolls.morning.features]);
}

export async function pickUpPhone(ui: UIScene): Promise<void> {
  if (state.day === 0) sfx.item();
  await ui.dialogue.say(
    state.day > 0
      ? ["The phone is where you left it.", '"Good morning, Ada. I remember yesterday."', "(Press TAB to look at it.)"]
      : [
          "Something on the nightstand is glowing...",
          "A phone? It isn't yours. The screen reads: IT'S DANGEROUS TO GO ALONE! TAKE THIS.",
          "You got the PHONE OF PRIORS! It knows the past. It predicts. It does not decide.",
          "(Press TAB to look at it.)",
        ],
  );
  state.hasPhone = true;
  prefetchRain();
  prefetchLeo();
}

export async function lookOutOfWindow(ui: UIScene): Promise<void> {
  if (state.umbrellas !== undefined) {
    await ui.dialogue.say(state.umbrellas ? "Umbrellas are packed. Whatever happens now, happens." : "No umbrellas today. Fingers crossed.");
    return;
  }
  if (!state.hasPhone) {
    await ui.dialogue.say(`${SKY_LINE[currentSky()]} Will it rain on the school run?`);
    return;
  }

  await ui.dialogue.say([
    `${SKY_LINE[currentSky()]} The school run leaves at 8:00.`,
    "House rule: ALWAYS PACK UMBRELLAS. Cheap. Reliable. Leo loses one a month.",
  ]);
  const pick = await ui.dialogue.choose("Umbrellas?", ["Follow the rule: pack them", "Ask the phone"], 1);
  if (pick === 0) {
    decide(true, "rule");
    await ui.dialogue.say("Umbrellas packed. The rule never needs a forecast.");
    return;
  }

  await ui.phone.open();
  const threshold = await ui.phone.dial("YOUR JUDGMENT", "Pack umbrellas if the chance of rain is at least...");
  ui.phone.thinking("RAIN ON THE SCHOOL RUN", "weather");
  prefetchRain();
  const result = await rain!;

  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. The rule it is: umbrellas packed.");
    await ui.phone.close();
    decide(true, "no_signal", threshold);
    return;
  }

  const p = result.rows[0].rain;
  const take = p >= threshold;
  state.phoneNotes.push(`Rain at 8:00: ${pct(p)}`);
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
  await ui.card.show(CARD);
}

/** Lines for when the family steps outside. */
export async function rainOutcome(): Promise<string[]> {
  const rainedOnSchoolRun = await willItRain();
  const result = rain ? await rain : undefined;
  const chance = result?.ok ? result.rows[0].rain : BASE_RATE;
  const judgment = state.judgments.find((j) => j.scene === "umbrella");
  if (judgment) judgment.outcome = rainedOnSchoolRun ? "rain" : "dry";
  const kids = state.leoHome ? "Mia" : "Mia and Leo";
  if (rainedOnSchoolRun) {
    return state.umbrellas
      ? ["It rains. Everyone stays dry.", `${state.leoHome ? "Mia" : "Leo"} leaves an umbrella at school anyway. The rule has costs too.`]
      : [`It pours. ${kids} ${state.leoHome ? "arrives" : "arrive"} soaked.`, `Mia: "The phone said only ${pct(chance)}!"`, "Unlikely things still happen, just not often."];
  }
  return state.umbrellas ? ["Not a drop. Umbrellas carried for nothing.", "A false alarm: cheap, but not free."] : ["Dry all the way. Hands free."];
}

function decide(umbrellas: boolean, choice: "rule" | "prediction" | "no_signal", threshold?: number, predicted?: number): void {
  state.umbrellas = umbrellas;
  void willItRain().then(prefetchTraffic);
  logJudgment(
    { scene: "umbrella", clock: "06:40", choice, threshold, predicted, action: umbrellas ? "umbrellas" : "no umbrellas", costOn: "family" },
    CARD,
  );
}
