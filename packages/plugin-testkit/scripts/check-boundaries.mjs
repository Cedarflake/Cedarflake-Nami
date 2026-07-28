import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd())
const pluginApiRoot = path.join(repositoryRoot, "packages", "plugin-api")
const pluginsRoot = path.join(repositoryRoot, "plugins")
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"])
const issues = []

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectFiles(entryPath)
    }

    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  })
}

function collectPackageRoots(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }

  const packageJsonPath = path.join(directory, "package.json")

  if (fs.existsSync(packageJsonPath)) {
    return [directory]
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? collectPackageRoots(path.join(directory, entry.name)) : [],
  )
}

function getImports(filePath) {
  const source = fs.readFileSync(filePath, "utf8")
  const pattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']|\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g
  const imports = []
  let match = pattern.exec(source)

  while (match) {
    imports.push(match[1] ?? match[2])
    match = pattern.exec(source)
  }

  return imports
}

function addIssue(filePath, message) {
  issues.push(`${path.relative(repositoryRoot, filePath)}: ${message}`)
}

function resolveSourceImport(filePath, specifier) {
  if (!specifier.startsWith(".")) {
    return null
  }

  const base = path.resolve(path.dirname(filePath), specifier)
  const candidates = [
    base,
    ...[...sourceExtensions].map((extension) => `${base}${extension}`),
    ...[...sourceExtensions].map((extension) => path.join(base, `index${extension}`)),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

function getPackageRoot(specifier) {
  if (specifier.startsWith("node:")) {
    return "node:"
  }
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/")
  }
  return specifier.split("/")[0]
}

function resolveExportTarget(value) {
  if (typeof value === "string") {
    return value
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  for (const condition of ["default", "import", "node", "types"]) {
    const target = resolveExportTarget(value[condition])
    if (target) {
      return target
    }
  }
  return null
}

function checkEntryBoundary(packageRoot, exportName, entryPath) {
  const forbiddenRoots = new Set(["mongodb", "next", "postgres", "react", "react-dom"])
  if (
    exportName === "./config"
    || exportName === "./installation"
    || exportName === "./manifest"
  ) {
    forbiddenRoots.add("@cloudflare/workers-types")
    forbiddenRoots.add("@netlify/edge-functions")
    forbiddenRoots.add("@vercel/functions")
    forbiddenRoots.add("node:")
  }
  if (exportName === "./runtime") {
    forbiddenRoots.add("node:")
  }

  const pending = [entryPath]
  const visited = new Set()
  while (pending.length > 0) {
    const filePath = pending.pop()
    if (!filePath || visited.has(filePath)) {
      continue
    }
    visited.add(filePath)

    for (const specifier of getImports(filePath)) {
      const sourceImport = resolveSourceImport(filePath, specifier)
      if (sourceImport && sourceImport.startsWith(packageRoot)) {
        pending.push(sourceImport)
        continue
      }
      const packageName = getPackageRoot(specifier)
      if (forbiddenRoots.has(packageName)) {
        addIssue(filePath, `${exportName} cannot import ${specifier}`)
      }
    }
  }
}

for (const filePath of collectFiles(path.join(pluginApiRoot, "src"))) {
  for (const specifier of getImports(filePath)) {
    if (specifier.startsWith("@i0c/") || specifier.includes("apps/")) {
      addIssue(filePath, `plugin-api cannot import ${specifier}`)
    }
  }
}

for (const packageRoot of collectPackageRoots(pluginsRoot)) {
  const packageJsonPath = path.join(packageRoot, "package.json")
  const packageJson = readJson(packageJsonPath)
  const dependencies = packageJson.dependencies ?? {}

  if (!("@i0c/plugin-api" in dependencies)) {
    addIssue(packageJsonPath, "plugin packages must depend on @i0c/plugin-api")
  }

  if ("@i0c/plugin-testkit" in dependencies) {
    addIssue(packageJsonPath, "@i0c/plugin-testkit must be a development dependency")
  }

  for (const dependency of Object.keys(dependencies)) {
    if (
      dependency.startsWith("@i0c/plugin-")
      && dependency !== "@i0c/plugin-api"
      && dependency !== "@i0c/plugin-sdk"
    ) {
      addIssue(
        packageJsonPath,
        `plugin packages must communicate through the host instead of depending on ${dependency}`,
      )
    }
  }

  for (const exportName of [
    "./config",
    "./installation",
    "./manifest",
    "./runtime",
  ]) {
    const exportPath = resolveExportTarget(packageJson.exports?.[exportName])
    if (exportPath) {
      checkEntryBoundary(
        packageRoot,
        exportName,
        path.resolve(packageRoot, exportPath),
      )
    }
  }

  for (const filePath of collectFiles(path.join(packageRoot, "src"))) {
    for (const specifier of getImports(filePath)) {
      if (
        specifier === "i0c-redirect-worker" ||
        specifier === "i0c.cc-webui" ||
        specifier.startsWith("@/") ||
        specifier.includes("apps/runtime") ||
        specifier.includes("apps/webui")
      ) {
        addIssue(filePath, `plugin source cannot import host internals through ${specifier}`)
      }
    }
  }
}

if (issues.length > 0) {
  console.error("Plugin dependency boundary check failed:")
  console.error(issues.map((issue) => `- ${issue}`).join("\n"))
  process.exitCode = 1
} else {
  console.log("Plugin dependency boundaries are valid.")
}
