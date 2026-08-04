# Repository Agent Guide

This file is the canonical repository policy for coding agents. Tool-specific instruction entrypoints may load it, but they must not define independent repository rules.

## Scope and Instruction Priority

Use this order when repository-controlled instructions overlap:

1. The explicit task and maintainer direction, to the extent permitted by the acting tool's platform, system, sandbox, security, and approval rules.
2. The closest applicable `AGENTS.md` for each changed file. Nested instructions add to or override this guide only within their subtree.
3. Executable configuration, scripts, and formatter, linter, framework, and compiler output for current versions, commands, and mechanically enforced behavior.
4. Project-owned README files and architecture documentation.
5. The dominant style of directly comparable sibling files.
6. The defaults in this file.

An explicit task may authorize changing configuration, but the resulting change must still satisfy the owning checks before it is reported as complete. Apply defaults only to new or modified code. Do not mass-reformat legacy files or perform unrelated cleanup.

## Quality Bar

- Work at an owner-level engineering standard: identify the root cause, owning layer, affected consumers, regression risk, and validation evidence before declaring a task complete.
- Do not stop at the first failed approach or claim that a task is impossible until safe in-scope source inspection, repository search, and reasonable alternatives have been exhausted.
- Do not ask the maintainer for facts that can be discovered from the repository, configured tools, or read-only checks.
- The duty to discover facts does not waive approval requirements for destructive actions, external writes, or unresolved product choices that would materially change scope or behavior.
- Report a repository change as complete only after every required check owned by the changed files has run successfully.
- If a required check cannot run, report the exact command, failure or missing prerequisite, and the behavior that remains unverified.
- Never describe an unrun, failed, partial, or stale check as passed.

## Repository Ownership

- The repository root owns pnpm workspace metadata, the shared lockfile, unified commands, repository-wide documentation, and cross-project contracts.
- `apps/runtime` owns the edge redirect runtime and its Cloudflare Workers, Vercel Edge Functions, and Netlify Edge Functions adapters.
- `apps/webui` owns the Next.js management panel, GitHub-backed redirect editing, authentication, validation UI, and WebUI deployment.
- `apps/docs` owns the bilingual VitePress documentation site, its information architecture, navigation, public assets, and documentation deployment metadata.
- The repository root is not a single deployable frontend application. Deploy each app from its documented project root.
- Runtime behavior must remain compatible with every supported provider unless the explicit task intentionally changes the support contract.
- A redirect data-model change is cross-project when it affects the runtime schema, runtime types or matching/loading behavior, WebUI serialization or editors, validation scripts, localized messages, or user documentation.
- Keep a change within one owner when possible. Expand to root or cross-project files only when the shared contract genuinely requires it.

## Before Making Changes

- Confirm the repository root, current branch, and task-owned paths, then inspect `git status`.
- Treat an existing dirty worktree as user-owned. Do not overwrite, revert, stage, format, validate as yours, or otherwise absorb unrelated changes.
- Read the root README, the target project's English and Chinese README files, affected `apps/docs` pages, manifests, formatting and compiler configuration, deployment configuration, and any owning workflow before editing.
- Search for affected callers, public URLs, environment variables, schema fields, generated outputs, localized copy, and documentation before changing shared behavior.
- Identify whether the source of truth is the runtime, WebUI, root workspace, remote data branch, deployment provider, or an external service.
- Treat checked-in configuration and scripts as authoritative for current versions and commands.
- Update stale documentation in the same diff only when it describes behavior changed by the task. Mention unrelated drift without editing it.

## Frontend Engineering Defaults

These defaults apply only when project configuration and the dominant style of comparable sibling files are silent.

### Files and Naming

