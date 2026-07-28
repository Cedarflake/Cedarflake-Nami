# i0c.cc

i0c.cc 是一个以数据库为控制面、默认启用 PostgreSQL、并保留归档 Git 回退方案的个人边缘重定向实验项目。同一套核心可以通过不同边缘平台适配器运行，并提供自用的 WebUI 与可选统计功能。

## 项目定位

这个仓库面向个人使用和工程实验，不准备成为托管短链接服务或企业级重定向平台。

- 按部署环境选择所需的 Runtime 适配器；Cloudflare、Vercel 与 Netlify 是可选方案，不要求同时运行。
- 默认使用 PostgreSQL；兼容的 WebUI 宿主也可绑定 Cloudflare D1，实现即时保存、不可变历史与回滚；Git 只作为归档的构建期回退方案保留。
- WebUI 与统计功能服务于个人工作流；后续路线优先保证清晰和可靠，不追求与商业产品功能对齐。

## 项目

| 项目 | 路径 | 说明 |
|------|------|------|
| Runtime | [apps/runtime](apps/runtime) | 可按平台选择的重定向运行时，支持 Cloudflare Workers、Vercel Edge Functions 与 Netlify Edge Functions。 |
| WebUI | [apps/webui](apps/webui) | 基于 Next.js 的管理面板，用于编辑 `config.json` 与 `redirects.json`、查看插件状态并查询统计。 |
| 配置 | [packages/config](packages/config) | 两个应用共用的启动默认值、两份数据文档 Schema 与校验。 |
| 插件 API | [packages/plugin-api](packages/plugin-api) | 官方插件使用的稳定编译期 Manifest、生命周期契约与类型化扩展边界。 |
| 插件 SDK | [packages/plugin-sdk](packages/plugin-sdk) | 用于开发 workspace 编译期插件的内部辅助函数与脚手架。 |
| 插件 Testkit | [packages/plugin-testkit](packages/plugin-testkit) | 共享插件契约与依赖边界检查。 |
| 插件目录 | [packages/plugin-catalog](packages/plugin-catalog) | 可选的官方预设与按宿主执行的插件配置校验。 |
| Runtime 宿主 | [packages/runtime-host](packages/runtime-host) | 平台无关的 Runtime 部署与可执行插件安装契约。 |
| Runtime 构建 | [packages/runtime-build](packages/runtime-build) | 构建期安装校验、根配置绑定与所选适配器 Bundle 生成。 |
| 官方插件 | [plugins](plugins) | Git、PostgreSQL 与 D1 数据后端、HTTP Runtime 快照源、三个 Runtime 适配器、统计投递与存储，以及机器人分类。 |

可执行插件在构建期选择：Runtime 安装位于 [i0c.runtime.config.ts](i0c.runtime.config.ts)，WebUI 服务端安装位于 [i0c.webui.config.ts](i0c.webui.config.ts)，客户端安全的 WebUI Renderer 位于 [apps/webui/webui.extensions.ts](apps/webui/webui.extensions.ts)。远程 `config.json` 文档只能配置已安装代码，不会下载或执行新包。

## 在线预览

- Runtime Cloudflare 域名：https://i0c.cc、https://www.i0c.cc、https://api.i0c.cc
- Runtime Vercel 部署：https://vc.i0c.cc
- Runtime Netlify 部署：https://nf.i0c.cc
- WebUI：https://u.i0c.cc

## 部署

这个仓库现在是 monorepo。部署时不要把仓库根目录当成一个单独应用，而是分别选择要部署的子项目目录。

### Runtime

从 [apps/runtime](apps/runtime) 部署重定向运行时。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Revaea/i0c.cc&root-directory=apps/runtime)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Revaea/i0c.cc)
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Revaea/i0c.cc)

如果平台检测到多个项目，请选择 `apps/runtime`。

平台要求填写项目或构建配置时，使用下面的值：

| 平台 | 项目根目录 | 构建命令 | 输出 |
|------|------------|----------|------|
| Cloudflare Workers | `apps/runtime` | `pnpm build:cf` | `dist/platforms/cloudflare.js` |
| Vercel | `apps/runtime` | `pnpm build:vc` | `.vercel/output` |
| Netlify | `apps/runtime` | `pnpm build:nf` | `dist` |

