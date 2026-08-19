import { Buffer } from "node:buffer"

import type {
  DataDocument,
  DataDocumentKind,
  DataRepositoryReadOptions,
  DataRepositorySnapshot,
  DataRepositoryWriteInput,
  DataRepositoryWriteResult,
} from "@nami/config"
import type { AtomicVersionedDataRepository } from "@nami/plugin-api"

import type { GitHubContentsRepositoryBootstrapConfig } from "./config"
import { githubContentsRepositoryManifest } from "./manifest"

const apiBase = "https://api.github.com"

interface RepoTarget {
  owner: string
  repo: string
  branch: string
  path: string
}

export type GitHubDataDocumentKind = DataDocumentKind
export type GitHubDataDocumentPayload = DataDocument
export type RedirectConfigPayload = DataDocument
export type UpdateDataDocumentInput = Omit<
  DataRepositoryWriteInput,
  "credential"
>
export type UpdateDataDocumentResult = DataRepositoryWriteResult
export type GitHubDataReadOptions = DataRepositoryReadOptions
export type GitHubDataWriteInput = DataRepositoryWriteInput

export interface GitHubRequestInit extends RequestInit {
  next?: {
    revalidate: number
    tags?: string[]
  }
}

export type GitHubFetch = (
  input: RequestInfo | URL,
  init?: GitHubRequestInit,
) => Promise<Response>

export interface GitHubContentsRepositoryServices {
  fetchImpl?: GitHubFetch
}

export type GitHubDataRepository = AtomicVersionedDataRepository<
  GitHubDataDocumentKind,
  GitHubDataReadOptions,
  GitHubDataWriteInput,
  GitHubDataDocumentPayload,
  UpdateDataDocumentResult,
  DataRepositorySnapshot
>

export function createGitHubContentsRepository(
  config: GitHubContentsRepositoryBootstrapConfig,
  services: GitHubContentsRepositoryServices = {},
): GitHubDataRepository {
  const fetchImpl = services.fetchImpl ?? fetch

  return {
    async read(kind, options) {
      const target = resolveTarget(config, kind, options.sourceUrl)
      return readGitHubDocument(
        fetchImpl,
        config,
        target,
        target.branch,
        options,
      )
    },
    async readSnapshot(options) {
      const configTarget = resolveTarget(config, "config")
      const redirectsTarget = resolveTarget(config, "redirects")
      const commitResponse = await fetchImpl(
        buildCommitUrl(configTarget, configTarget.branch),
        buildReadRequestInit(config, options),
      )
      if (!commitResponse.ok) {
        throw await createGitHubResponseError("load", commitResponse)
      }
      const commit = (await commitResponse.json()) as { sha: string }
      const [configDocument, redirectsDocument] = await Promise.all([
        readGitHubDocument(
          fetchImpl,
          config,
          configTarget,
          commit.sha,
          options,
        ),
        readGitHubDocument(
          fetchImpl,
          config,
          redirectsTarget,
          commit.sha,
          options,
        ),
      ])
      return {
        config: configDocument,
        redirects: redirectsDocument,
        revision: commit.sha,
      }
    },
    async write(kind, input) {
      const target = resolveTarget(config, kind, input.sourceUrl)
      const url = buildContentsUrl(target)
      const token = requireAccessToken(input.credential)
      const response = await fetchImpl(url, {
        method: "PUT",
        headers: buildHeaders(token),
        body: JSON.stringify({
          message:
            input.message ??
            (kind === "config"
              ? "chore(config): update instance settings"
              : "chore(redirects): update config"),
          content: Buffer.from(input.content, "utf-8").toString("base64"),
          sha: input.expectedRevision,
          branch: target.branch,
        }),
      })

      if (!response.ok) {
        throw await createGitHubResponseError("update", response)
      }

      const json = (await response.json()) as {
        content: { sha: string }
        commit: { html_url: string }
      }

      return {
        revision: json.content.sha,
        revisionUrl: json.commit.html_url,
      }
    },
  }
}

export const githubContentsRepositoryPlugin = {
  manifest: githubContentsRepositoryManifest,
  create: createGitHubContentsRepository,
}

function requireAccessToken(token: string | undefined): string {
  if (!token) {
    throw new Error("Missing GitHub access token in session.")
  }
  return token
}

function buildHeaders(accessToken?: string): HeadersInit {
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  } satisfies Record<string, string>
}

function buildReadRequestInit(
  config: GitHubContentsRepositoryBootstrapConfig,
  options: GitHubDataReadOptions,
): GitHubRequestInit {
  return {
    headers: buildHeaders(options.credential),
    ...(options.credential || options.cacheMode === "no-store"
      ? { cache: "no-store" as const }
      : {
          next: {
            revalidate: config.publicRevalidateSeconds,
            ...(options.cacheTags?.length
              ? { tags: [...options.cacheTags] }
              : {}),
          },
        }),
  }
}

