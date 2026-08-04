---
title: 实例配置
description: 了解 Bootstrap 选择、可编辑实例设置与密钥绑定。
---

# 实例配置

i0c.cc 有意把应用启动前必须确定的选项，与可以通过 WebUI 编辑的设置分开。

## Bootstrap 配置

[`packages/config/src/defaults.ts`](https://github.com/Revaea/i0c.cc/blob/main/packages/config/src/defaults.ts) 保存仓库内的 Bootstrap 配置，用于选择：

- 可编辑数据的 Repository Provider；
- Runtime 快照数据源；
- 统计 Store Provider；
- PostgreSQL 连接限制；
- D1 Account 与 Database ID；
- GitHub OAuth Scope。

切换 Bootstrap Provider 会改变应用所需的依赖，因此需要重新构建并部署。

## 可编辑实例配置

WebUI 管理由 `packages/config/config.schema.json` 描述的实例文档。

| 区域 | 用途 |
| --- | --- |
| `runtime` | 规范域名、Robots 策略与快照缓存时间 |
| `analytics` | Collector 地址与稳定的 Source ID |
| `webui.access` | 登录模式、管理员 ID 与黑名单 ID |
| `plugins` | 启用状态、公开选项与环境变量绑定名称 |

通过 Repository 保存后，Runtime 可以从 WebUI 快照端点获取新配置，不需要重新构建应用。

## 密钥绑定

插件声明可以按名称引用环境变量：

```json
{
  "@i0c/analytics-sink-http": {
    "enabled": true,
    "version": 1,
    "secrets": {
      "writeKey": "I0C_SECRET"
    }
  }
}
```

文档保存的是 `I0C_SECRET` 这个名称，而不是密钥值。真实值只应配置在 WebUI 与 Runtime 的部署环境中，并且必须完全一致。

## 访问模式

- `authenticated`：除黑名单外，任意已登录 GitHub 用户都可以使用 WebUI。
- `allowlist`：只有配置的管理员 ID 可以进入。
- `public-readonly`：已登录用户可以只读查看，管理员可以编辑；黑名单用户被拒绝。

这里使用 GitHub 数字用户 ID，因为用户名可能变化。

## 校验与修订

共享 Schema 和已安装插件 Manifest 会在配置被接受前完成校验。Repository 写入携带预期修订号，因此旧编辑器不能静默覆盖较新的改动。

日常编辑请使用 WebUI。`pnpm data:validate` 只校验仓库所配置的本地输入，不会自动获取更新的远程 Git Ref。