构建时必须使用完整的 monorepo 检出，确保 Runtime 可以导入共享 workspace 包。Vercel 需要保持开启 **Include source files outside of the Root Directory in the Build Step**。仓库当前启用的 Runtime Source 会从 WebUI 读取一份原子 HTTP 快照；GitHub Raw 仍可作为构建期回退方案。请在 WebUI 和每个平台的 Runtime 中配置相同的 `I0C_SECRET`。

### WebUI

从 [apps/webui](apps/webui) 部署管理面板。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Revaea/i0c.cc&root-directory=apps/webui)

Vercel 使用下面的设置：

| 设置 | 值 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

Vercel 需要保持开启 **Include source files outside of the Root Directory in the Build Step**，让 WebUI 构建能够包含共享 workspace 包。WebUI 环境只保留 OAuth 与部署绑定、数据库访问和密钥，详见 [apps/webui/README.zh-CN.md](apps/webui/README.zh-CN.md)。

## 应用配置

所选 WebUI Repository 包含两份可独立编辑的文档：

- `config.json` 存放非敏感实例配置，包括 Runtime 规范域名、缓存时间、robots 策略、统计命名空间与收集端地址、WebUI 访问策略，以及按命名空间隔离的插件配置。
- `redirects.json` 存放重定向规则。

PostgreSQL 与 D1 Repository 实现同一套乐观版本、原子快照、不可变历史、导入导出和回滚契约。仓库当前部署选择 PostgreSQL；支持 D1 的 WebUI 宿主可选择 D1，并在 Repository 初始化前注入数据库 binding。

GitHub Contents 仍保留为归档的构建期回退方案，并可在指定分支保留 commit，但仓库当前部署不会启用它。WebUI 可以编辑两份文档；即使 `config.json` 写坏，管理员仍能看到原文并修复。

仓库当前启用的 HTTP Snapshot Source 从 WebUI 读取一份经过校验的快照，确保配置和规则来自同一个 Repository revision；它使用 ETag、有限重试与超时，并保留最后一次有效的内存或平台缓存。选择 Git 数据后端时仍可使用 GitHub Raw。Runtime 部署不会获得数据库凭据或 binding。

[packages/config](packages/config) 负责 schema、校验、安全默认值，以及构建期 Repository 与 Source 选择。修改 GitHub 路径、数据库类型或连接策略、HTTP 快照地址或 GitHub OAuth scope 等启动配置后仍需重新构建。Repository 迁移属于明确的外部写入，构建与应用启动都不会自动执行。

原有非敏感环境变量不再作为覆盖值或回退值读取。平台后台遗留的旧值会被忽略，确认新部署正常后即可删除。密钥和与部署绑定的值继续保留在各应用的环境变量示例中。

## 本地开发

先启用 Corepack，让 `pnpm` 使用 `package.json` 中声明的版本：

```bash
corepack enable
```

在仓库根目录安装依赖：

```bash
pnpm install
```

运行 runtime：

```bash
pnpm runtime:dev:cf
```

运行 WebUI：

```bash
pnpm webui:dev
```

分别构建所需 Runtime 适配器与 WebUI：

```bash
pnpm runtime:build:cf
pnpm runtime:build:vc
pnpm runtime:build:nf
pnpm webui:build
```

运行插件、Runtime 与 WebUI 测试：

```bash
pnpm plugins:check
pnpm runtime:check
pnpm runtime:test
pnpm webui:test
```

提交前运行完整本地验证：

```bash
pnpm check
```

## 数据文档

所有 Repository 实现共用下面的文档 schema：

```text
packages/config/config.schema.json
packages/config/redirects.schema.json
```

两份文件分别通过 `$schema` 声明自己的 schema。默认 Git 工作流可以使用下面的命令校验本地 `origin/data` Git 引用中的两份数据：

```bash
pnpm data:validate
```

## 文档

- Runtime 文档：[apps/runtime/README.zh-CN.md](apps/runtime/README.zh-CN.md)
- WebUI 文档：[apps/webui/README.zh-CN.md](apps/webui/README.zh-CN.md)
- 统计架构与口径：[docs/analytics.zh-CN.md](docs/analytics.zh-CN.md)
- 内部插件架构：[docs/plugins.zh-CN.md](docs/plugins.zh-CN.md)
- 英文总览：[README.md](README.md)

## 许可证

Apache-2.0，详见 [LICENSE](LICENSE)。
