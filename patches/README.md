# Dependency patches

## VitePress 1.6.4

`vitepress@1.6.4.patch` makes the VitePress Markdown renderer use the separately
resolved `markdown-it@14.3.3` package instead of its bundled 14.1.0 parser. The
workspace package extension supplies this exact dependency. VitePress plugins and
renderer options are still applied by its original renderer factory.

The bundled parser is invisible to lockfile audits. The external 14.3.3 release
contains the upstream fixes for GHSA-38c4-r59v-3vqw, GHSA-6v5v-wf23-fmfq,
GHSA-253c-mchw-3w2r, GHSA-r7fv-28h4-cvq7, GHSA-vfgh-jcmw-g37q, and
GHSA-gfr2-rv44-r23c. This is a local integration patch, not a VitePress release.

`pnpm docs:check` verifies the actual VitePress renderer uses that external parser,
checks bilingual headings, links, tables, containers and inline HTML, runs bounded
adversarial-input regressions, and builds all documentation. Remove this patch only
after an upstream VitePress release supplies a fixed parser and these checks pass.

## braces 3.0.3

`braces@3.0.3.patch` is a local mitigation for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
not an upstream release or backport. As of 2026-10-08, the registry does not
publish the 3.0.4 version mentioned by the audit feed.

The parser rejects more than 100 combined nested braces/parentheses. Recursive
compile, expand, and stringify walkers apply the same bound to direct AST inputs,
including child cycles. Ordinary pattern behavior is unchanged; extremely deep
patterns now throw a bounded SyntaxError instead of overflowing the call stack.

The installed package is exercised by `scripts:check`, covering public APIs,
boundary inputs, escaped/quoted delimiters, direct ASTs, ranges, and resource-bounded
malicious inputs. The regression script can additionally compare against a pristine
3.0.3 package passed as its second directory argument.

The advisory was withdrawn on 2026-10-23 as not practically exploitable, so the
2026-10-24 raw audit no longer reports it. This is an advisory-feed change, not an
upstream code fix. Retain the local hardening and its regression tests until a
separately reviewed upstream change makes it unnecessary.
