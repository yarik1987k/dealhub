import type { CountryDetail } from "./countries/types";

const numberFormat = new Intl.NumberFormat("en-US");

export function formatPopulation(population: number | null): string {
  return population === null ? "—" : numberFormat.format(population);
}

/** "Americas · North America" */
export function formatRegion(country: Pick<CountryDetail, "region" | "subregion">): string {
  return [country.region, country.subregion].filter(Boolean).join(" · ");
}

/** "Canadian dollar ($)" */
export function formatCurrencies(currencies: CountryDetail["currencies"]): string {
  if (currencies.length === 0) return "—";
  return currencies
    .map((currency) => (currency.symbol ? `${currency.name} (${currency.symbol})` : currency.name))
    .join(", ");
}

export function formatCapital(capital: string[]): string {
  return capital.length > 0 ? capital.join(", ") : "—";
}

export function formatTimezones(timezones: string[]): string {
  return timezones.length > 0 ? timezones.join(", ") : "—";
}

export function flagImageUrl(alpha2: string, width: 40 | 80 | 160 = 80): string {
  return `https://flagcdn.com/w${width}/${alpha2.toLowerCase()}.png`;
}
