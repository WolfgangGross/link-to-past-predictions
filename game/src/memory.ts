// What the phone remembers across days: stored in this browser only (localStorage), never sent anywhere.

import type { Judgment } from "./state";

export interface Memory {
  day: number;
  autopilot: boolean;
  /** Every judgment from earlier days, tagged with its day: the phone's training data about you. */
  past: (Judgment & { day: number })[];
  /** Yesterday's answers, replayed by the autopilot. */
  choices: Record<string, number>;
  dials: Record<string, number>;
}

const KEY = "link-to-past-predictions:memory:v1";
const EMPTY: Memory = { day: 0, autopilot: false, past: [], choices: {}, dials: {} };

export function loadMemory(): Memory {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveMemory(m: Memory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Private mode or blocked storage: the phone simply forgets.
  }
}

export function wipeMemory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to wipe
  }
}
