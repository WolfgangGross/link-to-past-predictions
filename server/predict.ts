// Server-side prediction service shared by the Vercel function and the Vite dev server.
// World datasets live on the server; clients only send the rows they want predicted.

import { DEFAULT_MODEL_PATH, TabPFNClient, TabPFNError, type Cell, type PredictParams, type Row, type Task, type Timings } from "./tabpfn.js";
import * as weather from "./datasets/weather.js";
import * as symptoms from "./datasets/symptoms.js";
import * as traffic from "./datasets/traffic.js";
import * as experiments from "./datasets/experiments.js";
import * as avocados from "./datasets/avocados.js";
import * as reinjury from "./datasets/reinjury.js";
import { MAX_HISTORY, PERSONA, PLAYER_CATEGORIES, PLAYER_COLUMNS, PLAYER_TARGETS } from "./player.js";

const QUANTILES: PredictParams = { output_type: "quantiles", quantiles: [0.1, 0.25, 0.5, 0.75, 0.8, 0.9, 0.95, 0.98] };

interface WorldDataset {
  task: Task;
  columns: readonly string[];
  /** Columns that hold free text (TabPFN-3.5 reads them directly). */
  textColumns?: readonly string[];
  /** String columns restricted to known values. All other columns must be numbers. */
  categories?: Record<string, readonly string[]>;
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
  symptoms: {
    task: "classification",
    columns: symptoms.columns,
    textColumns: ["said"],
    X: symptoms.X,
    y: symptoms.y,
    predict: { output_type: "probas" },
    maxTestRows: 4,
  },
  traffic: {
    task: "regression",
    columns: traffic.columns,
    categories: { route: traffic.routes },
    X: traffic.X,
    y: traffic.y,
    predict: QUANTILES,
    maxTestRows: 12,
  },
  experiments: {
    task: "regression",
    columns: experiments.columns,
    textColumns: ["title"],
    categories: { team: experiments.teams },
    X: experiments.X,
    y: experiments.y,
    predict: QUANTILES,
    maxTestRows: 8,
  },
  avocados: {
    task: "regression",
    columns: avocados.columns,
    categories: { menu: avocados.menus },
    X: avocados.X,
    y: avocados.y,
    predict: QUANTILES,
    maxTestRows: 5,
  },
  reinjury: {
    task: "classification",
    columns: reinjury.columns,
    X: reinjury.X,
    y: reinjury.y,
    predict: { output_type: "probas" },
    maxTestRows: 4,
  },
  // Training rows = persona prior + the request's `history`; see predict().
  player: {
    task: "classification",
    columns: PLAYER_COLUMNS,
    categories: PLAYER_CATEGORIES,
    X: PERSONA.map((p) => PLAYER_COLUMNS.map((c) => p.row[c])),
    y: PERSONA.map((p) => p.choice),
    predict: { output_type: "probas" },
    maxTestRows: 4,
  },
};

const MAX_TEXT = 200;

export interface PredictRequest {
  dataset: string;
  rows: Row[];
  /** Player model only: the player's past judgments, each with its `choice`. */
  history?: { row: Row; choice: string }[];
}

/** What the server actually sent to TabPFN, so the game can show the real call on the phone. */
export interface CallTrace {
  task: Task;
  modelPath: string;
  predictParams: PredictParams;
  columns: string[];
  /** A few training rows in column order, target last. */
  trainSample: Cell[][];
  trainSampleNote: string;
  /** "fitted": this request ran /fit. "reused": the fit was already on the server (or deduplicated by the API). */
  fit: "fitted" | "reused";
  /** Milliseconds per API step of the original (uncached) call. */
  timings: Timings;
}

export interface PredictResponse {
  dataset: string;
  prediction: unknown;
  classes?: string[];
  /** For quantile regression: prediction[q][row] matches quantiles[q]. */
  quantiles?: number[];
  trainRows: number;
  cached: boolean;
  ms: number;
  trace: CallTrace;
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
  const clean = rows.map((row, i) => cleanRow(ds, row, i));
  if (dataset !== "player") return { dataset, rows: clean };
  const history = (body as Record<string, unknown>).history;
  if (!Array.isArray(history) || history.length > MAX_HISTORY) throw new RequestError(`history must be an array of up to ${MAX_HISTORY} items`);
  return {
    dataset,
    rows: clean,
    history: history.map((h, i) => {
      const { row, choice } = (h ?? {}) as Record<string, unknown>;
      if (!PLAYER_TARGETS.includes(choice as (typeof PLAYER_TARGETS)[number])) throw new RequestError(`history ${i}: bad choice`);
      return { row: cleanRow(ds, row, i), choice: choice as string };
    }),
  };
}

