---
title: Fix common problems
description: Identify whether a failure comes from the browser, Runtime, WebUI, database, or deployment provider before changing anything.
---

# Fix common problems

The WebUI, Runtime, and database are deployed separately. When something fails, first identify which one produced the page or response in front of you. That usually avoids several pointless restarts.

## Identify the failing layer first

| What you see | Check here first |
| --- | --- |
| The i0c.cc 404 page | The request reached the Runtime, but no rule matched |
| A Cloudflare, Vercel, or Netlify 404 page | Domain binding, project root, or provider routing |
| A Runtime 500 or Bad Gateway | Runtime logs, snapshot loading, the adapter, and any proxy upstream |
| A WebUI page or `/api/config` returns 500 | WebUI server logs and the database connection |
| `/api/analytics/events` returns 401 or 405 | The instance secret, signature, or request method |
| The browser and `curl` disagree | Browser caching, especially a previous 301 or 308 |

Reproduce once in a private window or with a fresh `curl` request. Record the exact URL, time, and status, then inspect the service that handled that request.

## A saved rule still returns the Runtime 404

The Runtime probably has not loaded the new snapshot yet:

1. make sure the path begins with `/` and uses the expected match type;
2. wait for the rule cache interval shown in settings, which is 60 seconds by default;
3. confirm that `bootstrapConfig.data.source.snapshotUrl` points to your WebUI;
4. confirm that the WebUI and Runtime use the same `I0C_SECRET`;
5. inspect the Runtime log for its latest snapshot refresh.

Permanent redirects may also be cached by the browser. If `curl -I` is correct but the browser is not, test in a private window.

## The Runtime returns 500 or Bad Gateway

Start with the first concrete error in the Runtime log. Common causes are:

- the snapshot could not be fetched, authenticated, or validated;
- the platform adapter was disabled in instance settings while the external deployment still receives traffic;
- a reverse-proxy upstream rejected the request, timed out, or exhausted every candidate;
- the build output is missing a module required by the selected platform.

Disabling an adapter does not delete its Cloudflare, Vercel, or Netlify project. Retire that external deployment separately when it is no longer used.

## The first WebUI load returns 500, then refresh works

A refresh hides the symptom; it does not make the first failure expected. Inspect the server stack for the first request. Typical causes include a brief database connection failure, stale development modules after a file change, or a race while initializing an empty database.

If it happens once after every source edit, check the development server state first. If production also reproduces it, investigate the database connection and initialization path.

## `relation ... does not exist`

The connected PostgreSQL database does not have the required table, or the application is connected to a different database. Confirm the actual `DATABASE_URL` target before running the matching command from [initialize or update the database](/operations/database).

For D1, also confirm that the rules and analytics Database IDs were not swapped. They are initialized and updated independently.

## The analytics endpoint returns 401

The WebUI could not verify the Runtime event signature. Every deployment must use the exact same `I0C_SECRET`. Also check that a binding name was not entered where the secret value belongs. Rotate the WebUI and every Runtime together.

## The analytics endpoint returns 405

The endpoint received an unsupported method. A Runtime sends a signed `POST`; opening the endpoint in a browser sends `GET`. A browser-visible 405 therefore does not prove event ingestion is broken.

## Only one Runtime is missing analytics

Check these in order:

1. the platform adapter and HTTP analytics delivery plugin are enabled;
2. the external provider is running a build that contains the current settings;
3. `I0C_SECRET` matches the WebUI;
4. background delivery logs show no network or signature error;
5. the analytics page is not filtered to another entry domain.

Platforms can share one analytics source ID while still recording separate entry domains and provider names.

## GitHub sign-in fails after switching accounts

Read the concrete Auth.js error in the WebUI server log. Verify the OAuth callback URL, and clear only the session for this i0c.cc instance. Browser warnings about GitHub's manifest icon are usually unrelated to the callback.

If the WebUI must access a repository protected by organization OAuth restrictions, approve the OAuth App in that organization. The default database-backed control plane only reads user identity and does not need repository content access.

## Vercel runs `npm install`

The application project did not reliably discover the root `pnpm-lock.yaml` and `packageManager`. Keep the project root at `apps/webui` or `apps/docs`; the checked-in `vercel.json` installs from the workspace root with the pinned pnpm version.

Do not add another lockfile inside the app or switch the workspace to npm. Retry a genuinely intermittent install failure. If it reproduces, verify the Vercel project root and that the deployed commit contains the current `vercel.json`.

## Build succeeds but deployment still fails

A successful build only proves that output files were generated. Continue with the provider's Unsupported Module, Edge Runtime, Output Directory, Root Directory, or routing message. Runtime providers need their platform-specific build, while the docs and WebUI deploy from their own project roots.

## Include this information when recording a problem

- the exact URL and deployment provider;
- the current commit and build command;
- whether PostgreSQL, D1, or GitHub stores the affected data, without credentials;
- the HTTP status and the server error from the service that handled it;
- whether a private window or a fresh `curl` request reproduces it.

That is normally enough to place the problem in browser cache, the Runtime, the WebUI, the database, or the deployment provider.
