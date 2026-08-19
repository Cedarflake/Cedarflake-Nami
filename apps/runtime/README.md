# nami Runtime

Provider-selectable redirect runtime for fetch-compatible edge platforms: Cloudflare Workers, Vercel Edge Functions, and Netlify Edge Functions. It enforces HTTPS, serves a favicon, and loads non-sensitive instance settings plus redirect rules through the selected Data Source. Choose the adapter that fits the deployment; the three providers do not need to run together.

Live previews:

- Cloudflare domains: https://i0c.cc, https://www.i0c.cc, https://api.i0c.cc
- Vercel deployment: https://vc.i0c.cc
- Netlify deployment: https://nf.i0c.cc

## Deploy

Deploy this package with `apps/runtime` as the project root.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Cedarflake/Cedarflake-Nami&root-directory=apps/runtime)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Cedarflake/Cedarflake-Nami)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Cedarflake/Cedarflake-Nami)

If the platform detects multiple projects, choose `apps/runtime`.

Use these settings when the platform asks for project or build configuration:

| Platform | Project root | Build command | Output |
|----------|--------------|---------------|--------|
| Cloudflare Workers | `apps/runtime` | `pnpm build:cf` | `dist/platforms/cloudflare.js` |
| Vercel | `apps/runtime` | `pnpm build:vc` | `.vercel/output` |
| Netlify | `apps/runtime` | `pnpm build:nf` | `dist` |

Build from a full monorepo checkout. On Vercel, keep **Include source files outside of the Root Directory in the Build Step** enabled so the build can include the shared workspace packages.

The package-level `pnpm build` command generates and retains all three provider outputs in one pass. The provider-specific commands remain available for targeted builds and deployments.

After deploying:

- Save `config.json` or `redirects.json` through the selected WebUI Repository when non-sensitive settings or rules change. The default Git setup uses the `data` branch. Built-in Sources pick up valid updates after their configured cache TTL without a rebuild.
- Set the same `NAMI_SECRET` on every Runtime provider and the WebUI.
- Re-run the package build after updating shared redirect logic, then redeploy.

## Choose an adapter

- Runtime host: [src/entry.ts](src/entry.ts)
- Installed Runtime plugins and platforms: [../../nami.runtime.config.ts](../../nami.runtime.config.ts)
- Build assembly: [../../packages/runtime-build](../../packages/runtime-build)

Need a custom platform or Runtime feature? Add a workspace package with its Manifest and typed factory or `./installation` entry, then add it to `nami.runtime.config.ts`. The Runtime host source and official catalog do not need plugin-specific changes. The external fixture builds a custom platform and Feature and verifies the Feature marker in the emitted artifact. The current contract proves source-workspace integration; the shared plugin packages are not yet published as a public npm SDK. Programmatic consumers can still import `handleRedirectRequest` from [src/lib/handler.ts](src/lib/handler.ts). Stable plugin manifests and adapter contracts live in [../../packages/plugin-api](../../packages/plugin-api).

Each build injects only the selected Runtime adapter and uses the same root installation configuration to assemble its Data Source, Analytics Sink, and Features. Remote declarations control optional enablement, configuration, and Secret binding names. Installed packages and the selected Source's initial connection settings remain bootstrap configuration because they are required before `config.json` can be read. See [../docs/plugins/architecture.md](../docs/plugins/architecture.md) for the package and failure boundaries.

## Environment variables and configuration

Non-sensitive instance settings are versioned in the selected Repository's `config.json`. [../../packages/config](../../packages/config) owns its schema, validation, build-time Source selection, and safe fallback. The Runtime does not read legacy environment variables as overrides or fallbacks; values left in provider dashboards are ignored.

### Remote Runtime configuration

`config.json` owns:

