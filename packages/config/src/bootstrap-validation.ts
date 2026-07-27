import type { BootstrapConfig } from "./types"

export function assertBootstrapConfigCompatibility(
  config: BootstrapConfig,
): void {
  if (
    config.data.repository.provider === "postgres"
    && config.data.source.provider !== "http"
  ) {
    throw new TypeError(
      "The PostgreSQL data repository requires the HTTP Runtime data source",
    )
  }
}
