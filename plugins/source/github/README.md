# GitHub data plugin

This official plugin provides two compile-time entries:

- `./runtime` reads `config.json` and `redirects.json` over GitHub Raw-compatible HTTPS with ETag, cache, deduplication, backoff, and last-valid-value behavior.
- `./webui` reads and writes the same documents through the GitHub Contents API with version conflict protection.

The host selects and registers these entries explicitly. The plugin never reads undeclared secrets or loads executable code from the data branch.

Repository location, branch, document paths, initial Raw URLs, and public revalidation belong to host bootstrap options because they are required before `config.json` can be read. The remote plugin declaration therefore has no locator fields; it only confirms that the mandatory installed Source and Repository remain enabled.

---

English · [简体中文](README.zh-CN.md)
