// POST /api/predict — the only route that talks to TabPFN. The API key never leaves the server.

import { datasetNames, parseRequest, predict, RequestError } from "../server/predict.js";
import { TabPFNError } from "../server/tabpfn.js";

export const config = { maxDuration: 60 };

// Best-effort per-instance limit; the real guard is the TabPFN token budget.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") return Response.json({ ok: true, datasets: datasetNames() });
    if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    if (rateLimited(ip)) return Response.json({ error: "Too many predictions, slow down" }, { status: 429 });

    try {
      const body = parseRequest(await request.json().catch(() => null));
      return Response.json(await predict(body));
    } catch (err) {
      if (err instanceof RequestError) return Response.json({ error: err.message }, { status: err.status });
      if (err instanceof TabPFNError) {
        console.error("TabPFN error", err.status, err.errorCode, err.traceId, err.message);
        // 503 tells the game to show "No signal" and fall back to the old rule.
        return Response.json({ error: "TabPFN unavailable", upstreamStatus: err.status }, { status: 503 });
      }
      console.error("Unexpected error", err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  },
};
