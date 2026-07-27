# Compile-time plugin architecture

## Scope

i0c.cc uses a small, statically registered plugin architecture. It keeps the redirect core independent from a particular edge provider, data repository or transport, analytics delivery path, or analytics database without turning this personal project into a dynamic plugin platform.

Plugins are workspace packages selected at build time. Remote `config.json` may configure or disable installed optional plugins, but it cannot discover, download, install, or execute new code.

## Package map

| Layer | Package or directory | Responsibility |
|-------|----------------------|----------------|
| Domain | `@i0c/analytics-domain` | Provider-neutral analytics events, ranges, classifications, and store result types |
| Protocol | `@i0c/plugin-api` | Manifests, host and slot types, plugin contracts, health, migrations, feature hooks, and WebUI slots |
| Contracts | `@i0c/plugin-testkit` | Manifest, adapter, repository, sink, store, migration, feature, and dependency-boundary tests |
| Catalog | `@i0c/plugin-catalog` | Optional official manifest presets and host-specific configuration validation |
| Runtime host | `@i0c/runtime-host` | Platform-neutral deployment assembly and host context enrichment |
| Runtime build | `@i0c/runtime-build` | Build-time installation config validation and selected-platform bundling |
| Git data | `@i0c/plugin-github-data` | GitHub Raw Runtime source and GitHub Contents WebUI repository |
| HTTP source | `@i0c/plugin-http-snapshot-source` | Atomic Runtime config-and-rules snapshot loading over HTTPS |
| Data repository | `@i0c/plugin-data-repository-postgres` | Optimistic, atomic config-and-rules persistence in PostgreSQL |
| Runtime | `@i0c/plugin-runtime-cloudflare`, `@i0c/plugin-runtime-vercel`, `@i0c/plugin-runtime-netlify` | Provider request, environment, cache, country, and background-task adaptation |
| Sink | `@i0c/plugin-analytics-sink-http` | Signed best-effort HTTP analytics delivery |
| Stores | `@i0c/plugin-analytics-store-postgres`, `@i0c/plugin-analytics-store-d1` | Analytics ingest, queries, rebuild, retention, health, and owned migrations |
| Feature | `@i0c/plugin-feature-bot-classifier` | Runtime analytics classification through the bounded feature pipeline |

The applications are hosts: `apps/runtime` assembles Runtime plugins, while `apps/webui` assembles repository and analytics-store plugins. Plugins may depend on the protocol and domain packages, but they may not import application internals.

## Data documents and bootstrap boundary

The editable non-secret data plane contains two documents:

- `config.json` stores versioned instance settings and installed-plugin declarations.
- `redirects.json` stores redirect rules.

The checked-in PostgreSQL Repository stores both documents with optimistic revisions and exposes an atomic read snapshot. GitHub Contents remains available and preserves the existing `data` branch workflow. Repository migration history is independent from analytics migrations.

The checked-in HTTP Snapshot Source reads one validated `{ revision, config, redirects }` response from the WebUI, deduplicates concurrent loads, revalidates with an ETag, and retains the last host-valid snapshot after a failed refresh. GitHub Raw remains available and reads both Git-backed documents independently. Runtime never connects directly to the PostgreSQL Repository.

Some values must exist before either document can be loaded. The selected Repository and Source, GitHub owner, repository, branch and paths, OAuth scope, PostgreSQL binding and connection policy, HTTP snapshot URL and retry policy, and installed plugin packages are therefore **bootstrap configuration**, not remote plugin configuration. Defaults live in `@i0c/config`; executable Runtime installations live in the root `i0c.runtime.config.ts`, WebUI server installations live in the root `i0c.webui.config.ts`, and client-safe WebUI extensions live in `apps/webui/webui.extensions.ts`. Changing an installation requires a rebuild. Plugin manifests intentionally reject bootstrap-only fields under `plugins.*.config`; accepting them there would create settings that validate but cannot initialize their own loader.

## Manifest and configuration model

Every installed plugin has a manifest with a unique ID, package version, independent Plugin API version, supported hosts, kind, slot, capabilities, configuration version and Schema, Secret declarations, and optional health or migration capability.

The remote declaration shape is:

```json
{
  "plugins": {
    "@i0c/analytics-sink-http": {
      "enabled": true,
      "version": 1,
      "config": {
        "maximumDeliveryAttempts": 2,
        "requestTimeoutMs": 5000
      },
      "secrets": {
        "writeKey": "I0C_SECRET"
      }
    }
  }
}
```

