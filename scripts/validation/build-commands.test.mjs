import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { prepareCloudflareRoot } from "../runtime/prepare-cloudflare-root.mjs"

const root = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
const runtime = JSON.parse(readFileSync(new URL("../../apps/runtime/package.json", import.meta.url), "utf8"))

test("the repository-root Cloudflare compatibility command delegates to the canonical build", () => {
  assert.equal(root.scripts["build:cf"], "pnpm runtime:build:cf && node scripts/runtime/prepare-cloudflare-root.mjs")
  assert.equal(root.scripts["runtime:build:cf"], "pnpm --filter nami-runtime build:cf")
  assert.equal(runtime.name, "nami-runtime")
  assert.equal(
    runtime.scripts["build:cf"],
    "pnpm build:platform cloudflare && node scripts/check-platform-build.mjs cloudflare platforms/cloudflare.js",
  )
})

test("all canonical Runtime provider builds remain package-scoped and build-only", () => {
  for (const provider of ["cf", "vc", "nf"]) {
    const name = `build:${provider}`
    assert.equal(root.scripts[`runtime:${name}`], `pnpm --filter nami-runtime ${name}`)
    assert.equal(typeof runtime.scripts[name], "string")
    assert.doesNotMatch(runtime.scripts[name], /\bdeploy\b|\bversions\s+upload\b/)
  }
})


test("root Wrangler discovery reuses the canonical Runtime configuration", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nami-wrangler-"))
  try {
    await assert.rejects(prepareCloudflareRoot(directory), { code: "ENOENT" })
    await mkdir(path.join(directory, "apps/runtime/dist/platforms"), { recursive: true })
    const config = "name = 'nami'\nmain = 'dist/platforms/cloudflare.js'\n"
    await writeFile(path.join(directory, "apps/runtime/wrangler.toml"), config)
    await assert.rejects(prepareCloudflareRoot(directory), { code: "ENOENT" })
    await writeFile(path.join(directory, "apps/runtime/dist/platforms/cloudflare.js"), "export default {}\n")
    await prepareCloudflareRoot(directory)
    await prepareCloudflareRoot(directory)
    const redirect = JSON.parse(await readFile(path.join(directory, ".wrangler/deploy/config.json"), "utf8"))
    assert.deepEqual(redirect, { configPath: "../../apps/runtime/wrangler.toml" })
    assert.equal(await readFile(path.join(directory, "apps/runtime/wrangler.toml"), "utf8"), config)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("Vercel app scripts delegate nested pnpm calls through Corepack", () => {
  for (const app of ["docs", "webui"]) {
    const manifest = JSON.parse(readFileSync(new URL(`../../apps/${app}/package.json`, import.meta.url), "utf8"))
    assert.equal(manifest.scripts["assets:check"], "corepack pnpm --dir ../.. assets:check")
    assert.match(manifest.scripts.build, /^corepack pnpm assets:check && /)
    for (const command of Object.values(manifest.scripts)) {
      assert.doesNotMatch(command, /(^|[;&|]\s*)pnpm\b/)
    }
    const config = JSON.parse(readFileSync(new URL(`../../apps/${app}/vercel.json`, import.meta.url), "utf8"))
    assert.equal(config.buildCommand, "corepack pnpm build")
    assert.equal(config.installCommand, "corepack pnpm -C ../.. install --frozen-lockfile")
  }
})