- `runtime.canonicalOrigin`: Canonical public Runtime origin used by shared consumers such as the WebUI QR code.
- `runtime.robotsPolicy`: Set to `allow` to publish an open `robots.txt` and sitemap; set to `disallow` to block crawling and omit the sitemap.
- `runtime.configCacheTtlSeconds`: Cache lifetime for `config.json`.
- `runtime.redirectsCacheTtlSeconds`: Cache lifetime for `redirects.json`.
- `analytics.ingestEndpoint`: HTTPS WebUI collector endpoint.
- `analytics.sourceId`: Lowercase base hostname and stable statistics namespace shared by all providers.
- `plugins`: Namespaced, non-sensitive plugin settings and references to environment-variable secret bindings.

### Choose a Data Source

GitHub Raw remains available and keeps the independent `config.json` and `redirects.json` cache behavior. Select it with `data.source.provider: "github"` in [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts).

The checked-in HTTP Snapshot Source reads both documents atomically from the WebUI:

```ts
source: {
  provider: "http",
  snapshotUrl: "https://u.example.com/api/runtime/snapshot",
  requestTimeoutMs: 5_000,
  maximumFetchAttempts: 2,
  failureBackoffSeconds: 30,
}
```

It deduplicates concurrent loads, uses ETags, bounds timeouts and transient retries, and retains the last host-valid in-memory or platform-cached snapshot when a refresh fails. Invalid snapshot envelopes, data documents, or required-plugin declarations never replace the active version. Use this Source with the PostgreSQL Repository so Runtime deployments receive database-backed saves without database credentials. Source selection is build-time bootstrap configuration and requires rebuilding the Runtime.

When GitHub Raw is selected, programmatic consumers can override its URLs or inject a complete data source through `HandlerOptions`.

### Configure the analytics secret

Analytics delivery is disabled unless the versioned endpoint and source ID are valid and this secret is set:

- `NAMI_SECRET`: Shared instance secret used to sign analytics delivery. Use the same value on the WebUI and every Runtime provider.

Copy [.env.example](.env.example) for the local placeholder. No other built-in Runtime setting is read from the environment.

Matched redirect and proxy events are sent at full rate. Unmatched and system outcomes are sampled at 10% so arbitrary bot and probe traffic can be analyzed without sending every 404. Cloudflare, Vercel, and Netlify use their platform background-execution mechanism; collector failures are logged and never change the redirect response. Delivery is best effort and currently has no retry queue. Each request is signed with HMAC-SHA256 in `X-Analytics-Signature`; the signed timestamp is sent in `X-Analytics-Timestamp`.

The event records the actual entry hostname and adapter provider separately. Entry hostnames must be the configured source hostname or one of its subdomains; other hosts become `unknown`. Browser referrer hostnames, signed campaign IDs, and verified internal short-link sources remain separate attribution dimensions. Controlled short-link hops use a short-lived signed `_nami_via` token that is removed before rule processing.

Classification locally derives bounded traffic, bot, confidence, resource, device, match, outcome, and probe categories. This makes robots that request paths outside `redirects.json` visible in sampled Runtime analysis. Events never send IP addresses, full User-Agent strings, full referrer URLs, query strings, destination URLs, or raw unmatched paths. Matched events contain only the configured rule path and stable analytics ID. Existing rules without an `analyticsId` receive a deterministic legacy identifier at runtime. Explicit object rules saved through the WebUI persist a UUID for future aggregation; string shortcuts continue using their legacy identifier until converted to object form.

See [../docs/reference/analytics.md](../docs/reference/analytics.md) for counting semantics, attribution tokens, sampling, privacy limits, schema-update order, and acceptance scenarios.

Custom adapters that enable analytics should also pass `provider`, optional `country`, and the platform's `waitUntil` through `HandlerOptions`.

Run the plugin contracts, Runtime tests, and independent provider builds from the repository root:

```bash
pnpm plugins:check
pnpm runtime:check
pnpm runtime:test
pnpm runtime:build:cf
pnpm runtime:build:vc
pnpm runtime:build:nf
```

### `redirects.json` quick reference

You can also deploy the [WebUI panel](../webui) to edit `redirects.json` online.

