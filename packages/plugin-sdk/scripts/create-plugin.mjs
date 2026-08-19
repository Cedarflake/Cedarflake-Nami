#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"

const pluginKinds = {
  "analytics-sink": {
    category: "sink",
    manifestHelper: "defineAnalyticsSinkManifest",
    packageSegment: "analytics-sink",
    pluginHelper: "defineRuntimeAnalyticsSinkPlugin",
    registrationTarget: "nami.runtime.config.ts",
    surface: "runtime",
  },
  "analytics-store": {
    category: "store",
    manifestHelper: "defineAnalyticsStoreManifest",
    packageSegment: "analytics-store",
    pluginHelper: "defineWebUiAnalyticsStorePlugin",
    registrationTarget: "nami.webui.config.ts",
    surface: "webui",
  },
  "data-repository": {
    category: "repository",
    manifestHelper: "defineDataRepositoryManifest",
    packageSegment: "data-repository",
    pluginHelper: "defineWebUiDataRepositoryPlugin",
    registrationTarget: "nami.webui.config.ts",
    surface: "webui",
  },
  "data-source": {
    category: "source",
    manifestHelper: "defineDataSourceManifest",
    packageSegment: "data-source",
    pluginHelper: "defineRuntimeDataSourcePlugin",
    registrationTarget: "nami.runtime.config.ts",
    surface: "runtime",
  },
  feature: {
    category: "feature",
    manifestHelper: "defineRuntimeFeatureManifest",
    packageSegment: "feature",
    pluginHelper: "defineRuntimeFeaturePlugin",
    registrationTarget: "nami.runtime.config.ts",
    surface: "runtime",
  },
  "runtime-platform": {
    category: "runtime",
    manifestHelper: "defineRuntimePlatformManifest",
    packageSegment: "runtime",
    pluginHelper: "defineRuntimePlatformPlugin",
    registrationTarget: "nami.runtime.config.ts",
    surface: "runtime",
  },
}

export function createPluginPackage(options) {
  const definition = resolvePluginDefinition(options)
  const files = createFiles(definition)

  if (!options.dryRun) {
    if (fs.existsSync(definition.targetDirectory)) {
      throw new Error(`Plugin directory already exists: ${definition.targetDirectory}`)
    }

    fs.mkdirSync(path.dirname(definition.targetDirectory), { recursive: true })
    let hasCreatedTarget = false
    try {
      fs.mkdirSync(definition.targetDirectory)
      hasCreatedTarget = true
      for (const [relativePath, content] of files) {
        const filePath = path.join(definition.targetDirectory, relativePath)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, content, "utf8")
      }
    } catch (error) {
      if (hasCreatedTarget) {
        fs.rmSync(definition.targetDirectory, {
          recursive: true,
          force: true,
        })
      }
      throw error
    }
  }

  return {
    files: [...files.keys()],
    packageName: definition.packageName,
    registrationTarget: definition.kind.registrationTarget,
    targetDirectory: definition.targetDirectory,
  }
}

export function parseCliOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": {
        type: "boolean",
        default: false,
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
      kind: {
        type: "string",
        short: "k",
      },
      name: {
        type: "string",
        short: "n",
      },
      root: {
        type: "string",
      },
      scope: {
        type: "string",
        default: "@nami",
      },
    },
    strict: true,
  })

  if (values.help) {
    return { help: true }
  }
  if (!values.kind || !values.name) {
    throw new Error("--kind and --name are required")
  }

  return {
    dryRun: values["dry-run"],
    kind: values.kind,
    name: values.name,
    root: values.root,
    scope: values.scope,
  }
}

