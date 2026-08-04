# Analytics architecture and semantics

This document defines the Analytics V2 contract shared by the edge Runtime, the WebUI collector, and the selected analytics store. PostgreSQL and Cloudflare D1 implement the same store contract; Neon works through its standard PostgreSQL connection string and needs no vendor-specific API.

## System boundary

The Runtime and WebUI remain independent deployments:

1. A Runtime instance handles a redirect, proxy, or unmatched request.
2. It builds a privacy-bounded event, signs the exact JSON body, and posts it to `https://u.i0c.cc/api/analytics/events`.
3. The WebUI collector verifies the signature and timestamp, validates the event contract, and writes through the selected analytics store.
4. Authenticated WebUI pages query aggregate tables for presentation.

The Runtime never connects to PostgreSQL or D1. Collector delivery is best effort and uses each provider's background execution mechanism. A collector or database failure is logged but never changes the redirect response. There is currently no delivery retry queue, so an event can be lost when the collector or network is unavailable.

## Configuration

The collector endpoint and source namespace are versioned in `data/config.json`:

```json
{
  "analytics": {
    "ingestEndpoint": "https://u.i0c.cc/api/analytics/events",
    "sourceId": "i0c.cc"
  }
}
```

Configure every Runtime deployment with the shared signing secret:

```dotenv
I0C_SECRET="replace-with-a-32-byte-random-secret"
```

Configure the WebUI deployment with the matching secret. The default PostgreSQL store also requires `DATABASE_URL`; D1 uses its server-only API token and bootstrap identifiers instead.

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
I0C_SECRET="the-same-value-as-every-Runtime"
```

The Runtime and WebUI do not read the former non-sensitive analytics environment variables. Values left in provider dashboards are ignored; edit the validated remote `config.json` to change them without rebuilding the applications.

`I0C_SECRET` is the single instance secret shared by the WebUI and every Runtime provider. It signs WebUI sessions, setup authorization, analytics delivery, and attribution data. Rotating it invalidates existing WebUI sessions and requires redeploying every Runtime.

`analytics.sourceId` is both the logical statistics namespace and its base hostname. It is normalized to lowercase. With `i0c.cc`, events may report `i0c.cc` or any subdomain of `i0c.cc`; other hostnames are stored as `unknown`. This bounds entry-domain cardinality without requiring a separate domain-list setting.

## Entry domain and provider

The two fields answer different questions:

- `entryDomain`: the hostname the visitor actually requested, taken from `request.url.hostname`.
- `provider`: the adapter that handled the request: `cloudflare`, `vercel`, `netlify`, or `unknown`.

The current Runtime namespace is expected to contain:

| Entry domain | Provider |
|---|---|
| `i0c.cc` | Cloudflare |
| `www.i0c.cc` | Cloudflare |
| `api.i0c.cc` | Cloudflare |
| `vc.i0c.cc` | Vercel |
| `nf.i0c.cc` | Netlify |

`u.i0c.cc` hosts the WebUI collector and is not a Runtime entry domain. Preview deployments or unrelated custom domains outside the `i0c.cc` namespace are grouped under `unknown`. Supporting unrelated custom domains in the same source would require a future explicit allowlist rather than trusting arbitrary Host values.

The WebUI domain filter applies the same entry-domain scope to totals, trends, links, geography, devices, providers, referrers, campaigns, internal sources, and automation analysis. “All domains” is therefore the sum of the individual domain scopes, including `unknown`.

## Event types and counting

Analytics V2 has two event kinds:

- `link`: a final matched redirect or proxy result. Link events use `sampleRate = 1`.
- `runtime`: an unmatched or system result. Runtime events use a fixed `sampleRate = 0.1` and store both observed and weighted estimates.

Only the final winning proxy candidate produces a matched link event. Failed proxy candidates do not produce separate link events. Runtime outcomes are:

- `not_found`
- `proxy_exhausted`
- `config_unavailable`
- `internal_error`

Successful `favicon.ico`, `robots.txt`, and `sitemap.xml` system responses are not analytics events. Requests to arbitrary paths that do not match a rule are eligible for sampled Runtime events.

The metrics use these counting rules:

- Every accepted link event increments that link's request count.
- Browser-like document navigation is shown separately from declared bots, link previews, and suspected automation.
- A controlled short-link chain records each matched link request, but only the first request counts as an entry request.
- Runtime estimates are calculated as `observed / sampleRate`; observed counts remain visible so sampling is not hidden.
- Permanent redirects may be cached by the browser, so later visits can bypass the Runtime and cannot be counted.

## Attribution

Attribution dimensions are deliberately separate.

### Browser referrer

`referrerDomain` stores only the normalized hostname from the browser's `Referer` header. A missing, suppressed, invalid, or non-HTTP referrer is displayed as `direct`. The Runtime does not infer a source from a redirect destination or from an intermediate service.

An external website or redirect service that links to a short URL is therefore attributed only when the browser supplies a referrer. QR codes, copied URLs, privacy policies such as `noreferrer`, and many redirect chains usually appear as `direct`.

### Explicit campaign

An authenticated client can create a signed campaign URL through:

```http
POST /api/analytics/campaigns
Content-Type: application/json

