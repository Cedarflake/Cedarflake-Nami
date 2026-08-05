## 项目简介

i0c.cc WebUI 是一个基于 Next.js 16 的管理面板，用于通过 GitHub OAuth 登录后在线编辑 `config.json` 与 `redirects.json`。仓库当前默认使用 PostgreSQL，实现即时乐观保存、原子快照、不可变版本历史与回滚。原有 GitHub Contents 流程保留为归档的构建期替代方案，默认不启用。

这个 WebUI 服务于个人 [i0c.cc](https://github.com/Revaea/i0c.cc) 工作流，作为可选的管理界面维护，不定位为通用的企业级链接管理产品。

服务端 Data Repository 与 Analytics Store 工厂通过 [../../i0c.webui.config.ts](../../i0c.webui.config.ts) 在构建期安装。客户端安全的 UI Renderer 使用 [webui.extensions.ts](webui.extensions.ts)，确保它们留在客户端 Bundle。workspace fixture 会覆盖两条安装链，无需在 WebUI 宿主源码中增加工厂映射；生产 Renderer 清单目前有意保持为空。

该项目默认提供可视化规则编辑和独立的设置界面：

- 可视化规则编辑（分组树 + 表单）
- 重新启用 GitHub Repository 时提供 Git 专属的规则来源切换与 JSON 编辑
- 位于侧边栏底部的可视化实例设置（`config.json`，使用共享契约校验）
- 数据库备份导入导出与不可变版本历史

## 快速开始

1. 在 `apps/webui` 目录下复制示例环境变量：

   - macOS/Linux：
     ```bash
     cp .env.example .env.local
     ```
   - Windows PowerShell：
     ```powershell
     Copy-Item .env.example .env.local
     ```

2. 创建 PostgreSQL 数据库，为 WebUI 配置 `DATABASE_URL`。随后在仓库根目录初始化两个选中的数据库插件槽：

   ```bash
   pnpm database:init
   ```

   该命令读取仓库内的 Bootstrap Provider 选择，先初始化 Data Repository，再初始化 Analytics Store。两组 Schema 已是最新时可以安全重复执行。初始化属于明确的外部写入，不会在构建、启动、健康检查或普通请求中自动执行。

   如果改用 D1，请在 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) 中把 Repository 与 Analytics Store 的 `provider` 设为 `"d1"`。没有原生 D1 binding 的宿主还需在 `bootstrapConfig.webui.d1` 填写非敏感的 Cloudflare Account ID 与两个 Database ID，并配置具有 D1 读写权限的 `CLOUDFLARE_D1_API_TOKEN`，然后运行同一个初始化命令。

   初始化命令只会创建或升级所选数据库的表结构，不会把 PostgreSQL 中的文档、修订历史或统计记录复制到 D1。

   注入原生 binding 的宿主可以不填写 REST ID，但必须通过自己的 D1 工具应用同一批插件 Schema migration；构建和启动不会自动更新 Schema。

3. 在 GitHub 创建 OAuth App，回调地址填写 `http(s)://<localhost:3000 或你的域名>/api/auth/callback/github`，并配置 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`。默认 scope 为 `read:user user:email`；PostgreSQL 控制面不需要 Repository 权限。

4. 生成一个至少 32 个随机字节的 `I0C_SECRET`，并在 WebUI 与每个平台的 Runtime 中配置相同值。NextAuth 通常会自动推断请求地址；仅当自托管代理未正确转发地址时，才设置可选的 `NEXTAUTH_URL` 覆盖值。

   - 使用 OpenSSL：
     ```bash
     openssl rand -base64 32
     ```
   - 或使用 Node.js：
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

5. 在仓库根目录安装依赖并启动开发服务器：

   ```bash
   pnpm install
   pnpm webui:dev
   ```

6. 打开 [http://localhost:3000](http://localhost:3000) 或部署域名。数据库为空时，WebUI 会进入初始化页面。登录 GitHub、输入共享的 `I0C_SECRET`、选择已部署的 Runtime 适配器与公开地址，然后原子创建初始 `config.json` 和空的 `redirects.json`。当前 GitHub 账号会成为首位管理者。

7. 初始化完成后继续保留 `I0C_SECRET`，它还用于签名 WebUI 会话和 Runtime 统计事件。

## Data Repository

仓库当前通过 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) 选择 PostgreSQL，并使用 `DATABASE_URL`。选择 D1 后，内置 WebUI 会优先使用注入的原生 `D1Database` binding；没有 binding 时，则使用配置的 Account ID、Database ID 与 `CLOUDFLARE_D1_API_TOKEN` 通过 Cloudflare 服务端 REST API 连接。

PostgreSQL 与 D1 由同一套共享行为契约约束。首次初始化会原子创建两份文档，并拒绝只存在其中一份文档的半初始化数据库。在可视化规则弹窗中确认后，该次修改会立即保存并创建不可变版本。GitHub Contents 会声明手动保存能力，因此仍保留页面级保存和本地撤销/重做。导入会先校验两份 JSON，再原子替换；恢复则把旧内容复制为新的活动版本，不会改写历史。管理者可以在 **设置 → 数据与历史** 中导出、导入、查看和恢复版本。

D1 使用 [../../plugins/repository/d1/migrations](../../plugins/repository/d1/migrations) 中的独立 Schema migration。首次使用所选数据库时运行 `pnpm database:init`；后续 Repository Schema 变更使用 `pnpm database:update d1 repository`。Vercel 不提供原生 D1 binding，因此 WebUI 会通过仅服务端 REST 适配器继续使用同一套 Binding 兼容契约。

`seed` 命令继续用于受控的非交互初始化或导入，但不再属于正常部署流程：

```bash
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

