"use strict"

// Regression coverage for the local braces@3.0.3 patch, GHSA-vfj7-8cjw-p6xm.
// Usage: node scripts/check-braces-security.cjs [braces package directory]
// Optional second argument: unpatched braces@3.0.3 for differential testing.
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("node_modules/.pnpm/node_modules/braces")
assert.ok(
  fs.existsSync(path.join(target, "package.json")),
  `Missing local braces installation: ${target}`,
)
const braces = require(target)
assert.equal(require(path.join(target, "package.json")).version, "3.0.3")
const baseline = process.argv[3] ? require(path.resolve(process.argv[3])) : null
const MAX_DEPTH = 100
let checks = 0

function check(label, callback) {
  try {
    callback()
    checks++
  } catch (error) {
    error.message = `${label}: ${error.message}`
    throw error
  }
}

function isDepthError(error) {
  return (
    error instanceof SyntaxError &&
    error.message === "Nesting depth exceeds max depth (100)"
  )
}

function nested(depth, kind = "brace") {
  if (kind === "paren") return "(".repeat(depth) + "x" + ")".repeat(depth)
  if (kind === "mixed") {
    const pairs = Array.from({ length: depth }, (_, i) =>
      i % 2 ? ["(", ")"] : ["{", "}"],
    )
    return (
      pairs.map((pair) => pair[0]).join("") +
      "x" +
      pairs
        .reverse()
        .map((pair) => pair[1])
        .join("")
    )
  }
  return "{".repeat(depth) + "x" + "}".repeat(depth)
}

function astWithDepth(depth) {
  const root = { type: "root", nodes: [] }
  let parent = root
  for (let i = 0; i < depth; i++) {
    const node = {
      type: "brace",
      open: true,
      close: true,
      commas: 0,
      ranges: 0,
      nodes: [],
    }
    parent.nodes.push(node)
    parent = node
    node.nodes.push({ type: "open", value: "{" })
  }
  parent.nodes.push({ type: "text", value: "x" })
  let node = root.nodes[0]
  while (node) {
    node.nodes.push({ type: "close", value: "}" })
    node = node.nodes.find((child) => child.type === "brace")
  }
  return root
}

const stringApis = {
  parse: (input) => braces.parse(input),
  compile: (input) => braces.compile(input),
  expand: (input) => braces.expand(input),
  stringify: (input) => braces.stringify(input),
  create: (input) => braces.create(input),
  default: (input) => braces(input),
  expanded: (input) => braces(input, { expand: true }),
  array: (input) => braces(["{a,b}", input]),
}
for (const [api, run] of Object.entries(stringApis)) {
  for (const kind of ["brace", "paren", "mixed"]) {
    check(`${api} accepts depth ${MAX_DEPTH} ${kind}`, () =>
      assert.doesNotThrow(() => run(nested(MAX_DEPTH, kind))),
    )
    for (const depth of [MAX_DEPTH + 1, 4000, 4999]) {
      check(`${api} rejects depth ${depth} ${kind}`, () =>
        assert.throws(() => run(nested(depth, kind)), isDepthError),
      )
    }
  }
  for (const input of ["{".repeat(101), "(".repeat(101), "{(".repeat(51)]) {
    check(`${api} rejects unclosed nesting`, () =>
      assert.throws(() => run(input), isDepthError),
    )
  }
}
for (const api of ["compile", "expand", "stringify"]) {
  check(`${api} accepts boundary AST`, () => {
    const result = braces[api](astWithDepth(MAX_DEPTH))
    assert.deepEqual(
      result,
      api === "expand" ? [nested(MAX_DEPTH)] : nested(MAX_DEPTH),
    )
  })
  for (const depth of [101, 4000]) {
    check(`${api} guards direct AST depth ${depth}`, () =>
      assert.throws(() => braces[api](astWithDepth(depth)), isDepthError),
    )
  }
  check(`${api} guards cyclic AST child links`, () => {
    const ast = { type: "root", nodes: [] }
    ast.nodes.push(ast)
    assert.throws(() => braces[api](ast), isDepthError)
  })
}

