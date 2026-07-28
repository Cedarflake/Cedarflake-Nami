import assert from "node:assert/strict"
import test from "node:test"

import {
  StaticPluginRegistry,
  type PluginConfigurationDeclaration,
  type PluginManifest,
  type RuntimePlatformManifest,
} from "@i0c/plugin-api"

import {
  installedPluginIds,
  installedPluginManifests,
  validateInstalledPluginDeclarations,
  validateRuntimeRequiredPluginDeclarations,
  validateWebUiRequiredPluginDeclarations,
} from "../src/index"

test("keeps the recognized plugin ID list synchronized with manifests", () => {
  assert.deepEqual(
    [...installedPluginIds].sort(),
    installedPluginManifests.map((manifest) => manifest.id).sort(),
  )
})

test("keeps D1 and PostgreSQL analytics capabilities aligned", () => {
  const postgres = installedPluginManifests.find(
    (manifest) => manifest.id === "@i0c/analytics-store-postgres",
  )
  const d1 = installedPluginManifests.find(
    (manifest) => manifest.id === "@i0c/analytics-store-d1",
  )

  assert.ok(postgres)
  assert.ok(d1)
  assert.deepEqual(
    [...d1.capabilities].sort(),
    [...postgres.capabilities].sort(),
  )
})

test("keeps installed plugin descriptions available for the WebUI", () => {
  for (const manifest of installedPluginManifests) {
    assert.equal(typeof manifest.description?.summary, "object")
    assert.equal(typeof manifest.description?.summary.en, "string")
    assert.equal(typeof manifest.description?.summary["zh-CN"], "string")
  }
})

test("allows all Runtime platform declarations across separate deployment hosts", () => {
  assert.deepEqual(validateInstalledPluginDeclarations({
    "@i0c/runtime-cloudflare": { enabled: true },
    "@i0c/runtime-vercel": { enabled: true },
    "@i0c/runtime-netlify": { enabled: true },
  }), [])
})

test("accepts an installed platform outside the official catalog", () => {
  const externalManifest = {
    id: "@example/runtime-external",
    name: "External Runtime",
    version: "1.0.0",
    apiVersion: 1,
    kind: "runtime-platform",
    slot: "runtime-platform",
    hosts: ["runtime"],
    capabilities: ["request-adapter"],
    config: { version: 1 },
    secrets: {},
    provider: "external-edge",
  } as const satisfies RuntimePlatformManifest

  assert.deepEqual(validateInstalledPluginDeclarations({
    "@example/runtime-external": { enabled: true },
  }, [externalManifest]), [])
})

test("rejects an external platform that reuses an installed plugin ID", () => {
  const conflictingManifest = {
    id: "@i0c/github-raw-source",
    name: "Conflicting Runtime",
    version: "1.0.0",
    apiVersion: 1,
    kind: "runtime-platform",
    slot: "runtime-platform",
    hosts: ["runtime"],
    capabilities: ["request-adapter"],
    config: { version: 1 },
    secrets: {},
    provider: "conflicting-edge",
  } as const satisfies RuntimePlatformManifest
  const issues = validateInstalledPluginDeclarations({}, [conflictingManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /conflicts with an installed manifest/,
  )
})

test("rejects an external platform that shadows an official platform manifest", () => {
  const conflictingManifest = {
    id: "@i0c/runtime-cloudflare",
    name: "Conflicting Cloudflare Runtime",
    version: "1.0.0",
    apiVersion: 1,
    kind: "runtime-platform",
    slot: "runtime-platform",
    hosts: ["runtime"],
    capabilities: ["request-adapter"],
    config: { version: 1 },
    secrets: {},
    provider: "conflicting-cloudflare",
  } as const satisfies RuntimePlatformManifest
  const issues = validateInstalledPluginDeclarations({}, [conflictingManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /conflicts with an installed manifest/,
  )
})

test("validates plugin-owned configuration schemas", () => {
  const issues = validateInstalledPluginDeclarations({
    "@i0c/feature-bot-classifier": {
      enabled: true,
      version: 1,
      config: { hookTimeoutMs: 0 },
    },
  })

  assert.match(issues.map((issue) => issue.message).join("\n"), /at least 1/)
})

test("validates plugin-owned configuration UI metadata", () => {
  const manifest = {
    id: "@example/config-ui",
    name: "Config UI",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:config-ui",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: {
        type: "object",
        properties: { mode: { type: "string" } },
      },
      ui: {
        fields: {
          mode: {
            control: "textarea",
            label: { en: "Mode" },
          },
        },
      },
    },
    secrets: {},
  } as unknown as PluginManifest

  assert.throws(
    () => new StaticPluginRegistry([manifest]),
    /config\.ui\.fields\.mode\.control is not supported/,
  )
})

