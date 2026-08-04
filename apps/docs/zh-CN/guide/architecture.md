---
title: 架构
description: 了解控制面、数据面、存储与编译期扩展边界。
---

# 架构

i0c.cc 把管理和请求处理分开：WebUI 是控制面，Runtime 部署是数据面。

```text
浏览器 ──► WebUI ──► 数据 Repository
                 └──► 统计 Store

访问者 ──► Runtime ──► 上游目标
                 ├──► WebUI 快照端点
                 └──► WebUI 统计 Collector
```

## WebUI 控制面

Next.js WebUI 负责认证、可视化规则编辑、实例设置、校验、不可变修订、备份与回滚，以及统计查询。只有 WebUI 会接收数据库凭据。

默认配置使用 PostgreSQL 同时保存可编辑数据与统计数据。通过 Bootstrap 配置选择后，也可以用 D1 适配器替换任一存储。

## Runtime 数据面

Runtime 读取并缓存已经校验的快照，匹配请求，然后返回重定向或透明反代响应。它不会直接连接 PostgreSQL 或 D1。

同一个 Host Core 可以与以下任一平台适配器一起构建：

- Cloudflare Workers
- Vercel Edge Functions
- Netlify Edge Functions

你可以只部署一个平台，也可以部署多个相互独立的平台。启用统计后，每个部署都会把实际入口域名和平台记录到同一个统计 Source 中。

## 三层配置

1. **Bootstrap 配置**：选择 WebUI 加载前必须确定的实现，例如 Repository 和统计 Store。
2. **实例配置**：保存可编辑的 Runtime、统计、访问权限和插件非敏感设置。
3. **重定向规则**：保存分组与基于路径的路由行为。

密钥始终保留在部署环境变量中。实例配置只保存 `I0C_SECRET`、`DATABASE_URL` 之类的绑定名称。

## 编译期扩展

插件通过静态安装和打包进入产物。Host 使用带类型的 Manifest 与 Installation 契约装配数据源、Repository、统计 Store、统计 Sink、Feature 和 Runtime 平台。

这套架构服务于源码级组合与可预测的边缘产物；它不是动态插件市场，也不会在运行时下载远程可执行代码。

## 内置兼容性

| 扩展点 | 内置实现 |
| --- | --- |
| Runtime 平台 | Cloudflare Workers、Vercel Edge Functions、Netlify Edge Functions |
| Runtime 数据源 | WebUI HTTP Snapshot、GitHub Raw |
| WebUI Data Repository | PostgreSQL、Cloudflare D1、GitHub Contents |
| Analytics Store | PostgreSQL、Cloudflare D1 |
| 统计投递 | 带签名 HTTP Collector |
| Runtime Feature | 注重隐私的机器人分类器 |

D1 插件既可以在兼容 Host 中使用注入的原生 Binding，也可以使用 WebUI 的仅服务端 REST 传输。选择 D1 时，仓库当前的 WebUI 部署使用 REST 路径。

## 故障边界

- 快照刷新失败时，Runtime 继续使用上一份有效快照。
- Repository 写入使用乐观版本，拒绝冲突编辑。
- 数据库初始化与 Schema 更新是显式、带版本的操作。
- 关闭已经部署的平台适配器会让该 Runtime 不可用，但不会自动删除平台上的部署。
