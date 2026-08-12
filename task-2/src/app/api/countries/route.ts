/**
 * GET /api/countries        -> every country the dropdown can show
 * GET /api/countries?q=can  -> the same list, filtered server-side
 *
 * The browser only ever talks to this route, so the upstream API key stays on
 * the server.
 */

import type { NextRequest } from "next/server";
import { getCountrySummaries, MissingApiKeyError } from "@/lib/countries";
import { failure, success } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  try {
    const countries = await getCountrySummaries();

    const filtered = query
      ? countries.filter(
          (country) =>
            country.name.toLowerCase().includes(query) ||
            country.code.toLowerCase().startsWith(query),
        )
      : countries;

    return success({ count: filtered.length, countries: filtered });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error("[api/countries] RESTCOUNTRIES_API_KEY is not configured");
      return failure(
        "api_key_missing",
        "This server has no REST Countries API key configured. Set RESTCOUNTRIES_API_KEY.",
        503,
      );
    }

    console.error("[api/countries] failed to load countries:", error);
    return failure("countries_unavailable", "Could not load the country list.", 502);
  }
}
