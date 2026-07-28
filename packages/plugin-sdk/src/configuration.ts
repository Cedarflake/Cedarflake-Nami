import {
  validateJsonSchema,
  validateJsonSchemaDefinition,
  type JsonObject,
  type PluginConfigurationManifest,
  type PluginConfigurationUiManifest,
} from "@i0c/plugin-api"

export interface PluginConfigurationDefinition<TConfig extends object> {
  readonly defaults?: Readonly<TConfig>
  readonly manifest: PluginConfigurationManifest
  resolve(value: JsonObject | undefined): TConfig
}

export interface PluginConfigurationDefinitionInput<TConfig extends object> {
  readonly defaults?: Readonly<TConfig>
  readonly required?: boolean
  readonly schema: JsonObject
  readonly ui?: PluginConfigurationUiManifest
  readonly version: number
  resolve(value: JsonObject | undefined): TConfig
}

export function definePluginConfiguration<TConfig extends object>(
  input: PluginConfigurationDefinitionInput<TConfig>,
): PluginConfigurationDefinition<TConfig> {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new TypeError("Plugin configuration version must be a positive integer")
  }

  assertSchemaDefinition(input.schema)
  if (input.defaults !== undefined) {
    assertSchemaValue(input.schema, input.defaults, "Plugin configuration defaults")
  }

  const manifest: PluginConfigurationManifest = {
    ...(input.required === undefined ? {} : { required: input.required }),
    version: input.version,
    schema: input.schema,
    ...(input.ui === undefined ? {} : { ui: input.ui }),
  }

  return {
    ...(input.defaults === undefined ? {} : { defaults: input.defaults }),
    manifest,
    resolve(value) {
      const resolved = input.resolve(value)
      assertSchemaValue(input.schema, resolved, "Resolved plugin configuration")
      return resolved
    },
  }
}

function assertSchemaDefinition(schema: JsonObject): void {
  const issues = validateJsonSchemaDefinition(schema)
  if (issues.length > 0) {
    throw new TypeError(formatIssues("Invalid plugin configuration Schema", issues))
  }
}

function assertSchemaValue(
  schema: JsonObject,
  value: unknown,
  label: string,
): void {
  const issues = validateJsonSchema(schema, value)
  if (issues.length > 0) {
    throw new TypeError(formatIssues(label, issues))
  }
}

function formatIssues(
  label: string,
  issues: readonly { path: string; message: string }[],
): string {
  return [
    `${label}:`,
    ...issues.map((issue) => `- ${issue.path}: ${issue.message}`),
  ].join("\n")
}
