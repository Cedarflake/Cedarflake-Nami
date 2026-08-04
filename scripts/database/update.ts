import process from "node:process"

import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
} from "@i0c/config"

import {
  createConfiguredSchemaMigrationProvider,
  initializeDatabases,
  resolveDatabaseProvider,
  resolveDatabasePurpose,
} from "./initialization"

assertBootstrapConfigCompatibility(bootstrapConfig)

const provider = resolveDatabaseProvider(process.argv[2])
const purpose = resolveDatabasePurpose(process.argv[3])
await initializeDatabases([{ provider, purpose }], {
  createProvider: (step) => createConfiguredSchemaMigrationProvider(step, {
    config: bootstrapConfig,
    readEnvironment: (name) => process.env[name],
  }),
  log: (message) => console.info(message),
})
