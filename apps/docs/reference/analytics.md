---
title: Analytics semantics
description: Look up the exact meaning of analytics values, time ranges, attribution, sampling, and retention.
---

# Analytics semantics

The two easiest things to misread are observed versus estimated traffic, followed by the boundary between a rolling day and a calendar day. Use [read analytics](/guide/analytics) for the normal UI; come here when you need the exact field or calculation.

## Values that are easy to confuse

| UI label | Meaning |
| --- | --- |
| Matched requests | Rule-match events actually received and stored from the Runtime |
| Effective visits | Estimated human entry navigations after bots, previews, and controlled continuation hops are excluded |
| Entry requests | Matched requests excluding verified internal continuation hops |
| Observed samples | Sampled events actually received by the database |
| Estimated requests | `observed samples ÷ sample rate`, used for unmatched and system traffic |
| All entry domains | The sum of recognized domains and `unknown` in the current analytics source |

An estimate never replaces its observed value. Automation views lead with the number of rows actually received and show extrapolation as secondary context.

## How data reaches a chart

1. the Runtime finishes a redirect, proxy, or unmatched request;
2. it extracts a limited set of fields and signs the event with `I0C_SECRET`;
3. the WebUI collector verifies the signature, time, and body, then writes through the selected analytics store;
4. an authenticated WebUI query reads aggregates or retained raw events.

The Runtime never connects to PostgreSQL or D1. Delivery is best effort through the provider's background-work mechanism. If the collector or database is unavailable, the redirect still completes, but that event may be lost. There is currently no durable retry queue.

## Time ranges and previous periods

- **1 day** is a rolling 24-hour window shown in hourly points;
- **7, 30, and 90 days** use calendar days in the browser device's IANA timezone;
- chart labels, tooltips, and query boundaries use the same device timezone;
- the previous period is the equally long interval immediately before the current range.

Hourly and daily aggregates remain stored in UTC. Queries whose date boundaries depend on the device timezone use retained raw events within the 181-day window so cards, trends, and dimensions cover the same interval.

When the previous value is zero and the current value is positive, the UI reports no previous-period requests instead of calculating a meaningless percentage. Two zero periods are shown as unchanged.

## Events that are recorded

Analytics V2 has two event types:

- `link`: a successful redirect or proxy rule match with `sampleRate = 1`;
- `runtime`: an unmatched or system result with `sampleRate = 0.1`.

Runtime results include `not_found`, `proxy_exhausted`, `config_unavailable`, and `internal_error`. Successful `favicon.ico`, `robots.txt`, and `sitemap.xml` responses do not emit analytics.

When a proxy races several candidates, only the final successful candidate emits the matched event. Failed candidates are not counted separately. A browser may cache a permanent redirect; later navigation that bypasses the Runtime cannot produce another event.

## Entry domain and provider

`entryDomain` and `provider` look related but record different things:

- `entryDomain`: the Runtime hostname requested by the visitor;
- `provider`: the platform adapter that handled it, such as `cloudflare`, `vercel`, or `netlify`.

`analytics.sourceId` is both the analytics namespace and its allowed base domain. With `i0c.cc`, the apex and subdomains can appear separately; a host outside that namespace becomes `unknown`.

The public instance currently uses:

| Entry domain | Provider |
| --- | --- |
| `i0c.cc`, `www.i0c.cc`, `api.i0c.cc` | Cloudflare |
| `vc.i0c.cc` | Vercel |
| `nf.i0c.cc` | Netlify |

`u.i0c.cc` hosts the WebUI and collector, not a Runtime. Entry-domain filtering applies to totals, trends, popular routes, referrers, providers, and automation views together.

## Referrers, campaigns, and short-link chains

The UI keeps these three sources separate.

### Browser referrer

`referrerDomain` stores only the hostname parsed from the browser's `Referer`. A missing header, `noreferrer`, invalid value, or non-HTTP(S) source becomes `direct`. The Runtime never guesses from the redirect target.

QR codes, pasted links, and many multi-hop redirects therefore appear as `direct`. That reflects the information available from the browser rather than a lost known source.