- `config` contains JSON-safe public values and is validated by the selected plugin's own Schema.
- Plugin Schemas use the validated subset documented by `@i0c/plugin-api`; unsupported keywords and non-JSON literals fail manifest registration instead of being ignored.
- The HTTP Sink applies `requestTimeoutMs` to each delivery attempt; omitted values use the plugin's 5-second default.
- `secrets` maps plugin-local names to environment-variable or platform-binding names. Secret values never enter the data documents.
- Unknown plugins, incompatible config versions, undeclared Secret names, unsupported hosts, and single-slot conflicts are rejected.
- The Runtime build selects exactly one provider adapter. A declaration for another supported provider may coexist in the shared document without being assembled into that build.
- The selected Runtime Source, selected WebUI Repository, and current Runtime provider are mandatory bootstrap capabilities. Explicitly disabling one invalidates that host's configuration.
- The HTTP Sink, bot classifier, and analytics Store are optional. Disabling them removes delivery, feature registration, or analytics storage respectively.

Missing declarations use compatibility defaults during the first migration. Once explicit declarations are published, `enabled`, plugin config, and Secret mappings drive the selected factories and feature pipeline.

## Compile-time installation

Runtime plugins are not hardcoded in `apps/runtime`. The root `i0c.runtime.config.ts` installs the data source, analytics sinks, features, and platform adapters. A platform package exports `./manifest`, `./runtime`, and `./installation`; its installation entry declares the package module, bundled dependencies, provider identifier, build key, and output path. Source installations also provide an opaque plugin-owned bootstrap object and diagnostic endpoints; `apps/runtime` passes that object to the selected factory without defining source-specific fields. Sink and Feature installations provide their Manifest and factory to the same root configuration.

`apps/runtime/src/entry.ts` imports only a virtual selected-platform module generated by `@i0c/runtime-build`. The build binds the selected root configuration, injects one selected adapter, bundles its declared Runtime plugins, and verifies the external fixture marker in the emitted artifact. Adding a workspace-local third-party Runtime Platform or Feature therefore requires adding its package to the workspace and root installation configuration, not editing `apps/runtime`, analytics event types, or the official catalog. The shared plugin packages remain private source-workspace packages rather than a published npm SDK.

WebUI server plugins follow the same static assembly rule through the root `i0c.webui.config.ts`: it installs one data Repository and the available analytics Stores without a factory mapping inside `apps/webui`. Client extensions use `apps/webui/webui.extensions.ts` because React renderers must remain in the client bundle. The external WebUI fixture passes its non-empty installation list through the real host registry, proving that a workspace package can add a renderer without changing host registry source. The production extension list is intentionally empty until a product-owned extension is needed.

## Runtime features and WebUI extensions

The first Runtime feature API exposes only the physically integrated `onAnalyticsEvent` hook. Registrations have deterministic order, a bounded timeout, and an explicit failure policy. Non-critical analytics, logging, and automation-classification failures are fail-open and cannot replace a valid redirect response. Match and response mutation hooks remain deferred because plugins must not change core routing semantics.

The first feature plugin moves bot and automation classification into `onAnalyticsEvent`. Runtime tests also inject a failing feature to prove that redirect behavior remains available.

WebUI owns four statically registered extension slots:

- `analytics.overview.cards`
- `analytics.detail.sections`
- `settings.plugins`
- `rule-editor.fields`

The production installation keeps these slots empty except for the host-owned plugin status panel. The slots are physical render points for compile-time UI extensions, not an online installation mechanism. Plugin messages are dynamically imported only when the status panel mounts.

`GET /api/plugins/status` reports installed manifests, configuration state, capabilities, observable Secret bindings, selected-store health, and missing prerequisites. It requires WebUI read access, disables response caching, bounds health checks with a timeout, and does not expose raw database errors or Secret values.

## Data repositories and migrations

`AtomicVersionedDataRepository` exposes document reads, optimistic writes, and an atomic two-document snapshot. GitHub maps its commit SHA to the repository revision and resolves both documents at one commit. PostgreSQL uses a repeatable-read transaction, numeric document revisions, and checksums.

