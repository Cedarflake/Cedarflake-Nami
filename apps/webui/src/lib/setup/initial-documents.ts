import {
  bootstrapConfig,
  defaultDataConfig,
  validateRedirectsConfig,
  type DataConfig,
} from "@nami/config";

import { parseDataConfig } from "@/lib/configuration/parse-data-config";

export const runtimeProviders = [
  "cloudflare",
  "netlify",
  "vercel",
] as const;

export type RuntimeProvider = (typeof runtimeProviders)[number];

export interface InitialDocumentsInput {
  analyticsEnabled: boolean;
  analyticsSourceId: string;
  managerGitHubUserId: string;
  runtimeOrigin: string;
  runtimeProviders: readonly RuntimeProvider[];
  webUiOrigin: string;
}

export interface InitialDocuments {
  config: DataConfig;
  configContent: string;
  redirectsContent: string;
}

export function createInitialDocuments(
  input: InitialDocumentsInput,
): InitialDocuments {
  const runtimeOrigin = normalizeHttpsOrigin(
    input.runtimeOrigin,
    "Runtime origin",
  );
  const webUiOrigin = normalizeHttpsOrigin(
    input.webUiOrigin,
    "WebUI origin",
  );
  const analyticsSourceId = input.analyticsSourceId.trim().toLowerCase()
    || new URL(runtimeOrigin).hostname.toLowerCase();
  const enabledProviders = new Set(input.runtimeProviders);
  const config = structuredClone(defaultDataConfig);

  config.runtime.canonicalOrigin = runtimeOrigin;
  config.analytics.ingestEndpoint = `${webUiOrigin}/api/analytics/events`;
  config.analytics.sourceId = analyticsSourceId;
  config.webui.access = {
    mode: "allowlist",
    managerGitHubUserIds: [input.managerGitHubUserId],
    blockedGitHubUserIds: [],
  };
  setPluginEnabled(config, "@nami/runtime-cloudflare", enabledProviders.has("cloudflare"));
  setPluginEnabled(config, "@nami/runtime-netlify", enabledProviders.has("netlify"));
  setPluginEnabled(config, "@nami/runtime-vercel", enabledProviders.has("vercel"));
  setPluginEnabled(config, "@nami/analytics-sink-http", input.analyticsEnabled);
  setPluginEnabled(
    config,
    "@nami/analytics-store-postgres",
    input.analyticsEnabled && bootstrapConfig.webui.analyticsStore.provider === "postgres",
  );
  setPluginEnabled(
    config,
    "@nami/analytics-store-d1",
    input.analyticsEnabled && bootstrapConfig.webui.analyticsStore.provider === "d1",
  );
  setPluginEnabled(config, "@nami/feature-bot-classifier", input.analyticsEnabled);

  const configContent = `${JSON.stringify(config, null, 2)}\n`;
  const parsedConfig = parseDataConfig(configContent);
  const redirects = {
    $schema:
      "https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json",
    Slots: {},
  };
  const redirectsValidation = validateRedirectsConfig(redirects);
  if (redirectsValidation.status !== "valid") {
    throw new Error("Generated redirects document failed validation");
  }

  return {
    config: parsedConfig,
    configContent,
    redirectsContent: `${JSON.stringify(redirects, null, 2)}\n`,
  };
}

function normalizeHttpsOrigin(
  value: string,
  label: string,
): `https://${string}` {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be a valid HTTPS origin`);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
  ) {
    throw new TypeError(`${label} must be an HTTPS origin without a path`);
  }
  return url.origin as `https://${string}`;
}

function setPluginEnabled(
  config: DataConfig,
  pluginId: string,
  enabled: boolean,
): void {
  const declaration = config.plugins[pluginId];
  if (!declaration) {
    throw new Error(`Generated config is missing installed plugin ${pluginId}`);
  }
  declaration.enabled = enabled;
}
