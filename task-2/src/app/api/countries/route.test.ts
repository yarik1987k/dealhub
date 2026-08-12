import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/** The handler only reads `nextUrl`, so a URL is all the test needs to pass. */
function request(url: string): NextRequest {
  return { nextUrl: new URL(url) } as NextRequest;
}

const UPSTREAM = [
  {
    names: { common: "Canada", official: "Canada" },
    codes: { alpha_2: "CA", alpha_3: "CAN" },
    capitals: [{ name: "Ottawa" }],
    region: "Americas",
    subregion: "North America",
    population: 38_005_238,
    timezones: ["UTC-05:00"],
    currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
    flag: { emoji: "🇨🇦" },
  },
  {
    names: { common: "Germany", official: "Federal Republic of Germany" },
    codes: { alpha_2: "DE", alpha_3: "DEU" },
    capitals: [{ name: "Berlin" }],
    region: "Europe",
    population: 83_240_525,
    timezones: ["UTC+01:00"],
    currencies: [{ code: "EUR", name: "Euro", symbol: "€" }],
    flag: { emoji: "🇩🇪" },
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubUpstream() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ data: { objects: UPSTREAM, meta: { more: false } } })),
  );
}

async function loadHandler() {
  vi.resetModules();
  const handlerModule = await import("./route");
  return handlerModule.GET;
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

describe("GET /api/countries", () => {
  it("returns the country list", async () => {
    stubUpstream();
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.countries).toEqual([
      { code: "CAN", alpha2: "CA", name: "Canada", flag: "🇨🇦" },
      { code: "DEU", alpha2: "DE", name: "Germany", flag: "🇩🇪" },
    ]);
  });

  it("marks responses as cacheable by a CDN", async () => {
    stubUpstream();
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));

    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
  });

  it("filters by name fragment, case-insensitively", async () => {
    stubUpstream();
    const GET = await loadHandler();

    const body = await (await GET(request("http://localhost/api/countries?q=cAnAd"))).json();

    expect(body.countries.map((country: { code: string }) => country.code)).toEqual(["CAN"]);
  });

  it("filters by code prefix", async () => {
    stubUpstream();
    const GET = await loadHandler();

    const body = await (await GET(request("http://localhost/api/countries?q=deu"))).json();

    expect(body.countries).toHaveLength(1);
    expect(body.countries[0].name).toBe("Germany");
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    stubUpstream();
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries?q=zzzzz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ count: 0, countries: [] });
  });

  it("answers 503 when the server has no API key configured", async () => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("api_key_missing");
    expect(body.error.message).toMatch(/RESTCOUNTRIES_API_KEY/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 502 when the upstream is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ errors: [{ message: "upstream down" }] })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("countries_unavailable");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
