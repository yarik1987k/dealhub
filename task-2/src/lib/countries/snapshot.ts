/**
 * Offline provider. Serves a dataset bundled with the repo so the widget runs
 * with no API key and stays usable if REST Countries is unreachable.
 *
 * See `scripts/generate-snapshot.mjs` for how `src/data/countries-snapshot.json`
 * is produced and which sources it draws on.
 */

import snapshot from "@/data/countries-snapshot.json";
import type { CountryDetail } from "./types";

const countries = snapshot as CountryDetail[];

const byCode = new Map(countries.map((country) => [country.code, country]));

export function snapshotCountries(): CountryDetail[] {
  return countries;
}

export function snapshotCountryByCode(code: string): CountryDetail | null {
  return byCode.get(code.toUpperCase()) ?? null;
}