PostgreSQL Repository migrations live in `plugins/repository/postgres/migrations` and use their own migration table and advisory lock. Builds, application startup, Runtime requests, and WebUI health checks never apply them automatically. Selecting PostgreSQL requires `DATABASE_URL`. Its explicit seed command validates local `config.json` and `redirects.json`, creates only missing documents in one transaction, and never overwrites existing content. The repository must be paired with the HTTP Snapshot Runtime Source so saved database state reaches edge deployments without giving them database credentials; incompatible bootstrap selections fail the build.

## Analytics stores and migrations

`AnalyticsStore` exposes domain operations rather than SQL. Both PostgreSQL and D1 implement the same shared behavior contract for idempotent ingest, traffic and automation queries, hourly and daily aggregation, entry-domain filtering, raw-event rebuild, 181-day raw retention, aggregate retention, health, and capability reporting.

- PostgreSQL is the current deployed Store and continues to use `DATABASE_URL` by default. Its migrations live in `plugins/store/postgres/migrations`.
- D1 is the second implementation used to prove that the contract is not PostgreSQL-shaped. Its independent migrations live in `plugins/store/d1/migrations`; a D1-enabled host must inject a D1 binding before selecting it. The bundled WebUI does not yet provide that binding integration, so D1 is a protocol-validation implementation rather than a selectable deployment option in the current application.

Each Store owns `status`, `plan`, and `apply` migration semantics. Builds, application startup, health checks, and ordinary requests never apply migrations automatically. PostgreSQL's real shared contract runs in Plugin CI against an isolated PostgreSQL service; local runs skip only that integration test when `TEST_POSTGRES_URL` is absent. D1 runs the same behavior contract through the Node SQLite-backed D1 test adapter.

## Checks and CI

Run checks serially from the repository root:

```bash
pnpm plugins:check
pnpm runtime:check
pnpm runtime:test
pnpm runtime:build:cf
pnpm runtime:build:vc
pnpm runtime:build:nf
pnpm --filter i0c-redirect-worker build:external-fixture
pnpm webui:test
pnpm webui:lint
pnpm webui:build
```

Plugin CI checks types, manifests, contracts, independent plugin packages, PostgreSQL integration behavior, and import or bundle boundaries. Runtime CI tests shared semantics, builds each official provider separately, and builds a test-only external adapter from `plugins/fixtures`. WebUI CI covers its tests, lint, and build. Config CI validates the core and installed manifests. Each workflow is path-filtered to its real owners and its own workflow file.

## Adding an official plugin

1. Add one workspace package with a narrow kind and explicit host entrypoints such as `./manifest`, `./config`, `./runtime`, `./collector`, or `./webui`.
2. Define its manifest, configuration Schema, defaults, Secret declarations, capabilities, and factory inside the plugin package.
3. Implement the narrow Plugin API contract; do not import `apps/runtime` or `apps/webui`.
4. Register an official Manifest in the appropriate catalog preset when it should be part of the compatibility defaults.
5. Add Runtime executable installations to `i0c.runtime.config.ts`, WebUI server installations to `i0c.webui.config.ts`, or client renderers to `apps/webui/webui.extensions.ts`. A Runtime platform also exports `./installation` with its build descriptor.
6. Reuse Plugin Testkit contracts and add implementation-specific tests.
7. Extend dependency-boundary checks and path-filtered CI ownership when the new package introduces a new surface.
8. Merge and deploy code that understands the declaration before publishing the corresponding `config.json` change through the selected Repository.

## Failure and rollout behavior

An invalid remote configuration or snapshot never replaces a valid cached value. Warm instances retain their last valid data; cold instances use the checked-in compatibility default when no valid platform cache is available. WebUI keeps the raw invalid document available to authenticated managers for repair.

Publish in this order:

1. Merge code and Schema changes.
2. Deploy the affected hosts.
3. Publish validated `config.json` and `redirects.json` changes through the selected Repository.
4. Wait for the configured cache TTL and verify WebUI plus the selected Runtime providers.
5. Remove obsolete non-sensitive dashboard variables only after production verification.

## Non-goals

- No runtime npm or URL plugin loading.
- No public plugin marketplace or online install/uninstall UI.
- No untrusted plugin sandbox.
- No Secret values in the data documents.
- No requirement to deploy all Runtime adapters together.
- No universal database or provider abstraction beyond implemented, contract-tested capabilities.
