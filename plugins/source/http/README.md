# HTTP Snapshot Data Source

`@i0c/plugin-http-snapshot-source` loads one validated Runtime snapshot from an HTTPS endpoint. The snapshot contains `config.json` and `redirects.json` at the same repository revision, so a Runtime request never combines documents from different saves.

The built-in WebUI publishes the snapshot at:

```text
https://<webui-domain>/api/runtime/snapshot
```

Select the source at build time in `packages/config/src/defaults.ts`:

```ts
source: {
  provider: "http",
  snapshotUrl: "https://u.example.com/api/runtime/snapshot",
  requestTimeoutMs: 5_000,
  maximumFetchAttempts: 2,
  failureBackoffSeconds: 30,
}
```

These fields are bootstrap configuration because the Runtime needs them before it can load remote instance settings. They are not editable through `plugins.*.config`.

The source deduplicates concurrent loads, revalidates with ETags, applies a bounded timeout and transient retry count, and keeps the last host-validated snapshot when refresh fails. It can use the platform Runtime cache on a cold isolate. Invalid envelopes, invalid data documents, and configurations that disable a required Runtime plugin never replace a valid cached snapshot.

Run the package checks from the repository root:

```bash
pnpm --filter @i0c/plugin-http-snapshot-source check
pnpm --filter @i0c/plugin-http-snapshot-source test
```

The endpoint is public because edge Runtime deployments do not share WebUI login sessions. Do not place secrets in either data document; plugin Secret values remain deployment bindings.
