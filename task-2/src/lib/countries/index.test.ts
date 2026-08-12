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
  currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("without an API key", () => {
  beforeEach(() => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
  });

  it("refuses the list rather than serving invented data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getCountrySummaries, MissingApiKeyError } = await loadModule();

    await expect(getCountrySummaries()).rejects.toBeInstanceOf(MissingApiKeyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a detail lookup too", async () => {
    const { getCountry, MissingApiKeyError } = await loadModule();

    await expect(getCountry("CAN")).rejects.toBeInstanceOf(MissingApiKeyError);
  });

  it("still rejects a malformed code before asking for a key", async () => {
    const { getCountry } = await loadModule();

    await expect(getCountry("CANADA")).resolves.toBeNull();
  });
});

describe("with an API key", () => {
  beforeEach(() => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "test-key");
  });

  it("returns summaries trimmed to what the dropdown needs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(envelope([CANADA]))));

    const { getCountrySummaries } = await loadModule();
    const countries = await getCountrySummaries();

    expect(countries).toEqual([{ code: "CAN", alpha2: "CA", name: "Canada", flag: "🇨🇦" }]);
  });

  it("fetches the list once and serves later callers from cache", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(envelope([CANADA])));
    vi.stubGlobal("fetch", fetchMock);

    const { getCountrySummaries } = await loadModule();
    await Promise.all([getCountrySummaries(), getCountrySummaries()]);
    await getCountrySummaries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure - the next caller retries", async () => {
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) return jsonResponse({ errors: [{ message: "upstream down" }] });
        return jsonResponse(envelope([CANADA]));
      }),
    );

    const { getCountrySummaries } = await loadModule();

    await expect(getCountrySummaries()).rejects.toThrow(/upstream down/);
    await expect(getCountrySummaries()).resolves.toHaveLength(1);
  });

  it("propagates an upstream outage instead of hiding it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const { getCountrySummaries } = await loadModule();

    await expect(getCountrySummaries()).rejects.toThrow(/Could not reach/);
  });

  it("propagates a rejected key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          errors: [{ code: "authKeyMissing", message: "Authorization key required." }],
        }),
      ),
    );

    const { getCountrySummaries } = await loadModule();

    await expect(getCountrySummaries()).rejects.toThrow(/Authorization key required/);
  });

  it("uses the single-country endpoint for a detail lookup", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(envelope([CANADA])),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getCountry } = await loadModule();
    const country = await getCountry("can");

    expect(country?.name).toBe("Canada");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v5/codes.alpha_3/CAN");
  });

  it("treats an upstream 404 as 'no such country', not as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ errors: [] }, 404)));

    const { getCountry } = await loadModule();

    await expect(getCountry("ZZZ")).resolves.toBeNull();
  });

  it("rejects a malformed code without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getCountry } = await loadModule();

    await expect(getCountry("CANADA")).resolves.toBeNull();
    await expect(getCountry("12")).resolves.toBeNull();
    await expect(getCountry("")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
