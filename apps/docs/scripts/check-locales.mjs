import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const chineseRoot = path.join(docsRoot, "zh-CN")

async function collectMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === ".vitepress" || entry.name === "node_modules") {
      continue
    }

    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(entryPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath)
    }
  }

  return files
}

function toRoutePath(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join("/")
}

const allFiles = await collectMarkdownFiles(docsRoot)
const englishRoutes = allFiles
  .filter((filePath) => !filePath.startsWith(`${chineseRoot}${path.sep}`))
  .map((filePath) => toRoutePath(filePath, docsRoot))
  .filter((route) => route !== "README.md" && route !== "README.zh-CN.md")
  .sort()
const chineseRoutes = allFiles
  .filter((filePath) => filePath.startsWith(`${chineseRoot}${path.sep}`))
  .map((filePath) => toRoutePath(filePath, chineseRoot))
  .sort()

const missingChinese = englishRoutes.filter((route) => !chineseRoutes.includes(route))
const missingEnglish = chineseRoutes.filter((route) => !englishRoutes.includes(route))

if (missingChinese.length > 0 || missingEnglish.length > 0) {
  const details = [
    ...missingChinese.map((route) => `Missing Chinese page: zh-CN/${route}`),
    ...missingEnglish.map((route) => `Missing English page: ${route}`),
  ]
  throw new Error(`Documentation locale routes are not aligned:\n${details.join("\n")}`)
}

console.log(`Validated ${englishRoutes.length} bilingual documentation routes`)
