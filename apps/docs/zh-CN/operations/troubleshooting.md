---
title: 故障排查
description: 按所有权边界诊断常见 WebUI、Runtime、统计、OAuth 与存储问题。
---

# 故障排查

先确定失败边界。Runtime 响应、WebUI API 响应、数据库错误和平台构建错误分别属于不同所有者。

## 首次加载配置返回 500，刷新后正常

请检查第一次失败的服务端堆栈，不要把刷新当成修复。常见原因包括数据库瞬时连接失败、文件修改后的开发模块过期，或 Repository 初始化竞争。先确认所选 Repository 的健康状态；只有明确任务进程后，才重启对应开发服务器。

## `relation ... does not exist`

所选 PostgreSQL 数据库尚未应用归属插件的 Schema 更新，或应用连接了另一数据库。只有在确认准确的 `DATABASE_URL` 目标后，才执行对应 Repository 或统计 Schema 更新。

## D1 提示缺少数据表

先确认 Repository 与统计 Database ID 没有填反，再对具体插件槽执行 Schema 更新。它们是两个独立数据库，Schema migration 历史也彼此独立。

## Analytics Collector 返回 401

事件签名缺失、过期，或使用了不同的 `I0C_SECRET`。WebUI 与每个 Runtime 必须配置完全相同的值。不要把真实值写进实例配置。

## Analytics Collector 返回 405

端点收到了不支持的 HTTP 方法。Runtime 使用 Collector 预期的带签名 `POST`；在浏览器直接打开会发送 `GET`，不能用于测试事件写入。

## 某个 Runtime 平台没有统计

检查该平台适配器与 HTTP Analytics Sink 是否启用、部署是否包含当前构建、`I0C_SECRET` 是否一致，以及后台投递日志中是否有网络错误。请按实际 `entryDomain` 筛选，不要假设所有平台域名都折叠为同一个标签。

## Runtime 返回 500 或 Bad Gateway

检查快照是否成功加载并通过校验、当前平台适配器是否启用，以及反代上游是否失败。关闭适配器不会删除外部服务，只会使已有部署无法正常提供路由。

## 切换账号后 GitHub OAuth 回调失败

核对回调 URL；测试时只清理本应用自己的 Session；检查 Auth.js 错误，而不是无关的浏览器 Manifest 图标警告。组织 OAuth 限制也可能导致登录成功后仍无法访问仓库。

## Vercel 在 pnpm 工作区运行了 `npm install`

应用级 Vercel 项目没有稳定识别仓库根的 `pnpm-lock.yaml` 与 `packageManager` 声明。不要为子应用增加第二份锁文件，也不要在工作区运行 npm。项目 Root Directory 仍保持为 `apps/webui` 或 `apps/docs`；仓库内相应的 `vercel.json` 会明确执行 `corepack pnpm -C ../.. install --frozen-lockfile`，由仓库固定的 pnpm 版本从工作区根安装依赖。

## 平台构建成功但部署失败

构建成功只证明本地输出生成完成。请检查平台报告的 Unsupported Module、Edge Runtime、输出目录和 Root Directory 信息，并先运行平台专用构建命令再修改部署设置。

## Bug 报告应包含

- 准确路由与部署平台；
- 当前 Commit 和构建命令；
- 所选 Repository 与统计 Provider，但不包含凭据；
- HTTP 状态与相关服务端堆栈；
- 直接发起全新请求时是否复现，而不只是导航缓存复用后的表现。
