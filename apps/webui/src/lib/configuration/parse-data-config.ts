import type { DataConfig } from "@nami/config";

import { validateInstanceDataConfig } from "@/lib/configuration/validation";
import { resolveWebUiPlugins } from "@/lib/plugins/registry";

export function parseDataConfig(content: string): DataConfig {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Instance config must be valid JSON");
  }

  const result = validateInstanceDataConfig(value);
  if (result.status === "valid") {
    resolveWebUiPlugins(result.config);
    return result.config;
  }

  const shownIssues = result.issues
    .slice(0, 5)
    .map((item) => `${item.path}: ${item.message}`);
  const remainingCount = result.issues.length - shownIssues.length;
  const details = [
    ...shownIssues,
    ...(remainingCount > 0 ? [`and ${remainingCount} more`] : []),
  ].join("; ");
  throw new Error(`Instance config validation failed: ${details}`);
}
