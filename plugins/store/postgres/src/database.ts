import {
  createPostgresClient,
  type PostgresSql,
} from "@i0c/database-postgres"

import type { PostgresAnalyticsStoreConfig } from "./config"

interface AnalyticsDatabaseGlobal {
  __i0cAnalyticsDatabase?: AnalyticsDatabaseState
}

interface AnalyticsDatabaseState {
  client: PostgresSql
  connectionOptionsKey: string
  connectionString: string
}

interface PostgresConnectionOptions {
  connect_timeout: number
  idle_timeout: number
  max: number
  prepare: false
}

const analyticsDatabaseGlobal = globalThis as typeof globalThis & AnalyticsDatabaseGlobal
let database: AnalyticsDatabaseState | null = null
let databaseUrl: string | null = null
let databaseConfig: PostgresAnalyticsStoreConfig | null = null
let isDevelopment = false

function resolveConnectionOptions(): PostgresConnectionOptions {
  if (!databaseConfig) {
    throw new Error("Analytics is not configured: PostgreSQL config is missing")
  }

  return {
    max: databaseConfig.maxConnections,
    idle_timeout: isDevelopment
      ? databaseConfig.developmentIdleTimeoutSeconds
      : databaseConfig.idleTimeoutSeconds,
    connect_timeout: databaseConfig.connectTimeoutSeconds,
    prepare: false,
  }
}

function closeReplacedClient(client: PostgresSql): void {
  void client.end({ timeout: 5 }).catch(() => {})
}

export function configurePostgresDatabase(input: {
  connectionString: string | null
  config: PostgresAnalyticsStoreConfig
  development: boolean
}): void {
  const nextUrl = input.connectionString?.trim() || null
  if (
    (databaseUrl && nextUrl && databaseUrl !== nextUrl)
    || (
      database
      && nextUrl
      && database.connectionString !== nextUrl
    )
  ) {
    throw new Error("PostgreSQL analytics store cannot change connection strings at runtime")
  }
  databaseUrl = nextUrl
  databaseConfig = input.config
  isDevelopment = input.development
}

export function isDatabaseConfigured(): boolean {
  return databaseUrl !== null
}

export function getDatabase(): PostgresSql {
  if (!databaseUrl || !databaseConfig) {
    throw new Error("Analytics is not configured: DATABASE_URL is missing")
  }

  const developmentDatabase = isDevelopment
    ? analyticsDatabaseGlobal.__i0cAnalyticsDatabase
    : undefined
  if (
    developmentDatabase
    && developmentDatabase.connectionString !== databaseUrl
  ) {
    throw new Error("PostgreSQL analytics store cannot change connection strings at runtime")
  }
  const cachedDatabase = database ?? developmentDatabase ?? null
  if (cachedDatabase && cachedDatabase.connectionString !== databaseUrl) {
    throw new Error("PostgreSQL analytics store cannot change connection strings at runtime")
  }

  const options = resolveConnectionOptions()
  const connectionOptionsKey = JSON.stringify(options)
  if (cachedDatabase?.connectionOptionsKey === connectionOptionsKey) {
    database = cachedDatabase
    if (isDevelopment) {
      analyticsDatabaseGlobal.__i0cAnalyticsDatabase = cachedDatabase
    }
    return cachedDatabase.client
  }

  const client = createPostgresClient(databaseUrl, {
    maxConnections: options.max,
    idleTimeoutSeconds: options.idle_timeout,
    connectTimeoutSeconds: options.connect_timeout,
  })
  const nextDatabase = {
    client,
    connectionOptionsKey,
    connectionString: databaseUrl,
  }

  database = nextDatabase
  if (isDevelopment) {
    analyticsDatabaseGlobal.__i0cAnalyticsDatabase = nextDatabase
  }
  if (cachedDatabase) {
    closeReplacedClient(cachedDatabase.client)
  }

  return client
}
