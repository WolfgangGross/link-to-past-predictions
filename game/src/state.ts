// The day's state: story flags plus the log of judgments the phone will later learn from.

export interface Judgment {
  scene: string;
  clock: string;
  choice: "rule" | "prediction" | "no_signal";
  threshold?: number;
  predicted?: number;
  action: string;
  outcome?: string;
}

export const state = {
  hasPhone: false,
  umbrellas: undefined as boolean | undefined,
  judgments: [] as Judgment[],
};

export function logJudgment(j: Judgment): void {
  state.judgments.push(j);
}