- Follow the dominant component filename convention in the target directory. If none exists, use `PascalCase` for new React or Vue component files.
- Keep framework-reserved filenames such as `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, and `index.tsx`.
- Use the dominant `camelCase` or `kebab-case` convention for ordinary TypeScript and JavaScript files. If neither dominates, use `camelCase`.
- Use `kebab-case` for new directories unless a framework or generator requires another shape.
- Use `camelCase` for variables and functions, and `PascalCase` for types, interfaces, classes, and component symbols.
- Use `SCREAMING_SNAKE_CASE` for environment variables. Predicate booleans should start with `is`, `has`, `can`, or `should`.
- Follow the owning style system for CSS names. Without one, use `kebab-case` for global classes.

### Formatting and Imports

- Follow the nearest formatter, linter, and `.editorconfig`.
- This repository currently requires UTF-8, 2-space indentation, LF line endings, a final newline, and no unrelated line-ending rewrites.
- Without a machine-readable or dominant local rule, use double quotes, no semicolons, trailing commas where syntax permits, and K&R braces.
- Group ECMAScript imports in this order: Node built-ins, third-party dependencies, alias paths, relative paths, then CSS or other style files.
- Separate non-empty import groups with one blank line. Place `import type` in the group determined by its module source.
- Format only changed files or the owning project. Do not reformat unrelated code.

### TypeScript

- Do not add explicit `any`. Use `unknown` plus narrowing, a generic, or a precise type.
- Do not use `@ts-ignore`. Use `@ts-expect-error` only when the expected error is intentional and an adjacent comment explains why.
- Prefer guards and type refinement over non-null assertions. Use a non-null assertion only when its invariant can be proven locally or an adjacent comment identifies the guaranteeing API contract.
- Follow the established object-type convention. If neither form dominates, use `interface` for object shapes and `type` for unions, intersections, tuples, mapped types, and aliases.
- Preserve `strict` mode. Do not weaken compiler settings to make a check pass.

### Comments and Component Organization

- Add source comments only for design intent, non-obvious logic, special constraints, public contracts, or implementation reasons.
- Do not add comments that merely restate visible code behavior.
- Write source comments for maintainers. Source comments must not mention AI identity, prompts, conversations, model behavior, or generation history.
- The source-comment restriction does not prohibit intentional repository documentation, agent instruction entrypoints, release notes, or historical analysis from naming AI tooling when relevant.
- Organize new components as behavior, structure, then presentation unless the framework or nearby components establish another order.
- In React components, keep state, derived data, handlers, and effects before the primary JSX return. Keep component-owned presentation in the owning stylesheet or established styling system.

### Runtime Core File Headers

These rules apply only to TypeScript modules under `apps/runtime/src/lib`.

- Begin each module with the established bilingual JSDoc file header before its imports.
- Include `@file` with the exact filename, `@description`, concise `[EN]` and `[CN]` responsibility summaries, and the existing repository `@see` link.
- Keep the summary focused on the module's ownership and design role. Update it when that responsibility changes.

## Workspace, Dependencies, and Lockfile

- Use the package manager and version declared by the root `packageManager` field.
- Run pnpm workspace commands and dependency operations from the repository root.
- Prefer root wrapper scripts over ad hoc equivalent commands.
- Make dependency changes through pnpm so the root `pnpm-lock.yaml` is updated by the owning tool.
- Do not hand-edit, copy, reconstruct, or selectively transplant lockfile importers or resolutions.
- Do not change the package manager, Node policy, dependency ranges, overrides, build allowlists, or workspace globs unless the task owns that change.
- After manifest, workspace, override, or dependency-resolution changes, verify that a frozen install succeeds when the local environment can run it safely.
- Inspect the environment and declared tooling before installing or auditing dependencies. Do not reinstall dependencies merely as a first diagnostic step.
- Use uv for Python environments or tooling only when Python work is explicitly required. Do not introduce Python tooling without a task-owned need.

## Documentation and Synchronized Surfaces

- The root `README.md` and `README.zh-CN.md` own the workspace overview, stable Live endpoints, deployment roots, common commands, redirect-data entrypoint, and license summary.
- Each project README pair owns project-specific setup, environment variables, behavior, deployment, validation, limitations, and operational prerequisites.
- `apps/docs` owns detailed user, deployment, operation, reference, and extension guidance. A public behavior, configuration, command, provider, database, or deployment change must search and update the affected English and Chinese documentation pages in addition to the README surfaces.
- Keep README files concise and use the documentation site for detailed procedures. Do not leave duplicated instructions with conflicting requirements or defaults.
- New or moved documentation pages must keep English and Chinese route parity and update the applicable navbar, sidebar, search, and cross-page links.
- When behavior documented in both languages changes, update the English and Chinese surfaces in the same diff. Preserve intentional language-specific context without leaving contradictory facts.
- Add or rename an environment variable only with its owning `.env.example` and documentation. Examples must contain placeholders, never usable credentials.
- Redirect shape changes must keep `packages/config/redirects.schema.json`, runtime parsing and types, WebUI serialization and editing, validation behavior, examples, localized copy, and affected documentation consistent.
- `pnpm data:validate` reads its configured local file or Git ref and does not fetch the remote data branch. Do not describe it as fresh remote validation unless an authorized fetch ran first.
- Treat `origin/data:redirects.json` as a local Git ref snapshot, not proof of current remote state.
- Record a Live endpoint only when a credential-free HTTPS request reaches the intended stable deployment after redirects.
- Keep canonical Runtime endpoints synchronized across the root README pair, project documentation, provider configuration, and project-owned metadata when those surfaces own the URL.
- A hostname or deployment-root change requires searching for the old value and updating every owning surface.
- Removing source or checked-in deployment metadata does not disable an external deployment. Decommission external provider state separately and only with explicit authorization.

## Validation Routes

- Start with the smallest check owned by the changed project and run at most one resource-intensive local command at a time.
- Runtime source, schema, or shared build changes require `pnpm runtime:build`.
- Vercel-specific Runtime configuration or output changes also require `pnpm runtime:build:vc`.
- Netlify-specific Runtime configuration or output changes also require `pnpm runtime:build:nf`.
- Cloudflare-specific Runtime changes require the Runtime build plus the applicable non-deploying Wrangler validation documented by the project, when available.
- WebUI source, configuration, messages, or public behavior changes require `pnpm webui:lint` and `pnpm webui:build`.
- Documentation source, VitePress configuration, localization, navigation, or public assets require `pnpm docs:check`.
- Redirect schema or cross-project redirect-contract changes require the Runtime build, WebUI lint and build, and `pnpm data:validate` when its local validation input is available.
- Root workspace, shared configuration, or changes spanning both projects require `pnpm check`.
- Dependency and lockfile changes require the owning project checks plus the safe frozen-install check described above.
- Instruction- or documentation-only changes that are not build inputs require link, encoding, line-ending, final-newline, whitespace, and task-owned diff validation; do not run unrelated builds merely to produce activity.
- Finish change tasks with whitespace validation and inspection of the task-owned diff. Run repository-wide diff checks only when the task owns the complete worktree diff.
- Remote CI is a fallback only when an applicable workflow exists and any required push or dispatch is authorized.
- A remote result validates the reported change only when it ran against the exact commit or an equivalent diff. Report local and remote validation separately.

## Generated Files, Local State, and Secrets

- Do not edit generated output directly. Regenerate it through the owning build command.
- Treat `dist`, `.next`, `.vercel`, `.wrangler`, coverage, build output, caches, and `*.tsbuildinfo` as generated or local state unless an owning release contract explicitly says otherwise.
- Commit a generated artifact only when the documented distribution path intentionally publishes that exact file, source remains authoritative, generation is deterministic, and a drift check proves it is current.
- Do not create, expose, print, copy, or commit secrets, `.env`, `.env.local`, `.dev.vars`, credentials, tokens, downloaded data, or runtime state.
- Do not read local secret files merely to discover variable names; use manifests, source references, documentation, and `.env.example`.
- Preserve third-party notices, licenses, and attribution. Never invent reuse rights for code or assets whose license is unknown.

## Terminal, Browser, and Process Safety

- Run terminal commands sequentially by default. Parallelize only independent, read-only, low-cost checks.
- Never overlap dependency installs, builds, browser suites, development servers, watchers, deployment commands, migrations, or repository-wide scans.
- Use short-lived, non-interactive task shells.
- Treat existing IDE terminals, browsers, browser profiles, ports, servers, and their processes as user-owned unless task ownership is proven.
- Browser automation must use an isolated, project-owned context unless the explicit task authorizes an existing session.
- Authorization to reuse an existing browser does not authorize closing it, killing it, modifying its profile, or stopping its child processes.
- Before starting a server, watcher, browser, or helper, check the required port or service and record a reliable process handle, command, and port.
- Before stopping a process, verify its command line, parent process, and task ownership. Never infer ownership from a process name, resource usage, or port alone.
- Do not repeat a failed heavy command until the failure has been classified as code, permission, tooling, or host-resource related.
- Treat out-of-memory, insufficient-resource, process-spawn, and repeated shell-startup failures as stop conditions. Cancel only task-owned heavy work and start no new heavy local checks.
- When host instability blocks comprehensive validation, use lightweight targeted checks and report the remaining gap. Use remote CI only under the authorization and ownership rules above.

## GitHub Actions Safety

These rules apply whenever a workflow is added or modified:

- Pin third-party Actions and reusable workflows to verified full 40-character commit SHAs and retain the reviewed release tag in an inline comment.
- Use least-privilege job permissions and set `persist-credentials: false` on checkout unless the job explicitly owns a push.
- Never run untrusted pull-request code with write credentials.
- Path-filtered workflows must cover their real owners and their own workflow file.
- Include a shared root file only when changing it can alter that workflow's install, check, build, audit, or deploy result.
- Preserve externally consumed workflow and job names unless every consumer is migrated.
- After editing workflow YAML, run the repository-declared workflow check when one exists and manually inspect triggers, path filters, permissions, working directories, credentials, immutable references, and self-paths.
- When no owning workflow exists, do not claim that remote CI covers the changed owner.

## Git Branch Selection

- Follow an explicit maintainer instruction about whether to use the current branch, create a branch, or open a pull request.
- Keep small, self-contained, low-risk, directly reviewable changes on the current branch by default. Do not create a branch or pull request for them unless the maintainer explicitly requests one.
- Treat a small follow-up correction to just-completed or just-merged work as part of that same maintenance boundary; apply it on the current branch instead of opening a dedicated cleanup branch.
- Do not create a branch solely because a tracked file will change.
- A change is not low risk when it alters public runtime behavior, security boundaries, dependencies, lockfiles, workflows, releases, deployments, generated artifacts, shared configuration, external data, or more than one project owner.
- Create a branch before feature development, public behavior changes, security fixes, dependency or lockfile updates, workflow or release changes, multi-project work, destructive migrations, long-running maintenance, or pull-request work.
- Branch prefixes belong to the acting tool, not to the repository as a universal namespace.
- Codex uses `codex/<short-slug>` unless the maintainer requests another name and the acting environment permits it.
- GitHub Copilot, Claude Code, and other tools follow their own platform or session branch constraints and must not inherit the `codex/` prefix.
- Do not rename, replace, or switch away from a platform-managed branch unless the task requires it and the acting tool permits it.
- If work that began as a small current-branch edit expands beyond the low-risk boundary, create the appropriate branch before broadening the diff without discarding or overwriting existing work.

## Commit Message Rules

- Inspect the staged diff before committing. Keep unrelated changes in separate commits so review and rollback boundaries remain clear.
- Commit messages must strictly follow Conventional Commits: `<type>[optional scope][!]: <description>`.
- Use an accurate type such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `chore`, or `revert`.
- Use a concise optional scope that names the real owner, such as `runtime`, `webui`, `redirects`, `deps`, or `docs`. Do not invent a scope when none improves clarity.
- Write the complete commit message in English.
- Count the complete first line as the summary. Keep it specific to the committed diff and no longer than 20 whitespace-separated words.
- When a body is needed, leave one blank line after the summary and use concise `- ` bullet items without blank lines between bullets.
- Mark a breaking change with `!` in the header or a `BREAKING CHANGE:` footer, and explain the migration impact.
- Do not use a commit message to claim checks or external effects that did not occur.

Example:

```text
fix(redirects): reject invalid route entries

