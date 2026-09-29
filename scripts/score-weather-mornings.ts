// Scores every held-out "today" candidate with one TabPFN call, to pick mornings with an interesting rain chance.
// Run: npx tsx --env-file=.env scripts/score-weather-mornings.ts   (one prediction, ~10K tokens)

import { TabPFNClient } from "../server/tabpfn.js";
import * as weather from "../server/datasets/weather.js";
import { weatherMornings } from "../game/src/data/weather-mornings.js";

const client = new TabPFNClient({ apiKey: process.env.TABPFN_API_KEY ?? "" });
const X = weather.X.map((v) => Object.fromEntries(weather.columns.map((c, i) => [c, v[i]])));
const fitId = await client.fit(X, weather.y, "classification");
const { prediction } = await client.predict(fitId, weatherMornings.map((m) => m.features), "classification", { output_type: "probas" });
(prediction as number[][]).forEach(([, rain], i) => console.log(i, weatherMornings[i].date, `${Math.round(rain * 100)}%`));
