import { readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

import {
  validateDataConfig,
  validateRedirectsConfig,
} from "@nami/config"
import { createPostgresClient } from "@nami/database-postgres"

import {
  resolvePostgresDataRepositoryConnectionOptions,
} from "../src/config"
import { createPostgresDataRepository } from "../src/repository"

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required to seed the PostgreSQL data repository",
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
const sql = createPostgresClient(options.connectionString, {
  maxConnections: 1,
  idleTimeoutSeconds: options.idleTimeoutSeconds,
  connectTimeoutSeconds: options.connectTimeoutSeconds,
})
const repository = createPostgresDataRepository(options, { sql })

try {
  const setupState = await repository.management.inspectSetupState()
  if (setupState.state === "initialized") {
    console.info("Both data documents already exist; nothing was overwritten")
  } else if (setupState.state === "empty") {
    await repository.management.initialize({
      configContent,
      redirectsContent,
    })
    console.info("Seeded config, redirects")
  } else if (setupState.state === "schema-update-required") {
    throw new Error(
      "The PostgreSQL data repository schema must be updated before seeding",
    )
  } else {
    throw new Error(
      `PostgreSQL data repository is partially initialized: ${setupState.existingKinds.join(", ")}`,
    )
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
