import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/** The handler only reads `nextUrl`, so a URL is all the test needs to pass. */
function request(url: string): NextRequest {
  return { nextUrl: new URL(url) } as NextRequest;
}

async function loadHandler() {
  vi.resetModules();
  const handlerModule = await import("./route");
  return handlerModule.GET;
}

beforeEach(() => {
  vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/countries", () => {
  it("returns every country with the source that answered", async () => {
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("snapshot");
    expect(body.count).toBe(body.countries.length);
    expect(body.countries.length).toBeGreaterThan(200);
  });

  it("marks responses as cacheable by a CDN", async () => {
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries"));

    expect(response.headers.get("cache-control")).toContain("s-maxage=3600");
  });

  it("filters by name fragment, case-insensitively", async () => {
    const GET = await loadHandler();

    const body = await (await GET(request("http://localhost/api/countries?q=cAnAd"))).json();

    expect(body.countries.map((country: { code: string }) => country.code)).toEqual(["CAN"]);
  });

  it("filters by code prefix", async () => {
    const GET = await loadHandler();

    const body = await (await GET(request("http://localhost/api/countries?q=deu"))).json();

    expect(body.countries).toHaveLength(1);
    expect(body.countries[0].name).toBe("Germany");
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const GET = await loadHandler();

    const response = await GET(request("http://localhost/api/countries?q=zzzzz"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ count: 0, countries: [] });
  });
});

describe("GET /api/countries when the data layer fails", () => {
  it("answers 502 with an error envelope instead of throwing", async () => {
    vi.resetModules();
    vi.doMock("@/lib/countries", () => ({
      getCountrySummaries: () => Promise.reject(new Error("data layer exploded")),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("./route");
    const response = await GET(request("http://localhost/api/countries"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("countries_unavailable");
    expect(response.headers.get("cache-control")).toBe("no-store");

    vi.doUnmock("@/lib/countries");
  });
});
