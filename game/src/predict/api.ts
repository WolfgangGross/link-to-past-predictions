// Browser side of /api/predict. Every call is a live TabPFN-3.5 prediction (or the server's cached copy of one).

export interface ClassPrediction {
  ok: true;
  probs: Record<string, number>;
  trainRows: number;
  cached: boolean;
  ms: number;
}

export interface NoSignal {
  ok: false;
  reason: string;
}

export async function predictClasses(
  dataset: string,
  row: Record<string, number>,
  timeoutMs = 25_000,
): Promise<ClassPrediction | NoSignal> {
  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset, rows: [row] }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, reason: body.error ?? `HTTP ${res.status}` };
    const [probas] = body.prediction as number[][];
    const probs = Object.fromEntries((body.classes as string[]).map((c, i) => [c, probas[i]]));
    return { ok: true, probs, trainRows: body.trainRows, cached: body.cached, ms: body.ms };
  } catch (err) {
    return { ok: false, reason: (err as Error).name === "TimeoutError" ? "timeout" : "network" };
  }
}
