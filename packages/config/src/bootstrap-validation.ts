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
}
