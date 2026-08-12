import { CountryWidget } from "@/components/CountryWidget";
import { getCountrySummaries } from "@/lib/countries";
import type { CountrySummary } from "@/lib/countries/types";

// Country data changes rarely; re-render the shell once an hour.
export const revalidate = 3600;

export default async function Home() {
  let countries: CountrySummary[] = [];

  // A failure here is not fatal: the widget retries through /api/countries and
  // surfaces whatever the route reports - a missing key, or an upstream outage.
  try {
    countries = await getCountrySummaries();
  } catch (error) {
    console.error("[page] could not preload countries:", error);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-eyebrow">
          Rest Countries
        </p>
        <h1 className="mt-2 mb-6 font-serif text-4xl font-bold tracking-tight text-ink">
          Country Explorer
        </h1>
      </div>

      <CountryWidget initialCountries={countries} />
    </main>
  );
}
