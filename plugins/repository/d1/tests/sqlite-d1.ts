import {
  DatabaseSync,
  type SQLInputValue,
} from "node:sqlite"

import type {
  D1Database,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
} from "../src/d1"

export class SQLiteD1Database implements D1Database {
  readonly database = new DatabaseSync(":memory:")
  private nextBatchFailureIndex: number | undefined

  prepare(query: string): D1PreparedStatement {
    return new SQLiteD1Statement(this.database, query)
  }

  async batch<T = Record<string, unknown>>(
    statements: readonly D1PreparedStatement[],
  ): Promise<D1Result<T>[]> {
    this.database.exec("BEGIN IMMEDIATE")
    try {
      const results = statements.map((statement, index) => {
        if (index === this.nextBatchFailureIndex) {
          throw new Error(`Injected D1 batch failure at statement ${index}`)
        }
        if (!(statement instanceof SQLiteD1Statement)) {
          throw new Error("SQLite D1 tests received an incompatible statement")
        }
        return statement.runSync<T>()
      })
      this.nextBatchFailureIndex = undefined
      this.database.exec("COMMIT")
      return results
    } catch (error) {
      this.nextBatchFailureIndex = undefined
      this.database.exec("ROLLBACK")
      throw error
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    const startedAt = performance.now()
    this.database.exec(query)
    return { count: 0, duration: performance.now() - startedAt }
  }

  close(): void {
    this.database.close()
  }

  failNextBatchAt(index: number): void {
    this.nextBatchFailureIndex = index
  }
}

class SQLiteD1Statement implements D1PreparedStatement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string,
    private readonly values: readonly SQLInputValue[] = [],
  ) {}

  bind(...values: readonly unknown[]): D1PreparedStatement {
    return new SQLiteD1Statement(
      this.database,
      this.query,
      values.map(toSqliteValue),
    )
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const statement = this.database.prepare(this.query)
    return {
      success: true,
      results: statement.all(...this.values) as T[],
      meta: { changes: 0 },
    }
  }

  async first<T = Record<string, unknown>>(
    columnName?: string,
  ): Promise<T | null> {
    const statement = this.database.prepare(this.query)
    const row = statement.get(...this.values) as Record<string, unknown> | undefined
    if (!row) {
      return null
    }
    return (columnName ? row[columnName] : row) as T
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.runSync<T>()
  }

  runSync<T = Record<string, unknown>>(): D1Result<T> {
    const statement = this.database.prepare(this.query)
    const result = statement.run(...this.values)
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes) },
    }
  }
}

function toSqliteValue(value: unknown): SQLInputValue {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "bigint"
    || value instanceof Uint8Array
  ) {
    return value
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  throw new TypeError(`Unsupported SQLite binding value: ${String(value)}`)
}