test("rejects empty plugin localized text metadata", () => {
  const manifest = {
    id: "@example/empty-description",
    name: "Empty description",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:empty-description",
    hosts: ["runtime"],
    capabilities: [],
    description: { summary: {} },
    config: { version: 1 },
    secrets: {},
  } as unknown as PluginManifest

  assert.throws(
    () => new StaticPluginRegistry([manifest]),
    /description\.summary must not be empty/,
  )
})

test("rejects bootstrap-only settings in remote plugin configuration", () => {
  const issues = validateInstalledPluginDeclarations({
    "@i0c/runtime-cloudflare": {
      enabled: true,
      version: 1,
      config: { useDefaultCache: false },
    },
    "@i0c/github-raw-source": {
      enabled: true,
      version: 1,
      config: { redirectsConfigUrl: "https://example.com/redirects.json" },
    },
  })

  assert.equal(
    issues.filter((issue) => issue.message.includes("not allowed")).length,
    2,
  )
})

test("rejects analytics store slot conflicts", () => {
  const issues = validateInstalledPluginDeclarations({
    "@i0c/analytics-store-postgres": { enabled: true },
    "@i0c/analytics-store-d1": { enabled: true },
  })

  assert.match(issues.map((issue) => issue.message).join("\n"), /already occupied/)
})

test("rejects declarations for plugins not installed in the catalog", () => {
  const issues = validateInstalledPluginDeclarations({
    "@i0c/not-installed": { enabled: false },
  })

  assert.match(issues.map((issue) => issue.message).join("\n"), /not installed/)
})

test("rejects explicitly disabled Runtime deployment requirements", () => {
  const externalManifest = {
    id: "@example/runtime-external",
    name: "External Runtime",
    version: "1.0.0",
    apiVersion: 1,
    kind: "runtime-platform",
    slot: "runtime-platform",
    hosts: ["runtime"],
    capabilities: ["request-adapter"],
    config: { version: 1 },
    secrets: {},
    provider: "external-edge",
  } as const satisfies RuntimePlatformManifest
  const issues = validateRuntimeRequiredPluginDeclarations({
    "@i0c/github-raw-source": { enabled: false },
    "@example/runtime-external": { enabled: false },
  }, {
    dataSourcePluginId: "@i0c/github-raw-source",
    runtimePlatformManifests: [externalManifest],
  })

  assert.deepEqual(issues.map((issue) => issue.path), [
    "/plugins/@i0c~1github-raw-source/enabled",
    "/plugins/@example~1runtime-external/enabled",
  ])
})

test("keeps omitted Runtime deployment requirements compatibility-enabled", () => {
  assert.deepEqual(validateRuntimeRequiredPluginDeclarations({}, {
    dataSourcePluginId: "@i0c/github-raw-source",
    runtimePlatformManifests: [],
  }), [])
})

test("rejects an explicitly disabled WebUI data repository", () => {
  assert.deepEqual(validateWebUiRequiredPluginDeclarations({
    "@i0c/github-contents-repository": { enabled: false },
  }, "@i0c/github-contents-repository").map((issue) => issue.path), [
    "/plugins/@i0c~1github-contents-repository/enabled",
  ])
})

test("rejects a missing config only when the manifest declares it required", () => {
  const manifest = {
    id: "@example/required-config",
    name: "Required config",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:required-config",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      required: true,
      schema: {
        type: "object",
        required: ["mode"],
        properties: { mode: { type: "string" } },
      },
    },
    secrets: {},
  } as const satisfies PluginManifest
  const result = new StaticPluginRegistry([manifest]).resolve("runtime", {
    [manifest.id]: { enabled: true, version: 1 },
  })

  assert.equal(result.status, "invalid")
  if (result.status === "invalid") {
    assert.match(result.issues[0]?.message ?? "", /is required/)
  }
})

test("rejects invalid plugin schema patterns during registration", () => {
  const manifest = {
    id: "@example/invalid-pattern",
    name: "Invalid pattern",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:invalid-pattern",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: { type: "string", pattern: "[" },
    },
    secrets: {},
  } as const satisfies PluginManifest

  assert.throws(
    () => new StaticPluginRegistry([manifest]),
    /must be a valid regular expression/,
  )
})

test("rejects unsupported plugin schema types during registration", () => {
  const manifest = {
    id: "@example/unsupported-schema",
    name: "Unsupported schema",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:unsupported-schema",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: { type: "null" },
    },
    secrets: {},
  } as unknown as PluginManifest

  assert.throws(
    () => new StaticPluginRegistry([manifest]),
    /type: is not supported/,
  )
})

