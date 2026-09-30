// Scene 11 — Mia's final (the book's Michael Jordan example): the prediction can't say whose preferences count.

import type { Story } from "../world/WorldScene";
import { predictClasses, type ClassPrediction, type NoSignal } from "../predict/api";
import { rolls } from "../data/rolls";
import { logJudgment, pct, state, type JudgmentCard } from "../state";
import type { UIScene } from "../scenes/UIScene";

const MIA = rolls.mia;
const AGE_WORD = ["", "", "", "", "", "", "", "seven", "eight", "nine", "ten"];
const SWELLING = ["No swelling", "A little swelling", "Quite some swelling", "A lot of swelling"];
const PAIN = (p: number) => (p === 0 ? "She says it doesn't hurt" : p <= 2 ? "She says it hurts a tiny bit" : "She admits it hurts");
const WIN_CHANCE = { full: 0.6, half: 0.45, sit: 0.25 };
const LINES = { Mia: 0.5, "Coach Jansen": 0.4, Charles: 0.1 };

export const CARD: JudgmentCard = {
  title: "Mia's final",
  falseNegative: "She plays and the ankle goes again: six weeks out.",
  falsePositive: "She sits, the ankle was fine, and her team loses without her.",
  whoBears: "Mia, mostly. Her team, a bit. You, at bedtime.",
  whoDecides: "Mia, the coach, Charles, you. The phone can't say whose preferences count.",
  oldRule: '"No match within a week of a sprain": protective, and blind to how bad it is.',
};

let risk: Promise<ClassPrediction | NoSignal> | undefined;

function prefetchRisk(): void {
  risk ??= predictClasses("reinjury", [
    { ...MIA, minutes_planned: 45 },
    { ...MIA, minutes_planned: 20 },
    { ...MIA, days_since_sprain: MIA.days_since_sprain + 7, swelling: 0, minutes_planned: 45 },
  ]);
}

async function decideFinal(ui: UIScene): Promise<void> {
  await ui.dialogue.say([
    `Karim (physio): "Day ${MIA.days_since_sprain} after the sprain. ${SWELLING[MIA.swelling]}. ${PAIN(MIA.pain_reported)}${MIA.previous_sprains ? `. That's sprain number ${MIA.previous_sprains + 1} for her` : ""}."`,
    'Karim: "Kids always say that before a final. The club rule: NO MATCH WITHIN A WEEK OF A SPRAIN."',
  ], "worried");
  const pick = await ui.dialogue.choose("Mia?", ["Follow the rule: she sits out", "Ask the phone"], 1);
  if (pick === 0) return play(ui, "sit", "rule");

  await ui.phone.open();
  ui.phone.thinking("MIA'S ANKLE", "reinjury");
  prefetchRisk();
  const result = await risk!;
  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. The club rule it is: Mia sits out.");
    await ui.phone.close();
    return play(ui, "sit", "no_signal");
  }
  const [full, half, nextWeek] = result.rows.map((r) => r.reinjured);
  state.phoneNotes.push(`Mia reinjury: ${pct(full)} full, ${pct(half)} half`);
  ui.phone.showLines("REINJURY RISK", [
    `Full game: ${pct(full)}`,
    `Second half only: ${pct(half)}`,
    `(If the final were next week: ${pct(nextWeek)})`,
    `${result.trainRows} past matches after a sprain.`,
  ], "SPACE continue");
  await ui.dialogue.say([
    `The phone: ${pct(full)} for the full game. ${pct(half)} if she only plays the second half.`,
    'Mia: "I\'d play even at fifty percent!"',
    'Coach Jansen: "Under forty, she plays. We need her up front."',
    `Charles (video call): "Anything over ten percent is too much. She's ${AGE_WORD[MIA.age]}."`,
  ], "worried");
  const yours = await ui.phone.dial("YOUR LINE", "Mia plays if her reinjury risk is below...", 20, 5, "<");
  await ui.dialogue.say("One prediction. Four lines. The phone can't tell you whose preferences count.");
  const lines = { ...LINES, You: yours };
  const agree = (p: number) => Object.entries(lines).filter(([, line]) => p < line).map(([who]) => who);
  const describe = (who: string[]) => (who.length ? who.join(", ") : "nobody");
  const choice = await ui.dialogue.choose("Your call?", [
    `Full game, ${pct(full)} (OK for: ${describe(agree(full))})`,
    `Second half, ${pct(half)} (OK for: ${describe(agree(half))})`,
    "She sits out",
  ], 0, agree(full).includes("You") ? 0 : agree(half).includes("You") ? 1 : 2);
  await ui.phone.close();
  const kind = (["full", "half", "sit"] as const)[choice];
  await play(ui, kind, "prediction", kind === "sit" ? undefined : kind === "full" ? full : half, yours);
  await ui.card.show(CARD);
}

