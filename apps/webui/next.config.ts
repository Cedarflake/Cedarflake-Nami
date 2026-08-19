import path from "node:path"

import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

function createNextConfig(phase: string): NextConfig {
  return {
    reactCompiler: phase !== PHASE_DEVELOPMENT_SERVER,
    transpilePackages: ["@nami/config"],
    turbopack: {
      root: path.resolve(process.cwd(), "../.."),
    },
    images: {
      minimumCacheTTL: 86_400,
      remotePatterns: [
        {
          protocol: "https",
          hostname: "avatars.githubusercontent.com",
        },
        {
          protocol: "https",
          hostname: "unavatar.webp.se",
          pathname: "/**",
          search: "?fallback=false",
        },
      ],
    },
  }
}

function resolveNextConfig(phase: string): NextConfig {
  return withNextIntl(createNextConfig(phase))
}

export default resolveNextConfig
