import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) => Promise<Response>;

const CANADA = {
  names: { common: "Canada", official: "Canada", native: { eng: { common: "Canada" } } },
  codes: { alpha_2: "CA", alpha_3: "CAN" },
  capitals: [{ name: "Ottawa" }],
  region: "Americas",
  subregion: "North America",
  population: 38_005_238,
  timezones: ["UTC-05:00", "UTC-03:30"],
  currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
  flag: { emoji: "🇨🇦" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubUpstream(objects: unknown[], status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    jsonResponse({ data: { objects, meta: { more: false } } }, status),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function context(code: string) {
  return { params: Promise.resolve({ code }) };
}

async function loadHandler(): Promise<Handler> {
  vi.resetModules();
  const handlerModule = await import("./route");
  return handlerModule.GET as unknown as Handler;
}

beforeEach(() => {
  vi.stubEnv("RESTCOUNTRIES_API_KEY", "test-key");
  vi.stubEnv("RESTCOUNTRIES_BASE_URL", "https://api.test/v5");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/countries/[code]", () => {
  it("returns the full detail payload for a known code", async () => {
    stubUpstream([CANADA]);
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CAN"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.country).toEqual({
      code: "CAN",
      alpha2: "CA",
      name: "Canada",
      officialName: "Canada",
      nativeName: "Canada",
      flag: "🇨🇦",
      capital: ["Ottawa"],
      region: "Americas",
      subregion: "North America",
      population: 38_005_238,
      timezones: ["UTC-05:00", "UTC-03:30"],
      currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
    });
  });

  it("upper-cases a lowercase code before asking the upstream", async () => {
    const fetchMock = stubUpstream([CANADA]);
    const GET = await loadHandler();

    const body = await (await GET({} as NextRequest, context("can"))).json();

    expect(body.country.code).toBe("CAN");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v5/codes.alpha_3/CAN");
  });

  it("rejects a malformed code with 400, before any request", async () => {
    const fetchMock = stubUpstream([]);
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CANADA"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a well-formed but unknown code", async () => {
    stubUpstream([]);
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("ZZZ"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: "not_found",
      message: 'No country matches the code "ZZZ".',
    });
  });

  it("answers 503 when the server has no API key configured", async () => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CAN"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("api_key_missing");
  });

  it("answers 502 when the upstream fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ errors: [{ message: "upstream down" }] })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CAN"));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("country_unavailable");
  });
});
