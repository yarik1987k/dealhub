/** Consistent JSON envelopes for this app's own API routes. */

import type { ErrorResponse } from "./countries/types";

const CACHE_HEADER = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

export function success<T>(payload: T, init: ResponseInit = {}): Response {
  return Response.json(payload, {
    ...init,
    headers: { "cache-control": CACHE_HEADER, ...init.headers },
  });
}

export function failure(code: string, message: string, status: number): Response {
  const body: ErrorResponse = { error: { code, message } };
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