使用数据库文档时，还要在同一份启动配置中选择 HTTP Runtime Source，并指向 `https://<webui-domain>/api/runtime/snapshot`。这个公开端点会返回一份带 ETag、经过校验的配置与规则 revision，且不包含 Secret 值。边缘 Runtime 只读取该端点，不会获得数据库连接信息或 binding。

GitHub Contents 与 GitHub Raw 继续保留在 workspace 中，作为归档的构建期替代方案。重新启用时，需要主动修改启动 Repository 与 Runtime Source 选择、恢复对应的 OAuth Repository scope，并重新构建两个应用；它们不属于默认首次初始化流程。

## 短链接统计

当前部署的统计功能选择 PostgreSQL Store 插件，不依赖特定厂商的数据库 API。对于小型部署，可以使用 [Neon](https://neon.com/pricing) 等免费托管 PostgreSQL；[Supabase](https://supabase.com/pricing) 也可以使用同一插件和 Schema migration。如果服务商提供连接池地址，建议优先使用。

仓库还包含完整的 D1 Store，它通过同一套统计行为契约，并拥有独立 Schema migration。它既可以使用注入的原生 binding，也可以使用内置的服务端 REST 适配器。`data/config.json` 必须至多选择一个 Store；启动配置中的 Analytics Store 选择决定初始化页面生成的首份文档。关闭全部 Store 时，规则编辑仍可使用，统计路由会报告缺失能力。

1. 创建 PostgreSQL 数据库，并在 WebUI 环境中配置：

   ```dotenv
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   I0C_SECRET="replace-with-the-shared-instance-secret"
   ```

2. 在仓库根目录更新 PostgreSQL 统计 Schema：

   ```bash
   pnpm database:update postgres analytics
   ```

   通过 REST 适配器使用 D1 时，请配置 `CLOUDFLARE_D1_API_TOKEN`，并执行 `pnpm database:update d1 analytics`。使用原生 binding 的宿主也可以通过自己的 D1 工具应用相同的 Schema migration。这些命令不会在构建或启动时自动运行。

3. 配置每个 Runtime 部署，将签名后的事件发送到 WebUI：

   ```dotenv
   I0C_SECRET="the-same-value-as-the-WebUI-I0C_SECRET"
   ```

收集端地址和统计 source ID 来自 `data/config.json`。source ID 必须是共享的基础域名，而不是平台名称。使用 `i0c.cc` 时，`i0c.cc`、`www.i0c.cc`、`api.i0c.cc`、`vc.i0c.cc`、`nf.i0c.cc` 可以分别统计，无需再维护一份域名列表。命名空间之外的域名会存为 `unknown`。

使用 GitHub 登录后，可以在 `/<locale>/analytics` 查看 1、7、30 和 90 天范围的统计。1 天趋势使用滚动小时桶；更长范围使用按当前设备 IANA 时区对齐的自然日桶。入口域名筛选会一致作用于总数、趋势、路由、国家或地区、设备、平台、来源域名、渠道、内部来源和自动化分析。`/<locale>/analytics/automation` 会把已声明机器人、疑似自动化和未匹配 Runtime 请求的观测值与抽样估算值分开展示。

事件接收端兼容 V1，并严格校验 V2 的 link 与 Runtime 事件。过期、签名无效、正文过大、分类不一致或 source 错误的事件都会被拒绝。查询接口与渠道链接接口要求已经通过 WebUI 身份验证的会话。

对象形式的规则使用稳定的 `analyticsId`，因此只要保留该 ID，修改短链路径也不会切断后续统计历史。字符串简写规则使用确定性的兼容标识；将其转换为对象形式后会开始使用新的稳定标识。匹配事件全量采集；未匹配和系统 Runtime 事件按 10% 抽样，并同时显示观测值和估算值。

Runtime 会发送匹配流量对应的配置规则路径、入口域名、平台、结果、受控的流量与机器人分类、国家代码、来源域名和延迟，但不会发送 IP、完整 User-Agent、查询参数、目标地址、完整来源 URL 或原始未匹配路径。浏览器来源、显式签名渠道和验证后的内部短链接来源属于相互独立的维度。

需要生成渠道链接时，已登录的客户端可以调用 `POST /api/analytics/campaigns`，传入 Runtime 地址、统计 ID、渠道 ID 和 1–365 天有效期。返回的签名 `_i0c_via` 参数会绑定精确域名和归一化路径，并由 Runtime 在规则处理前删除。

数据库地址和实例密钥必须仅保存在服务端。统计事件写入后，WebUI 会在后台低频安排数据保留，不再暴露维护端点，也不需要另一项部署密钥。原始事件、幂等收据和上游声明在 181 天后过期，小时与天级聚合继续保留。免费方案的额度和休眠策略可能变化，生产使用前请检查服务商的最新限制。

完整事件契约、归因行为、Schema 更新顺序、隐私限制、投递保证和验收场景详见[统计架构文档](../docs/zh-CN/reference/analytics.md)。每个 Store 插件自己实现 `schemaMigrationStatus`、`schemaMigrationPlan` 与 `applySchemaMigrations`；Schema 更新属于明确的外部写入，WebUI 构建、启动和健康检查都不会自动执行。

## 部署

在 monorepo 中部署这个包时，Vercel 使用下面的设置：

| 设置 | 值 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Install Command | `corepack pnpm -C ../.. install --frozen-lockfile` |
| Build Command | `corepack pnpm build` |
| Output Directory | Next.js default |

仓库内的 `vercel.json` 负责安装与构建命令，避免 Vercel 未识别仓库根锁文件时回退到 npm。保持开启 Vercel 的 **Include source files outside of the Root Directory in the Build Step**，让构建能够包含共享 workspace 包。将 [.env.example](.env.example) 中的必填部署绑定配置到 Vercel。GitHub OAuth callback URL 必须是 `https://<你的域名>/api/auth/callback/github`；仅当部署地址无法正确自动推断时才配置 `NEXTAUTH_URL`。

WebUI 不会把原有非敏感环境变量作为覆盖值或回退值读取。Vercel 中遗留的旧值会被忽略，确认版本化配置部署正常后即可删除。

## 功能概览

- 通过版本化配置选择任意已登录用户、数字用户 ID 白名单或带指定管理员与可选黑名单的 GitHub 全员只读模式。
- 可视化编辑 `redirects.json`：分组树、规则描述、规则表单，以及弹窗内的高级反向代理编辑器。
- GitHub Repository 专属的规则来源切换和 JSON 编辑器，支持当前行高亮与语法校验。
- 可视化并校验 `config.json`；只有当前文档无法安全转换为表单时，才显示原始内容恢复编辑器。
- 数据库首次初始化，无需手写 JSON 或执行 seed。
- 带 Git 风格行差异的不可变文档历史、非破坏性回滚，以及原子 JSON 备份导入导出。
- 通过认证后查看已安装 Manifest、配置状态、能力、缺失绑定和所选 Store 健康状态。
- 表单行为对齐 Schema（规范来源：[https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json](https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json)）。
- GitHub Contents 在页面级显式保存前保留本地撤销/重做。
- 通过所选版本化 Repository 保存；revision 过期时拒绝覆盖较新的内容。
- 所选 Repository 提供结果链接时，保存成功通知会显示该链接。

## 注意事项

- 只有主动重新启用归档的 GitHub Repository 时，才需要 Repository OAuth 权限并受到公开目标限制。
- 生产环境部署时务必将 `.env.local` 中的凭据配置到对应平台的环境变量管理中。

---

[English](README.md) · 简体中文
