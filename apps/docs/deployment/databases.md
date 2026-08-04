---
title: Choose a database
description: Compare the PostgreSQL and Cloudflare D1 repository and analytics adapters.
---

# Choose a database

The WebUI has two storage slots:

- a data repository for instance configuration, rules, revisions, backups, and rollback;
- an analytics store for events, rollups, retention, and queries.

The Runtime does not connect to either store.

## PostgreSQL

PostgreSQL is the checked-in default. One `DATABASE_URL` can back both plugin slots, while each plugin maintains its own versioned schema and schema-update command.

Choose PostgreSQL when:

- you already operate Neon or another managed PostgreSQL service;
- the WebUI is deployed close to that database;
- SQL inspection and conventional backup tooling are useful to you.

The adapters use shared PostgreSQL primitives for connection and schema-migration behavior, while repository and analytics schemas remain separate concerns.

## Cloudflare D1

D1 uses the WebUI's server-only adapter and Cloudflare API credentials. Configure two database IDs:

- `dataRepository`: instance configuration, rules, and revisions;
- `analytics`: events and aggregate statistics.

Choose D1 when:

- you prefer Cloudflare-managed SQLite storage;
- two small, isolated databases fit the workload;
- API-based administration is acceptable for the WebUI deployment.

The D1 adapters share atomic write and schema-migration primitives, but the two databases retain independent schemas and version histories.

## Other databases

PostgreSQL and D1 are the built-in implementations, not a closed database list. A new database normally provides a `data-repository` plugin for configuration and rules, an `analytics-store` plugin for statistics, and optionally one shared provider package for connection and schema-update primitives. See [Write an adapter](/plugins/adapters#add-a-data-repository).

## Provider choice does not migrate data

Changing the bootstrap provider only changes where future reads and writes go. It does not copy PostgreSQL rows into D1 or copy D1 records into PostgreSQL.

Before switching a populated instance:

1. stop or restrict writes;
2. export and transform the current repository and analytics data;
3. create and initialize the destination stores;
4. import and verify counts and revisions;
5. switch the bootstrap provider and redeploy;
6. keep the source store available for rollback until acceptance is complete.

i0c.cc currently ships schema updates, not an automatic cross-provider data-migration tool.
