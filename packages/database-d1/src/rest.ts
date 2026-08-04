import { assertD1Result } from "./operations"
import type {
  D1Database,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  D1ResultMeta,
} from "./types"

const DEFAULT_API_BASE_URL = "https://api.cloudflare.com/client/v4"
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

export type D1RestFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export interface D1RestDatabaseOptions {
  accountId: string
  apiBaseUrl?: string
  apiToken: string
  databaseId: string
  fetchImpl?: D1RestFetch
  requestTimeoutMs?: number
}

interface D1RestQuery {
  sql: string
  params?: readonly unknown[]
}

interface CloudflareApiError {
  message?: unknown
}

interface CloudflareD1Envelope {
  errors?: unknown
  result?: unknown
  success?: unknown
}

export function createD1RestDatabase(
  options: D1RestDatabaseOptions,
): D1Database {
  return new D1RestDatabase(options)
}

class D1RestDatabase implements D1Database {
  private readonly endpoint: string
  private readonly apiToken: string
  private readonly fetchImpl: D1RestFetch
  private readonly requestTimeoutMs: number

  constructor(options: D1RestDatabaseOptions) {
    const accountId = requireValue(options.accountId, "Cloudflare account ID")
    const databaseId = requireValue(options.databaseId, "D1 database ID")
    this.apiToken = requireValue(options.apiToken, "Cloudflare D1 API token")
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestTimeoutMs = resolveRequestTimeout(options.requestTimeoutMs)
    const apiBaseUrl = (options.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/u, "")
    this.endpoint = `${apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`
  }

  prepare(query: string): D1PreparedStatement {
    return new D1RestPreparedStatement(this, query)
  }

  async batch<T = Record<string, unknown>>(
    statements: readonly D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    if (statements.length === 0) {
      return []
    }
    const queries = statements.map((statement) => {
      if (!(statement instanceof D1RestPreparedStatement)) {
        throw new TypeError("D1 REST batches require statements from the same REST database")
      }
      if (statement.database !== this) {
        throw new TypeError("D1 REST batches cannot mix database instances")
      }
      return statement.toQuery()
    })
    return this.executeQueries(queries) as Promise<D1Result<T>[]>
  }

  async exec(query: string): Promise<D1ExecResult> {
    const results = await this.executeQueries([{ sql: query }])
    for (const result of results) {
      assertD1Result(result)
    }
    return {
      count: results.length,
      duration: results.reduce(
        (duration, result) => duration + (result.meta?.duration ?? 0),
        0,
      ),
    }
  }

  async executeStatement<T>(query: D1RestQuery): Promise<D1Result<T>> {
    const [result] = await this.executeQueries([query])
    if (!result) {
      throw new Error("Cloudflare D1 REST API returned no query result")
    }
    return result as D1Result<T>
  }

  private async executeQueries(
    queries: readonly D1RestQuery[],
  ): Promise<D1Result[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          queries.length === 1
            ? serializeQuery(queries[0])
            : { batch: queries.map(serializeQuery) },
        ),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(
          `Cloudflare D1 REST request timed out after ${this.requestTimeoutMs} ms`,
          { cause: error },
        )
      }
      throw new Error("Cloudflare D1 REST request failed", { cause: error })
    } finally {
      clearTimeout(timeout)
    }

    const payload = await readResponsePayload(response)
    if (!response.ok || payload.success !== true) {
      throw new Error(formatApiError(response.status, payload.errors))
    }
    if (!Array.isArray(payload.result)) {
      throw new Error("Cloudflare D1 REST API returned an invalid result payload")
    }
    return payload.result.map(normalizeD1Result)
  }
}

class D1RestPreparedStatement implements D1PreparedStatement {
  constructor(
    readonly database: D1RestDatabase,
    private readonly query: string,
    private readonly values: readonly unknown[] = [],
  ) {}

  bind(...values: readonly unknown[]): D1PreparedStatement {
    return new D1RestPreparedStatement(this.database, this.query, values)
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.database.executeStatement<T>(this.toQuery())
  }

  async first<T = Record<string, unknown>>(
    columnName?: string,
  ): Promise<T | null> {
    const result = await this.all<Record<string, unknown>>()
    assertD1Result(result)
    const row = result.results?.[0]
    if (!row) {
      return null
    }
    if (columnName === undefined) {
      return row as T
    }
    if (!(columnName in row)) {
      throw new Error(`D1 result does not contain column ${columnName}`)
    }
    return row[columnName] as T
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.database.executeStatement<T>(this.toQuery())
  }

  toQuery(): D1RestQuery {
    return this.values.length > 0
      ? { sql: this.query, params: this.values }
      : { sql: this.query }
  }
}

function serializeQuery(query: D1RestQuery): D1RestQuery {
  return query.params
    ? { sql: query.sql, params: query.params.map(serializeBindingValue) }
    : { sql: query.sql }
}

function serializeBindingValue(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (
    value === null
    || typeof value === "string"
    || (typeof value === "number" && Number.isFinite(value))
  ) {
    return value
  }
  if (value instanceof Uint8Array) {
    return [...value]
  }
  if (value instanceof ArrayBuffer) {
    return [...new Uint8Array(value)]
  }
  throw new TypeError(`Unsupported D1 REST binding value: ${String(value)}`)
}

async function readResponsePayload(response: Response): Promise<CloudflareD1Envelope> {
  try {
    const payload: unknown = await response.json()
    return isRecord(payload) ? payload : {}
  } catch (error) {
    throw new Error(
      `Cloudflare D1 REST API returned an invalid JSON response (${response.status})`,
      { cause: error },
    )
  }
}

function normalizeD1Result(value: unknown): D1Result {
  if (!isRecord(value)) {
    return { success: false, error: "Invalid D1 query result" }
  }
  const meta = isRecord(value.meta)
    ? value.meta as D1ResultMeta
    : undefined
  return {
    success: value.success === true,
    results: Array.isArray(value.results) ? value.results : undefined,
    error: typeof value.error === "string" ? value.error : undefined,
    meta,
  }
}

function formatApiError(status: number, errors: unknown): string {
  const messages = Array.isArray(errors)
    ? errors
      .filter(isRecord)
      .map((error: CloudflareApiError) => error.message)
      .filter((message): message is string => typeof message === "string")
    : []
  const detail = messages.length > 0 ? `: ${messages.join("; ")}` : ""
  return `Cloudflare D1 REST API request failed (${status})${detail}`
}

function requireValue(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new TypeError(`${label} is missing`)
  }
  return normalized
}

function resolveRequestTimeout(value: number | undefined): number {
  const resolved = value ?? DEFAULT_REQUEST_TIMEOUT_MS
  if (!Number.isSafeInteger(resolved) || resolved < 1) {
    throw new TypeError("D1 REST request timeout must be a positive integer")
  }
  return resolved
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
