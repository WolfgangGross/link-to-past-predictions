// Browser side of /api/predict. Every call is a live TabPFN-3.5 prediction (or the server's cached copy of one).

export type Row = Record<string, number | string>;

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
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset, rows, ...extra }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
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
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset, rows }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, reason: body.error ?? `HTTP ${res.status}` };
    const qs = body.quantiles as number[];
    const pred = body.prediction as number[][]; // [quantile][row]
    const out = rows.map((_, i) => Object.fromEntries(qs.map((q, j) => [q, pred[j][i]])));
    return { ok: true, rows: out, trainRows: body.trainRows };
  } catch (err) {
    return { ok: false, reason: (err as Error).name === "TimeoutError" ? "timeout" : "network" };
  }
}
