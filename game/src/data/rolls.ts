// Today's test rows, rolled once per page load (the page reloads every night, so once per day).
// The weather is a random real, held-out Freiburg morning; everything else the phone is asked about
// is rolled within the ranges the training data covers. Add ?seed=abc to the URL to replay the same rolls.

import { weatherMornings } from "./weather-mornings";

function seeded(text: string): () => number {
  let h = 1779033703;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("seed");
const rand = seed ? seeded(seed) : Math.random;

export const chance = (p: number) => rand() < p;
export const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
export const uniform = (lo: number, hi: number, digits = 1) => Number((lo + rand() * (hi - lo)).toFixed(digits));
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
function weighted<T>(xs: readonly (readonly [T, number])[]): T {
  let r = rand() * xs.reduce((s, [, w]) => s + w, 0);
  for (const [x, w] of xs) if ((r -= w) < 0) return x;
  return xs[0][0];
}

// --- Leo: the same conditions and phrases the symptoms dataset was built from ---

const PHRASES = {
  flu: ["my head is hot", "everything hurts", "i feel shivery", "i'm cold and hot", "my head hurts so much", "i coughed all night"],
  cold: ["my nose is runny", "*sniff*", "i sneeze a lot", "my throat tickles", "my nose is stuffy", "i coughed a bit"],
  tummy_bug: ["my tummy is grumpy", "i threw up", "i feel sick in my tummy", "my tummy is gurgly", "i don't want breakfast"],
  nothing: ["my tummy hurts", "i'm too tired", "i don't want to go", "my leg hurts", "can i stay home", "i feel funny"],
  allergy: ["my eyes itch", "i sneeze a lot", "my nose tickles", "*sniff*", "my eyes are watery"],
} as const;
const FILLERS = ["", "", "", "mama, ", "papa, ", "*sniff* ", "ugh, "];
const TEMPS = { flu: [37.9, 39.6], cold: [36.7, 37.8], tummy_bug: [37.1, 38.6], nothing: [36.3, 37.2], allergy: [36.4, 37.1] } as const;

export interface LeoRow {
  said: string;
  temperature_c: number;
  days_since_onset: number;
  test_today: number;
}

function rollLeo(): LeoRow {
  const cond = weighted([["flu", 18], ["cold", 30], ["tummy_bug", 10], ["nothing", 27], ["allergy", 15]] as const);
  const [lo, hi] = TEMPS[cond];
  const phrases = [pick(PHRASES[cond])];
  if (chance(0.3)) phrases.push(pick(PHRASES[cond]));
  return {
    said: pick(FILLERS) + [...new Set(phrases)].join(" and "),
    temperature_c: uniform(lo, hi),
    days_since_onset: int(0, 5),
    test_today: chance(0.3) ? 1 : 0,
  };
}

// --- Mia: a sprain 2-5 days ago (the club rule is "within a week") ---

export interface MiaRow {
  age: number;
  days_since_sprain: number;
  swelling: number;
  pain_reported: number;
  previous_sprains: number;
}

function rollMia(): MiaRow {
  const swelling = pick([0, 1, 1, 2, 3]);
  return { age: int(7, 10), days_since_sprain: int(2, 5), swelling, pain_reported: int(0, swelling + 1), previous_sprains: pick([0, 0, 1, 2]) };
}

// --- Rosa's canteen week: the same month and roughly the same temperatures as the morning's weather ---

const MENUS = ["avocado_toast", "burrito_bowl", "poke_bowl", "pasta", "schnitzel"] as const;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export interface CanteenDay {
  day: string;
  menu: string;
  temp_c: number;
  team_event: number;
}

function rollWeek(baseTemp: number): CanteenDay[] {
  const eventDay = chance(0.8) ? int(0, 4) : -1;
  return DAY_NAMES.map((day, i) => ({ day, menu: pick(MENUS), temp_c: Number((baseTemp + uniform(-3, 3)).toFixed(1)), team_event: i === eventDay ? 1 : 0 }));
}

const morning = pick(weatherMornings);

export const rolls = {
  /** A real Freiburg morning the weather model has never seen. */
  morning,
  leo: rollLeo(),
  mia: rollMia(),
  week: rollWeek(morning.features.temp_c),
  /** School-run weekday, 0 = Monday. */
  weekday: int(0, 4),
  bullwhipSeed: int(1, 2 ** 31 - 2),
  /** Proposal numbers are nudged by these, in order. */
  gpu: Array.from({ length: 8 }, () => ({ rows: uniform(-0.4, 0.4), days: uniform(0.7, 1.3, 2), novelty: pick([-1, 0, 0, 1]) })),
};
