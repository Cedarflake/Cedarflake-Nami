# i0c.cc

i0c.cc 是一个个人边缘重定向实验项目，包含数据库驱动的控制面、可选 Runtime 平台、可选统计与编译期扩展。

它面向个人使用和工程实验，不是托管短链接服务，也不以企业级重定向平台为目标。

## 提供的能力

- 从 Cloudflare Workers、Vercel Edge Functions 或 Netlify Edge Functions 中选择一个 Runtime 适配器部署。
- 通过 Next.js WebUI 管理实例配置与重定向规则。
- 默认使用 PostgreSQL 保存可编辑数据与统计，也可以选择 Cloudflare D1 适配器。
- 由 WebUI 提供经过校验的快照，让 Runtime 不接收数据库凭据。
- 在构建期组合数据源、Repository、统计、Feature 与平台适配器。

## 工作区

| 项目 | 路径 | 职责 |
| --- | --- | --- |
| Runtime | [apps/runtime](apps/runtime) | 边缘重定向与透明反代数据面 |
| WebUI | [apps/webui](apps/webui) | 认证、编辑、修订、设置与统计控制面 |
| 文档站 | [apps/docs](apps/docs) | 双语 VitePress 使用、部署、运维与扩展指南 |
| 共享包 | [packages](packages) | 配置、数据库基础设施、插件协议、SDK、Host 与构建契约 |
| 官方插件 | [plugins](plugins) | Runtime 平台、数据源与 Repository、统计和 Runtime Feature |

Runtime 与 WebUI 插件在构建前显式选择。远程实例配置可以配置已安装代码，但不会下载或执行新包。

## 在线端点

- Cloudflare Runtime：https://i0c.cc、https://www.i0c.cc、https://api.i0c.cc
- Vercel Runtime：https://vc.i0c.cc
- Netlify Runtime：https://nf.i0c.cc
- WebUI：https://u.i0c.cc
- 文档站：https://d.i0c.cc

## 本地设置

使用 Node.js 22 和仓库声明的 pnpm 版本：

```bash
corepack enable
pnpm install --frozen-lockfile
```

常用入口：

```bash
pnpm webui:dev
pnpm runtime:dev:cf
pnpm docs:dev
pnpm database:init
```

`pnpm check` 会运行完整工作区检查，也可以使用下方文档中的所有者专用命令。数据库初始化、Schema 更新和平台部署属于显式外部操作，不会随构建或检查执行。

## 文档

- [了解这个项目](apps/docs/zh-CN/guide/getting-started.md)
- [它如何工作](apps/docs/zh-CN/guide/architecture.md)
- [选择部署组合](apps/docs/zh-CN/deployment/choose-a-topology.md)
- [创建第一条规则](apps/docs/zh-CN/guide/first-rule.md)
- [查看统计](apps/docs/zh-CN/guide/analytics.md)
- [数据库初始化与 Schema 更新](apps/docs/zh-CN/operations/database.md)
- [统计口径参考](apps/docs/zh-CN/reference/analytics.md)
- [编译期插件架构](apps/docs/zh-CN/plugins/architecture.md)
- [命令索引](apps/docs/zh-CN/reference/commands.md)
- [Runtime 包文档](apps/runtime/README.zh-CN.md)
- [WebUI 包文档](apps/webui/README.zh-CN.md)
- [English overview](README.md)

## 许可证

Apache-2.0，详见 [LICENSE](LICENSE)。
