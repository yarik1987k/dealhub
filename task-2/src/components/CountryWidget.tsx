"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CountryDetails } from "./CountryDetails";
import { CountrySelect } from "./CountrySelect";
import type {
  CountryDetail,
  CountrySummary,
  DetailResponse,
  ErrorResponse,
  ListResponse,
} from "@/lib/countries/types";

type Props = {
  /** Rendered on the server so the dropdown is usable on first paint. */
  initialCountries: CountrySummary[];
};

function isErrorResponse(payload: unknown): payload is ErrorResponse {
  return typeof payload === "object" && payload !== null && "error" in payload;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = isErrorResponse(payload)
      ? payload.error.message
      : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

export function CountryWidget({ initialCountries }: Props) {
  const [countries, setCountries] = useState(initialCountries);
  const [selected, setSelected] = useState<CountrySummary | null>(null);
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailRequest = useRef<AbortController | null>(null);

  // Only runs if the server-side load came back empty - the list is otherwise
  // already in the initial HTML.
  useEffect(() => {
    if (countries.length > 0) return;

    const controller = new AbortController();
    getJson<ListResponse>("/api/countries", controller.signal)
      .then((data) => {
        setCountries(data.countries);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not load countries.");
      });

    return () => controller.abort();
  }, [countries.length]);

  const loadDetail = useCallback(async (country: CountrySummary) => {
    detailRequest.current?.abort(); // a newer selection wins
    const controller = new AbortController();
    detailRequest.current = controller;

    setLoading(true);
    setError(null);

    try {
      const data = await getJson<DetailResponse>(
        `/api/countries/${encodeURIComponent(country.code)}`,
        controller.signal,
      );
      setDetail(data.country);
    } catch (cause: unknown) {
      if (controller.signal.aborted) return;
      setDetail(null);
      setError(cause instanceof Error ? cause.message : "Could not load this country.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => () => detailRequest.current?.abort(), []);

  function handleSelect(country: CountrySummary) {
    setSelected(country);
    void loadDetail(country);
  }

  return (
    <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-[0_24px_60px_-24px_rgba(16,35,63,0.35)] ring-1 ring-white/60">
      <p
        id="country-select-label"
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft"
      >
        Select a country
      </p>

      <CountrySelect
        countries={countries}
        selected={selected}
        onSelect={handleSelect}
        labelledBy="country-select-label"
        disabled={countries.length === 0 && !error}
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && !detail && (
        <p className="mt-5 border-t border-line pt-5 text-sm text-muted">Loading country…</p>
      )}

      {detail && !error && <CountryDetails country={detail} />}
    </div>
  );
}
