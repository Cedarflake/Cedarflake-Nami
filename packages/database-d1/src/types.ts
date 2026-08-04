export interface D1ResultMeta {
  changes?: number
  duration?: number
  [key: string]: unknown
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
