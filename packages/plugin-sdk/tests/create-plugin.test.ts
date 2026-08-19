import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import ts from "typescript"

import {
  createPluginPackage,
  parseCliOptions,
} from "../scripts/create-plugin.mjs"

const repositoryRoot = path.resolve(import.meta.dirname, "../../..")
const pluginKinds = [
  "analytics-sink",
  "analytics-store",
  "data-repository",
  "data-source",
  "feature",
  "runtime-platform",
] as const

test("creates every supported plugin package shape", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nami-plugin-sdk-"))

  try {
    for (const kind of pluginKinds) {
      const name = `fixture-${kind}`
      const result = createPluginPackage({
        kind,
        name,
        root,
        scope: "@example",
      })
      const packageJsonPath = path.join(result.targetDirectory, "package.json")
      const manifestPath = path.join(result.targetDirectory, "src", "manifest.ts")
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, "utf8"),
      ) as { dependencies: Record<string, string>; name: string }

      assert.equal(packageJson.name, result.packageName)
      assert.equal(packageJson.dependencies["@nami/plugin-api"], "workspace:*")
      assert.equal(packageJson.dependencies["@nami/plugin-sdk"], "workspace:*")
      assert.match(
        fs.readFileSync(manifestPath, "utf8"),
        /define[A-Za-z]+Manifest/,
      )
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("generates type-safe source for every supported plugin kind", () => {
  const root = fs.mkdtempSync(
    path.join(process.cwd(), ".plugin-sdk-generated-"),
  )

  try {
    for (const kind of pluginKinds) {
      const result = createPluginPackage({
        kind,
        name: `typed-${kind}`,
        root,
      })
      const configPath = path.join(result.targetDirectory, "tsconfig.json")
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
      assert.equal(configFile.error, undefined)
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        result.targetDirectory,
      )
      const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: {
          ...parsed.options,
          paths: {
            "@nami/plugin-testkit": [
              path.join(
                repositoryRoot,
                "packages/plugin-testkit/src/index.ts",
              ),
            ],
          },
        },
      })
      const diagnostics = ts.getPreEmitDiagnostics(program)

      assert.deepEqual(
        diagnostics.map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
        [],
        `${kind} scaffold must type-check`,
      )
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("supports dry runs without changing the filesystem", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nami-plugin-sdk-"))

  try {
    const result = createPluginPackage({
      dryRun: true,
      kind: "feature",
      name: "fixture",
      root,
    })

    assert.equal(fs.existsSync(result.targetDirectory), false)
    assert.ok(result.files.includes("src/plugin.ts"))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("rejects unsafe names and existing targets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nami-plugin-sdk-"))

  try {
    assert.throws(
      () => createPluginPackage({
        kind: "feature",
        name: "../escape",
        root,
      }),
      /kebab-case/,
    )

    createPluginPackage({
      kind: "feature",
      name: "existing",
      root,
    })
    assert.throws(
      () => createPluginPackage({
        kind: "feature",
        name: "existing",
        root,
      }),
      /already exists/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("parses the documented command shape", () => {
  assert.deepEqual(
    parseCliOptions([
      "--kind",
      "feature",
      "--name",
      "request-sampler",
      "--dry-run",
    ]),
    {
      dryRun: true,
      kind: "feature",
      name: "request-sampler",
      root: undefined,
      scope: "@nami",
    },
  )
})
