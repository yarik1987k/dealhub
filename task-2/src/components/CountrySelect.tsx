"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CountrySummary } from "@/lib/countries/types";

type Props = {
  countries: CountrySummary[];
  selected: CountrySummary | null;
  onSelect: (country: CountrySummary) => void;
  /** id of the element that labels the trigger. */
  labelledBy?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function CountrySelect({
  countries,
  selected,
  onSelect,
  labelledBy,
  disabled = false,
  placeholder = "Choose a country",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const listboxId = useId();
  const triggerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) ||
        country.code.toLowerCase().startsWith(needle),
    );
  }, [countries, query]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  // Close on an outside click or on Escape, wherever focus happens to be.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeMenu]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function search(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function choose(country: CountrySummary) {
    onSelect(country);
    closeMenu();
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const country = matches[activeIndex];
      if (country) choose(country);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={triggerId}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${triggerId}` : undefined}
        className="flex w-full items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(16,35,63,0.04)] transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12 disabled:cursor-not-allowed disabled:opacity-60 aria-expanded:border-accent"
      >
        {selected ? (
          <>
            <span aria-hidden className="text-lg leading-none">
              {selected.flag}
            </span>
            <span className="truncate font-semibold text-ink">{selected.name}</span>
          </>
        ) : (
          <span className="truncate text-muted">{placeholder}</span>
        )}

        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`ml-auto size-5 shrink-0 text-accent transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5.5 7.5 10 12l4.5-4.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.65rem)] z-20 overflow-hidden rounded-xl border border-line bg-white p-2 shadow-[0_18px_40px_-12px_rgba(16,35,63,0.28)]">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search countries"
            aria-label="Search countries"
            aria-controls={listboxId}
            className="mb-2 w-full rounded-lg bg-field px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/25"
          />

          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No countries match “{query}”.</p>
          ) : (
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Countries"
              className="scroll-slim max-h-56 overflow-y-auto pr-1"
            >
              {matches.map((country, index) => {
                const isSelected = selected?.code === country.code;
                return (
                  <li
                    key={country.code}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(country)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      index === activeIndex ? "bg-field" : ""
                    } ${isSelected ? "font-semibold text-ink" : "text-ink-soft"}`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {country.flag}
                    </span>
                    <span className="truncate">{country.name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
