// Minimal client for the TabPFN REST API (https://docs.priorlabs.ai/api-reference/getting-started).
// Flow: prepare_train_set_upload → PUT signed URLs → fit → prepare_test_set_upload → PUT → predict.

const DEFAULT_BASE_URL = "https://api.priorlabs.ai";

export type Task = "classification" | "regression";
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export type PredictParams =
  | { output_type: "probas" | "preds" }
  | { output_type: "mean" | "median" | "mode" | "full" }
  | { output_type: "quantiles"; quantiles: number[] };

export interface FitOptions {
  modelPath?: string; // "v3.5_default" | "v3.5-fast_default"
  fitMode?: "fit_preprocessors" | "fit_with_cache";
  nEstimators?: number;
}

export interface PredictResult {
  prediction: unknown;
  metadata: Record<string, unknown>;
}

export type Timings = Record<string, number>;

export class TabPFNError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly traceId?: string;

  constructor(message: string, status: number, errorCode?: string, traceId?: string) {
    super(message);
    this.name = "TabPFNError";
    this.status = status;
    this.errorCode = errorCode;
    this.traceId = traceId;
  }
}

interface FileUploadInfo {
  signed_urls: string[];
  expires_at: number;
  required_headers: Record<string, string>;
}

// CRC32C (Castagnoli), base64 of the big-endian value — the API's dedup hash for uploads.
const CRC32C_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32cBase64(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC32C_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  const be = new Uint8Array([crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff]);
  return btoa(String.fromCharCode(...be));
}

export function toCsv(rows: Row[], columns: string[]): string {
  const escape = (v: Cell): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(row[c] ?? null)).join(","));
  return lines.join("\n") + "\n";
}

export class TabPFNClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: { apiKey: string; baseUrl?: string; timeoutMs?: number }) {
    if (!opts.apiKey) throw new Error("TabPFN API key is missing");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  /** Uploads the training set and fits it. Returns the id to predict against. */
  async fit(
    X: Row[],
    y: Cell[],
    task: Task,
    opts: FitOptions = {},
    timings: Timings = {},
  ): Promise<string> {
    if (X.length === 0 || X.length !== y.length) throw new Error("X and y must be non-empty and equal length");
    const columns = Object.keys(X[0]);
    const xCsv = toCsv(X, columns);
    const yCsv = toCsv(y.map((v) => ({ target: v })), ["target"]);

    // With content hashes, identical data is recognised server-side (409) and neither re-uploaded nor re-fitted.
    let t = performance.now();
    const prep = await this.post<{
      train_set_upload_id: string;
      x_train_info?: FileUploadInfo;
      y_train_info?: FileUploadInfo;
    }>("/tabpfn/prepare_train_set_upload", {
      x_train_info: { format: "csv", hash: crc32cBase64(xCsv), size_bytes: xCsv.length },
      y_train_info: { format: "csv", hash: crc32cBase64(yCsv), size_bytes: yCsv.length },
    }, { allowDuplicate: true });
    timings.prepare_train = performance.now() - t;

    t = performance.now();
    if (prep.x_train_info && prep.y_train_info) {
      await Promise.all([this.upload(prep.x_train_info, xCsv), this.upload(prep.y_train_info, yCsv)]);
    }
    timings.upload_train = performance.now() - t;

    const tabpfnConfig: Record<string, unknown> = { model_path: opts.modelPath ?? "v3.5_default" };
    if (opts.fitMode) tabpfnConfig.fit_mode = opts.fitMode;
    if (opts.nEstimators) tabpfnConfig.n_estimators = opts.nEstimators;

    t = performance.now();
    const fit = await this.post<{ fitted_train_set_id: string }>("/tabpfn/fit", {
      train_set_upload_id: prep.train_set_upload_id,
      task,
      tabpfn_config: tabpfnConfig,
    });
    timings.fit = performance.now() - t;
    return fit.fitted_train_set_id;
  }

  /**
   * Uploads a test set against an existing fit and predicts it.
   * Output shapes: "probas" → prediction[row][class] (classes sorted); "quantiles" → prediction[quantile][row].
   */
  async predict(
    fittedTrainSetId: string,
    X: Row[],
    task: Task,
    predictParams: PredictParams,
    timings: Timings = {},
  ): Promise<PredictResult> {
    const columns = Object.keys(X[0]);

    let t = performance.now();
    const prep = await this.post<{ test_set_upload_id: string; x_test_info?: FileUploadInfo }>(
      "/tabpfn/prepare_test_set_upload",
      { fitted_train_set_id: fittedTrainSetId, x_test_info: { format: "csv" } },
      { allowDuplicate: true },
    );
    timings.prepare_test = performance.now() - t;

    t = performance.now();
    if (prep.x_test_info) await this.upload(prep.x_test_info, toCsv(X, columns));
    timings.upload_test = performance.now() - t;

    t = performance.now();
    const result = await this.post<PredictResult & { download_uri?: string }>("/tabpfn/predict", {
      test_set_upload_id: prep.test_set_upload_id,
      fitted_train_set_id: fittedTrainSetId,
      task_config: { task, predict_params: predictParams },
    });
    timings.predict = performance.now() - t;
    return result;
  }

  private async post<T>(path: string, body: unknown, opts: { allowDuplicate?: boolean } = {}): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    // Long fits stream keepalive whitespace before the JSON payload, so parse the trimmed text.
    const text = (await res.text()).trim();
    const json = text ? JSON.parse(text) : {};
    if (res.ok) return json as T;
    // 409 on prepare_*_upload: identical data already uploaded; the body carries the reusable id.
    if (res.status === 409 && opts.allowDuplicate) return json as T;
    throw new TabPFNError(
      `${path} failed (${res.status}): ${json.message ?? text.slice(0, 300)}`,
      res.status,
      json.error_code,
      json.trace_id,
    );
  }

  private async upload(info: FileUploadInfo, content: string): Promise<void> {
    if (info.signed_urls.length !== 1) throw new Error("Chunked uploads are not supported");
    const res = await fetch(info.signed_urls[0], {
      method: "PUT",
      headers: info.required_headers,
      body: content,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new TabPFNError(`Upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`, res.status);
  }
}
