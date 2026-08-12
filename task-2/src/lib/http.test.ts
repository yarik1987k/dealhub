import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, HttpError, NetworkError } from "./http";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(...responses: Array<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("fetch called more times than the test expected");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("returns the parsed body on success", async () => {
    mockFetch(jsonResponse({ hello: "world" }));

    await expect(fetchJson<{ hello: string }>("https://example.test/a")).resolves.toEqual({
      hello: "world",
    });
  });

  it("sends an accept header and merges caller headers", async () => {
    const fetchMock = mockFetch(jsonResponse({}));

    await fetchJson("https://example.test/a", { headers: { authorization: "Bearer k" } });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      accept: "application/json",
      authorization: "Bearer k",
    });
  });

  it("retries a 500 and resolves once the upstream recovers", async () => {
    const fetchMock = mockFetch(jsonResponse({ error: "boom" }, 500), jsonResponse({ ok: true }));

    await expect(fetchJson("https://example.test/a", { attempts: 2 })).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 429", async () => {
    const fetchMock = mockFetch(jsonResponse({}, 429), jsonResponse({ ok: true }));

    await fetchJson("https://example.test/a", { attempts: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx, and reports status and body", async () => {
    const fetchMock = mockFetch(jsonResponse({ message: "bad code" }, 400));

    const error = await fetchJson("https://example.test/a", { attempts: 3 }).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).body).toContain("bad code");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the last HttpError when every attempt fails", async () => {
    mockFetch(jsonResponse({}, 503), jsonResponse({}, 503));

    const error = await fetchJson("https://example.test/a", { attempts: 2 }).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(503);
  });

  it("wraps transport failures in a NetworkError", async () => {
    mockFetch(new Error("ECONNREFUSED"), new Error("ECONNREFUSED"));

    const error = await fetchJson("https://example.test/a", { attempts: 2 }).catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).url).toBe("https://example.test/a");
  });

  it("gives up immediately when the caller aborts", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJson("https://example.test/a", { attempts: 3, signal: controller.signal }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out a hanging request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("timed out", "TimeoutError")),
            );
          }),
      ),
    );

    await expect(
      fetchJson("https://example.test/slow", { attempts: 1, timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("HttpError.isRetryable", () => {
  it.each([
    [408, true],
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [404, false],
  ])("status %i -> %s", (status, expected) => {
    expect(new HttpError(status, "https://example.test", "").isRetryable).toBe(expected);
  });
});
