// The phone predicts *you*: before each decision it seals a guess (rule or phone?) learned in context
// from your earlier judgments — today's and, on replays, yesterday's. Revealed right after you choose.

import { loadMemory } from "../memory";
import { state, type Judgment } from "../state";
import { predictClasses } from "./api";

type Scene = "umbrella" | "sick_kid" | "school_run" | "gpu" | "avocados" | "final";
const COST_ON: Record<Scene, "family" | "others" | "self"> = {
  umbrella: "family",
  sick_kid: "others",
  school_run: "family",
  gpu: "others",
  avocados: "others",
  final: "family",
};

export interface Guess {
  scene: Scene;
  guess: "rule" | "prediction";
  p: number;
  seal: string;
  hit?: boolean;
}

export const guesses: Partial<Record<Scene, Guess>> = {};

/** Features for a decision, given the judgments made before it on that day. */
function features(scene: Scene, before: Judgment[], day: number) {
  const asked = before.filter((j) => j.choice === "prediction").length;
  const ruled = before.filter((j) => j.choice === "rule").length;
  const last = before.at(-1)?.choice;
  return {
    scene,
    cost_on: COST_ON[scene],
    asked_before: asked,
    ruled_before: ruled,
    last_choice: last === "prediction" || last === "rule" ? last : "none",
    day,
  };
}

function history() {
  const rows: { row: ReturnType<typeof features>; choice: "rule" | "prediction" }[] = [];
  const add = (js: Judgment[], day: number) =>
    js.forEach((j, i) => {
      if (j.choice === "no_signal" || !(j.scene in COST_ON)) return;
      rows.push({ row: features(j.scene as Scene, js.slice(0, i), day), choice: j.choice });
    });
  const past = loadMemory().past;
  for (const day of [...new Set(past.map((j) => j.day))]) add(past.filter((j) => j.day === day), day);
  add(state.judgments, state.day);
  return rows.slice(-200);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** One live call seals guesses for the next decisions. Returns a toast line, or undefined on no signal. */
export async function sealGuesses(scenes: Scene[]): Promise<string | undefined> {
  const todo = scenes.filter((s) => !guesses[s]);
  if (!todo.length) return undefined;
  const rows = todo.map((s) => features(s, state.judgments, state.day));
  const result = await predictClasses("player", rows, 30_000, { history: history() });
  if (!result.ok) return undefined;
  const sealed: Scene[] = [];
  for (const [i, scene] of todo.entries()) {
    // A guess that arrives after the decision would be worthless: only seal what is still open.
    if (state.judgments.some((j) => j.scene === scene)) continue;
    sealed.push(scene);
    const p = result.rows[i].prediction;
    const guess = p >= 0.5 ? "prediction" : "rule";
    const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
    const seal = (await sha256Hex(`${scene}:${guess}:${p}:${nonce}`)).slice(0, 4);
    guesses[scene] = { scene, guess, p: guess === "prediction" ? p : 1 - p, seal };
  }
  if (!sealed.length) return undefined;
  return `The phone sealed ${sealed.length > 1 ? `${sealed.length} guesses` : "a guess"} about you: #${sealed.map((s) => guesses[s]!.seal).join(" #")}`;
}

/** After a judgment: was the sealed guess right? */
export function revealGuess(j: Judgment): string | undefined {
  const g = guesses[j.scene as Scene];
  if (!g || j.choice === "no_signal") return undefined;
  g.hit = g.guess === j.choice;
  const said = g.guess === "prediction" ? "you'd ask me" : "you'd follow the rule";
  return `Sealed guess #${g.seal}: ${said} (${Math.round(g.p * 100)}%). ${g.hit ? "Right." : "Wrong!"}`;
}

export function trainingRowCount(): number {
  return history().length;
}