async function play(ui: UIScene, kind: "full" | "half" | "sit", choice: "rule" | "prediction" | "no_signal", p?: number, yours?: number): Promise<void> {
  // If you never asked, the ankle still had a real risk: the world uses the phone's number either way.
  const result = risk ? await risk : undefined;
  const chance = p ?? (result?.ok ? result.rows[kind === "half" ? 1 : 0].reinjured : 0.3);
  const reinjured = kind !== "sit" && Math.random() < chance;
  const won = !reinjured && Math.random() < WIN_CHANCE[kind];
  const whose = kind === "sit" ? (choice === "rule" ? "the club rule" : "Charles's line") : kind === "full" ? "Mia's and the coach's line" : "a compromise";
  state.final = { minutes: kind === "full" ? 45 : kind === "half" ? 20 : 0, risk: p, reinjured, whose };
  logJudgment({ scene: "final", clock: "16:28", choice, threshold: yours, predicted: p, action: { full: "full game", half: "second half", sit: "sat out" }[kind], costOn: "family", outcome: reinjured ? "reinjured" : won ? "team won" : "team lost" }, CARD);

  ui.setClock("17:15");
  const story =
    kind === "sit"
      ? won
        ? ["Mia watches from the bench, arms crossed.", "Her team wins 1-0 without her. She is thrilled, and furious."]
        : ["Mia watches from the bench, arms crossed.", "Her team loses 0-2. The ankle is safe. Mia is not speaking to you."]
      : reinjured
        ? ["Twelve minutes in, Mia lands badly. Ice pack, tears, six weeks off.", `The phone said ${pct(chance)}. That happens ${pct(chance)} of the time. Today it happened.`]
        : won
          ? [kind === "half" ? "Mia comes on for the second half..." : "Mia starts up front...", "...and scores the winner! 2-1. The ankle holds."]
          : [kind === "half" ? "Mia comes on for the second half." : "Mia plays the whole game.", "They lose 1-2. But the ankle holds, and she played."];
  if (reinjured) {
    await ui.dialogue.say(story[0], "panic");
    await ui.dialogue.say(story.slice(1), "guilty");
    return;
  }
  await ui.dialogue.say(story, kind === "sit" ? "uneasy" : won ? "success" : "neutral");
}

export const fieldStory: Story = {
  async onEnter({ ui }) {
    ui.setClock("16:25");
    prefetchRisk();
    await ui.dialogue.say("The pitch behind the school. The final starts in five minutes. Karim, the physio, is checking Mia's ankle.");
  },
  interact: {
    async physio({ ui }) {
      if (state.final) return ui.dialogue.say('Karim: "Ice at home tonight either way."');
      await decideFinal(ui);
    },
    async mia({ ui }) {
      if (!state.final) return ui.dialogue.say('Mia: "It doesn\'t hurt. Much. Can I play? PLEASE?"');
      await ui.dialogue.say(state.final.reinjured ? 'Mia: "*sniff* It was worth it. Maybe."' : 'Mia: "Can we get pizza?"', state.final.reinjured ? "guilty" : "amused");
    },
    coach: ({ ui }) => ui.dialogue.say('Coach Jansen: "Finals are finals. But she\'s your kid."'),
    kid1: ({ ui }) => ui.dialogue.say('"Is Mia playing? She\'s our best striker!"'),
    kid2: ({ ui }) => ui.dialogue.say('"We\'re going to win!"'),
    kid3: ({ ui }) => ui.dialogue.say('"My mum said the phone said we\'ll lose. I don\'t believe phones."'),
    async leave({ ui, world }) {
      if (!state.final) return ui.dialogue.say("You can't leave before the final. Karim is waiting.");
      await ui.dialogue.say("Home time.");
      world.goto("evening");
    },
  },
};
