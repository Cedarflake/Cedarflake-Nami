import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../", import.meta.url))
const [app, command] = process.argv.slice(2)
assert.ok(app === "apps/docs" || app === "apps/webui")
assert.ok(command === "check" || command === "build")
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))
const expected = manifest.packageManager.match(/^pnpm@([^+]+)/)?.[1]
assert.ok(expected, "The workspace must pin pnpm")
const guard = await mkdtemp(path.join(os.tmpdir(), "nami-corepack-"))

try {
  // Reproduce hosts whose global pnpm differs from Corepack's selected version.
  const shim = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  const content = process.platform === "win32"
    ? "@echo Unexpected bare pnpm invocation >&2\r\n@exit /b 86\r\n"
    : "#!/bin/sh\necho 'Unexpected bare pnpm invocation' >&2\nexit 86\n"
  await writeFile(path.join(guard, shim), content, { mode: 0o755 })
  const options = {
    cwd: path.join(root, app),
    env: { ...process.env, PATH: `${guard}${path.delimiter}${process.env.PATH ?? ""}` },
  }
  const bare = spawnSync("pnpm", ["--version"], { ...options, encoding: "utf8" })
  assert.equal(bare.status, 86, "The test must intercept the global pnpm executable")
  const version = spawnSync("corepack", ["pnpm", "--version"], { ...options, encoding: "utf8" })
  assert.ifError(version.error)
  assert.equal(version.status, 0, version.stderr)
  assert.equal(version.stdout.trim(), expected)
  const build = spawnSync("corepack", ["pnpm", command], { ...options, stdio: "inherit" })
  assert.ifError(build.error)
  assert.equal(build.status, 0, `${app} ${command} must succeed without global pnpm`)
} finally {
  await rm(guard, { recursive: true, force: true })
}
