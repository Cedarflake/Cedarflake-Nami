import process from "node:process"

import {
  assertBootstrapConfigCompatibility,
  bootstrapConfig,
} from "@nami/config"

import {
  createConfiguredSchemaMigrationProvider,
  initializeDatabases,
  resolveDatabaseInitializationPlan,
} from "./initialization"

assertBootstrapConfigCompatibility(bootstrapConfig)

const steps = resolveDatabaseInitializationPlan(bootstrapConfig)
await initializeDatabases(steps, {
  createProvider: (step) => createConfiguredSchemaMigrationProvider(step, {
    config: bootstrapConfig,
    readEnvironment: (name) => process.env[name],
  }),
  log: (message) => console.info(message),
})
