import type { ReactNode } from "react"

import type { WebUiExtensionRegistration } from "@nami/plugin-api"

export type WebUiExtensionRenderer = (context: unknown) => ReactNode

export const webUiExtensionInstallations = [] satisfies readonly WebUiExtensionRegistration<
  WebUiExtensionRenderer
>[]