### Explicit campaign

An authenticated client can create a signed campaign URL with `POST /api/analytics/campaigns`:

```json
{
  "url": "https://i0c.cc/r",
  "analyticsId": "the-rule-analytics-id",
  "campaignId": "docs-launch",
  "expiresInDays": 30
}
```

The `_i0c_via` value binds the analytics source, rule ID, hostname, path, and expiry for at most 365 days. After verification, the Runtime removes it and uses a short-lived secure cookie for the parameter-free request. An invalid token is removed but never recorded as a valid campaign.

### Controlled short-link chain

When short link A redirects to B inside the same analytics namespace, A adds a signed upstream token valid for two minutes. B verifies and removes it before matching, and the store claims each upstream event only once.

For A → B → C:

- all three rules receive their own matched event;
- only A is an entry request;
- B records A as its internal source, and C records B.

This does not depend on browser referrers, and the token is not attached to a non-HTTPS target or one outside the source namespace.

## Bots and unmatched traffic

These classifications describe signals in a request; they do not prove a visitor's identity:

- `declared_bot`: a User-Agent clearly matches a known crawler, preview, or monitor;
- `suspected_automation`: an automated client, scanner, or suspicious path pattern was detected;
- `browser_like`: browser navigation signals are present;
- `unknown`: there is not enough evidence.

WordPress probes, environment files, admin paths, version-control metadata, and traversal attempts are classified locally by the Runtime. The collector receives a category, not the original unmatched path or full User-Agent.

Unmatched and system events are sampled at 10%, so the UI shows both observed samples and estimated requests. `suspected_automation` means “looks automated to this classifier,” not “confirmed bot.”

## Data that is not stored

Analytics events do not contain:

- IP addresses;
- full User-Agent strings;
- full referrer URLs;
- raw query parameters;
- redirect or proxy targets;
- original unmatched paths.

A matched event contains the configured rule path and stable analytics ID. Hostnames, identifiers, enums, body sizes, timestamps, and token lifetimes are validated before insertion. The collector accepts only the configured source ID, and signed requests have a five-minute acceptance window.

## Configuration and secrets

Instance settings hold the collector URL and source ID:

```json
{
  "analytics": {
    "ingestEndpoint": "https://u.i0c.cc/api/analytics/events",
    "sourceId": "i0c.cc"
  }
}
```

The WebUI and every Runtime share one `I0C_SECRET`. PostgreSQL analytics also needs `DATABASE_URL`; D1 uses Account and Database IDs from startup configuration plus the server-only `CLOUDFLARE_D1_API_TOKEN`.

Rotating `I0C_SECRET` invalidates existing WebUI sessions and requires every Runtime to be redeployed. Mixing old and new values breaks snapshot authentication, analytics delivery, and short-link attribution.

## Database structure and retention

PostgreSQL and D1 implement the same analytics-store contract and query semantics. Each keeps an ordered, checksummed schema history; builds, startup, and normal requests never update tables automatically.

Update an existing analytics database with:

```sh
pnpm database:update postgres analytics
pnpm database:update d1 analytics
```

Raw matched events, Runtime events, idempotency receipts, and expired upstream claims are retained for 181 days. Hourly and daily aggregates remain available, so 90-day trends and previous-period comparisons do not require raw requests forever. The WebUI schedules retention after successful ingestion, at most once per running instance per day.

The 181-day window covers two full 90-day periods plus one day for timezone boundaries and cleanup timing. It provides source data for a manual aggregate rebuild but does not trigger one automatically.

## Useful acceptance scenarios

- Visit one rule through three Runtime domains: total 3, each domain 1.
- Click from an external page with a Referer: record the source domain.
- Use a QR code, pasted URL, or `noreferrer`: show `direct`.
- Use a signed campaign URL: record the campaign and remove `_i0c_via` before routing.
- Follow A → B: both rules record a match, while entry requests increase once.
- Let a bot request an unmatched path: it may enter sampled Runtime and automation analytics.
- Make the collector unavailable: the redirect still succeeds, while the event may be lost.
