import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url))

export async function prepareCloudflareRoot(root = repositoryRoot) {
  const runtimeConfig = path.join(root, "apps/runtime/wrangler.toml")
  await access(runtimeConfig)
  await access(path.join(root, "apps/runtime/dist/platforms/cloudflare.js"))

  const directory = path.join(root, ".wrangler/deploy")
  const configPath = path.relative(directory, runtimeConfig).split(path.sep).join("/")
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "config.json"), `${JSON.stringify({ configPath }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareCloudflareRoot()
}
