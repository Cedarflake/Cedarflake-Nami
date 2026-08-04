import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import Ajv, { type AnySchema, type ErrorObject } from "ajv"
import addFormats from "ajv-formats"

import { validateRedirectsConfig } from "@i0c/config"

interface RedirectSource {
  label: string
  content: string
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "../..")
const defaultSchemaPath = path.join(repoRoot, "packages/config/redirects.schema.json")
const defaultSource = "origin/data:redirects.json"
const userArgs = process.argv.slice(2).filter((arg) => arg !== "--")

function printHelp() {
  console.log(`Usage: pnpm data:validate:redirects [source] [--source <source>] [--schema <schema>]

Sources can be local JSON files or git object refs such as origin/data:redirects.json.

Examples:
  pnpm data:validate:redirects
  pnpm data:validate:redirects -- --source origin/data:redirects.json
  pnpm data:validate:redirects -- ./redirects.json
`)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const inlineArg = userArgs.find((item) => item.startsWith(prefix))

  if (inlineArg) {
    return inlineArg.slice(prefix.length)
  }

  const separateArgIndex = userArgs.indexOf(`--${name}`)
  if (separateArgIndex >= 0) {
    return userArgs[separateArgIndex + 1]
  }

  return undefined
}

function readSource(source: string): RedirectSource {
  const resolved = path.resolve(process.cwd(), source)

  if (fs.existsSync(resolved)) {
    return {
      label: resolved,
      content: readJsonFile(resolved, "redirect config"),
    }
  }

  if (source.includes(":")) {
    try {
      return {
        label: source,
        content: execFileSync("git", ["show", source], {
          cwd: repoRoot,
          encoding: "utf8",
        }),
      }
    } catch (error) {
      throw new Error(
        `Failed to read redirect config from git ref ${source}: ${getErrorMessage(error)}`,
        { cause: error },
      )
    }
  }

  throw new Error(`Redirect config source not found: ${source}`)
}

function readJsonFile(filePath: string, label: string): string {
  try {
    return fs.readFileSync(filePath, "utf8")
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${getErrorMessage(error)}`, { cause: error })
  }
}

function parseJson(content: string, label: string): unknown {
  try {
    return JSON.parse(content) as unknown
  } catch (error) {
    throw new Error(`Failed to parse ${label} as JSON: ${getErrorMessage(error)}`, { cause: error })
  }
}

function formatErrors(errors: readonly ErrorObject[]): string {
  return errors
    .slice(0, 8)
    .map((error) => {
      const location = error.instancePath || "/"
      const message = error.message ?? "failed validation"
      return `- ${location} ${message}`
    })
    .join("\n")
}

function isPositionalSourceArg(arg: string, index: number): boolean {
  return !arg.startsWith("--") && userArgs[index - 1] !== "--source" && userArgs[index - 1] !== "--schema"
}

const source =
  readArg("source")
  ?? userArgs.find((arg, index) => isPositionalSourceArg(arg, index))
  ?? defaultSource

function main() {
  if (userArgs.includes("--help") || userArgs.includes("-h")) {
    printHelp()
    return
  }

  const schemaPath = path.resolve(process.cwd(), readArg("schema") ?? defaultSchemaPath)
  const schema = parseJson(readJsonFile(schemaPath, "schema"), schemaPath)
  const input = readSource(source)
  const data = parseJson(input.content, input.label)
  const ajv = new Ajv({ allErrors: true, strict: false })

  addFormats(ajv)

  const validate = ajv.compile(schema as AnySchema)
  const isSchemaValid = validate(data)

  if (!isSchemaValid) {
    const errors = validate.errors ?? []
    console.error(`Redirect config failed schema validation: ${input.label}`)
    console.error(formatErrors(errors))

    if (errors.length > 8) {
      console.error(`... and ${errors.length - 8} more`)
    }

    process.exitCode = 1
    return
  }

  const sharedResult = validateRedirectsConfig(data)
  if (sharedResult.status === "invalid") {
    console.error(`Redirect config failed semantic validation: ${input.label}`)
    for (const issue of sharedResult.issues.slice(0, 8)) {
      console.error(`- ${issue.path} ${issue.message}`)
    }

    if (sharedResult.issues.length > 8) {
      console.error(`... and ${sharedResult.issues.length - 8} more`)
    }

    process.exitCode = 1
    return
  }

  console.log(`Redirect config validation passed: ${input.label}`)
}

try {
  main()
} catch (error) {
  console.error(getErrorMessage(error))
  process.exitCode = 1
}