const cases = [
  ["a/{b,c}/d", {}, "a/(b|c)/d", ["a/b/d", "a/c/d"]],
  ["x{1..3}y", {}, "x([1-3])y", ["x1y", "x2y", "x3y"]],
  ["{03..01}", {}, "(0[1-3])", ["03", "02", "01"]],
  ["{a..e..2}", {}, "(a|c|e)", ["a", "c", "e"]],
  ["{a,{b,c}}", {}, "(a|(b|c))", ["a", "b", "c"]],
  ["{a,b}{1,2}", {}, "(a|b)(1|2)", ["a1", "a2", "b1", "b2"]],
  ["{a,a,,b}", { nodupes: true, noempty: true }, "(a|a|b)", ["a", "b"]],
  ["${a,b}", {}, "${a,b}", ["${a,b}"]],
  ["a{b", {}, "a{b", ["a{b"]],
  ["{x}", {}, "{x}", ["{x}"]],
  ["{}", {}, "{}", ["{}"]],
  ['"{a,b}"', {}, "{a,b}", ["{a,b}"]],
  ["[{}()]", {}, "[{}()]", ["[{}()]"]],
  ["\\{a,b\\}", {}, "{a,b}", ["{a,b}"]],
]
for (const [input, options, compiled, expanded] of cases) {
  check(`compile ${input}`, () =>
    assert.equal(braces.compile(input, options), compiled),
  )
  check(`expand ${input}`, () =>
    assert.deepEqual(braces.expand(input, options), expanded),
  )
}
for (const input of [
  '"' + "{(".repeat(1000) + '"',
  "'" + "{(".repeat(1000) + "'",
  "`" + "{(".repeat(1000) + "`",
  "[" + "{(".repeat(1000) + "]",
  "\\{\\(".repeat(1000),
  "{x}".repeat(500),
  "(x)".repeat(500),
]) {
  for (const api of ["compile", "expand", "stringify"]) {
    check(`${api} permits literal delimiters and sibling groups`, () =>
      assert.doesNotThrow(() => braces[api](input)),
    )
  }
}
check("existing character limit remains enforced", () =>
  assert.throws(
    () => braces.parse("x".repeat(10001)),
    /exceeds max characters/,
  ),
)
check("existing custom character limit remains enforced", () =>
  assert.throws(
    () => braces.parse("abc", { maxLength: 2 }),
    /exceeds max characters/,
  ),
)
check("existing range limit remains enforced", () =>
  assert.throws(() => braces.expand("{1..1001}"), /exceeds range limit/),
)
check("options cannot disable the hard depth limit", () =>
  assert.throws(
    () =>
      braces.compile(nested(101), { maxDepth: Infinity, maxLength: Infinity }),
    isDepthError,
  ),
)

// Isolate the advisory-sized case and verify controlled rejection on a smaller
// stack as well. The timeout bounds a regression without relying on timing.
for (const api of ["compile", "expand", "stringify"]) {
  check(`${api} rejects safely in a fresh small-stack process`, () => {
    const script = `const b = require(${JSON.stringify(target)}); try { b[${JSON.stringify(api)}]('{'.repeat(4999) + 'x' + '}'.repeat(4999)); process.exit(2); } catch (e) { if (!(e instanceof SyntaxError) || e.message !== 'Nesting depth exceeds max depth (100)') throw e; }`
    const result = spawnSync(
      process.execPath,
      ["--stack-size=256", "-e", script],
      { encoding: "utf8", timeout: 5000 },
    )
    assert.ifError(result.error)
    assert.equal(result.status, 0, result.stderr)
  })
}

if (baseline) {
  let seed = 0x3bace
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  const alphabet = [
    "a",
    "b",
    "1",
    "2",
    ".",
    "/",
    "*",
    "{",
    "}",
    "(",
    ")",
    "[",
    "]",
    ",",
    "\\",
    '"',
    "'",
    "`",
    "$",
  ]
  const options = [
    {},
    { escapeInvalid: true },
    { keepQuotes: true },
    { keepEscaping: true },
    { noempty: true, nodupes: true },
  ]
  function outcome(run) {
    try {
      return { value: run() }
    } catch (error) {
      return { error: error.name, message: error.message }
    }
  }
  for (let i = 0; i < 3000; i++) {
    let input = ""
    const length = 1 + Math.floor(random() * 60)
    for (let j = 0; j < length; j++)
      input += alphabet[Math.floor(random() * alphabet.length)]
    const opts = options[i % options.length]
    for (const api of ["compile", "expand", "stringify"]) {
      check(`differential ${i} ${api} ${JSON.stringify(input)}`, () => {
        assert.deepEqual(
          outcome(() => braces[api](input, opts)),
          outcome(() => baseline[api](input, opts)),
        )
      })
    }
  }
}
console.log(`braces security regression passed: ${checks} checks; ${target}`)
