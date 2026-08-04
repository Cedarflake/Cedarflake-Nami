import type { BootstrapConfig } from "./types"

export function assertBootstrapConfigCompatibility(
  config: BootstrapConfig,
): void {
  if (
    config.data.repository.provider !== "github"
    && config.data.source.provider !== "http"
  ) {
    throw new TypeError(
      "Database-backed data repositories require the HTTP Runtime data source",
    )
  }
  if (!config.webui.d1.apiTokenBinding.trim()) {
    throw new TypeError("The D1 API token binding must not be empty")
  }
  if (
    !Number.isSafeInteger(config.webui.d1.requestTimeoutMs)
    || config.webui.d1.requestTimeoutMs < 1
  ) {
    throw new TypeError("The D1 request timeout must be a positive integer")
  }
  if (config.data.repository.provider === "d1") {
    assertD1RestTargetCompatibility(
      config.webui.d1.accountId,
      config.webui.d1.databaseIds.dataRepository,
      "data repository",
    )
  }
  if (config.webui.analyticsStore.provider === "d1") {
    assertD1RestTargetCompatibility(
      config.webui.d1.accountId,
      config.webui.d1.databaseIds.analytics,
      "analytics store",
    )
  }
}

function assertD1RestTargetCompatibility(
  accountId: string,
  databaseId: string,
  target: string,
): void {
  const hasAccountId = accountId.trim().length > 0
  const hasDatabaseId = databaseId.trim().length > 0
  if (hasAccountId !== hasDatabaseId) {
    throw new TypeError(
      `The D1 ${target} REST fallback requires both a Cloudflare account ID and database ID`,
    )
  }
}
