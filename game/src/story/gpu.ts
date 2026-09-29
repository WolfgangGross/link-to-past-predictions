// Scene 7 — GPU allocation (the book's Flint example): efficient by prediction, or visibly fair by rule?

import { predictQuantiles, type NoSignal, type QuantilePrediction } from "../predict/api";
import { rolls } from "../data/rolls";
import { sampleFromQuantiles } from "../predict/sample";
import { logJudgment, state, type JudgmentCard } from "../state";
import type { UIScene } from "../scenes/UIScene";

interface Proposal {
  id: string;
  short: string;
  team: "scaling" | "multimodal" | "efficiency" | "forecasting";
  row: { title: string; team: string; log10_rows: number; gpu_days: number; novelty: number };
}

// Each proposal's scale, compute and novelty are nudged every playthrough (titles that name a size keep it).
let n = 0;
const P = (id: string, short: string, team: Proposal["team"], title: string, log10_rows: number, gpu_days: number, novelty: number, fixedRows = false): Proposal => {
  const j = rolls.gpu[n++];
  return {
    id,
    short,
    team,
    row: {
      title,
      team,
      log10_rows: fixedRows ? log10_rows : Math.min(6.5, Math.max(4, Number((log10_rows + j.rows).toFixed(1)))),
      gpu_days: Math.min(40, Math.max(2, Math.round(gpu_days * j.days))),
      novelty: Math.min(5, Math.max(1, novelty + j.novelty)),
    },
  };
};

// Everything the teams could bring; each team hands in two per day.
const POOL: Proposal[] = [
  P("chunked", "Chunked", "scaling", "Chunked row attention for 1M rows", 6.0, 30, 4, true),
  P("memory", "Memory tok", "scaling", "Longer context via memory tokens", 6.0, 20, 4),
  P("bigger", "Bigger", "scaling", "Bigger model, same data", 5.5, 25, 2),
  P("noblock", "No block 2", "scaling", "Ablation: remove the second attention block", 5.0, 6, 3),
  P("textenc", "Text enc", "multimodal", "Joint text encoder for free-text columns", 5.0, 25, 5),
  P("tokenizer", "Tokenizer", "multimodal", "Bigger tokenizer vocabulary", 5.0, 8, 2),
  P("patches", "Patches", "multimodal", "Image patches as extra columns", 5.0, 20, 4),
  P("freeze", "Freeze text", "multimodal", "Ablation: freeze the text tower", 5.0, 6, 2),
  P("distill", "Distill", "efficiency", "Distill into a fast student", 4.5, 8, 2),
  P("prune", "Prune", "efficiency", "Prune half the heads", 5.0, 6, 2),
  P("quantize", "Int8", "efficiency", "Quantize attention to int8", 5.0, 10, 3),
  P("xseries", "X-series", "forecasting", "Cross-series attention for related tables", 5.0, 30, 5),
  P("calendar", "Calendar", "forecasting", "Calendar and lag features", 5.0, 10, 2),
  P("nodate", "No dates", "forecasting", "Ablation: drop the date encoder", 5.0, 5, 3),
];
const TEAMS = ["scaling", "multimodal", "efficiency", "forecasting"] as const;
const PETRA_PICK = "tokenizer";

// Two per team, drawn per playthrough. Petra's promised tokenizer run is always on the table.
export const PROPOSALS: Proposal[] = TEAMS.flatMap((team) =>
  POOL.filter((p) => p.team === team)
    .sort((a, b) => (b.id === PETRA_PICK ? 1 : 0) - (a.id === PETRA_PICK ? 1 : 0) || rolls.gpuDraw[POOL.indexOf(a)] - rolls.gpuDraw[POOL.indexOf(b)])
    .slice(0, 2),
);
// What each team would pick for itself under the old rule: its lead's favourite, the more novel of its two.
const TEAM_PICKS = TEAMS.map((team) => PROPOSALS.filter((p) => p.team === team).sort((a, b) => b.row.novelty - a.row.novelty)[0].id);
const NODES = 4;

export const CARD: JudgmentCard = {
  title: "GPU allocation",
  falseNegative: "Skip an idea that would have worked. Nobody ever finds out.",
  falsePositive: "Burn a node for a week on a dud.",
  whoBears: "Teams whose ideas look bad to the model, even the good ones.",
  whoDecides: "Whoever controls the ranking. Today, that's you.",
  oldRule: '"One node per team": not efficient, but it kept the peace.',
};

let ranking: Promise<QuantilePrediction | NoSignal> | undefined;

