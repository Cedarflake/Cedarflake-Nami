import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

import { defaultDataConfig, validateDataConfig } from "@nami/config"
import Ajv2020, { type AnySchema } from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

const schemaPath = path.resolve(process.cwd(), "../../packages/config/config.schema.json")
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as AnySchema
const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validateSchema = ajv.compile(schema)

const invalidCases = [
  {
    name: "canonical origin credentials",
    config: {
      ...defaultDataConfig,
      runtime: {
        ...defaultDataConfig.runtime,
        canonicalOrigin: "https://user@example.com",
      },
    },
  },
  {
    name: "empty hostname label",
    config: {
      ...defaultDataConfig,
      analytics: {
        ...defaultDataConfig.analytics,
        sourceId: "api..i0c.cc",
      },
    },
  },
  {
    name: "hostname label beginning with a hyphen",
    config: {
      ...defaultDataConfig,
      analytics: {
        ...defaultDataConfig.analytics,
        sourceId: "-api.i0c.cc",
      },
    },
  },
  {
    name: "hostname label longer than 63 characters",
    config: {
      ...defaultDataConfig,
      analytics: {
        ...defaultDataConfig.analytics,
        sourceId: `${"a".repeat(64)}.i0c.cc`,
      },
    },
  },
  {
    name: "non-numeric blocked GitHub user ID",
    config: {
      ...defaultDataConfig,
      webui: {
        access: {
          ...defaultDataConfig.webui.access,
          blockedGitHubUserIds: ["not-a-github-id"],
        },
      },
    },
  },
  {
    name: "duplicate blocked GitHub user IDs",
    config: {
      ...defaultDataConfig,
      webui: {
        access: {
          ...defaultDataConfig.webui.access,
          blockedGitHubUserIds: ["99999999", "99999999"],
        },
      },
    },
  },
] as const

test("accepts the default data config in both validators", () => {
  assert.equal(validateSchema(defaultDataConfig), true)
  assert.equal(validateDataConfig(defaultDataConfig).status, "valid")
})

test("accepts an existing config without a blocked user list", () => {
  const config = {
    ...defaultDataConfig,
    webui: {
      access: {
        mode: defaultDataConfig.webui.access.mode,
        managerGitHubUserIds:
          defaultDataConfig.webui.access.managerGitHubUserIds,
      },
    },
  }

  assert.equal(validateSchema(config), true)
  assert.equal(validateDataConfig(config).status, "valid")
})

for (const invalidCase of invalidCases) {
  test(`rejects ${invalidCase.name} in both validators`, () => {
    assert.equal(validateSchema(invalidCase.config), false)
    assert.equal(validateDataConfig(invalidCase.config).status, "invalid")
  })
}
