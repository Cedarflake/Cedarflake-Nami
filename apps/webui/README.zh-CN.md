## 项目简介

i0c.cc WebUI 是一个基于 Next.js 16 的管理面板，用于通过 GitHub OAuth 登录后在线编辑 `config.json` 与 `redirects.json`。保存操作会交给构建期选择的 Data Repository。GitHub Contents 仍是默认实现并保留 commit 历史；PostgreSQL 可用于带乐观并发的数据库保存与原子快照。

这个 WebUI 服务于个人 [i0c.cc](https://github.com/Revaea/i0c.cc) 工作流，作为可选的管理界面维护，不定位为通用的企业级链接管理产品。

服务端 Data Repository 与 Analytics Store 工厂通过 [../../i0c.webui.config.ts](../../i0c.webui.config.ts) 在构建期安装。客户端安全的 UI Renderer 使用 [webui.extensions.ts](webui.extensions.ts)，确保它们留在客户端 Bundle。workspace fixture 会覆盖两条安装链，无需在 WebUI 宿主源码中增加工厂映射；生产 Renderer 清单目前有意保持为空。

该项目提供两种规则编辑方式和独立的设置界面：

- 可视化规则编辑（分组树 + 表单）
- 规则 JSON 编辑（右侧面板，可直接编辑 `redirects.json`）
- 位于侧边栏底部的可视化实例设置（`config.json`，使用共享契约校验）

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

2. 在 GitHub 创建 OAuth App，回调地址填写 `http(s)://<localhost:3000 或 你的域名>/api/auth/callback/github`，然后将 `Client ID`、`Client Secret` 写入 `.env.local` 的 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`。如果是部署在 ▲ Vercel，将配置写到环境变量便好。

   OAuth scope 配置在 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts)。公开目标仓库使用
   `read:user user:email public_repo`，私有目标仓库则将 `public_repo` 改为 `repo`。
   访问模式和管理者 GitHub 数字用户 ID 配置在 `data/config.json` 的 `webui.access` 中。
   可以使用 `gh api user --jq .id` 查询自己的数字 ID。`access.mode` 可设为 `authenticated`、`allowlist`
   或 `public-readonly`；`allowlist` 必须配置管理者 ID，`public-readonly` 可按需配置。
   `blockedGitHubUserIds` 可在 `authenticated` 和 `public-readonly` 模式中按 GitHub 数字账号 ID 拒绝登录；
   `allowlist` 模式会忽略该名单，同一 ID 不能同时属于管理者和黑名单。选择 GitHub Contents 时，`public-readonly` 会为只读账号通过 GitHub 未认证 API 加载指定规则，
   因此目标仓库必须公开；任意 GitHub 用户登录后都可以查看规则和统计，名单内用户可以编辑配置、
   生成渠道链接并手动刷新统计。如果未配置名单，则任何人都不能管理。

3. 构建期 Repository 与 Runtime Source 选择配置在 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts)，可执行 Repository 工厂由 [../../i0c.webui.config.ts](../../i0c.webui.config.ts) 安装。默认 GitHub 方案从 `Revaea/i0c.cc` 的 `data` 分支读取 `config.json` 与 `redirects.json`；二维码使用的 Runtime 规范地址来自 `config.json`。

4. 生成 `NEXTAUTH_SECRET` 并写入 `.env.local`。生产环境将 `NEXTAUTH_URL` 设为 `https://你的域名`，开发环境可将 `NEXTAUTH_URL` 设为 `http://localhost:3000`。

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

6. 打开 [http://localhost:3000](http://localhost:3000) 或 **你的域名**并登录。已配置的管理者可以编辑两份数据文档，其他获准用户则获得所选访问模式定义的权限。

## Data Repository

GitHub Contents 是默认 Repository。它把分支 commit 作为快照 revision，并在同一个 commit 上读取两份文档供 Runtime 发布。

需要使用 PostgreSQL 时，在 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) 中修改 `data.repository`，配置 `DATA_REPOSITORY_DATABASE_URL`，再明确执行迁移和初始化：

```bash
pnpm --filter @i0c/plugin-data-repository-postgres migrate
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

两个命令都会修改所配置的数据库，构建、应用启动、健康检查和普通请求都不会自动运行。初始化会校验两份文件，在同一个事务中只创建缺失文档，并且不会覆盖已有内容。初始化前，需要在 `config.json` 中把 GitHub Repository 与 Raw Source 声明替换为已启用的 `@i0c/data-repository-postgres` 和 `@i0c/http-snapshot-source`，使文档与构建期所选安装保持一致。

使用数据库文档时，还要在同一份启动配置中选择 HTTP Runtime Source，并指向 `https://<webui-domain>/api/runtime/snapshot`。这个公开端点会返回一份带 ETag、经过校验的配置与规则 revision，且不包含 Secret 值。边缘 Runtime 只读取该端点，不会获得 PostgreSQL 连接串。

## 短链接统计

当前部署的统计功能选择 PostgreSQL Store 插件，不依赖特定厂商的数据库 API。对于小型部署，可以使用 [Neon](https://neon.com/pricing) 等免费托管 PostgreSQL；[Supabase](https://supabase.com/pricing) 也可以使用同一插件和迁移。如果服务商提供连接池地址，建议优先使用。

仓库还包含完整的 D1 Store，它通过同一套统计行为契约，并拥有独立迁移。D1 目前用于验证协议和支持其他宿主；当前 Vercel WebUI 仍使用 PostgreSQL。选择 D1 的宿主必须在 Store 初始化前注入 D1 binding。`data/config.json` 必须至多选择一个 Store；关闭全部 Store 时，规则编辑仍可使用，统计路由会报告缺失能力。

1. 创建 PostgreSQL 数据库，并在 WebUI 环境中配置：

   ```dotenv
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ANALYTICS_INGEST_SECRET="replace-with-a-separate-strong-secret"
   CRON_SECRET="replace-with-an-independent-strong-secret"
   ```

2. 在仓库根目录执行 PostgreSQL 插件迁移：

   ```bash
   pnpm analytics:migrate
   ```

3. 配置每个 Runtime 部署，将签名后的事件发送到 WebUI：

   ```dotenv
   ANALYTICS_WRITE_KEY="the-same-value-as-ANALYTICS_INGEST_SECRET"
   ```

收集端地址和统计 source ID 来自 `data/config.json`。source ID 必须是共享的基础域名，而不是平台名称。使用 `i0c.cc` 时，`i0c.cc`、`www.i0c.cc`、`api.i0c.cc`、`vc.i0c.cc`、`nf.i0c.cc` 可以分别统计，无需再维护一份域名列表。命名空间之外的域名会存为 `unknown`。

使用 GitHub 登录后，可以在 `/<locale>/analytics` 查看 1、7、30 和 90 天范围的统计。1 天趋势使用滚动小时桶；更长范围使用按当前设备 IANA 时区对齐的自然日桶。入口域名筛选会一致作用于总数、趋势、路由、国家或地区、设备、平台、来源域名、渠道、内部来源和自动化分析。`/<locale>/analytics/automation` 会把已声明机器人、疑似自动化和未匹配 Runtime 请求的观测值与抽样估算值分开展示。

事件接收端兼容 V1，并严格校验 V2 的 link 与 Runtime 事件。过期、签名无效、正文过大、分类不一致或 source 错误的事件都会被拒绝。查询接口与渠道链接接口要求已经通过 WebUI 身份验证的会话。

对象形式的规则使用稳定的 `analyticsId`，因此只要保留该 ID，修改短链路径也不会切断后续统计历史。字符串简写规则使用确定性的兼容标识；将其转换为对象形式后会开始使用新的稳定标识。匹配事件全量采集；未匹配和系统 Runtime 事件按 10% 抽样，并同时显示观测值和估算值。

Runtime 会发送匹配流量对应的配置规则路径、入口域名、平台、结果、受控的流量与机器人分类、国家代码、来源域名和延迟，但不会发送 IP、完整 User-Agent、查询参数、目标地址、完整来源 URL 或原始未匹配路径。浏览器来源、显式签名渠道和验证后的内部短链接来源属于相互独立的维度。

需要生成渠道链接时，已登录的客户端可以调用 `POST /api/analytics/campaigns`，传入 Runtime 地址、统计 ID、渠道 ID 和 1–365 天有效期。返回的签名 `_i0c_via` 参数会绑定精确域名和归一化路径，并由 Runtime 在规则处理前删除。

数据库地址和签名密钥必须仅保存在服务端。Vercel 每天调用受保护的保留端点：原始事件、幂等收据和上游声明在 181 天后过期，小时与天级聚合继续保留。免费方案的额度和休眠策略可能变化，生产使用前请检查服务商的最新限制。

完整事件契约、归因行为、数据库迁移顺序、隐私限制、投递保证和验收场景详见 [统计架构文档](../../docs/analytics.zh-CN.md)。每个 Store 插件自己实现迁移 `status`、`plan` 与 `apply`；迁移属于明确的外部写入，WebUI 构建、启动和健康检查都不会自动执行迁移。

## 部署

在 monorepo 中部署这个包时，Vercel 使用下面的设置：

| 设置 | 值 |
|------|----|
| Framework Preset | Next.js |
| Root Directory | `apps/webui` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

保持开启 Vercel 的 **Include source files outside of the Root Directory in the Build Step**，让构建能够包含共享 workspace 包。将 [.env.example](.env.example) 中的部署绑定与密钥配置到 Vercel。生产环境的 `NEXTAUTH_URL` 必须和部署域名一致，并配置 `CRON_SECRET` 供每日保留请求使用；GitHub OAuth callback URL 必须是 `https://<你的域名>/api/auth/callback/github`。

WebUI 不会把原有非敏感环境变量作为覆盖值或回退值读取。Vercel 中遗留的旧值会被忽略，确认版本化配置部署正常后即可删除。

## 功能概览

- 通过版本化配置选择任意已登录用户、数字用户 ID 白名单或带指定管理员与可选黑名单的 GitHub 全员只读模式。
- 可视化编辑 `redirects.json`：分组树管理 + 规则表单编辑。
- 规则 JSON 编辑器：行号、当前行高亮、JSON 语法校验（格式错误提示）。
- 可视化并校验 `config.json`；只有当前文档无法安全转换为表单时，才显示原始内容恢复编辑器。
- 通过认证后查看已安装 Manifest、配置状态、能力、缺失绑定和所选 Store 健康状态。
- 表单行为对齐 Schema（规范来源：[https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json](https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json)）。
- 支持撤销/重做，便于快速回退编辑。
- 通过所选版本化 Repository 保存；revision 过期时拒绝覆盖较新的内容。
- 所选 Repository 提供链接时，保存成功通知会显示 GitHub commit 链接。

## 注意事项

- OAuth 应用需要 `repo` 权限才能写入私有仓库。
- 若目标仓库为私有，请确认登录账号具备相应写权限。
- 使用 GitHub Repository 时，`public-readonly` 仅支持公开目标，并受 GitHub 未认证 API 请求限额约束。
- 生产环境部署时务必将 `.env.local` 中的凭据配置到对应平台的环境变量管理中。
