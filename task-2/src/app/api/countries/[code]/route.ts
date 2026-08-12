/**
 * GET /api/countries/:code - full detail for one ISO alpha-3 code (e.g. CAN).
 */

import type { NextRequest } from "next/server";
import { getCountry, MissingApiKeyError } from "@/lib/countries";
import { failure, success } from "@/lib/api-response";

export async function GET(_request: NextRequest, context: RouteContext<"/api/countries/[code]">) {
  const { code } = await context.params;

  if (!/^[A-Za-z]{3}$/.test(code)) {
    return failure("invalid_code", "Expected a three-letter ISO country code, e.g. CAN.", 400);
  }

  try {
    const country = await getCountry(code);

    if (!country) {
      return failure("not_found", `No country matches the code "${code.toUpperCase()}".`, 404);
    }

    return success({ country });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      console.error(`[api/countries/${code}] RESTCOUNTRIES_API_KEY is not configured`);
      return failure(
        "api_key_missing",
        "This server has no REST Countries API key configured. Set RESTCOUNTRIES_API_KEY.",
        503,
      );
    }

    console.error(`[api/countries/${code}] lookup failed:`, error);
    return failure("country_unavailable", "Could not load this country right now.", 502);
  }
}
