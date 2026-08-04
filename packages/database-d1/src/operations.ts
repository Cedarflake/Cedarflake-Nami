import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "./types"

export async function d1All<T>(
  statement: D1PreparedStatement,
): Promise<T[]> {
  const result = await statement.all<T>()
  assertD1Result(result)
  return result.results ?? []
}

export async function d1Run(
  statement: D1PreparedStatement,
): Promise<D1Result> {
  const result = await statement.run()
  assertD1Result(result)
  return result
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