export function prefetchRanking(): void {
  ranking ??= predictQuantiles("experiments", PROPOSALS.map((p) => p.row));
}

export async function allocateGpus(ui: UIScene): Promise<void> {
  if (state.gpu) {
    await ui.dialogue.say('Petra: "The runs are queued. Results by three."');
    return;
  }
  ui.setClock("09:40");
  await ui.dialogue.say([
    'Petra: "Four GPU nodes this week. Eight proposals. How do we split them?"',
    'Petra: "The rule: ONE NODE PER TEAM. Each team runs its favourite. Fair, visible, nobody sulks."',
  ]);
  const pick = await ui.dialogue.choose("Allocation?", ["Follow the rule: one per team", "Ask the phone to rank all eight"], 1);
  if (pick === 0) return fund(TEAM_PICKS, "rule");

  prefetchRanking();
  await ui.phone.open();
  ui.phone.thinking("WHICH IDEAS WILL WORK?", "experiments");
  const result = await ranking!;
  if (!result.ok) {
    ui.phone.showLines("NO SIGNAL", ["I can't see the future right now.", "Back to the old rule."], "SPACE continue");
    await ui.dialogue.say("No signal. One node per team, as always.");
    await ui.phone.close();
    return fund(TEAM_PICKS, "no_signal");
  }

  const median = (id: string) => result.rows[PROPOSALS.findIndex((p) => p.id === id)][0.5];
  const order = [...PROPOSALS].sort((a, b) => median(b.id) - median(a.id));
  ui.phone.showDistributions(
    "PREDICTED GAIN (PTS)",
    order.map((p) => ({ label: p.short, q: result.rows[PROPOSALS.indexOf(p)] })),
    { min: -2, max: 5, deadline: 0, format: (v) => `${v > 0 ? "+" : ""}${v}` },
    [],
  );
  const top = order.slice(0, NODES);
  const leftOut = TEAMS.filter((t) => !top.some((p) => p.team === t));
  await ui.dialogue.say([
    `The phone ranks all eight on ${result.trainRows} past experiments, titles included. Top four: ${top.map((p) => p.short).join(", ")}.`,
    leftOut.length ? `The ${leftOut.join(" and ")} team${leftOut.length > 1 ? "s get" : " gets"} nothing.` : "Every team gets one anyway.",
  ]);
  if (leftOut.includes("efficiency")) {
    await ui.dialogue.say('Tomas (efficiency): "So a model decides now whose ideas get GPUs? My team built the inference stack it runs on."');
  }
  await ui.dialogue.say('Petra: "And I promised the board a tokenizer run. Can we squeeze it in?"');
  const choice = await ui.dialogue.choose("Whose ranking wins?", [
    "The phone's top four",
    "The rule: one per team",
    "Top three, plus Petra's tokenizer",
  ]);
  await ui.phone.close();
  if (choice === 0) await fund(top.map((p) => p.id), "prediction");
  else if (choice === 1) await fund(TEAM_PICKS, "rule");
  else await fund([...order.filter((p) => p.id !== PETRA_PICK).slice(0, 3).map((p) => p.id), PETRA_PICK], "prediction");
  await ui.card.show(CARD);
}

async function fund(ids: string[], choice: "rule" | "prediction" | "no_signal"): Promise<void> {
  const result = ranking ? await ranking : undefined;
  // Real outcomes are drawn from the phone's own predictive distributions; without them, a flat guess.
  const gains = Object.fromEntries(
    ids.map((id) => [id, result?.ok ? sampleFromQuantiles(result.rows[PROPOSALS.findIndex((p) => p.id === id)]) : 0.8 + (Math.random() - 0.5) * 2]),
  );
  const expected = (set: string[]) =>
    result?.ok ? set.reduce((sum, id) => sum + result.rows[PROPOSALS.findIndex((p) => p.id === id)][0.5], 0) : undefined;
  const top = result?.ok
    ? [...PROPOSALS].sort((a, b) => result.rows[PROPOSALS.indexOf(b)][0.5] - result.rows[PROPOSALS.indexOf(a)][0.5]).slice(0, NODES).map((p) => p.id)
    : [];
  state.gpu = { funded: ids, gains, asked: choice === "prediction", expectedFunded: expected(ids), expectedRule: expected(TEAM_PICKS), expectedTop: expected(top) };
  logJudgment(
    { scene: "gpu", clock: "09:40", choice, action: ids.map((id) => PROPOSALS.find((p) => p.id === id)!.short).join(", "), costOn: "others" },
    CARD,
  );
}
