// Evening: the day's results arrive, the family weighs in, and at bedtime the phone reads your judgment back.

import type { Story } from "../world/WorldScene";
import { pct, state } from "../state";
import { loadMemory, saveMemory } from "../memory";
import { PROPOSALS } from "./gpu";
import type { ReportPage } from "../ui/Report";
import type { UIScene } from "../scenes/UIScene";

const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;

async function runResults(ui: UIScene): Promise<void> {
  const gpu = state.gpu;
  if (!gpu) return;
  const lines = gpu.funded.map((id) => `${PROPOSALS.find((p) => p.id === id)!.short}: ${fmt(gpu.gains[id])} pts`);
  const total = Object.values(gpu.gains).reduce((a, b) => a + b, 0);
  ui.phone.showLines("RUNS FINISHED", [...lines, `Total: ${fmt(total)} pts`], "SPACE continue");
  await ui.phone.open();
  const expected =
    gpu.expectedRule === undefined || gpu.expectedTop === undefined
      ? "Nobody predicted anything beforehand. Nobody can say what another split would have found."
      : gpu.asked
        ? `Predicted beforehand: ${fmt(gpu.expectedFunded!)} for your pick, ${fmt(gpu.expectedRule)} for one-per-team.`
        : `You never asked, but the phone had ranked them anyway: ${fmt(gpu.expectedRule)} for one-per-team, ${fmt(gpu.expectedTop)} for its top four.`;
  await ui.dialogue.say([`Petra: "The runs are in: ${fmt(total)} points in total."`, expected], total > 0 ? "success" : "neutral");
  await ui.phone.close();
}

function judgmentRows(): [string, string][] {
  return state.judgments.map((j, i) => {
    const title = state.cards[i]?.title ?? j.scene;
    const how =
      j.choice === "rule"
        ? "the old rule"
        : j.choice === "no_signal"
          ? "no signal, so the rule"
          : j.predicted !== undefined && j.threshold !== undefined
            ? `phone ${pct(j.predicted)}, your line ${pct(j.threshold)}`
            : "the phone";
    return [title, `${how} -> ${j.action}${j.outcome ? ` -> ${j.outcome}` : ""}`];
  });
}

function hiddenJudgment(): [string, string][] {
  const by = (scene: string) => state.judgments.find((j) => j.scene === scene);
  const rows: [string, string][] = [];
  const umbrella = by("umbrella");
  const leo = by("sick_kid");
  if (umbrella?.threshold !== undefined) rows.push(["", `You'll risk soaked kids whenever rain is below ${pct(umbrella.threshold)}.`]);
  if (leo?.threshold !== undefined) {
    rows.push(["", `You keep Leo home from ${pct(leo.threshold)}. Charles from 10%. The nurse only at 38.0 °C.`]);
    if (umbrella?.threshold !== undefined && leo.threshold < umbrella.threshold)
      rows.push(["", "You're more careful when the cost lands on other families than on your own."]);
  }
  const run = by("school_run");
  if (run?.threshold !== undefined) rows.push(["", `Late for school is OK once in ${Math.round(1 / (1 - run.threshold))} runs.`]);
  const gpu = by("gpu");
  if (gpu) rows.push(["", gpu.choice === "rule" ? "GPUs: you chose fair over efficient." : `GPUs: you funded ${gpu.action}.`]);
  const avo = by("avocados");
  if (avo?.threshold !== undefined) rows.push(["", `No avocados is fine once in ${Math.round(1 / (1 - avo.threshold))} days.`]);
  const fin = by("final");
  if (fin?.threshold !== undefined) rows.push(["", `Mia plays below ${pct(fin.threshold)} risk. Mia's line: 50%. The coach: 40%. Charles: 10%.`]);
  const asked = state.judgments.filter((j) => j.choice === "prediction").length;
  rows.push(["", `You asked the phone ${asked} times out of ${state.judgments.length}.`]);
  if (!rows.length) rows.push(["", "You followed every rule. Your judgment stayed hidden, even from you."]);
  return rows;
}

async function bedtime(ui: UIScene): Promise<void> {
  const leo = state.judgments.find((j) => j.scene === "sick_kid");
  if (leo && state.leoContagious !== undefined) leo.outcome = state.leoContagious ? "was contagious" : "wasn't contagious";
  await ui.dialogue.say(["22:00. The phone glows on the nightstand.", '"Before you sleep: here is what I learned today."'], "endOfDay");
  const pages: ReportPage[] = [
    { title: "YOUR DAY", rows: judgmentRows() },
    { title: "YOUR HIDDEN JUDGMENT", rows: [...hiddenJudgment(), ["", "Every probability needed a line. Every line was yours."]] },
  ];
  await ui.report.show(pages);
  await ui.dialogue.say([
    { text: '"I know your lines now. Tomorrow I could make these calls for you. Same thresholds, new day."', mood: "endOfDay" },
    { text: 'Charles (half asleep): "Your thresholds, or ours?"', mood: "suspicious" },
  ]);
  const pick = await ui.dialogue.choose("Tomorrow?", ["Let the phone decide for me", "I'll decide myself", "Wipe the phone's memory"], 0, undefined, "endOfDay");
  const memory = loadMemory();
  memory.past.push(...state.judgments.map((j) => ({ ...j, day: state.day })));
  memory.choices = { ...state.choiceLog };
  memory.dials = { ...state.dialLog };
  memory.day = state.day + 1;
  memory.autopilot = pick === 0;
  if (pick === 2) {
    memory.past = [];
    memory.day = 0;
    memory.autopilot = false;
  }
  saveMemory(memory);
  await ui.dialogue.say(pick === 2 ? '"Forgotten. Tomorrow I know nothing about you."' : '"Good night, Ada."', "endOfDay");
  window.location.reload();
}

export const eveningStory: Story = {
  async onEnter({ ui }) {
    ui.setClock("18:30");
    await ui.dialogue.say("Home. It smells like pizza.");
    await runResults(ui);
  },
  sky: () => "night",
  interact: {
    async charles({ ui }) {
      const cost = state.leoHome ? "I lost my meeting today. Leo was worth it. Probably." : "Quiet day. I even got work done.";
      await ui.dialogue.say(`Charles: "${cost} How was the phone?"`);
    },
    async mia({ ui }) {
      const f = state.final;
      await ui.dialogue.say(
        !f ? 'Mia: "Pizza!"' : f.reinjured ? 'Mia: "My ankle is blue. But I played."' : f.minutes === 0 ? 'Mia: "I watched. From the BENCH."' : 'Mia: "Did you see me?!"',
      );
    },
    leo: ({ ui }) => ui.dialogue.say(state.leoHome ? 'Leo: "I watched four cartoons. I feel great."' : 'Leo: "I got nine out of ten in spelling!"', "amused"),
    bed: ({ ui }) => bedtime(ui),
    window: ({ ui }) => ui.dialogue.say("Dark outside. Tomorrow's weather is tomorrow's problem."),
    wardrobe: ({ ui }) => ui.dialogue.say("Pyjamas. Finally.", "endOfDay"),
    desk: ({ ui }) => ui.dialogue.say("The home laptop. Not tonight."),
    fridge: ({ ui }) => ui.dialogue.say("Leftover pizza. A prediction you can trust.", "amused"),
  },
};
