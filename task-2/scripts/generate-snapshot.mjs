/**
 * Regenerates src/data/countries-snapshot.json - the offline dataset the app
 * serves when RESTCOUNTRIES_API_KEY is not set.
 *
 * Run manually; it is not part of the build:
 *
 *   npm i --no-save countries-and-timezones
 *   node scripts/generate-snapshot.mjs
 *
 * Sources (all free, no key):
 *   - mledoze/countries v4.0.0 - names, ISO codes, capitals, region, currencies, flag emoji
 *   - World Bank SP.POP.TOTL  - population
 *   - IANA tz database, via countries-and-timezones - UTC offsets
 */

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ct from "countries-and-timezones";

const COUNTRIES_URL = "https://raw.githubusercontent.com/mledoze/countries/v4.0.0/countries.json";
const POPULATION_URL =
  "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=400&date=2023";

const OUTPUT = fileURLToPath(new URL("../src/data/countries-snapshot.json", import.meta.url));

/** A winter date, so zones report their standard (non-DST) offset. */
const WINTER = Date.UTC(2024, 0, 15);

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return response.json();
}

function offsetOf(zone) {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(new Date(WINTER))
    .find((part) => part.type === "timeZoneName").value;
  return label === "GMT" ? "UTC+00:00" : label.replace("GMT", "UTC");
}

function offsetMinutes(offset) {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 0;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

function timezonesOf(alpha2) {
  const entry = ct.getCountry(alpha2);
  if (!entry) return ["UTC+00:00"];
  return [...new Set(entry.timezones.map(offsetOf))].sort(
    (a, b) => offsetMinutes(a) - offsetMinutes(b),
  );
}

function nativeNameOf(name) {
  const first = Object.values(name.native ?? {})[0];
  return first?.common ?? null;
}

const [countries, populationPayload] = await Promise.all([
  getJson(COUNTRIES_URL),
  getJson(POPULATION_URL),
]);

const population = new Map(
  (populationPayload[1] ?? [])
    .filter((row) => row.countryiso3code && typeof row.value === "number")
    .map((row) => [row.countryiso3code, row.value]),
);

const snapshot = countries
  .map((country) => ({
    code: country.cca3,
    alpha2: country.cca2,
    name: country.name.common,
    officialName: country.name.official,
    nativeName: nativeNameOf(country.name),
    flag: country.flag,
    capital: country.capital ?? [],
    region: country.region,
    subregion: country.subregion || null,
    // The World Bank does not track every dependency and territory.
    population: population.get(country.cca3) ?? null,
    timezones: timezonesOf(country.cca2),
    currencies: Object.entries(country.currencies ?? {}).map(([code, currency]) => ({
      code,
      name: currency.name,
      symbol: currency.symbol ?? null,
    })),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n");

const missing = snapshot.filter((country) => country.population === null).length;
console.log(`Wrote ${snapshot.length} countries to ${OUTPUT} (${missing} without population).`);
