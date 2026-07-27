export const dataDocumentKinds = ["config", "redirects"] as const

export type DataDocumentKind = (typeof dataDocumentKinds)[number]

export interface DataDocument {
  content: string
  revision: string
  lastModified?: string
  sourcePath?: string
  sourceUrl?: string
}

export interface DataRepositorySnapshot {
  config: DataDocument
  redirects: DataDocument
  revision: string
}

export interface DataRepositoryReadOptions {
  cacheMode?: "default" | "no-store"
  cacheTags?: readonly string[]
  credential?: string
  sourceUrl?: string | null
}

export interface DataRepositoryWriteInput {
  content: string
  credential?: string
  expectedRevision: string
  message?: string
  sourceUrl?: string | null
}

export interface DataRepositoryWriteResult {
  revision: string
  revisionUrl?: string
}

export class DataDocumentNotFoundError extends Error {
  readonly code = "DATA_DOCUMENT_NOT_FOUND"

  constructor(readonly kind: DataDocumentKind) {
    super(`The ${kind} data document does not exist`)
    this.name = "DataDocumentNotFoundError"
  }
}

export class DataRepositoryConflictError extends Error {
  readonly code = "DATA_REPOSITORY_CONFLICT"

  constructor(
    readonly kind: DataDocumentKind,
    readonly expectedRevision: string,
    readonly actualRevision: string,
  ) {
    super(
      `The ${kind} data document changed from revision ${expectedRevision} to ${actualRevision}`,
    )
    this.name = "DataRepositoryConflictError"
  }
}
