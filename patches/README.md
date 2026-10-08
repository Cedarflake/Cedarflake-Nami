# Dependency patches

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

The advisory remains visible in raw audits. Remove this local patch only after a
verified upstream fix is available and the same regression tests pass.
