// What "today" looks like on each playthrough day (day 1, then replays). The inputs are fixed per day;
// the predictions come live from TabPFN and the outcomes are sampled from them.

import { weatherMornings } from "./weather-mornings";

export interface DayScenario {
  /** A real, held-out Freiburg morning the weather model has never seen. */
  weatherDate: string;
  leo: { said: string; temperature_c: number; days_since_onset: number; test_today: number };
}

export const DAYS: DayScenario[] = [
  {
    weatherDate: "2025-09-30",
    leo: { said: "*sniff* my nose is runny and i am tired", temperature_c: 37.5, days_since_onset: 3, test_today: 1 },
  },
  {
    weatherDate: "2025-10-06",
    leo: { said: "my throat tickles and my head is hot", temperature_c: 37.7, days_since_onset: 1, test_today: 0 },
  },
  {
    weatherDate: "2025-09-26",
    leo: { said: "mama, my tummy hurts", temperature_c: 37.0, days_since_onset: 0, test_today: 1 },
  },
];

export function weatherFor(day: DayScenario) {
  const m = weatherMornings.find((w) => w.date === day.weatherDate);
  if (!m) throw new Error(`No held-out morning for ${day.weatherDate}`);
  return m;
}
