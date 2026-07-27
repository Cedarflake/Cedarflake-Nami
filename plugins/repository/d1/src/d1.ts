export interface D1ResultMeta {
  changes?: number
}

export interface D1Result<T = unknown> {
  success: boolean
  results?: T[]
  error?: string
  meta?: D1ResultMeta
}

export interface D1ExecResult {
  count: number
  duration: number
}

export interface D1PreparedStatement {
  bind(...values: readonly unknown[]): D1PreparedStatement
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(
    statements: readonly D1PreparedStatement[],
  ): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

export async function d1All<T>(
  statement: D1PreparedStatement,
): Promise<T[]> {
  const result = await statement.all<T>()
  assertD1Result(result)
  return result.results ?? []
}

export async function d1Batch(
  database: D1Database,
  statements: readonly D1PreparedStatement[],
): Promise<D1Result[]> {
  const results = await database.batch(statements)
  for (const result of results) {
    assertD1Result(result)
  }
  return results
}

export function assertD1Result(result: D1Result): void {
  if (!result.success) {
    throw new Error(result.error || "D1 operation failed")
  }
}
