import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { D1SchemaMigration } from "./migrations"

export async function loadD1SchemaMigrationFiles(
  directory: string,
): Promise<readonly D1SchemaMigration[]> {
  const filenames = (await readdir(directory))
    .filter((filename) => /^\d+.*\.sql$/u.test(filename))
    .sort((left, right) => left.localeCompare(right))

  const migrations: D1SchemaMigration[] = []
  for (const id of filenames) {
    migrations.push({
      id,
      sql: await readFile(join(directory, id), "utf8"),
    })
  }
  return migrations
}
