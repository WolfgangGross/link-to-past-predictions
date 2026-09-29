// Server-side prediction service shared by the Vercel function and the Vite dev server.
// World datasets live on the server; clients only send the rows they want predicted.

import { TabPFNClient, TabPFNError, type Cell, type PredictParams, type Row, type Task } from "./tabpfn.js";
import * as weather from "./datasets/weather.js";

interface WorldDataset {
  task: Task;
  columns: readonly string[];
  X: Cell[][];
  y: Cell[];
  predict: PredictParams;
  maxTestRows: number;
}

const WORLD: Record<string, WorldDataset> = {
  weather: {
    task: "classification",
    columns: weather.columns,
    X: weather.X,
    y: weather.y,
    predict: { output_type: "probas" },
    maxTestRows: 4,
  },
};

export interface PredictRequest {
  dataset: string;
  rows: Row[];
}

export interface PredictResponse {
  dataset: string;
  prediction: unknown;
  classes?: string[];
  trainRows: number;
  cached: boolean;
  ms: number;
}

export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function datasetNames(): string[] {
  return Object.keys(WORLD);
}

export function parseRequest(body: unknown): PredictRequest {
  if (typeof body !== "object" || body === null) throw new RequestError("Body must be a JSON object");
  const { dataset, rows } = body as Record<string, unknown>;
  if (typeof dataset !== "string" || !(dataset in WORLD)) throw new RequestError(`Unknown dataset: ${String(dataset)}`);
  const ds = WORLD[dataset];
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > ds.maxTestRows) {
    throw new RequestError(`rows must be an array of 1–${ds.maxTestRows} rows`);
  }
  const clean = rows.map((row, i) => {
    if (typeof row !== "object" || row === null) throw new RequestError(`Row ${i} must be an object`);
    const out: Row = {};
    for (const col of ds.columns) {
      const v = (row as Record<string, unknown>)[col];
      if (typeof v !== "number" || !Number.isFinite(v)) throw new RequestError(`Row ${i}: ${col} must be a finite number`);
      out[col] = v;
    }
    return out;
  });
  return { dataset, rows: clean };
}

// Per-instance caches. Fits are free but slow; identical world requests reuse the real response (no tokens).
const fits = new Map<string, Promise<string>>();
const responses = new Map<string, PredictResponse>();
const MAX_CACHED_RESPONSES = 500;

let client: TabPFNClient | undefined;
function getClient(): TabPFNClient {
  client ??= new TabPFNClient({ apiKey: process.env.TABPFN_API_KEY ?? "", timeoutMs: 25_000 });
  return client;
}

function fitDataset(name: string, refit = false): Promise<string> {
  let fit = refit ? undefined : fits.get(name);
  if (!fit) {
    const ds = WORLD[name];
    const X = ds.X.map((values) => Object.fromEntries(ds.columns.map((c, i) => [c, values[i]])));
    fit = getClient().fit(X, ds.y, ds.task);
    fits.set(name, fit);
    fit.catch(() => fits.delete(name));
  }
  return fit;
}

export async function predict(req: PredictRequest): Promise<PredictResponse> {
  const key = JSON.stringify(req);
  const hit = responses.get(key);
  if (hit) return { ...hit, cached: true, ms: 0 };

  const ds = WORLD[req.dataset];
  const start = performance.now();
  let fitId = await fitDataset(req.dataset);
  let result;
  try {
    result = await getClient().predict(fitId, req.rows, ds.task, ds.predict);
  } catch (err) {
    // The fitted model can expire server-side; refit once.
    if (!(err instanceof TabPFNError) || err.status !== 404) throw err;
    fitId = await fitDataset(req.dataset, true);
    result = await getClient().predict(fitId, req.rows, ds.task, ds.predict);
  }

  const response: PredictResponse = {
    dataset: req.dataset,
    prediction: result.prediction,
    classes: ds.task === "classification" ? [...new Set(ds.y.map(String))].sort() : undefined,
    trainRows: ds.X.length,
    cached: false,
    ms: Math.round(performance.now() - start),
  };
  if (responses.size >= MAX_CACHED_RESPONSES) responses.delete(responses.keys().next().value!);
  responses.set(key, response);
  return response;
}
