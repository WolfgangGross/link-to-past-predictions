// The player model: TabPFN learns *you* in context. The training rows are a small persona prior
// plus the player's own judgments (sent by the browser, strictly validated). Nothing is trained.

import type { Row } from "./tabpfn.js";

export const PLAYER_COLUMNS = ["scene", "cost_on", "asked_before", "ruled_before", "last_choice", "day"] as const;
export const PLAYER_CATEGORIES: Record<string, readonly string[]> = {
  scene: ["umbrella", "sick_kid", "school_run", "gpu", "avocados", "final"],
  cost_on: ["family", "others", "self"],
  last_choice: ["none", "rule", "prediction"],
};
export const PLAYER_TARGETS = ["rule", "prediction"] as const;
export const MAX_HISTORY = 200;

// "People like Ada": curious about the phone when the cost stays in the family,
// more rule-bound when others pay for a mistake. Deterministic, so it caches well.
export const PERSONA: { row: Row; choice: string }[] = (() => {
  const scenes: [string, string][] = [
    ["umbrella", "family"],
    ["sick_kid", "others"],
    ["school_run", "family"],
    ["gpu", "others"],
    ["avocados", "others"],
    ["final", "family"],
  ];
  const out: { row: Row; choice: string }[] = [];
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let person = 0; person < 6; person++) {
    let asked = 0;
    let ruled = 0;
    let last = "none";
    for (const [scene, cost] of scenes) {
      const pAsk = cost === "family" ? 0.75 : 0.45;
      const choice = rand() < pAsk + 0.1 * (asked - ruled) ? "prediction" : "rule";
      out.push({ row: { scene, cost_on: cost, asked_before: asked, ruled_before: ruled, last_choice: last, day: -1 }, choice });
      if (choice === "prediction") asked++;
      else ruled++;
      last = choice;
    }
  }
  return out;
})();
