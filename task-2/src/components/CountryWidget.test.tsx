/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountryWidget } from "./CountryWidget";
import type { CountryDetail, CountrySummary } from "@/lib/countries/types";

const SUMMARIES: CountrySummary[] = [
  { code: "BRA", alpha2: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CAN", alpha2: "CA", name: "Canada", flag: "🇨🇦" },
];

const CANADA: CountryDetail = {
  code: "CAN",
  alpha2: "CA",
  name: "Canada",
  officialName: "Canada",
  nativeName: "Canada",
  flag: "🇨🇦",
  capital: ["Ottawa"],
  region: "Americas",
  subregion: "North America",
  population: 38_005_238,
  timezones: ["UTC-05:00", "UTC-03:30"],
  currencies: [{ code: "CAD", name: "Canadian dollar", symbol: "$" }],
};

const BRAZIL: CountryDetail = {
  ...CANADA,
  code: "BRA",
  alpha2: "BR",
  name: "Brazil",
  nativeName: "Brasil",
  capital: ["Brasília"],
  subregion: "South America",
  population: 212_559_417,
  timezones: ["UTC-03:00"],
  currencies: [{ code: "BRL", name: "Brazilian real", symbol: "R$" }],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CountryWidget", () => {
  it("renders the server-supplied list without fetching again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<CountryWidget initialCountries={SUMMARIES} />);

    expect(screen.getByText("Select a country")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads and renders detail for the selected country", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ source: "snapshot", country: CANADA })));
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={SUMMARIES} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Canada/ }));

    expect(await screen.findByText("Ottawa")).toBeInTheDocument();
    expect(screen.getByText("Americas · North America")).toBeInTheDocument();
    expect(screen.getByText("Canadian dollar ($)")).toBeInTheDocument();
    expect(screen.getByText("38,005,238")).toBeInTheDocument();
    expect(screen.getByText("UTC-05:00, UTC-03:30")).toBeInTheDocument();
  });

  it("requests the detail route for the chosen code", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({ source: "snapshot", country: CANADA }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={SUMMARIES} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Canada/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/countries/CAN");
  });

  it("surfaces the API's error message and hides stale detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "not_found", message: "No country matches." } }, 404),
      ),
    );
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={SUMMARIES} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Canada/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No country matches.");
    expect(screen.queryByText("Ottawa")).not.toBeInTheDocument();
  });

  it("reports a transport failure rather than failing silently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={SUMMARIES} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Canada/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to fetch");
  });

  it("shows the last selection when two lookups overlap", async () => {
    // Canada's request resolves after Brazil's, so a naive implementation would
    // paint Canada last. The in-flight request must be aborted instead.
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const slow = url.endsWith("/CAN");
      return new Promise<Response>((resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        setTimeout(
          () => resolve(jsonResponse({ source: "snapshot", country: slow ? CANADA : BRAZIL })),
          slow ? 50 : 5,
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={SUMMARIES} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Canada/ }));
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("option", { name: /Brazil/ }));

    expect(await screen.findByText("Brasília")).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByText("Brasília")).toBeInTheDocument();
    expect(screen.queryByText("Ottawa")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("recovers the list from the API when the server render came back empty", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ source: "snapshot", count: SUMMARIES.length, countries: SUMMARIES }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CountryWidget initialCountries={[]} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/countries", expect.anything()));

    await user.click(await screen.findByRole("button"));
    expect(await screen.findByRole("option", { name: /Canada/ })).toBeInTheDocument();
  });

  it("shows an error when the list cannot be recovered either", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "countries_unavailable", message: "Could not load." } }, 502),
      ),
    );

    render(<CountryWidget initialCountries={[]} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");
  });
});
