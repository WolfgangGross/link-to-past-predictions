// Scene 2 — sick Leo (the book's COVID-testing example): one number, two parents, two lines.

import { predictClasses, type ClassPrediction, type NoSignal, type Row } from "../predict/api";
import { logJudgment, pct, state, today, type JudgmentCard } from "../state";
import type { UIScene } from "../scenes/UIScene";

const BASE_RATE = 0.41; // share of contagious mornings in the training data
const SAM_LINE = 0.1; // Sam keeps Leo home at anything above this

const CARD: JudgmentCard = {
  title: "Sick Leo",
  falseNegative: "Leo is contagious and goes to school: his class catches it.",
  falsePositive: "Leo is fine and stays home: Sam loses his workday.",
  whoBears: "A miss lands on other families. A false alarm lands on Sam.",
  whoDecides: "You and Sam. And the school nurse, who has her own line.",
  oldRule: '"Any symptom, stay home": simple, but it empties classrooms and offices.',
};

let leo: Promise<ClassPrediction | NoSignal> | undefined;

const GRUMPY = "my tummy is grumpy";
const HURTS = "mama, my tummy hurts";

/** Leo's morning plus three "what if" rows in the same call (same token charge). */
export function prefetchLeo(): void {
  const actual: Row = { ...today().leo };
  leo ??= predictClasses("symptoms", [
    actual,
    { ...actual, temperature_c: 38.3 },
    { ...actual, said: GRUMPY },
    { ...actual, said: HURTS },
  ]);
}

export async function talkToLeo(ui: UIScene): Promise<void> {
  const s = today().leo;
  if (state.leoHome !== undefined) {
    await ui.dialogue.say(state.leoHome ? 'Leo: "Can I watch cartoons?" (Sam: "No.")' : 'Leo: "*sniff* Do I have to take the spelling test?"');
    return;
  }
  await ui.dialogue.say([`Leo: "${s.said}..."`, ...(s.test_today ? ['Ada: "Spelling test today, huh?"', 'Leo: "...maybe."'] : [])]);
  if (!state.hasPhone) return;

  ui.setClock("07:05");
  await ui.dialogue.say('Sam (from the kitchen): "School rule: any symptom, he stays home. And then one of us stays with him."');
  const pick = await ui.dialogue.choose("Leo?", ["Follow the rule: Leo stays home", "Check his temperature, ask the phone"]);
  if (pick === 0) {
    decide(true, "rule");
    await ui.dialogue.say("Leo stays home. Sam cancels his big meeting and sets up on the sofa.");
    return;
  }

  await ui.dialogue.say(`The thermometer beeps: ${s.temperature_c.toFixed(1)} °C. Day ${s.days_since_onset} of the sniffles.`);
  await ui.phone.open();
  const threshold = await ui.phone.dial("YOUR JUDGMENT", "Keep Leo home if the chance he's contagious is at least...", 30);
  ui.phone.thinking("IS LEO CONTAGIOUS?");
  prefetchLeo();
  const result = await leo!;
  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. The rule it is: Leo stays home, and so does Sam.");
    await ui.phone.close();
    decide(true, "no_signal", threshold);
    return;
  }

  const [actual, hot, grumpy, hurts] = result.rows.map((r) => r.contagious);
  state.phoneNotes.push(`Leo contagious: ${pct(actual)}`);
  ui.phone.showProbability("LEO IS CONTAGIOUS", actual, threshold, [
    `From ${result.trainRows} past school mornings, and from what Leo said.`,
  ]);
  await ui.dialogue.say(`The phone says ${pct(actual)}. Your line is ${pct(threshold)}.`);
  ui.phone.showLines("WHAT MOVES IT", [
    `At 38.3 °C: ${pct(hot)}`,
    `If he'd said "${GRUMPY}": ${pct(grumpy)}`,
    `If he'd said "${HURTS}": ${pct(hurts)}`,
  ], "SPACE continue");
  // Narrate what the numbers actually show, not what we expect them to show.
  await ui.dialogue.say(
    grumpy - hurts >= 0.2
      ? `Same tummy, different words: "grumpy" ${pct(grumpy)}, "hurts" ${pct(hurts)}. The phone reads what he says, not just the thermometer.`
      : "The phone reads what he says, not just the thermometer.",
  );

  let home = actual >= threshold;
  const samHome = actual >= SAM_LINE;
  if (home !== samHome) {
    await ui.dialogue.say([
      `Sam: "${pct(actual)}? I'd keep him home at anything over ${pct(SAM_LINE)}."`,
      "Same number. Two different lines. The phone can't tell you whose line counts.",
    ]);
    const options = home ? ["Yours: Leo stays home", "Sam's: Leo goes to school"] : ["Yours: Leo goes to school", "Sam's: Leo stays home"];
    const whose = await ui.dialogue.choose("Whose line wins?", options);
    if (whose === 1) home = samHome;
  } else {
    await ui.dialogue.say(home ? 'Sam: "Agreed. I\'ll stay with him."' : 'Sam: "Fine by me. Nurse checks him at the gate anyway."');
  }
  await ui.phone.close();
  decide(home, "prediction", threshold, actual);
  await ui.dialogue.say(home ? "Leo stays home. Sam cancels his big meeting." : "Leo gets dressed. Spelling test it is.");
  await ui.card.show(CARD);
}

async function sampleTruth(): Promise<boolean> {
  const result = leo ? await leo : undefined;
  return Math.random() < (result?.ok ? result.rows[0].contagious : BASE_RATE);
}

function decide(home: boolean, choice: "rule" | "prediction" | "no_signal", threshold?: number, predicted?: number): void {
  state.leoHome = home;
  logJudgment(
    { scene: "sick_kid", clock: "07:05", choice, threshold, predicted, action: home ? "Leo home" : "Leo to school", costOn: "others" },
    CARD,
  );
  void sampleTruth().then((contagious) => (state.leoContagious = contagious));
}