export function resolvePluginDefinition(options) {
  if (!isPluginKind(options.kind)) {
    throw new Error(
      `Unsupported plugin kind ${options.kind}. Expected one of: ${Object.keys(pluginKinds).join(", ")}`,
    )
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.name)) {
    throw new Error("Plugin name must use kebab-case")
  }
  const scope = options.scope ?? "@nami"
  if (!/^@[a-z0-9][a-z0-9._-]*$/.test(scope)) {
    throw new Error("Plugin scope must be a valid lowercase npm scope")
  }

  const repositoryRoot = path.resolve(options.root ?? process.cwd())
  const kind = pluginKinds[options.kind]
  const targetDirectory = path.resolve(
    repositoryRoot,
    "plugins",
    kind.category,
    options.name,
  )
  const pluginsRoot = path.resolve(repositoryRoot, "plugins")
  const relativeTarget = path.relative(pluginsRoot, targetDirectory)
  if (
    relativeTarget.startsWith("..")
    || path.isAbsolute(relativeTarget)
    || relativeTarget === ""
  ) {
    throw new Error("Plugin target must stay inside the repository plugins directory")
  }

  const symbolBase = toPascalCase(options.name)
  const identifierBase = toCamelCase(options.name)
  const packageName = `${scope}/plugin-${kind.packageSegment}-${options.name}`

  return {
    identifierBase,
    kind,
    name: options.name,
    packageName,
    pluginKind: options.kind,
    symbolBase,
    targetDirectory,
  }
}

function createFiles(definition) {
  return new Map([
    ["package.json", `${JSON.stringify(createPackageJson(definition), null, 2)}\n`],
    ["tsconfig.json", `${JSON.stringify(createTsConfig(), null, 2)}\n`],
    ["README.md", createPluginReadme(definition, "en")],
    ["README.zh-CN.md", createPluginReadme(definition, "zh-CN")],
    ["src/config.ts", createConfigSource(definition)],
    ["src/manifest.ts", createManifestSource(definition)],
    ["src/plugin.ts", createPluginSource(definition)],
    ["tests/manifest.test.ts", createManifestTestSource(definition)],
  ])
}

function createPackageJson(definition) {
  return {
    name: definition.packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    license: "Apache-2.0",
    exports: {
      "./config": "./src/config.ts",
      "./manifest": "./src/manifest.ts",
      "./plugin": "./src/plugin.ts",
    },
    sideEffects: false,
    scripts: {
      build: "tsc --noEmit",
      check: "tsc --noEmit",
      test: "tsx --test tests/**/*.test.ts",
    },
    dependencies: {
      "@nami/plugin-api": "workspace:*",
      "@nami/plugin-sdk": "workspace:*",
    },
    devDependencies: {
      "@nami/plugin-testkit": "workspace:*",
      "@types/node": "^25.5.0",
      tsx: "^4.21.0",
      typescript: "^6.0.2",
    },
  }
}

function createTsConfig() {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      noEmit: true,
      isolatedModules: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["src/**/*.ts", "tests/**/*.ts"],
  }
}

function createPluginReadme(definition, locale) {
  const title = `${toTitleCase(definition.name)} plugin`
  const isChinese = locale === "zh-CN"
  return isChinese
    ? `# ${title}\n\n这是一个由 \`@nami/plugin-sdk\` 生成的 ${definition.pluginKind} 插件骨架。\n\n## 接入\n\n在 \`${definition.kind.registrationTarget}\` 中显式导入并启用 \`${definition.packageName}\`。生成器不会自动改变当前部署。\n\n## 检查\n\n\`\`\`bash\npnpm --filter ${definition.packageName} check\npnpm --filter ${definition.packageName} test\n\`\`\`\n`
    : `# ${title}\n\nThis is a ${definition.pluginKind} plugin scaffold generated by \`@nami/plugin-sdk\`.\n\n## Installation\n\nImport and enable \`${definition.packageName}\` explicitly in \`${definition.kind.registrationTarget}\`. The generator does not change the active deployment automatically.\n\n## Checks\n\n\`\`\`bash\npnpm --filter ${definition.packageName} check\npnpm --filter ${definition.packageName} test\n\`\`\`\n`
}

function createConfigSource(definition) {
  return `import { definePluginConfiguration } from "@nami/plugin-sdk"

export type ${definition.symbolBase}Config = Record<string, never>

export const ${definition.identifierBase}Configuration =
  definePluginConfiguration<${definition.symbolBase}Config>({
    version: 1,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
    defaults: {},
    resolve() {
      return {}
    },
  })
`
}

