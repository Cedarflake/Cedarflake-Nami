import postgres, {
  type Sql,
  type TransactionSql,
} from "postgres"

export interface PostgresClientOptions {
  connectTimeoutSeconds: number
  idleTimeoutSeconds: number
  maxConnections: number
}

export type PostgresSql = Sql
export type PostgresTransactionSql = TransactionSql

export function createPostgresClient(
  connectionString: string,
  options: PostgresClientOptions,
): PostgresSql {
  const normalizedConnectionString = connectionString.trim()
  if (!normalizedConnectionString) {
    throw new TypeError("PostgreSQL connection string is missing")
  }
  assertPositiveInteger(options.maxConnections, "maxConnections")
  assertNonNegativeInteger(options.idleTimeoutSeconds, "idleTimeoutSeconds")
  assertPositiveInteger(options.connectTimeoutSeconds, "connectTimeoutSeconds")

  return postgres(normalizedConnectionString, {
    max: options.maxConnections,
    idle_timeout: options.idleTimeoutSeconds,
    connect_timeout: options.connectTimeoutSeconds,
    prepare: false,
  })
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`)
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`)
  }
}
