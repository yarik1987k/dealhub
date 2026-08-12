/**
 * The app's single entry point for country data.
 *
 * Provider choice is decided here, once: REST Countries when
 * RESTCOUNTRIES_API_KEY is set, the bundled snapshot otherwise. If a live call
 * fails we degrade to the snapshot rather than showing an empty widget - the
 * `source` field on every result says which one answered.
 */

import { fetchAllCountries, fetchCountryByCode, getApiKey } from "./restcountries";
import { snapshotCountries, snapshotCountryByCode } from "./snapshot";
import type { CountriesSource, CountryDetail, CountrySummary } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;

type CachedList = {
  source: CountriesSource;
  countries: CountryDetail[];
};

let cache: { expiresAt: number; value: Promise<CachedList> } | null = null;

function toSummary(country: CountryDetail): CountrySummary {
  return {
    code: country.code,
    alpha2: country.alpha2,
    name: country.name,
    flag: country.flag,
  };
}

function snapshotList(): CachedList {
  return { source: "snapshot", countries: snapshotCountries() };
}

async function loadCountries(): Promise<CachedList> {
  const key = getApiKey();
  if (!key) return snapshotList();

  try {
    return { source: "restcountries", countries: await fetchAllCountries(key) };
  } catch (error) {
    console.warn("[countries] REST Countries unavailable, serving bundled snapshot:", error);
    return snapshotList();
  }
}

/** Full list, memoised per server process for an hour. */
export function getCountries(): Promise<CachedList> {
  const now = Date.now();

  if (!cache || cache.expiresAt <= now) {
    const value = loadCountries().catch((error) => {
      cache = null; // never cache a rejection
      throw error;
    });
    cache = { expiresAt: now + CACHE_TTL_MS, value };
  }

  return cache.value;
}

export async function getCountrySummaries(): Promise<{
  source: CountriesSource;
  countries: CountrySummary[];
}> {
  const { source, countries } = await getCountries();
  return { source, countries: countries.map(toSummary) };
}

/**
 * Single country by ISO alpha-3. With a key this hits the dedicated lookup
 * endpoint; on failure - and with no key - it resolves from the cached list.
 */
export async function getCountry(code: string): Promise<{
  source: CountriesSource;
  country: CountryDetail;
} | null> {
  const normalized = code.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) return null;

  const key = getApiKey();

  if (key) {
    try {
      const country = await fetchCountryByCode(key, normalized);
      return country ? { source: "restcountries", country } : null;
    } catch (error) {
      console.warn(`[countries] lookup for ${normalized} failed, falling back:`, error);
    }
  }

  const { source, countries } = await getCountries();
  const fromList = countries.find((country) => country.code === normalized);
  if (fromList) return { source, country: fromList };

  const fromSnapshot = snapshotCountryByCode(normalized);
  return fromSnapshot ? { source: "snapshot", country: fromSnapshot } : null;
}

export { getApiKey };
export type { CountriesSource, CountryDetail, CountrySummary };
