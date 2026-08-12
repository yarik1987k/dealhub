/**
 * REST Countries v5 client (https://restcountries.com/docs/countries).
 *
 * v5 requires an API key: `Authorization: Bearer <key>`. Put it in
 * RESTCOUNTRIES_API_KEY - it is read on the server only and never shipped to
 * the browser. Without a key the app falls back to the bundled snapshot; see
 * `./index.ts`.
 */

import { fetchJson, HttpError } from "@/lib/http";
import type { CountryDetail, Currency } from "./types";

const DEFAULT_BASE_URL = "https://api.restcountries.com/countries/v5";

/** v5 caps the free plan at 100 records per page. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Read per call rather than at import time, so the env stays overridable. */
function baseUrl(): string {
  return process.env.RESTCOUNTRIES_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

/**
 * The upstream payload, typed loosely on purpose: v5 exposes 90+ fields and
 * only these matter here. Everything optional, because a provider adding or
 * renaming a field should degrade one row, not crash the widget.
 */
type RawCountry = {
  names?: {
    common?: string;
    official?: string;
    native?: Record<string, { common?: string; official?: string }>;
  };
  codes?: {
    alpha_2?: string;
    alpha_3?: string;
  };
  capitals?: Array<{ name?: string } | string>;
  region?: string;
  subregion?: string;
  population?: number;
  timezones?: string[];
  currencies?: Record<string, { name?: string; symbol?: string }>;
  flag?: { emoji?: string };
};

type ListEnvelope = {
  data?: {
    objects?: RawCountry[];
    meta?: { total?: number; count?: number; more?: boolean };
  };
  errors?: Array<{ message?: string; code?: string }>;
};

export function getApiKey(): string | null {
  const key = process.env.RESTCOUNTRIES_API_KEY?.trim();
  return key ? key : null;
}

function authHeaders(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` };
}

function capitalNames(capitals: RawCountry["capitals"]): string[] {
  if (!Array.isArray(capitals)) return [];
  return capitals
    .map((entry) => (typeof entry === "string" ? entry : entry?.name))
    .filter((name): name is string => Boolean(name));
}

function nativeName(names: RawCountry["names"]): string | null {
  const native = names?.native;
  if (!native) return null;
  for (const value of Object.values(native)) {
    if (value?.common) return value.common;
  }
  return null;
}

function currencyList(currencies: RawCountry["currencies"]): Currency[] {
  if (!currencies) return [];
  return Object.entries(currencies).map(([code, value]) => ({
    code,
    name: value?.name ?? code,
    symbol: value?.symbol ?? null,
  }));
}

/** Maps one upstream record onto our shape. Returns null if it is unusable. */
function toCountryDetail(raw: RawCountry): CountryDetail | null {
  const name = raw.names?.common;
  const alpha3 = raw.codes?.alpha_3;
  const alpha2 = raw.codes?.alpha_2;

  if (!name || !alpha3 || !alpha2) return null;

  return {
    code: alpha3,
    alpha2,
    name,
    officialName: raw.names?.official ?? name,
    nativeName: nativeName(raw.names),
    flag: raw.flag?.emoji ?? "",
    capital: capitalNames(raw.capitals),
    region: raw.region ?? "Unknown",
    subregion: raw.subregion || null,
    population: typeof raw.population === "number" ? raw.population : null,
    timezones: Array.isArray(raw.timezones) ? raw.timezones : [],
    currencies: currencyList(raw.currencies),
  };
}

function readObjects(envelope: ListEnvelope, url: string): RawCountry[] {
  if (envelope.errors?.length) {
    const message = envelope.errors.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(`REST Countries returned an error for ${url}: ${message || "unknown error"}`);
  }

  const objects = envelope.data?.objects;
  if (!Array.isArray(objects)) {
    throw new Error(`Unexpected REST Countries payload for ${url}`);
  }
  return objects;
}

/**
 * Walks every page of `/countries/v5`. The full list is ~250 records, so this
 * is three requests that we then cache in memory (see `./index.ts`).
 */
export async function fetchAllCountries(key: string): Promise<CountryDetail[]> {
  const collected: CountryDetail[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${baseUrl()}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
    const envelope = await fetchJson<ListEnvelope>(url, {
      headers: authHeaders(key),
      revalidate: 60 * 60,
    });

    const objects = readObjects(envelope, url);
    for (const raw of objects) {
      const country = toCountryDetail(raw);
      if (country) collected.push(country);
    }

    const more = envelope.data?.meta?.more;
    if (more === false || objects.length < PAGE_SIZE) break;
  }

  if (collected.length === 0) {
    throw new Error("REST Countries returned no usable countries");
  }

  return collected.sort((a, b) => a.name.localeCompare(b.name));
}

/** Looks a single country up by ISO alpha-3 code. `null` means "no such country". */
export async function fetchCountryByCode(key: string, code: string): Promise<CountryDetail | null> {
  const url = `${baseUrl()}/codes.alpha_3/${encodeURIComponent(code.toUpperCase())}`;

  let envelope: ListEnvelope;
  try {
    envelope = await fetchJson<ListEnvelope>(url, {
      headers: authHeaders(key),
      revalidate: 60 * 60,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }

  const [raw] = readObjects(envelope, url);
  return raw ? toCountryDetail(raw) : null;
}
