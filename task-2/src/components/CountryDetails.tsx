import type { CountryDetail } from "@/lib/countries/types";
import {
  flagImageUrl,
  formatCapital,
  formatCurrencies,
  formatPopulation,
  formatRegion,
  formatTimezones,
} from "@/lib/format";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-3 last:border-b-0">
      <span className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
        <span aria-hidden className="size-1.5 rounded-full bg-dot" />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

export function CountryDetails({ country }: { country: CountryDetail }) {
  return (
    <section className="mt-5 border-t border-line pt-5" aria-live="polite">
      <header className="flex items-center gap-3">
        {/* Flags come from flagcdn.com, keyed off the ISO alpha-2 code, so the
            image host stays the same whichever data provider answered. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={flagImageUrl(country.alpha2)}
          alt={`Flag of ${country.name}`}
          width={44}
          height={33}
          className="h-8 w-11 rounded-md object-cover shadow-[0_1px_3px_rgba(16,35,63,0.18)]"
        />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-ink">{country.name}</h2>
          <p className="truncate text-xs text-muted">{country.nativeName ?? country.officialName}</p>
        </div>
      </header>

      <div className="mt-4">
        <DetailRow label="Capital" value={formatCapital(country.capital)} />
        <DetailRow label="Region" value={formatRegion(country)} />
        <DetailRow label="Currencies" value={formatCurrencies(country.currencies)} />
        <DetailRow label="Population" value={formatPopulation(country.population)} />
        <DetailRow label="Time zone" value={formatTimezones(country.timezones)} />
      </div>
    </section>
  );
}