function createManifestSource(definition) {
  const provider = definition.pluginKind === "runtime-platform"
    ? `\n  provider: "${definition.name}",`
    : ""
  const slot = definition.pluginKind === "feature"
    ? `\n  slot: "feature:${definition.name}",`
    : ""

  return `import { ${definition.kind.manifestHelper} } from "@nami/plugin-sdk"

import { ${definition.identifierBase}Configuration } from "./config"

export const ${toConstantCase(definition.name)}_PLUGIN_ID =
  "${definition.packageName}"

export const ${definition.identifierBase}Manifest =
  ${definition.kind.manifestHelper}({
    id: ${toConstantCase(definition.name)}_PLUGIN_ID,
    name: "${toTitleCase(definition.name)}",
    version: "0.1.0",${provider}${slot}
    capabilities: [],
    description: {
      summary: {
        en: "Describe what this plugin provides.",
        "zh-CN": "说明此插件提供的能力。",
      },
    },
    config: ${definition.identifierBase}Configuration.manifest,
    secrets: {},
  })
`
}

function createPluginSource(definition) {
  const helperImport = definition.kind.pluginHelper
  const surface = definition.kind.surface
  const body = createPluginBody(definition)

  return `import { ${helperImport} } from "@nami/plugin-sdk/${surface}"

import { ${definition.identifierBase}Configuration } from "./config"
import { ${definition.identifierBase}Manifest } from "./manifest"

export const ${definition.identifierBase}Plugin = ${helperImport}({
  manifest: ${definition.identifierBase}Manifest,
${body}})
`
}

function createPluginBody(definition) {
  const configLine =
    `    const config = ${definition.identifierBase}Configuration.resolve(value)\n`

  switch (definition.pluginKind) {
    case "data-source":
      return `  create(value) {
${configLine}
    void config
    return {
      async loadConfig() {
        return null
      },
      async loadRules() {
        return null
      },
    }
  },
`
    case "analytics-sink":
      return `  create(value) {
${configLine}
    void config
    return {
      emit() {
        return Promise.resolve()
      },
    }
  },
`
    case "feature":
      return `  create(value) {
${configLine}
    void config
    return {
      id: ${definition.identifierBase}Manifest.id,
      order: 1000,
      timeoutMs: 50,
      failurePolicy: "continue",
      hooks: {},
    }
  },
`
    case "runtime-platform":
      return `  create(handler) {
    return (request: Request) => handler(request, {
      provider: ${definition.identifierBase}Manifest.provider,
    })
  },
`
    case "data-repository":
      return `  create() {
    return {
      async read() {
        throw new Error("Implement ${definition.packageName} read")
      },
      async write() {
        throw new Error("Implement ${definition.packageName} write")
      },
      async readSnapshot() {
        throw new Error("Implement ${definition.packageName} readSnapshot")
      },
    }
  },
`
    case "analytics-store":
      return `  create(context) {
    const config = ${definition.identifierBase}Configuration.resolve(
      context.declaration.config,
    )
    void config
    return null
  },
`
  }
}

function createManifestTestSource(definition) {
  return `import test from "node:test"

import { assertPluginManifest } from "@nami/plugin-testkit"

import { ${definition.identifierBase}Manifest } from "../src/manifest"

test("exposes a valid plugin manifest", () => {
  assertPluginManifest(${definition.identifierBase}Manifest)
})
`
}

function isPluginKind(value) {
  return Object.prototype.hasOwnProperty.call(pluginKinds, value)
}

function toPascalCase(value) {
  return value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("")
}

function toCamelCase(value) {
  const pascal = toPascalCase(value)
  return `${pascal[0]?.toLowerCase() ?? ""}${pascal.slice(1)}`
}

function toConstantCase(value) {
  return value.replaceAll("-", "_").toUpperCase()
}

function toTitleCase(value) {
  return value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

function printHelp() {
  console.log(`Create a nami compile-time plugin package.

Usage:
  pnpm plugin:create --kind <kind> --name <kebab-name>

Options:
  -k, --kind <kind>   ${Object.keys(pluginKinds).join(" | ")}
  -n, --name <name>   Plugin package suffix in kebab-case
      --scope <scope> npm scope (default: @nami)
      --root <path>   Repository root (default: current directory)
      --dry-run       Show files without writing them
  -h, --help          Show this help
`)
}

async function runCli() {
  try {
    const options = parseCliOptions(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }

    const result = createPluginPackage(options)
    const action = options.dryRun ? "Would create" : "Created"
    console.log(`${action} ${result.packageName}`)
    console.log(`Directory: ${result.targetDirectory}`)
    console.log(`Files:\n${result.files.map((file) => `- ${file}`).join("\n")}`)
    console.log(`Next: register the plugin in ${result.registrationTarget}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectExecution) {
  await runCli()
}
