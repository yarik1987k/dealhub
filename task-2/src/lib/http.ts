/**
 * Outgoing HTTP: one place that owns timeouts, retries and error shape so every
 * upstream call fails the same predictable way.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: string;

  constructor(status: number, url: string, body: string) {
    super(`Upstream request failed (${status}) for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }

  /** 408/429/5xx are worth another attempt; 4xx is our own fault. */
  get isRetryable(): boolean {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

export class NetworkError extends Error {
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`Could not reach ${url}`, { cause });
    this.name = "NetworkError";
    this.url = url;
  }
}

type FetchJsonOptions = {
  headers?: Record<string, string>;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Total attempts, including the first one. */
  attempts?: number;
  /** Forwarded to fetch(); `revalidate` seconds or `false` for no cache. */
  revalidate?: number | false;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;

function backoffMs(attempt: number): number {
  return 300 * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    attempts = DEFAULT_ATTEMPTS,
    revalidate,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", ...headers },
        signal: abort,
        ...(revalidate === undefined ? {} : { next: { revalidate } }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new HttpError(response.status, url, body.slice(0, 500));
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      // The caller gave up, or the failure is permanent - stop here.
      if (signal?.aborted) throw error;
      if (error instanceof HttpError && !error.isRetryable) throw error;
      if (attempt === attempts) break;

      await sleep(backoffMs(attempt));
    }
  }

  if (lastError instanceof HttpError) throw lastError;
  throw new NetworkError(url, lastError);
}
