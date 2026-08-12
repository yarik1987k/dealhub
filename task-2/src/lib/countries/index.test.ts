import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The module keeps a process-wide cache, so every test imports it fresh via
 * `loadModule()` rather than sharing one instance.
 */
async function loadModule() {
  vi.resetModules();
  return import("./index");
}

const CANADA = {
  names: { common: "Canada", official: "Canada", native: { eng: { common: "Canada" } } },
  codes: { alpha_2: "CA", alpha_3: "CAN" },
  capitals: [{ name: "Ottawa" }],
  region: "Americas",
  subregion: "North America",
  population: 38_005_238,
  timezones: ["UTC-05:00"],
  currencies: { CAD: { name: "Canadian dollar", symbol: "$" } },
  flag: { emoji: "🇨🇦" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function envelope(objects: unknown[]) {
  return { data: { objects, meta: { more: false } } };
}

beforeEach(() => {
  vi.stubEnv("RESTCOUNTRIES_BASE_URL", "https://api.test/v5");
  // Fallbacks are expected in several tests; keep the output readable.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("without an API key", () => {
  beforeEach(() => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
  });

  it("serves the bundled snapshot and makes no upstream request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getCountrySummaries } = await loadModule();
    const { source, countries } = await getCountrySummaries();

    expect(source).toBe("snapshot");
    expect(countries.length).toBeGreaterThan(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns summaries trimmed to what the dropdown needs", async () => {
    const { getCountrySummaries } = await loadModule();
    const { countries } = await getCountrySummaries();

    const canada = countries.find((country) => country.code === "CAN");
    expect(canada).toEqual({ code: "CAN", alpha2: "CA", name: "Canada", flag: "🇨🇦" });
  });

  it("resolves a single country from the snapshot", async () => {
    const { getCountry } = await loadModule();
    const result = await getCountry("can");

    expect(result?.source).toBe("snapshot");
    expect(result?.country.capital).toEqual(["Ottawa"]);
  });

  it("rejects a malformed code without touching the data layer", async () => {
    const { getCountry } = await loadModule();

    await expect(getCountry("CANADA")).resolves.toBeNull();
    await expect(getCountry("12")).resolves.toBeNull();
    await expect(getCountry("")).resolves.toBeNull();
  });

  it("returns null for a well-formed but unknown code", async () => {
    const { getCountry } = await loadModule();

    await expect(getCountry("ZZZ")).resolves.toBeNull();
  });
});

describe("with an API key", () => {
  beforeEach(() => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "test-key");
  });

  it("serves live data and marks the source", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(envelope([CANADA]))));

    const { getCountrySummaries } = await loadModule();
    const { source, countries } = await getCountrySummaries();

    expect(source).toBe("restcountries");
    expect(countries).toHaveLength(1);
  });

  it("fetches the list once and serves later callers from cache", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(envelope([CANADA])));
    vi.stubGlobal("fetch", fetchMock);

    const { getCountrySummaries } = await loadModule();
    await Promise.all([getCountrySummaries(), getCountrySummaries()]);
    await getCountrySummaries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to the snapshot when the upstream is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const { getCountrySummaries } = await loadModule();
    const { source, countries } = await getCountrySummaries();

    expect(source).toBe("snapshot");
    expect(countries.length).toBeGreaterThan(200);
  });

  it("degrades to the snapshot when the key is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ errors: [{ code: "authKeyMissing", message: "Authorization key required." }] }),
      ),
    );

    const { getCountrySummaries } = await loadModule();

    expect((await getCountrySummaries()).source).toBe("snapshot");
  });

  it("uses the single-country endpoint for a detail lookup", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(envelope([CANADA])),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getCountry } = await loadModule();
    const result = await getCountry("CAN");

    expect(result?.source).toBe("restcountries");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v5/codes.alpha_3/CAN");
  });

  it("treats an upstream 404 as 'no such country', not as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ errors: [] }, 404)));

    const { getCountry } = await loadModule();

    await expect(getCountry("ZZZ")).resolves.toBeNull();
  });

  it("falls back to snapshot data when the detail lookup errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const { getCountry } = await loadModule();
    const result = await getCountry("CAN");

    expect(result?.source).toBe("snapshot");
    expect(result?.country.name).toBe("Canada");
  });
});