Provide a `Slots` object in `redirects.json` to define routing rules. The table below lists the available fields for each route:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `analyticsId` | UUID string | generated or derived | Stable analytics identity. Keep it unchanged when editing the path or destination. |
| `description` | string | omitted | Optional management note of up to 500 characters. Runtime ignores it when matching and responding. |
| `type` | string | `prefix` | Route mode: `prefix` for prefix redirects, `exact` for exact matches, `proxy` for reverse proxying. |
| `target` | string | `""` | Destination URL. Use exactly one of `target`, `to`, or `url`. |
| `to` / `url` | string | `""` | Alias fields. Use exactly one of `target`, `to`, or `url`. |
| `appendPath` | boolean | `true` | Whether to append the remaining path when using `prefix` or `proxy` mode. Not applicable to `exact`. |
| `proxyOptions` | object | omitted | Optional request headers, response headers, redirect, cookie, timeout, and request-body overrides for `proxy` rules. |
| `status` | number | `302` | HTTP status code from 200 through 599 for non-proxy responses. Do not set for `proxy`. |
| `priority` | number | by order | Determines rule precedence for the same path. Smaller numbers are matched first. |

- Keys must start with `/` and can use colon parameters such as `:id` or the `*` wildcard. Captures can be referenced in the target with `$1`, `:id`, and so on.
- When multiple path patterns match, literal segments take precedence over colon parameters, parameters take precedence over `*`, and deeper patterns win when shared segments have equal specificity.
- The `proxy` type forwards the request to the destination and returns the upstream response. Other types respond with a `Location` redirect.
- Proxy requests preserve application headers such as `Cookie`, `Authorization`, `Origin`, and `Referer`. The Runtime removes hop-by-hop headers, replaces `X-Forwarded-Host` and `X-Forwarded-Proto`, and drops credentials when an upstream redirect changes origin.
- Upstream response headers, including security headers and separate `Set-Cookie` fields, are preserved. Cookie `Domain` attributes are removed so cookies bind to the public proxy hostname.
- `proxyOptions.requestHeaders` and `proxyOptions.responseHeaders` use string values to set headers and `null` to remove them. Runtime-managed protocol headers cannot be overridden. Configured request headers are not reapplied after a redirect changes origin.
- Proxy redirects are followed up to five times by default. `proxyOptions.redirects` can change the limit or pass the upstream redirect through. Optional timeout and request-body limits use seconds and megabytes; provider limits still apply.
- To configure multiple rules for the same path, provide an array. Array order controls the default priority, or you can specify `priority` explicitly.

Add the schema reference below to unlock autocomplete and validation in supporting editors. The schema lives on `main`, so it still applies if the JSON sits in a data branch:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json",
  "Slots": {
    // ...
  }
}
```

#### Sample `redirects.json`

```jsonc
{
  "Slots": {
    "/": "https://example.com",
    "/docs/:page": [
      {
        "type": "exact",
        "target": "https://kb.example.com/:page",
        "status": 302,
        "priority": 1
      },
      {
        "type": "prefix",
        "target": "https://docs.example.com/:page",
        "appendPath": false,
        "status": 301,
        "priority": 5
      }
    ],
    "/promo": {
      "target": "https://example.com/campaign",
      "status": 308
    },
    "/api": [
      {
        "type": "exact",
        "target": "https://status.example.com/healthz",
        "status": 200,
        "priority": 1
      },
      {
        "type": "proxy",
        "target": "https://api.example.com",
        "appendPath": true,
        "priority": 10
      },
      {
        "type": "proxy",
        "target": "https://backup-api.example.com",
        "appendPath": true,
        "priority": 20
      }
    ],
    "/media/*": {
      "type": "proxy",
      "target": "https://cdn.example.com/$1",
      "proxyOptions": {
        "requestHeaders": {
          "Referer": "https://www.example.com/"
        },
        "redirects": {
          "maxHops": 3
        },
        "timeoutSeconds": 10,
        "maxRequestBodyMegabytes": 5
      }
    },
    "/admin": {
      "type": "prefix",
      "target": "https://console.example.com",
      "appendPath": true,
      "status": 307
    }
  }
}
```

---

English · [简体中文](README.zh-CN.md)
