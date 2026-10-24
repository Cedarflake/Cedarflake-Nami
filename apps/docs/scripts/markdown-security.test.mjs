import assert from "node:assert/strict"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads"

const docsRoot = fileURLToPath(new URL("../", import.meta.url))

if (!isMainThread) {
  const require = createRequire(import.meta.url)
  const requireFromVitePress = createRequire(require.resolve("vitepress"))
  const packagePath = requireFromVitePress.resolve("markdown-it/package.json")
  assert.equal(requireFromVitePress("markdown-it/package.json").version, "14.3.3")
  const { default: MarkdownIt } = await import(
    pathToFileURL(path.join(path.dirname(packagePath), "index.mjs")).href
  )
  const { createMarkdownRenderer } = await import("vitepress")
  const md = await createMarkdownRenderer(docsRoot, {
    typographer: true,
    highlight: (code) => code,
  })
  assert.equal(md.constructor, MarkdownIt, "VitePress must use the patched parser")
  parentPort.postMessage(md.render(workerData))
} else {
  function render(markdown) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: markdown,
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      })
      const timer = setTimeout(() => {
        void worker.terminate()
        reject(new Error("VitePress rendering exceeded the 15 second limit"))
      }, 15_000)
      worker.once("message", (html) => {
        clearTimeout(timer)
        resolve(html)
      })
      worker.once("error", (error) => {
        clearTimeout(timer)
        reject(error)
      })
      worker.once("exit", (code) => {
        clearTimeout(timer)
        if (code !== 0) reject(new Error(`Markdown worker exited with ${code}`))
      })
    })
  }

  test("VitePress preserves its plugins with the external security-patched parser", async () => {
    const html = await render([
      "# Nami 文档",
      "",
      "::: tip",
      "**English** and 中文 with [reference][guide].",
      ":::",
      "",
      "| Runtime | 状态 |",
      "| --- | --- |",
      "| Cloudflare | Ready |",
      "",
      "`inline code` and <span>HTML</span>.",
      "",
      "[guide]: https://example.com/guide",
    ].join("\n"))
    assert.match(html, /header-anchor/)
    assert.match(html, /Nami 文档/)
    assert.match(html, /tip custom-block/)
    assert.match(html, /<strong>English<\/strong>/)
    assert.match(html, /<table tabindex="0">/)
    assert.match(html, /href="https:\/\/example\.com\/guide"/)
    assert.match(html, /<code>inline code<\/code>/)
    assert.match(html, /<span>HTML<\/span>/)
  })

  // Adapted from markdown-it's MIT-licensed 14.3.3 pathological tests:
  // https://github.com/markdown-it/markdown-it/blob/14.3.3/test/markdown-it/pathological.test.mjs
  const pathologicalCases = [
    ["unclosed inline HTML", "<b></" + "<!--".repeat(30_000)],
    ["multiline reference title", '[a]: /u "' + "x\n".repeat(60_000) + '"'],
    ["linkified soft breaks", "ping a@b.co ok\n".repeat(10_000)],
    ["unregistered link schemes", "a://".repeat(30_000)],
    ["long quote run", '"'.repeat(60_000)],
    ["mismatched smart quotes", '"a '.repeat(30_000) + "b' ".repeat(30_000)],
  ]
  for (const [name, markdown] of pathologicalCases) {
    test(`VitePress bounds ${name}`, async () => {
      assert.equal(typeof await render(markdown), "string")
    })
  }
}
