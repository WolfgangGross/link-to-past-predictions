// Scores candidate rows against a world dataset with one live TabPFN call, to design scenarios.
// Run: npx tsx --env-file=.env scripts/score.ts <dataset> '<json array of rows>'   (~10K tokens)

import { predict } from "../server/predict.js";

const [dataset, rowsJson] = process.argv.slice(2);
const rows = JSON.parse(rowsJson);
const res = await predict({ dataset, rows });
const preds = res.prediction as number[][];
rows.forEach((row: unknown, i: number) =>
  console.log(JSON.stringify(row), "→", res.classes!.map((c, j) => `${c}=${Math.round(preds[i][j] * 100)}%`).join(" ")),
);
