import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllCountries, fetchCountryByCode, getApiKey } from "./restcountries";

const KEY = "test-key";

/** A well-formed v5 record, per https://restcountries.com/docs/countries. */
const CANADA = {
  names: {
    common: "Canada",
    official: "Canada",
    native: { eng: { common: "Canada" }, fra: { common: "Canada" } },
  },
  codes: { alpha_2: "CA", alpha_3: "CAN", ccn3: "124" },
  capitals: [{ name: "Ottawa" }],
  region: "Americas",
  subregion: "North America",
  population: 38_005_238,
  timezones: ["UTC-08:00", "UTC-07:00", "UTC-06:00", "UTC-05:00", "UTC-04:00", "UTC-03:30"],
  currencies: { CAD: { name: "Canadian dollar", symbol: "$" } },
  flag: { emoji: "🇨🇦" },
};

function envelope(objects: unknown[], more = false) {
  return {
    data: { objects, meta: { total: objects.length, count: objects.length, more } },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(...bodies: Array<{ body: unknown; status?: number }>) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = bodies.shift();
    if (!next) throw new Error("unexpected extra request");
    return jsonResponse(next.body, next.status ?? 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("RESTCOUNTRIES_BASE_URL", "https://api.test/v5");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getApiKey", () => {
  it("returns null when unset or blank", () => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", "");
    expect(getApiKey()).toBeNull();

    vi.stubEnv("RESTCOUNTRIES_API_KEY", "   ");
    expect(getApiKey()).toBeNull();
  });

  it("trims a configured key", () => {
    vi.stubEnv("RESTCOUNTRIES_API_KEY", " abc ");
    expect(getApiKey()).toBe("abc");
  });
});

describe("fetchAllCountries", () => {
  it("maps an upstream record onto the app's shape", async () => {
    mockFetch({ body: envelope([CANADA]) });

    const [canada] = await fetchAllCountries(KEY);

    expect(canada).toEqual({
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
      timezones: ["UTC-08:00", "UTC-07:00", "UTC-06:00", "UTC-05:00", "UTC-04:00", "UTC-03:30"],
      currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
    });
  });

  it("authenticates with a bearer token", async () => {
    const fetchMock = mockFetch({ body: envelope([CANADA]) });

    await fetchAllCountries(KEY);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/v5?limit=100&offset=0");
    expect(init.headers).toMatchObject({ authorization: `Bearer ${KEY}` });
  });

  it("skips records that lack a name or ISO codes instead of failing the batch", async () => {
    mockFetch({ body: envelope([CANADA, { names: {}, codes: {} }, { codes: { alpha_3: "XXX" } }]) });

    const countries = await fetchAllCountries(KEY);

    expect(countries).toHaveLength(1);
    expect(countries[0].code).toBe("CAN");
  });

  it("fills in defaults when optional fields are missing", async () => {
    mockFetch({
      body: envelope([{ names: { common: "Nowhere" }, codes: { alpha_2: "NW", alpha_3: "NWH" } }]),
    });

    const [country] = await fetchAllCountries(KEY);

    expect(country).toMatchObject({
      officialName: "Nowhere",
      nativeName: null,
      flag: "",
      capital: [],
      region: "Unknown",
      subregion: null,
      population: null,
      timezones: [],
      currencies: [],
    });
  });

  it("accepts capitals given as plain strings", async () => {
    mockFetch({
      body: envelope([{ ...CANADA, capitals: ["Ottawa"] }]),
    });

    const [country] = await fetchAllCountries(KEY);

    expect(country.capital).toEqual(["Ottawa"]);
  });

  it("falls back to the currency code when the name is missing", async () => {
    mockFetch({ body: envelope([{ ...CANADA, currencies: { CAD: {} } }]) });

    const [country] = await fetchAllCountries(KEY);

    expect(country.currencies).toEqual([{ code: "CAD", name: "CAD", symbol: null }]);
  });

  it("walks every page until the upstream reports no more", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({
      names: { common: `Country ${index}` },
      codes: { alpha_2: "AA", alpha_3: `A${String(index).padStart(2, "0")}` },
    }));
    const fetchMock = mockFetch(
      { body: envelope(fullPage, true) },
      { body: envelope([CANADA], false) },
    );

    const countries = await fetchAllCountries(KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(countries).toHaveLength(101);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/v5?limit=100&offset=100");
  });

  it("stops after a short page even if `more` is missing", async () => {
    const fetchMock = mockFetch({ body: { data: { objects: [CANADA] } } });

    await fetchAllCountries(KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns countries sorted by name", async () => {
    mockFetch({
      body: envelope([
        { names: { common: "Zimbabwe" }, codes: { alpha_2: "ZW", alpha_3: "ZWE" } },
        CANADA,
        { names: { common: "Albania" }, codes: { alpha_2: "AL", alpha_3: "ALB" } },
      ]),
    });

    const countries = await fetchAllCountries(KEY);

    expect(countries.map((country) => country.name)).toEqual(["Albania", "Canada", "Zimbabwe"]);
  });

  it("throws when the upstream answers with an error envelope", async () => {
    mockFetch({ body: { errors: [{ message: "Authorization key required." }] } });

    await expect(fetchAllCountries(KEY)).rejects.toThrow(/Authorization key required/);
  });

  it("throws when the payload has no objects array", async () => {
    mockFetch({ body: { data: {} } });

    await expect(fetchAllCountries(KEY)).rejects.toThrow(/Unexpected REST Countries payload/);
  });

  it("throws when every record was unusable", async () => {
    mockFetch({ body: envelope([{ names: {}, codes: {} }]) });

    await expect(fetchAllCountries(KEY)).rejects.toThrow(/no usable countries/);
  });
});

describe("fetchCountryByCode", () => {
  it("looks the country up by alpha-3 code", async () => {
    const fetchMock = mockFetch({ body: envelope([CANADA]) });

    const country = await fetchCountryByCode(KEY, "can");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v5/codes.alpha_3/CAN");
    expect(country?.name).toBe("Canada");
  });

  it("returns null for an unknown code rather than throwing", async () => {
    mockFetch({ body: { errors: [{ message: "not found" }] }, status: 404 });

    await expect(fetchCountryByCode(KEY, "ZZZ")).resolves.toBeNull();
  });

  it("returns null when the upstream answers with an empty result", async () => {
    mockFetch({ body: envelope([]) });

    await expect(fetchCountryByCode(KEY, "ZZZ")).resolves.toBeNull();
  });

  it("propagates other upstream failures", async () => {
    mockFetch({ body: {}, status: 401 });

    await expect(fetchCountryByCode(KEY, "CAN")).rejects.toThrow(/401/);
  });
});
