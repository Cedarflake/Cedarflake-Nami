import type { DataConfig, RedirectsConfig } from "./types"

export interface RuntimeDataSnapshot {
  schemaVersion: 1
  revision: string
  config: DataConfig
  redirects: RedirectsConfig
}
