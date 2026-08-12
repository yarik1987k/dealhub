import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

type Handler = (
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) => Promise<Response>;

function context(code: string) {
  return { params: Promise.resolve({ code }) };
}

async function loadHandler(): Promise<Handler> {
  vi.resetModules();
  const handlerModule = await import("./route");
  return handlerModule.GET as unknown as Handler;
}

beforeEach(() => {
  vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/countries/[code]", () => {
  it("returns the full detail payload for a known code", async () => {
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CAN"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("snapshot");
    expect(body.country).toMatchObject({
      code: "CAN",
      alpha2: "CA",
      name: "Canada",
      capital: ["Ottawa"],
      region: "Americas",
      subregion: "North America",
    });
    expect(body.country.currencies[0]).toMatchObject({ code: "CAD", symbol: "$" });
    expect(body.country.timezones.length).toBeGreaterThan(0);
  });

  it("accepts a lowercase code", async () => {
    const GET = await loadHandler();

    const body = await (await GET({} as NextRequest, context("can"))).json();

    expect(body.country.code).toBe("CAN");
  });

  it("rejects a malformed code with 400", async () => {
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("CANADA"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_code");
  });

  it("answers 404 for a well-formed but unknown code", async () => {
    const GET = await loadHandler();

    const response = await GET({} as NextRequest, context("ZZZ"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toEqual({
      code: "not_found",
      message: 'No country matches the code "ZZZ".',
    });
  });

  it("answers 502 when the data layer throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/countries", () => ({
      getCountry: () => Promise.reject(new Error("data layer exploded")),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { GET } = await import("./route");
    const response = await (GET as unknown as Handler)({} as NextRequest, context("CAN"));

    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("country_unavailable");

    vi.doUnmock("@/lib/countries");
  });
});
