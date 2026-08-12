/**
 * The shapes the app itself speaks. Everything coming back from an upstream
 * provider is mapped into these before it reaches a route handler or the UI,
 * so the widget never depends on a provider's field names.
 */

export type Currency = {
  code: string;
  name: string;
  symbol: string | null;
};

/** What the dropdown needs: enough to render a row, nothing more. */
export type CountrySummary = {
  code: string;
  alpha2: string;
  name: string;
  flag: string;
};

export type CountryDetail = CountrySummary & {
  officialName: string;
  nativeName: string | null;
  capital: string[];
  region: string;
  subregion: string | null;
  population: number | null;
  timezones: string[];
  currencies: Currency[];
};

export type ListResponse = {
  count: number;
  countries: CountrySummary[];
};

export type DetailResponse = {
  country: CountryDetail;
};

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