{
  "url": "https://i0c.cc/r",
  "analyticsId": "the-rule-analytics-id",
  "campaignId": "docs-launch",
  "expiresInDays": 30
}
```

The response contains a URL with a signed `_i0c_via` parameter. Campaign tokens are bound to the source, analytics ID, exact hostname, normalized path, issue time, and expiry, with a maximum lifetime of 365 days. The Runtime validates the token, removes the reserved parameter before rule processing, and uses a short-lived secure cookie for the sanitized follow-up request. Invalid tokens are removed and never become attribution data.

### Controlled short-link chain

When short link A redirects over HTTPS to another hostname or path inside the same source namespace, A appends a signed upstream token with a two-minute lifetime. B verifies and removes it before routing. The selected analytics store claims each upstream event once, so replaying the same token cannot repeatedly suppress entry counts.

For A → B → C:

- A, B, and C each receive their own request event.
- A is the entry request.
- B records A as its internal source.
- C records B as its internal source.

This does not rely on the browser referrer. Destinations outside the source namespace and non-HTTPS destinations never receive an upstream token.

## Bot and unmatched-traffic analysis

Classification is heuristic and versioned; “suspected automation” is not a confirmed bot identity.

- `declared_bot`: known search, AI crawler, social preview, or monitoring user-agent signatures.
- `suspected_automation`: automation clients, generic bot/scanner signatures, or bounded suspicious-path categories.
- `browser_like`: a request that presents browser navigation signals.
- `unknown`: insufficient signals.

Probe categories include WordPress paths, environment files, admin paths, version-control metadata, path traversal, scanners, and a bounded `other` group. Classification happens locally at the Runtime. Raw unmatched paths and raw User-Agent strings are not sent to the collector.

The automation page separates observed values from sampling-adjusted estimates and can be filtered by entry domain. It includes traffic class, bot category, confidence, classifier version, resource class, match kind, outcome, probe category, provider, and affected short links.

## Privacy and cardinality limits

Events do not contain:

- IP addresses
- full User-Agent strings
- full referrer URLs
- request query strings
- redirect or proxy destination URLs
- raw unmatched request paths

Matched events contain the configured rule path and stable analytics ID. Hostnames, identifiers, enums, request bodies, timestamps, and token lifetimes are validated and length-bounded before storage. The collector accepts only the configured source ID, and its signed request window is five minutes.

## Analytics schema updates

Update the selected analytics store schema from the repository root before deploying the collector:

```bash
# PostgreSQL
pnpm database:update postgres analytics

# Cloudflare D1
pnpm database:update d1 analytics
```

Each provider owns an ordered, checksummed schema migration history. Never edit a schema migration after it has been applied; add a new numbered file instead.

The PostgreSQL history is split by capability:

- `001_short_link_analytics.sql`: original link events and aggregates.
- `002_domain_attribution.sql`: entry-domain, campaign, internal-source, classification, and UTC aggregate dimensions.
- `003_runtime_traffic_analysis.sql`: sampled Runtime events, cross-kind idempotency receipts, and automation aggregates.
- `004_raw_event_retention.sql`: cleanup indexes and the fixed 181-day raw-event retention function.
- `005_aggregate_rebuild.sql`: aggregate reconstruction from retained raw events.
- `006_open_runtime_providers.sql`: accepted Runtime provider identifiers.

The D1 store owns an independent SQLite-compatible `001_analytics_store.sql` schema migration with the equivalent store contract.

Recommended rollout order:

1. Apply every required schema update.
2. Deploy the WebUI collector that accepts V1 and V2 events.
3. Configure and deploy the Runtime provider or providers you selected.
4. Check collector errors, `unknown` entry domains, observed/estimated ratios, and all-domain sums.

After a successful analytics ingestion, the WebUI schedules retention in the background at most
once per running instance per day. It deletes link events, Runtime events, idempotency receipts,
and expired upstream claims whose database receive time is more than 181 days old. Hourly and
daily aggregate tables are retained, so historical trends and prior-period comparisons do not
depend on keeping raw request rows indefinitely. Retention and schema migrations are never run as
part of the WebUI build.

The WebUI exposes 1, 7, 30, and 90-day ranges. The 1-day trend is a rolling 24-hour window with
UTC-aligned hourly storage buckets that are formatted in the device time zone. Longer ranges use
calendar-day boundaries and trend buckets aligned to the device's IANA time zone. UTC hourly and
daily tables remain the storage format; non-UTC boundary-sensitive breakdowns use retained raw
events so cards, trends, and dimensions cover the same interval. The 181-day raw-event policy
preserves two complete 90-day periods plus one day for boundary handling and the cleanup interval.
This retention window makes future aggregate rebuilding possible; it does not by itself
perform a rebuild.

## Acceptance scenarios

- One short link visited once through each of three Runtime domains: total `3`, each domain `1`.
- External page click with a referrer: referrer hostname recorded.
- QR code, copy/paste, or `noreferrer`: displayed as `direct`.
- Signed campaign URL: campaign recorded and `_i0c_via` absent from the routed request.
- A → B controlled chain: A and B both record a request, but entry requests increase once.
- Bot access to an arbitrary unmatched path: eligible for sampled Runtime and automation analysis.
- Old V1 event: accepted and grouped under entry domain `unknown`.
- Collector unavailable: redirect behavior remains successful while the event may be lost.
