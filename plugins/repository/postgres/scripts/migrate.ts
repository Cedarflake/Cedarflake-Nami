import { createPostgresDataRepositoryMigrationProvider } from "../src/migrations"

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required to run PostgreSQL data repository migrations",
  )
}

const provider = createPostgresDataRepositoryMigrationProvider({
  connectionString,
})
const result = await provider.applyMigrations()

if (result.applied.length === 0) {
  console.info(`Already at ${result.currentVersion}`)
} else {
  for (const filename of result.applied) {
    console.info(`Applied ${filename}`)
  }
}
