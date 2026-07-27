import path from "node:path"

import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

function createNextConfig(phase: string): NextConfig {
  return {
    reactCompiler: phase !== PHASE_DEVELOPMENT_SERVER,
    transpilePackages: ["@i0c/config"],
    turbopack: {
      root: path.resolve(process.cwd(), "../.."),
    },
    images: {
      remotePatterns: [
        {
          protocol: "https",
          hostname: "avatars.githubusercontent.com",
        },
      ],
    },
  }
}

function resolveNextConfig(phase: string): NextConfig {
  return withNextIntl(createNextConfig(phase))
}

export default resolveNextConfig