- Validate route entries before runtime matching
- Preserve valid redirect and proxy behavior
```

## Commit, Push, Pull Request, and External-Write Authorization

- Editing files, creating a commit, pushing a branch, and creating or modifying a pull request are separate permissions unless the invoked agent surface explicitly defines the requested handoff.
- Authorization for one action does not imply authorization for a later action.
- Commit or push only when explicitly requested.
- Permission to edit, commit, push, or open a pull request does not authorize creating or pushing tags, creating or modifying releases, publishing packages, deploying, promoting, rolling back, writing issues or comments, creating credentials or secrets, or migrating external data.
- Release preparation is an ordinary repository change. Publication and deployment are external writes.
- Before any Runtime deploy command, obtain explicit authorization for the exact provider and target environment.
- Authorization to deploy to one provider does not authorize Cloudflare, Vercel, or Netlify as a group.
- Permission to change deployment configuration does not authorize deployment.
- A successful build does not prove that deployment succeeded or that a Live endpoint is healthy.
- Never run a data migration as a validation command. Confirm the exact target environment, expected mutation, backup or rollback path, and authorization before running it.
- Before a destructive filesystem, Git, deployment, or data action, resolve the exact target, preserve unrelated work, and obtain authorization for that action.

## Project Lifecycle Changes

- Add a new workspace project only with a project README, manifest, meaningful check and build commands, explicit license status, workspace registration, lockfile update, and documented prerequisites.
- Preserve upstream attribution and licensing for imported code and assets.
- Use a history-preserving move or rename when practical.
- A move or rename must update package names and paths, workspace and lockfile state, scripts, documentation in both languages, deployment roots, environment examples, provider configuration, source URLs, schema references, and workflows when present.
- Finish moves and renames by searching for every old path, package name, hostname, environment variable, and public URL.
- Archiving must preserve license, attribution, status, and reproducibility while explicitly documenting validation and deployment disposition.
- Deleting source requires removing or replacing its workspace, lockfile, scripts, documentation, deployment, workflow, generated, and configuration surfaces.
- Archiving or deleting checked-in source does not disable an external deployment, revoke credentials, or delete external data. Handle each external system separately with explicit authorization.

## Completion Checklist

Before considering a repository change complete, confirm:

- [ ] The task-owned diff contains only intended files and preserves unrelated worktree changes.
- [ ] The owning layer and all affected consumers were identified.
- [ ] Machine-readable configuration, scripts, schemas, code, localized copy, and documentation agree.
- [ ] English and Chinese documentation remain factually aligned where both own the changed behavior.
- [ ] Workspace metadata, dependency manifests, and the root lockfile are current.
- [ ] Generated artifacts are either absent or reproducibly generated and verified.
- [ ] No secrets, local environment files, caches, downloads, or runtime data entered the diff or output.
- [ ] Stable public URLs and deployment roots were verified and synchronized when changed.
- [ ] Every required owner check ran successfully, or the exact unverified behavior is reported.
- [ ] Local and remote validation are distinguished and apply to the exact reported diff.
- [ ] Links, UTF-8 encoding, LF line endings, final newlines, and whitespace checks pass for changed documentation.
- [ ] Old identifiers and orphaned files are absent after moves, renames, URL changes, archiving, or deletion.
- [ ] No commit, push, pull request, tag, release, deployment, publication, migration, or destructive action was inferred from another permission.
- [ ] The final handoff reports what changed, what was validated, and what remains unverified.