async function readGitHubDocument(
  fetchImpl: GitHubFetch,
  config: GitHubContentsRepositoryBootstrapConfig,
  target: RepoTarget,
  revision: string,
  options: GitHubDataReadOptions,
): Promise<DataDocument> {
  const response = await fetchImpl(
    `${buildContentsUrl(target)}?ref=${encodeURIComponent(revision)}`,
    buildReadRequestInit(config, options),
  )
  if (!response.ok) {
    throw await createGitHubResponseError("load", response)
  }
  const json = (await response.json()) as {
    content: string
    sha: string
    path: string
    html_url?: string
  }
  return {
    content: Buffer.from(json.content, "base64").toString("utf-8"),
    revision: json.sha,
    sourcePath: json.path,
    sourceUrl: json.html_url,
    lastModified: response.headers.get("last-modified") ?? undefined,
  }
}

function encodeGitHubPath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

function parseGitHubSourceUrl(
  config: GitHubContentsRepositoryBootstrapConfig,
  sourceUrl: string,
): RepoTarget {
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    throw new Error("Invalid config URL.")
  }

  const host = url.hostname.toLowerCase()
  const parts = url.pathname.split("/").filter(Boolean)

  if (host === "github.com" || host === "www.github.com") {
    const [owner, repo, mode, branch, ...rest] = parts
    if (
      !owner ||
      !repo ||
      !mode ||
      !branch ||
      rest.length === 0 ||
      (mode !== "blob" && mode !== "raw")
    ) {
      throw new Error("Unsupported GitHub config URL.")
    }
    return {
      owner,
      repo,
      branch,
      path: ensureJsonPath(rest.join("/")),
    }
  }

  if (host === "raw.githubusercontent.com") {
    const [owner, repo, branch, ...rest] = parts
    if (!owner || !repo || !branch || rest.length === 0) {
      throw new Error("Unsupported GitHub config URL.")
    }
    return {
      owner,
      repo,
      branch,
      path: ensureJsonPath(rest.join("/")),
    }
  }

  if (host === "api.github.com") {
    const [reposKeyword, owner, repo, contentsKeyword, ...rest] = parts
    if (
      reposKeyword !== "repos" ||
      contentsKeyword !== "contents" ||
      !owner ||
      !repo ||
      rest.length === 0
    ) {
      throw new Error("Unsupported GitHub config URL.")
    }
    return {
      owner,
      repo,
      branch: url.searchParams.get("ref") || config.branch,
      path: ensureJsonPath(rest.join("/")),
    }
  }

  throw new Error("Only GitHub config URLs are supported.")
}

function resolveTarget(
  config: GitHubContentsRepositoryBootstrapConfig,
  kind: GitHubDataDocumentKind,
  sourceUrl?: string | null,
): RepoTarget {
  if (sourceUrl) {
    return parseGitHubSourceUrl(config, sourceUrl)
  }

  if (!config.owner || !config.repository) {
    throw new Error("The configured GitHub data repository is missing an owner or name.")
  }

  return {
    owner: config.owner,
    repo: config.repository,
    branch: config.branch,
    path: ensureJsonPath(
      kind === "config" ? config.configPath : config.redirectsPath,
    ),
  }
}

function ensureJsonPath(value: string): string {
  if (!/\.json$/i.test(value)) {
    throw new Error("The configured GitHub data path must point to a .json file.")
  }
  return value
}

function buildContentsUrl(target: RepoTarget): string {
  return `${apiBase}/repos/${target.owner}/${target.repo}/contents/${encodeGitHubPath(target.path)}`
}

function buildCommitUrl(target: RepoTarget, revision: string): string {
  return `${apiBase}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/commits/${encodeURIComponent(revision)}`
}

async function createGitHubResponseError(
  operation: "load" | "update",
  response: Response,
): Promise<Error> {
  const rawBody = await response.text()
  const normalized = normalizeGitHubErrorBody(response.status, rawBody)
  return new Error(
    `Failed to ${operation} config ${operation === "load" ? "from " : "on "}GitHub: ${response.status} ${response.statusText}${normalized ? ` - ${normalized}` : ""}`,
  )
}

function normalizeGitHubErrorBody(status: number, rawBody: string): string {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return ""
  }

  try {
    const json = JSON.parse(trimmed) as { message?: string }
    const message = typeof json.message === "string" ? json.message : trimmed
    return status === 404
      ? `${message} (repo/branch/path not found, or the current account lacks write permission)`
      : message
  } catch {
    return status === 404
      ? `${trimmed} (repo/branch/path not found, or the current account lacks write permission)`
      : trimmed
  }
}
