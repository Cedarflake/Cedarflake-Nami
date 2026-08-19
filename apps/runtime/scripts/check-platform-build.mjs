import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const runtimeRoot = path.resolve(import.meta.dirname, "..")
const platform = process.argv[2]
const expectedEntry = process.argv[3]
const allowAdditionalEntries = process.argv.includes("--allow-additional")
const requiredMarkers = process.argv
  .slice(4)
  .filter((argument) => argument !== "--allow-additional")

if (!platform || !expectedEntry) {
  throw new Error("Runtime platform and expected entry are required")
}

const distRoot = path.join(runtimeRoot, "dist")
const javaScriptEntries = collectJavaScriptEntries(distRoot)
  .filter((entry) => !entry.startsWith("netlify/"))

if (!javaScriptEntries.includes(expectedEntry)) {
  throw new Error(
    `Expected ${expectedEntry}, found ${javaScriptEntries.join(", ") || "no JavaScript output"}`,
  )
}

if (!allowAdditionalEntries && javaScriptEntries.length !== 1) {
  throw new Error(
    `Expected only ${expectedEntry}, found ${javaScriptEntries.join(", ") || "no JavaScript output"}`,
  )
}

const source = fs.readFileSync(path.join(distRoot, expectedEntry), "utf8")
const forbiddenMarkers = [
  "@nami/runtime-build/config",
  "from \"postgres\"",
  "from 'postgres'",
  "from \"zod\"",
  "from 'zod'",
  "react-dom",
  "next/server",
]
if (platform !== "vercel") {
  forbiddenMarkers.push("@vercel/functions")
}

for (const marker of forbiddenMarkers) {
  if (source.includes(marker)) {
    throw new Error(`${expectedEntry} contains forbidden dependency marker ${marker}`)
  }
}

if (/(?:^|\n)import\s/.test(source)) {
  throw new Error(`${expectedEntry} contains an unresolved static import`)
}

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`${expectedEntry} is missing required plugin marker ${marker}`)
  }
}

console.log(
  allowAdditionalEntries
    ? `${platform} Runtime build contains ${expectedEntry}`
    : `${platform} Runtime build contains only ${expectedEntry}`,
)

function collectJavaScriptEntries(directory) {
  if (!fs.existsSync(directory)) {
    return []
  }
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectJavaScriptEntries(entryPath)
    }
    return entry.name.endsWith(".js")
      ? [path.relative(distRoot, entryPath).replaceAll(path.sep, "/")]
      : []
  })
}
