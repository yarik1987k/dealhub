# Country Explorer

A country widget built with Next.js (App Router, TypeScript, Tailwind CSS v4). Pick a country
from a searchable dropdown and see its capital, region, currencies, population and time zones.

## Running it

```bash
npm install
cp .env.example .env.local   # then add your key - see below
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`, `npm run typecheck`, `npm test`.

## API key

REST Countries **v5 requires an API key** (the old keyless `v3.1` endpoints were retired and now
return a deprecation error). Get a free key at <https://restcountries.com> and put it in
`.env.local`:

```
RESTCOUNTRIES_API_KEY=your-key-here
```

The key is read server-side only and is sent upstream as `Authorization: Bearer <key>`. It never
reaches the browser: the client only ever talks to this app's own `/api/countries` routes.

The key is required. With none configured the API routes answer `503 api_key_missing` and the
widget shows that message, rather than inventing data or failing silently.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/countries` | All countries as `{ code, alpha2, name, flag }` |
| `GET /api/countries?q=can` | Same list, filtered server-side by name or code prefix |
| `GET /api/countries/:code` | Full detail for one ISO alpha-3 code, e.g. `/api/countries/CAN` |

Success: `{ count, countries }` or `{ country }`.
Failure: `{ error: { code, message } }` with `400` (malformed code), `404` (unknown country),
`502` (upstream unavailable) or `503` (no API key configured).

```bash
curl localhost:3000/api/countries/CAN
curl localhost:3000/api/countries?q=port
```

## How the data flows

```
page.tsx (server)  ──► lib/countries ──► REST Countries v5
       │ initial list rendered into the HTML
       ▼
CountryWidget (client) ──fetch──► /api/countries/:code ──► lib/countries
```

- `src/lib/http.ts` — the only place that does outgoing HTTP: per-attempt timeout, three attempts
  with exponential backoff, retries on 408/429/5xx but never on other 4xx, and typed
  `HttpError` / `NetworkError`.
- `src/lib/countries/restcountries.ts` — v5 client. Pages through `/countries/v5` (100 records per
  page on the free plan), unwraps the `data.objects` envelope, and maps each record onto the app's
  own types. Every upstream field is treated as optional, so a renamed or missing field drops one
  record instead of breaking the page.
- `src/lib/countries/index.ts` — memoises the full list per server process for an hour, and never
  caches a rejection, so a failed load is retried by the next caller rather than pinned for an hour.
- `src/lib/countries/types.ts` — the shapes the UI and routes speak. Nothing downstream of the
  client knows REST Countries' field names.
- The list is fetched once on the server and rendered into the initial HTML, so the dropdown is
  usable on first paint; only the detail lookup happens in the browser. Rapid selections abort the
  in-flight request via `AbortController`.

## Tests

```bash
npm test           # vitest run
npm run test:watch
```

92 tests, no network access — `fetch` is stubbed, so the suite is deterministic and runs in ~3s.

| File | What it pins down |
| --- | --- |
| `lib/http.test.ts` | Retry on 408/429/5xx, never on other 4xx, timeout and transport failures wrapped as `NetworkError`, caller aborts respected, headers merged |
| `lib/countries/restcountries.test.ts` | Mapping a v5 record, skipping unusable records, defaults for absent optional fields, pagination across pages, bearer auth, error envelopes, 404 as `null` |
| `lib/countries/index.test.ts` | Missing key refused before any request, list cached to a single upstream call, failures not cached, outages and rejected keys propagated rather than hidden, malformed codes rejected before any I/O |
| `app/api/countries/*.test.ts` | Route contracts: 200 payload shape, `q` filtering, cache headers, 400 / 404 / 502 / 503 error envelopes |
| `components/CountrySelect.test.tsx` | Open, search, filter by name or code, mouse and keyboard selection, Escape and click-away, disabled state, accessible name |
| `components/CountryWidget.test.tsx` | Detail loading and rendering, API and transport errors surfaced to the user, list recovery when the server render came back empty, and out-of-order responses — a slow first request must not overwrite a newer selection |

Flag images come from `flagcdn.com`, keyed off the ISO alpha-2 code, so the widget renders one
image host regardless of what the API returns.

## Notes

- The v5 client is covered by tests against the documented v5 envelope (pagination, auth header,
  malformed records). If a field name differs from the published docs, the mapping in
  `restcountries.ts` is the one place to adjust.
- The design is fixed-light, matching the reference screenshots supplied with the task.
