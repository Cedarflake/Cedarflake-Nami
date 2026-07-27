import type { JsonObject } from "@i0c/config"

export const postgresDataRepositoryPluginConfigSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} satisfies JsonObject

export interface PostgresDataRepositoryConnectionOptions {
  connectionString: string
  maxConnections?: number
  idleTimeoutSeconds?: number
  connectTimeoutSeconds?: number
}

export interface ResolvedPostgresDataRepositoryConnectionOptions {
  connectionString: string
  maxConnections: number
  idleTimeoutSeconds: number
  connectTimeoutSeconds: number
}

const DEFAULT_MAX_CONNECTIONS = 3
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 30

export function resolvePostgresDataRepositoryConnectionOptions(
  options: PostgresDataRepositoryConnectionOptions,
): ResolvedPostgresDataRepositoryConnectionOptions {
  const connectionString = options.connectionString.trim()
  if (!connectionString) {
    throw new Error("PostgreSQL data repository connection string is missing")
  }

  return {
    connectionString,
    maxConnections: resolvePositiveInteger(
      options.maxConnections,
      DEFAULT_MAX_CONNECTIONS,
      "maxConnections",
    ),
    idleTimeoutSeconds: resolveNonNegativeInteger(
      options.idleTimeoutSeconds,
      DEFAULT_IDLE_TIMEOUT_SECONDS,
      "idleTimeoutSeconds",
    ),
    connectTimeoutSeconds: resolvePositiveInteger(
      options.connectTimeoutSeconds,
      DEFAULT_CONNECT_TIMEOUT_SECONDS,
      "connectTimeoutSeconds",
    ),
  }
}

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 1) {
    throw new TypeError(`${name} must be a positive integer`)
  }
  return resolved
}

function resolveNonNegativeInteger(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new TypeError(`${name} must be a non-negative integer`)
  }
  return resolved
}
