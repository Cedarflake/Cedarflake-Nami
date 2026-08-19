# `@nami/database-postgres`

Shared PostgreSQL infrastructure for nami plugins.

The package owns consistent `postgres` client construction and reusable file-backed migration mechanics. Repository and Analytics Store plugins retain their own connection policy, migration table names, advisory lock names, schemas, and domain SQL.

---

English · [简体中文](README.zh-CN.md)
