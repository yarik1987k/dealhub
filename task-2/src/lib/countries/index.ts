/**
 * The app's single entry point for country data, backed by REST Countries v5.
 *
 * An API key is required; without one the data layer refuses to answer rather
 * than inventing data, and the route handlers turn that into a 503 the UI can
 * explain.
 */

import { fetchAllCountries, fetchCountryByCode, getApiKey } from "./restcountries";
import type { CountryDetail, CountrySummary } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000;

export class MissingApiKeyError extends Error {
  constructor() {
    super("RESTCOUNTRIES_API_KEY is not configured.");
    this.name = "MissingApiKeyError";
  }
}

let cache: { expiresAt: number; value: Promise<CountryDetail[]> } | null = null;

function requireApiKey(): string {
  const key = getApiKey();
  if (!key) throw new MissingApiKeyError();
  return key;
}

function toSummary(country: CountryDetail): CountrySummary {
  return {
    code: country.code,
    alpha2: country.alpha2,
    name: country.name,
    flag: country.flag,
  };
}

/** Full list, memoised per server process for an hour. */
export function getCountries(): Promise<CountryDetail[]> {
  const key = requireApiKey();
  const now = Date.now();

  if (!cache || cache.expiresAt <= now) {
    const value = fetchAllCountries(key).catch((error: unknown) => {
      cache = null; // never cache a rejection
      throw error;
    });
    cache = { expiresAt: now + CACHE_TTL_MS, value };
  }

  return cache.value;
}

/** Just what the dropdown renders. */
export async function getCountrySummaries(): Promise<CountrySummary[]> {
  return (await getCountries()).map(toSummary);
}

/** Single country by ISO alpha-3. `null` means no such country. */
export async function getCountry(code: string): Promise<CountryDetail | null> {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return null;

  return fetchCountryByCode(requireApiKey(), normalized);
}

export { getApiKey };
export type { CountryDetail, CountrySummary };
