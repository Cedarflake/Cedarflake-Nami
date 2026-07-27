import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import postgres from "postgres"

import {
  validateDataConfig,
  validateRedirectsConfig,
} from "@i0c/config"

import {
  resolvePostgresDataRepositoryConnectionOptions,
} from "../src/config"

const connectionString = process.env.DATA_REPOSITORY_DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error(
    "DATA_REPOSITORY_DATABASE_URL is required to seed the PostgreSQL data repository",
  )
}

const configPath = resolveRequiredPath("--config")
const redirectsPath = resolveRequiredPath("--redirects")
const [configContent, redirectsContent] = await Promise.all([
  readFile(configPath, "utf8"),
  readFile(redirectsPath, "utf8"),
])

validateDocumentContent("config", configContent)
validateDocumentContent("redirects", redirectsContent)

const options = resolvePostgresDataRepositoryConnectionOptions({
  connectionString,
})
const sql = postgres(options.connectionString, {
  max: 1,
  idle_timeout: options.idleTimeoutSeconds,
  connect_timeout: options.connectTimeoutSeconds,
  prepare: false,
})

try {
  const insertedKinds = await sql.begin(async (transaction) => {
    const rows = await transaction<{ kind: string }[]>`
      INSERT INTO i0c_data_document (
        kind,
        content,
        revision,
        checksum,
        updated_at
      )
      VALUES
        (
          'config',
          ${configContent},
          1,
          ${createChecksum(configContent)},
          NOW()
        ),
        (
          'redirects',
          ${redirectsContent},
          1,
          ${createChecksum(redirectsContent)},
          NOW()
        )
      ON CONFLICT (kind) DO NOTHING
      RETURNING kind
    `
    const documents = await transaction<{ kind: string }[]>`
      SELECT kind
      FROM i0c_data_document
      WHERE kind IN ('config', 'redirects')
      ORDER BY kind ASC
    `
    if (
      documents.length !== 2
      || documents[0]?.kind !== "config"
      || documents[1]?.kind !== "redirects"
    ) {
      throw new Error("PostgreSQL data repository seeding is incomplete")
    }
    return rows.map((row) => row.kind)
  })

  if (insertedKinds.length === 0) {
    console.info("Both data documents already exist; nothing was overwritten")
  } else {
    console.info(`Seeded ${insertedKinds.join(", ")}`)
  }
} finally {
  await sql.end({ timeout: 5 })
}

function resolveRequiredPath(flag: string): string {
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a file path`)
  }
  return path.resolve(process.cwd(), value)
}

function validateDocumentContent(
  kind: "config" | "redirects",
  content: string,
): void {
  let value: unknown
  try {
    value = JSON.parse(content) as unknown
  } catch {
    throw new Error(`${kind} seed file must contain valid JSON`)
  }

  const result = kind === "config"
    ? validateDataConfig(value)
    : validateRedirectsConfig(value)
  if (result.status !== "valid") {
    throw new Error(
      `${kind} seed file failed validation: ${result.issues
        .slice(0, 5)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    )
  }
}

function createChecksum(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}