function cleanRow(ds: WorldDataset, row: unknown, i: number): Row {
  if (typeof row !== "object" || row === null) throw new RequestError(`Row ${i} must be an object`);
  const out: Row = {};
  for (const col of ds.columns) {
    const v = (row as Record<string, unknown>)[col];
    const allowed = ds.categories?.[col];
    if (allowed) {
      if (typeof v !== "string" || !allowed.includes(v)) throw new RequestError(`Row ${i}: ${col} must be one of ${allowed.join(", ")}`);
    } else if (ds.textColumns?.includes(col)) {
      if (typeof v !== "string" || v.length > MAX_TEXT) throw new RequestError(`Row ${i}: ${col} must be text up to ${MAX_TEXT} chars`);
    } else if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new RequestError(`Row ${i}: ${col} must be a finite number`);
    }
    out[col] = v;
  }
  return out;
}

// Per-instance caches. Fits are free but slow; identical world requests reuse the real response (no tokens).
const fits = new Map<string, Promise<string>>();
const fitTimings = new Map<string, Timings>();
const responses = new Map<string, PredictResponse>();
const MAX_CACHED_RESPONSES = 500;

let client: TabPFNClient | undefined;
function getClient(): TabPFNClient {
  client ??= new TabPFNClient({ apiKey: process.env.TABPFN_API_KEY ?? "", timeoutMs: 50_000 });
  return client;
}

function fitDataset(name: string, refit = false): Promise<string> {
  let fit = refit ? undefined : fits.get(name);
  if (!fit) {
    const ds = WORLD[name];
    const X = ds.X.map((values) => Object.fromEntries(ds.columns.map((c, i) => [c, values[i]])));
    const timings: Timings = {};
    fitTimings.set(name, timings);
    fit = getClient().fit(X, ds.y, ds.task, {}, timings);
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
  if (req.history) return predictPlayer(req, ds, key, start);
  const fitWasCached = fits.has(req.dataset);
  const timings: Timings = {};
  let fitId = await fitDataset(req.dataset);
  let result;
  try {
    result = await getClient().predict(fitId, req.rows, ds.task, ds.predict, timings);
  } catch (err) {
    // The fitted model can expire server-side; refit once.
    if (!(err instanceof TabPFNError) || err.status !== 404) throw err;
    fitId = await fitDataset(req.dataset, true);
    result = await getClient().predict(fitId, req.rows, ds.task, ds.predict, timings);
  }

  const response: PredictResponse = {
    dataset: req.dataset,
    prediction: result.prediction,
    classes: ds.task === "classification" ? [...new Set(ds.y.map(String))].sort() : undefined,
    quantiles: ds.predict.output_type === "quantiles" ? ds.predict.quantiles : undefined,
    trainRows: ds.X.length,
    cached: false,
    ms: Math.round(performance.now() - start),
    trace: {
      task: ds.task,
      modelPath: DEFAULT_MODEL_PATH,
      predictParams: ds.predict,
      columns: [...ds.columns, "target"],
      trainSample: ds.X.slice(0, 2).map((row, i) => [...row, ds.y[i]]),
      trainSampleNote: "first 2 rows",
      fit: fitWasCached ? "reused" : "fitted",
      timings: { ...(fitWasCached ? {} : fitTimings.get(req.dataset)), ...timings },
    },
  };
  if (responses.size >= MAX_CACHED_RESPONSES) responses.delete(responses.keys().next().value!);
  responses.set(key, response);
  return response;
}

/** The player model re-fits on every call: the context is the player's own (changing) history. */
async function predictPlayer(req: PredictRequest, ds: WorldDataset, key: string, start: number): Promise<PredictResponse> {
  const history = req.history ?? [];
  const X = [...PERSONA.map((p) => p.row), ...history.map((h) => h.row)];
  const y = [...PERSONA.map((p) => p.choice), ...history.map((h) => h.choice)];
  const timings: Timings = {};
  const fitId = await getClient().fit(X, y, ds.task, {}, timings);
  const result = await getClient().predict(fitId, req.rows, ds.task, ds.predict, timings);
  const response: PredictResponse = {
    dataset: req.dataset,
    prediction: result.prediction,
    classes: [...PLAYER_TARGETS].sort(),
    trainRows: X.length,
    cached: false,
    ms: Math.round(performance.now() - start),
    trace: {
      task: ds.task,
      modelPath: DEFAULT_MODEL_PATH,
      predictParams: ds.predict,
      columns: [...ds.columns, "target"],
      trainSample: X.slice(-2).map((row, i) => [...ds.columns.map((c) => row[c] ?? null), y.slice(-2)[i]]),
      trainSampleNote: "your 2 latest judgments",
      fit: "fitted",
      timings,
    },
  };
  if (responses.size >= MAX_CACHED_RESPONSES) responses.delete(responses.keys().next().value!);
  responses.set(key, response);
  return response;
}
