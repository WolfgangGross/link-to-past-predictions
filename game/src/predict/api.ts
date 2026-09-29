// Browser side of /api/predict. Every call is a live TabPFN-3.5 prediction (or the server's cached copy of one).

export type Row = Record<string, number | string>;

/** What the server reports about its own TabPFN calls (see CallTrace in server/predict.ts). */
export interface CallTrace {
  task: "classification" | "regression";
  modelPath: string;
  predictParams: { output_type: string; quantiles?: number[] };
  columns: string[];
  trainSample: (string | number | boolean | null)[][];
  trainSampleNote: string;
  fit: "fitted" | "reused";
  timings: Record<string, number>;
}

/** One /api/predict round trip, verbatim, for the phone's "API call" view. */
export interface ApiCall {
  id: number;
  request: Record<string, unknown>;
  startedAt: number;
  status?: number;
  response?: Record<string, unknown>;
  ms?: number;
}

/** The phone shows the latest call for the world models. The player model (your sealed guesses) is not the phone's. */
export const apiLog: { inflight: Record<string, ApiCall | undefined>; last: Record<string, ApiCall | undefined> } = { inflight: {}, last: {} };

let callCount = 0;

async function post(request: Record<string, unknown>, timeoutMs: number): Promise<{ ok: boolean; status: number; body: any }> {
  const call: ApiCall = { id: ++callCount, request, startedAt: performance.now() };
  const dataset = String(request.dataset);
  const tracked = dataset !== "player";
  if (tracked) apiLog.inflight[dataset] = call;
  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    if (tracked) {
      call.status = res.status;
      call.response = body;
      call.ms = Math.round(performance.now() - call.startedAt);
      apiLog.last[dataset] = call;
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    if (apiLog.inflight[dataset] === call) apiLog.inflight[dataset] = undefined;
  }
}

export interface ClassPrediction {
  ok: true;
  /** One entry per requested row: class → probability. */
  rows: Record<string, number>[];
  trainRows: number;
  cached: boolean;
  ms: number;
}

export interface NoSignal {
  ok: false;
  reason: string;
}

/** Up to 4 rows share one call, and so one token charge. Handy for "what if" counterfactuals. */
export async function predictClasses(
  dataset: string,
  rows: Row[],
  timeoutMs = 25_000,
  extra: Record<string, unknown> = {},
): Promise<ClassPrediction | NoSignal> {
  try {
    const res = await post({ dataset, rows, ...extra }, timeoutMs);
    const body = res.body;
    if (!res.ok) return { ok: false, reason: body.error ?? `HTTP ${res.status}` };
    const classes = body.classes as string[];
    const out = (body.prediction as number[][]).map((probas) => Object.fromEntries(classes.map((c, i) => [c, probas[i]])));
    return { ok: true, rows: out, trainRows: body.trainRows, cached: body.cached, ms: body.ms };
  } catch (err) {
    return { ok: false, reason: (err as Error).name === "TimeoutError" ? "timeout" : "network" };
  }
}

export interface QuantilePrediction {
  ok: true;
  /** One entry per requested row: quantile level → value. */
  rows: Record<number, number>[];
  trainRows: number;
}

export async function predictQuantiles(
  dataset: string,
  rows: Row[],
  timeoutMs = 45_000,
): Promise<QuantilePrediction | NoSignal> {
  try {
    const res = await post({ dataset, rows }, timeoutMs);
    const body = res.body;
    if (!res.ok) return { ok: false, reason: body.error ?? `HTTP ${res.status}` };
    const qs = body.quantiles as number[];
    const pred = body.prediction as number[][]; // [quantile][row]
    const out = rows.map((_, i) => Object.fromEntries(qs.map((q, j) => [q, pred[j][i]])));
    return { ok: true, rows: out, trainRows: body.trainRows };
  } catch (err) {
    return { ok: false, reason: (err as Error).name === "TimeoutError" ? "timeout" : "network" };
  }
}
