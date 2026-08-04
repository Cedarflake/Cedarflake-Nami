---
title: Troubleshooting
description: Diagnose common WebUI, Runtime, analytics, OAuth, and storage failures by ownership layer.
---

# Troubleshooting

Start with the failing boundary. A Runtime response, a WebUI API response, a database error, and a provider build error have different owners.

## Configuration loads after a refresh but first returns 500

Check the first server-side stack trace rather than treating the refresh as a fix. Common causes include a transient database connection, a stale development module after a file edit, or a repository initialization race. Confirm the selected repository health and restart only the task-owned development server when its process is known.

## `relation ... does not exist`

The selected PostgreSQL database has not received the owning plugin schema update, or the application points at another database. Run the appropriate repository or analytics schema-update command only after verifying the exact `DATABASE_URL` target.

## D1 reports a missing table

Confirm that the repository and analytics database IDs have not been swapped, then run the schema-update command for that specific slot. They are separate databases and use independent schema migration histories.

## Analytics collector returns 401

The event signature is missing, expired, or was created with a different `I0C_SECRET`. The WebUI and every Runtime must use exactly the same value. Do not expose the value in instance configuration.

## Analytics collector returns 405

The endpoint received an unsupported HTTP method. Runtime delivery uses the collector's expected signed `POST`; opening the endpoint in a browser normally sends `GET` and does not test ingestion.

## One Runtime provider has no analytics

Check that the provider-specific adapter and HTTP analytics sink are enabled, the deployment contains the current build, `I0C_SECRET` matches, and background delivery logs have no network errors. Filter by the actual `entryDomain`; do not assume all provider domains collapse into one label.

## Runtime returns 500 or Bad Gateway

Inspect whether the snapshot could be loaded and validated, whether the active platform adapter is enabled, and whether a proxy upstream failed. A disabled adapter does not undeploy the external service; it makes the existing deployment unable to serve normal routing.

## GitHub OAuth callback fails after switching accounts

Verify the callback URL, clear only the application's own session when testing, and inspect the Auth.js error rather than unrelated browser manifest-icon warnings. Organization OAuth restrictions can also reject repository access after sign-in succeeds.

## Provider build succeeds but deployment fails

Build success only proves local output generation. Inspect the provider's unsupported-module, edge-runtime, output-directory, and root-directory diagnostics. Use the provider-specific build command before changing deployment settings.

## What to include in a bug report

- exact route and deployment provider;
- current commit and build command;
- selected repository and analytics provider, without credentials;
- HTTP status and the relevant server-side stack trace;
- whether the same behavior reproduces after a clean request, not only after navigation cache reuse.