test("rejects plugin schema keywords that would otherwise be ignored", () => {
  const manifest = {
    id: "@example/invalid-keyword",
    name: "Invalid keyword",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:invalid-keyword",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: {
        type: "string",
        minimum: "1",
      },
    },
    secrets: {},
  } as unknown as PluginManifest

  assert.throws(
    () => new StaticPluginRegistry([manifest]),
    /must be a finite number|requires schema type integer or number/,
  )
})

test("returns structured issues for a malformed external manifest", () => {
  const issues = validateInstalledPluginDeclarations({}, [{
    id: "@example/malformed",
    name: null,
    version: "invalid",
    apiVersion: 1,
    kind: "feature",
    slot: "feature",
    hosts: null,
    capabilities: null,
    config: null,
    secrets: null,
  } as unknown as PluginManifest])

  assert.ok(issues.length > 0)
  assert.ok(issues.every((issue) => issue.path === "/manifests/@example~1malformed"))
  assert.match(issues.map((issue) => issue.message).join("\n"), /name must not be empty/)
})

test("rejects malformed secret metadata without throwing native errors", () => {
  const issues = validateInstalledPluginDeclarations({}, [{
    id: "@example/malformed-secret",
    name: "Malformed secret",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:malformed-secret",
    hosts: ["runtime"],
    capabilities: [],
    config: { version: 1 },
    secrets: {
      token: {
        required: "yes",
        sensitive: true,
        description: 42,
      },
    },
  } as unknown as PluginManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /required must be a boolean/,
  )
  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /description must be a string/,
  )
})

test("rejects unsupported manifest fields before comparing manifests", () => {
  const issues = validateInstalledPluginDeclarations({}, [{
    ...installedPluginManifests[0],
    unsupported: BigInt(1),
  } as unknown as PluginManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /manifest\.unsupported is not supported/,
  )
})

test("rejects non-plain manifest records", () => {
  const issues = validateInstalledPluginDeclarations({}, [new Date() as unknown as PluginManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /manifest must be an object/,
  )
})

test("returns structured issues for a null manifest", () => {
  const issues = validateInstalledPluginDeclarations({}, [null as unknown as PluginManifest])

  assert.deepEqual(issues, [{
    message: "manifest must be an object",
    path: "/manifests/invalid-0",
  }])
  assert.throws(
    () => new StaticPluginRegistry([null as unknown as PluginManifest]),
    /manifest must be an object/,
  )
})

test("rejects non-JSON plugin schema literals as structured issues", () => {
  const issues = validateInstalledPluginDeclarations({}, [{
    id: "@example/non-json-schema",
    name: "Non-JSON schema",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:non-json-schema",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: {
        enum: [BigInt(1)],
      },
    },
    secrets: {},
  } as unknown as PluginManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /must be a JSON value/,
  )
})

test("rejects non-plain plugin schema objects as structured issues", () => {
  const issues = validateInstalledPluginDeclarations({}, [{
    id: "@example/non-plain-schema",
    name: "Non-plain schema",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:non-plain-schema",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: new Date(),
    },
    secrets: {},
  } as unknown as PluginManifest])

  assert.match(
    issues.map((issue) => issue.message).join("\n"),
    /must be a schema object/,
  )
})

test("compares JSON object literals without depending on key order", () => {
  const manifest = {
    id: "@example/object-const",
    name: "Object const",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:object-const",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: {
        const: { first: 1, second: 2 },
      },
    },
    secrets: {},
  } as const satisfies PluginManifest
  const result = new StaticPluginRegistry([manifest]).resolve("runtime", {
    [manifest.id]: {
      enabled: true,
      config: { second: 2, first: 1 },
    },
  })

  assert.equal(result.status, "valid")
})

test("rejects non-JSON plugin values without throwing native errors", () => {
  const manifest = {
    id: "@example/non-json-value",
    name: "Non-JSON value",
    version: "1.0.0",
    apiVersion: 1,
    kind: "feature",
    slot: "feature:non-json-value",
    hosts: ["runtime"],
    capabilities: [],
    config: {
      version: 1,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["values"],
        properties: {
          values: {
            type: "array",
            uniqueItems: true,
            items: { type: "integer" },
          },
        },
      },
    },
    secrets: {},
  } as const satisfies PluginManifest
  const declaration = {
    enabled: true,
    config: { values: [BigInt(1), BigInt(1)] },
  } as unknown as PluginConfigurationDeclaration
  const result = new StaticPluginRegistry([manifest]).resolve("runtime", {
    [manifest.id]: declaration,
  })

  assert.equal(result.status, "invalid")
  if (result.status === "invalid") {
    assert.match(
      result.issues.map((issue) => issue.message).join("\n"),
      /must be a JSON value/,
    )
  }
})
