---
title: Read analytics
description: Understand the traffic overview, entry-domain filter, automation view, and the difference between observed requests and estimates.
---

# Read analytics

The analytics page is not a general website tracker. It answers redirect-specific questions: which rules were requested, which Runtime domain received the traffic, how much looked like human navigation, and how much looked automated.

Once analytics storage and Runtime event delivery are enabled, open **Analytics** in the sidebar.

## Start with two numbers

**Matched requests** is the observed number of tracked-rule matches written by the Runtime. It includes browsers, link previews, and bots.

**Effective visits** is an estimate of human entry visits. It excludes declared bots, suspected automation, link previews, and verified short-link continuation hops, so it is usually lower than the matched-request count.

Neither number is more “correct.” The first tells you how many rule matches the Runtime processed; the second tries to answer how many looked like a person deliberately opening the link.

<!-- Real screenshot needed: traffic overview with effective visits, matched requests, and the trend chart. -->

## Time ranges follow the device time zone

- **1 day** is a rolling 24-hour window ending now, with hourly points;
- **7, 30, and 90 days** use calendar days in the device's IANA time zone;
- chart tooltips and axis labels use that same device time zone.

On the first visit after a time-zone change, the page records the new zone and queries again. Refresh once before treating an old boundary as a data error.

## Entry domains are not rule groups

The entry-domain list shows the host that actually received the Runtime request, such as `i0c.cc`, `vc.i0c.cc`, or `nf.i0c.cc`.

Selecting one domain applies the same scope to cards, trends, popular routes, and breakdowns. **All entry domains** is their combined total. **Unrecognized domain** holds events outside the configured base domain and its subdomains.

## Reading route comparisons

Popular routes are ordered by effective visits in the selected range and compared with the preceding range of equal length. A 7-day view compares with the seven days immediately before it.

When the previous period had no effective visits, the UI avoids dividing by zero and shows “No requests in the previous period.” If both periods are zero, it shows no change.

Open a route to see its own trend and aggregated dimensions. As long as you retain the same analytics ID while editing, a path or destination change does not split future data into a different tracked link.

## The automation view leads with observations

The **Automation** view brings declared bots, suspected automation, unmatched routes, and processing errors together.

Large values are the samples actually stored in the database. Unmatched and system events are sampled, so the smaller estimated value underneath is the extrapolated reference. “Suspected automation” is a classifier result, not confirmation that a client is a bot.

<!-- Real screenshot needed: automation view showing the visual hierarchy between observed samples and estimated reference. -->

## Why a refresh can change the numbers

Analytics queries use a short 15-second cache so range and domain switches feel faster. Use the refresh button when you need to check a newly arrived event immediately. Refreshing queries again; it does not resend or mutate an event.

Browsers may also cache permanent redirects. If a later visit never reaches the Runtime, the count cannot increase. That behavior is separate from the analytics query cache.

## Privacy and retention

Events omit IP addresses, full User-Agent strings, full referrer URLs, destination URLs, raw query parameters, and raw unmatched paths. Raw events and idempotency records are retained for 181 days; hourly and daily aggregates remain available afterward.

Use the [analytics semantics reference](/reference/analytics) when you need the exact event fields, attribution rules, sampling behavior, time buckets, or database retention contract.
