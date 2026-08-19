---
title: Create the first rule
description: Save one exact redirect in the WebUI and verify it through the public Runtime domain.
---

# Create the first rule

The following steps create one redirect through the new Runtime:

```text
https://go.example.com/docs  →  https://docs.example.com
```

Replace both example domains with your Runtime domain and a destination you can open normally.

## Before continuing

Make sure these are already in place:

- the WebUI opens and you can reach the rules page;
- the current GitHub account can edit;
- one Runtime is deployed and has a public domain;
- the WebUI and Runtime use the same `NAMI_SECRET`.

If the public domain currently shows the Nami 404 page, that is a good starting point. The request already reaches the Runtime; it simply has no rule yet.

## 1. Open a rule group

Open **Rules** in the WebUI and select `Main` in the left sidebar. Groups only organize the editor. Their names never become part of the public URL.

Click **Add rule** in the main panel.

<!-- Real screenshot needed: rules page with Main selected and the Add rule button visible. -->

## 2. Enter the redirect

Fill the dialog with:

```text
Path: /docs
Description: Project documentation
Match type: exact
Destination: https://docs.example.com
Status: 302
```

`exact` matches `/docs` and nothing below it, so `/docs/setup` will not follow this rule. Use `302` while testing so the browser does not retain the result as aggressively as a permanent redirect.

The WebUI generates the analytics ID for you. Leave it alone. Keeping this ID when you later change the path or destination preserves the same analytics identity.

<!-- Real screenshot needed: Add rule dialog filled with the values above. -->

## 3. Save it

Click **Save rule** and wait for the success notification in the lower-right corner. The default database-backed storage immediately creates a new revision, and a rule card appears in `Main`.

The card should show the destination, `/docs`, and the `exact` type. If it does not appear after the dialog closes, read the notification before clicking Save several more times.

<!-- Real screenshot needed: saved rule card and success notification. -->

## 4. Wait for the Runtime snapshot

The Runtime does not query the database on every request. The default rule-cache lifetime is 60 seconds, so an old response immediately after saving is not necessarily a fault.

After one cache interval, open:

```text
https://go.example.com/docs
```

The browser should end up at `https://docs.example.com`.

## 5. Inspect the original response

Browsers follow redirects automatically. To see the Runtime's own response, run:

```sh
curl -I https://go.example.com/docs
```

It should contain a `3xx` status and the destination:

```text
HTTP/2 302
location: https://docs.example.com/
```

Do not add `-L` here. That would follow the redirect and show the destination site's response instead.

## What to check when it does not work

- Runtime 404 remains: check that the path starts with `/` and allow time for the snapshot refresh;
- the old result never changes: confirm that `snapshotUrl` points to your WebUI and that both secret values match;
- curl works but the browser behaves differently: a previous permanent redirect may be cached, so try a private window;
- the provider returns 500 or Bad Gateway: inspect Runtime logs for snapshot-loading or required-plugin errors.

Once this rule works, continue with [manage rules](/guide/rules) for prefix redirects and transparent proxies. The settings reference begins at [instance settings](/guide/configuration).
