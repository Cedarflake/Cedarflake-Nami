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
  actorGitHubUserId?: string
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

export type DataDocumentRevisionOperation =
  | "import"
  | "initialize"
  | "migration"
  | "rollback"
  | "save"

export interface DataDocumentRevisionSummary {
  actorGitHubUserId?: string
  checksum: string
  createdAt: string
  kind: DataDocumentKind
  operation: DataDocumentRevisionOperation
  revision: string
}

export interface DataDocumentRevision extends DataDocumentRevisionSummary {
  content: string
}

export type DataRepositorySetupState =
  | {
      state: "migration-required"
    }
  | {
      existingKinds: readonly DataDocumentKind[]
      state: "empty" | "partial"
    }
  | {
      state: "initialized"
    }

export interface DataRepositoryInitializeInput {
  actorGitHubUserId?: string
  configContent: string
  redirectsContent: string
}

export interface DataRepositoryImportInput
  extends DataRepositoryInitializeInput {
  expectedConfigRevision: string
  expectedRedirectsRevision: string
}

export interface DataRepositoryRevisionListInput {
  beforeRevision?: string
  kind: DataDocumentKind
  limit?: number
}

export interface DataRepositoryRevisionReadInput {
  kind: DataDocumentKind
  revision: string
}

export interface DataRepositoryRestoreInput
  extends DataRepositoryRevisionReadInput {
  actorGitHubUserId?: string
  expectedRevision: string
}

export interface DataRepositoryManagement {
  importSnapshot(input: DataRepositoryImportInput): Promise<DataRepositorySnapshot>
  initialize(input: DataRepositoryInitializeInput): Promise<DataRepositorySnapshot>
  inspectSetupState(): Promise<DataRepositorySetupState>
  listRevisions(
    input: DataRepositoryRevisionListInput,
  ): Promise<readonly DataDocumentRevisionSummary[]>
  readRevision(
    input: DataRepositoryRevisionReadInput,
  ): Promise<DataDocumentRevision>
  restore(input: DataRepositoryRestoreInput): Promise<DataRepositoryWriteResult>
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

export class DataRepositoryInitializationError extends Error {
  readonly code = "DATA_REPOSITORY_INITIALIZATION_FAILED"

  constructor(message: string) {
    super(message)
    this.name = "DataRepositoryInitializationError"
  }
}
