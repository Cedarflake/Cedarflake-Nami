/**
 * @file classification.ts
 * @description
 * [EN] Compatibility exports for the installed bot-classifier feature plugin.
 * Keeps existing Runtime imports stable while plugin code owns classification behavior.
 *
 * [CN] 已安装机器人分类 Feature 插件的兼容导出。
 * 在分类行为归属插件包后，保持现有 Runtime 导入路径稳定。
 *
 * @see {@link https://github.com/Cedarflake/Cedarflake-Nami} for repository info.
 */

export {
  classifyAnalyticsDevice,
  classifyAnalyticsProbe,
  classifyAnalyticsRequest,
  classifyAnalyticsResource,
  classifyAnalyticsTraffic,
} from "@nami/plugin-feature-bot-classifier/runtime";
