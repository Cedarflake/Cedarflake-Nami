/**
 * @file config.ts
 * @description
 * [EN] Remote data bootstrap URL resolution.
 * Builds instance configuration and redirect-rule URLs from the repository-owned bootstrap settings.
 *
 * [CN] 远程数据启动地址解析。
 * 根据仓库维护的启动配置构建实例配置与重定向规则地址。
 *
 * @see {@link https://github.com/Revaea/i0c.cc} for repository info.
 */

import { bootstrapConfig } from "@nami/config";

const dataSource = bootstrapConfig.data.github;
const CONFIG_REPO = `${dataSource.owner}/${dataSource.repository}`;
const CONFIG_BRANCH = dataSource.branch;

export function buildConfigUrl(parts?: { repo?: string; branch?: string; path?: string }): string {
  const repo = parts?.repo ?? CONFIG_REPO;
  const branch = parts?.branch ?? CONFIG_BRANCH;
  const path = parts?.path ?? dataSource.redirectsPath;
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
}

export const DEFAULT_DATA_CONFIG_URL = buildConfigUrl({ path: dataSource.configPath });
export const DEFAULT_REDIRECTS_CONFIG_URL = buildConfigUrl({ path: dataSource.redirectsPath });
export const DEFAULT_CONFIG_URL = DEFAULT_REDIRECTS_CONFIG_URL;
