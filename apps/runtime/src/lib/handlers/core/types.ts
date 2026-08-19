/**
 * @file types.ts
 * @description
 * [EN] Runtime core type definitions.
 * Defines all TypeScript interfaces, types, and shared data structures used throughout the library.
 * Centralizing types here prevents circular dependencies.
 *
 * [CN] Runtime 核心类型定义。
 * 定义库中使用的所有 TypeScript 接口、类型和共享数据结构。
 * 在此处集中管理类型可防止循环依赖。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import type { AnalyticsProvider as AnalyticsProviderType } from "@nami/analytics-domain";
import type {
  AnalyticsClassificationHookContext
} from "@nami/analytics-domain/classification";
import type {
  DataConfig,
  ProxyOptions,
  RedirectsConfig as SharedRedirectsConfig,
  SlotBranch as SharedSlotBranch
} from "@nami/config";
import type {
  AnalyticsSink,
  RuntimeCache,
  RuntimeDataSource as RuntimeDataSourceContract,
  RuntimeFeaturePipeline,
  RuntimeFeatureRegistration,
  RuntimePlatformManifest
} from "@nami/plugin-api";

import type { RuntimePluginInstallations } from "@nami/runtime-host/installations";

export type RouteType = "prefix" | "exact" | "proxy";
export type AnalyticsProvider = AnalyticsProviderType;
export type AnalyticsRequestClass = "human" | "link_preview" | "crawler" | "monitor" | "asset" | "unknown";
export type AnalyticsEventKind = "link" | "runtime";
export type AnalyticsTrafficClass = "browser_like" | "declared_bot" | "suspected_automation" | "unknown";
export type AnalyticsBotCategory = "none" | "search" | "ai_crawler" | "social_preview" | "monitor" | "automation" | "security_probe" | "unknown";
export type AnalyticsBotConfidence = "none" | "low" | "medium" | "high";
export type AnalyticsResourceClass = "document" | "asset" | "api" | "other" | "unknown";
export type AnalyticsDeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";
export type AnalyticsProbeCategory = "none" | "wordpress" | "env_file" | "admin" | "vcs" | "path_traversal" | "scanner" | "other";
export type AnalyticsLinkMatchKind = "exact" | "parameterized" | "prefix" | "catch_all";
export type AnalyticsRuntimeMatchKind = "unmatched" | "system";
export type AnalyticsRuntimeOutcome = "not_found" | "proxy_exhausted" | "config_unavailable" | "internal_error";

export interface AnalyticsTrafficClassification {
  trafficClass: AnalyticsTrafficClass;
  botCategory: AnalyticsBotCategory;
  botConfidence: AnalyticsBotConfidence;
}

export interface AnalyticsUpstreamAttribution {
  upstreamEventId: string;
  upstreamAnalyticsId: string;
  upstreamEntryDomain: string;
  upstreamProvider: AnalyticsProvider;
}

export type RouteValue = string | RouteConfig;
export type RouteValueEntry = RouteValue | RouteValue[];

export interface RouteConfig {
  analyticsId?: string;
  description?: string;
  type?: string;
  target?: string;
  to?: string;
  url?: string;
  appendPath?: boolean;
  proxyOptions?: ProxyOptions;
  status?: number | string;
  priority?: number | string;
}

export interface NormalizedRule {
  analyticsId?: string;
  type: RouteType;
  target: string;
  appendPath: boolean;
  proxyOptions?: ProxyOptions;
  status: number;
  priority: number;
}

export interface CompiledEntry {
  base: string;
  rule: NormalizedRule;
  regex: RegExp;
  names: string[];
  isParam: boolean;
  order: number;
}

export type SlotBranch = SharedSlotBranch;
export type RedirectsConfig = SharedRedirectsConfig;
export type CacheLike = RuntimeCache;

export type RuntimeDataSource = RuntimeDataSourceContract<DataConfig, RedirectsConfig>;

export interface AnalyticsSinkEvent {
  eventKind: AnalyticsEventKind;
}

export interface AnalyticsSinkContext {
  completedAt: number;
  dataConfig: DataConfig;
  endpoint: string;
  fetchImpl: typeof fetch;
  provider: AnalyticsProvider;
  readSecret(bindingName: string): string | undefined;
  sourceId: string;
  writeKey?: string;
}

export type RuntimeAnalyticsSink = AnalyticsSink<AnalyticsSinkEvent, AnalyticsSinkContext>;
export type RuntimeAnalyticsFeaturePipeline = RuntimeFeaturePipeline<
  AnalyticsClassificationHookContext
>;
export type RuntimeFeatureRegistrationInput = RuntimeFeatureRegistration<
  AnalyticsClassificationHookContext
>;

export interface HandlerOptions {
  configUrl?: string;
  dataConfigUrl?: string | null;
  redirectsConfigUrl?: string;
  dataConfigCacheTtlSeconds?: number;
  redirectsCacheTtlSeconds?: number;
  dataSource?: RuntimeDataSource;
  analyticsSink?: RuntimeAnalyticsSink;
  runtimeFeatures?: readonly RuntimeFeatureRegistrationInput[];
  cache?: CacheLike;
  cacheTtlSeconds?: number;
  fetchImpl?: typeof fetch;
  fetchInit?: RequestInit;
  envBindings?: Record<string, unknown>;
  readEnvironment?(name: string): unknown;
  provider?: AnalyticsProvider;
  platformPluginId?: string;
  pluginInstallations?: RuntimePluginInstallations;
  runtimePlatformManifests?: readonly RuntimePlatformManifest[];
  country?: string;
  waitUntil?(promise: Promise<unknown>): void;
  now?: () => number;
  random?: () => number;
}

export interface ResolvedRuntime {
  configUrl?: string;
  dataConfig: DataConfig;
  dataConfigUrl?: string;
  redirectsConfigUrl?: string;
  dataSource: RuntimeDataSource;
  analyticsSink?: RuntimeAnalyticsSink;
  featurePipeline: RuntimeAnalyticsFeaturePipeline;
  runtimeFeatures: readonly RuntimeFeatureRegistrationInput[];
  cache?: CacheLike;
  cacheTtlSeconds: number;
  fetchImpl: typeof fetch;
  fetchInit?: RequestInit;
  envBindings?: Record<string, unknown>;
  readEnvironment?: (name: string) => unknown;
  provider: AnalyticsProvider;
  platformPluginId?: string;
  pluginInstallations: RuntimePluginInstallations;
  runtimePlatformManifests: readonly RuntimePlatformManifest[];
  country?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
  now: () => number;
  random: () => number;
}
