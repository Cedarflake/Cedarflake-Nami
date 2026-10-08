import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const root = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))
const runtime = JSON.parse(readFileSync(new URL("../../apps/runtime/package.json", import.meta.url), "utf8"))

test("the repository-root Cloudflare compatibility command delegates to the canonical build", () => {
  assert.equal(root.scripts["build:cf"], "pnpm runtime:build:cf")
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
