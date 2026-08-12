/**
 * GET /api/countries/:code - full detail for one ISO alpha-3 code (e.g. CAN).
 */

import type { NextRequest } from "next/server";
import { getCountry } from "@/lib/countries";
import { failure, success } from "@/lib/api-response";

export async function GET(_request: NextRequest, context: RouteContext<"/api/countries/[code]">) {
  const { code } = await context.params;

  if (!/^[A-Za-z]{3}$/.test(code)) {
    return failure("invalid_code", "Expected a three-letter ISO country code, e.g. CAN.", 400);
  }

  try {
    const result = await getCountry(code);

    if (!result) {
      return failure("not_found", `No country matches the code "${code.toUpperCase()}".`, 404);
    }

    return success({ source: result.source, country: result.country });
  } catch (error) {
    console.error(`[api/countries/${code}] lookup failed:`, error);
    return failure("country_unavailable", "Could not load this country right now.", 502);
  }
}
