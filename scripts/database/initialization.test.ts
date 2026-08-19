import assert from "node:assert/strict"
import test from "node:test"

import type { BootstrapConfig } from "@nami/config"
import type { PluginSchemaMigrationProvider } from "@nami/plugin-api"

import {
  initializeDatabases,
  resolveDatabaseInitializationPlan,
  resolveDatabaseProvider,
  resolveDatabasePurpose,
  type DatabaseInitializationStep,
} from "./initialization"

const baseConfig: BootstrapConfig = {
  data: {
    github: {
      owner: "owner",
      repository: "repository",
      branch: "data",
      configPath: "config.json",
      redirectsPath: "redirects.json",
    },
    repository: {
      provider: "postgres",
      databaseUrlBinding: "DATABASE_URL",
      maxConnections: 3,
      idleTimeoutSeconds: 20,
      connectTimeoutSeconds: 30,
    },
    source: {
      provider: "http",
      snapshotUrl: "https://example.com/api/runtime/snapshot",
      requestTimeoutMs: 5_000,
      maximumFetchAttempts: 2,
      failureBackoffSeconds: 30,
    },
  },
  webui: {
    analyticsStore: { provider: "postgres" },
    d1: {
      accountId: "account",
      apiTokenBinding: "CLOUDFLARE_D1_API_TOKEN",
      databaseIds: {
        analytics: "analytics",
        dataRepository: "repository",
      },
      requestTimeoutMs: 10_000,
    },
    githubOAuthScope: "read:user user:email",
  },
}

test("initializes the configured repository before the analytics store", () => {
  assert.deepEqual(resolveDatabaseInitializationPlan(baseConfig), [
    { provider: "postgres", purpose: "repository" },
    { provider: "postgres", purpose: "analytics" },
  ])
})

test("skips database initialization for the GitHub repository", () => {
  const config: BootstrapConfig = {
    ...baseConfig,
    data: {
      ...baseConfig.data,
      repository: { provider: "github" },
    },
    webui: {
      ...baseConfig.webui,
      analyticsStore: { provider: "d1" },
    },
  }

  assert.deepEqual(resolveDatabaseInitializationPlan(config), [
    { provider: "d1", purpose: "analytics" },
  ])
})

test("parses database schema-update targets", () => {
  assert.equal(resolveDatabaseProvider("d1"), "d1")
  assert.equal(resolveDatabaseProvider("postgres"), "postgres")
  assert.equal(resolveDatabasePurpose("repository"), "repository")
  assert.equal(resolveDatabasePurpose("analytics"), "analytics")
  assert.throws(() => resolveDatabaseProvider("mysql"), /d1 or postgres/)
  assert.throws(() => resolveDatabasePurpose(undefined), /analytics or repository/)
})

test("initializes schemas serially and guards their current versions", async () => {
  const calls: string[] = []
  const steps: readonly DatabaseInitializationStep[] = [
    { provider: "d1", purpose: "repository" },
    { provider: "postgres", purpose: "analytics" },
  ]

  await initializeDatabases(steps, {
    createProvider: async (step) => createProvider(step, calls),
    log: (message) => calls.push(`log:${message}`),
  })

  assert.deepEqual(calls, [
    "create:d1:repository",
    "plan:d1:repository",
    "log:Applying 1 d1 repository schema change(s) from 001.sql to 002.sql",
    "apply:d1:repository:001.sql",
    "log:Applied 1 d1 repository schema change(s); current version is 002.sql",
    "create:postgres:analytics",
    "plan:postgres:analytics",
    "log:Applying 1 postgres analytics schema change(s) from 001.sql to 002.sql",
    "apply:postgres:analytics:001.sql",
    "log:Applied 1 postgres analytics schema change(s); current version is 002.sql",
  ])
})

function createProvider(
  step: DatabaseInitializationStep,
  calls: string[],
): PluginSchemaMigrationProvider {
  const label = `${step.provider}:${step.purpose}`
  calls.push(`create:${label}`)
  return {
    schemaMigrationStatus: async () => ({
      currentVersion: "001.sql",
      targetVersion: "002.sql",
      pending: 1,
    }),
    schemaMigrationPlan: async () => {
      calls.push(`plan:${label}`)
      return {
        currentVersion: "001.sql",
        targetVersion: "002.sql",
        actions: [{
          id: "002.sql",
          description: "Apply 002.sql",
          destructive: false,
        }],
      }
    },
    applySchemaMigrations: async (input) => {
      calls.push(`apply:${label}:${input?.expectedCurrentVersion ?? "none"}`)
      return {
        previousVersion: "001.sql",
        currentVersion: "002.sql",
        applied: ["002.sql"],
      }
    },
  }
}
