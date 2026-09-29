// The day's state: story flags plus the log of judgments the phone will later learn from.

import { DAYS, type DayScenario } from "./data/scenarios";

export interface Judgment {
  scene: string;
  clock: string;
  choice: "rule" | "prediction" | "no_signal";
  threshold?: number;
  predicted?: number;
  action: string;
  /** Who bears the cost of a false negative for this decision. */
  costOn: "family" | "others" | "self";
  outcome?: string;
}

/** The book's five questions, answered per decision. */
export interface JudgmentCard {
  title: string;
  falseNegative: string;
  falsePositive: string;
  whoBears: string;
  whoDecides: string;
  oldRule: string;
}

export interface Message {
  from: string;
  text: string;
}

export const state = {
  day: 0,
  hasPhone: false,
  umbrellas: undefined as boolean | undefined,
  leoHome: undefined as boolean | undefined,
  leoContagious: undefined as boolean | undefined,
  schoolRun: undefined as { depart: number; route: string; arrive: number; late: boolean; herd: boolean } | undefined,
  judgments: [] as Judgment[],
  cards: [] as JudgmentCard[],
  messages: [] as Message[],
  /** One line per prediction, shown on the phone's PREDICT page. */
  phoneNotes: [] as string[],
};

export function today(): DayScenario {
  return DAYS[state.day % DAYS.length];
}

export function logJudgment(j: Judgment, card: JudgmentCard): void {
  state.judgments.push(j);
  state.cards.push(card);
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Dev shortcut (?map=street): fill in the morning so a later map can be opened directly. */
export function fakeMorning(): void {
  state.hasPhone = true;
  state.umbrellas ??= true;
  state.leoHome ??= false;
  state.schoolRun ??= { depart: 45, route: "car_main_road", arrive: 62, late: false, herd: false };
}
