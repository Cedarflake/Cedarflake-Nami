import { createPostgresSchemaMigrationProvider } from "../src/migrations"

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required to update the PostgreSQL analytics schema",
  )
}

const provider = createPostgresSchemaMigrationProvider({ connectionString })
const result = await provider.applySchemaMigrations()

if (result.applied.length === 0) {
  console.info(`Already at ${result.currentVersion}`)
} else {
  for (const filename of result.applied) {
    console.info(`Applied ${filename}`)
  }
}
