# i0c.cc Runtime

面向 Cloudflare Workers、Vercel Edge Functions、Netlify Edge Functions 等 fetch 兼容边缘平台的可选式重定向运行时。它会强制 HTTPS、返回 favicon，并通过所选 Data Source 加载非敏感实例配置与重定向规则。部署时选择适合的平台适配器即可，三个平台不要求同时运行。

在线预览：

- Cloudflare 域名：https://i0c.cc、https://www.i0c.cc、https://api.i0c.cc
- Vercel 部署：https://vc.i0c.cc
- Netlify 部署：https://nf.i0c.cc

## 部署

部署这个包时，请把 `apps/runtime` 作为项目根目录。

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

构建时必须使用完整的 monorepo 检出。Vercel 需要保持开启 **Include source files outside of the Root Directory in the Build Step**，让构建能够包含共享 workspace 包。

包目录中的 `pnpm build` 会一次生成并保留三个平台的产物。需要单独构建或部署某个平台时，仍可使用对应的平台专用命令。

部署完成后：

- 非敏感配置或规则变化时，通过所选 WebUI Repository 保存 `config.json` 或 `redirects.json`。默认 Git 方案使用 `data` 分支；内置 Source 会在对应缓存时间结束后获取有效更新，不需要重新构建。
- 在 WebUI 和每个平台的 Runtime 中设置相同的 `I0C_SECRET`。
- 更新公共重定向逻辑后重新执行包构建，然后再部署。

## 选择适配器

- Runtime 宿主：[src/entry.ts](src/entry.ts)
- 已安装 Runtime 插件与平台：[../../i0c.runtime.config.ts](../../i0c.runtime.config.ts)
- 构建装配：[../../packages/runtime-build](../../packages/runtime-build)

需要自定义平台或 Runtime Feature？在 workspace 中新增提供 Manifest 与类型化工厂或 `./installation` 入口的包，再把它加入 `i0c.runtime.config.ts` 即可。Runtime 宿主源码和官方 Catalog 不需要增加插件专属改动。外部 fixture 会构建自定义平台与 Feature，并在生成产物中验证 Feature 标记。当前契约证明的是源码 workspace 内的接入能力；共享插件包尚未作为公共 npm SDK 发布。程序化消费者仍可从 [src/lib/handler.ts](src/lib/handler.ts) 引入 `handleRedirectRequest`。稳定的插件 Manifest 与适配器契约位于 [../../packages/plugin-api](../../packages/plugin-api)。

每次构建只注入所选 Runtime 适配器，并通过同一份根安装配置装配 Data Source、Analytics Sink 与 Feature。远程声明会控制可选插件的启停、配置和 Secret 绑定名称。已安装包与所选 Source 的初始连接设置必须在读取 `config.json` 前可用，因此仍属于启动配置。包结构与故障边界详见 [../../docs/plugins.zh-CN.md](../../docs/plugins.zh-CN.md)。

## 环境变量与配置

非敏感实例配置统一维护在所选 Repository 的 `config.json`。[../../packages/config](../../packages/config) 负责 schema、校验、构建期 Source 选择和安全回退值。Runtime 不会再把旧环境变量作为覆盖值或回退值读取，平台后台遗留的旧值会被忽略。

### 远程 Runtime 配置

`config.json` 负责：

- `runtime.canonicalOrigin`：WebUI 二维码等共享消费者使用的 Runtime 规范公开地址。
- `runtime.robotsPolicy`：设为 `allow` 时开放 `robots.txt` 并提供 sitemap；设为 `disallow` 时阻止抓取并关闭 sitemap。
- `runtime.configCacheTtlSeconds`：`config.json` 的缓存时间。
- `runtime.redirectsCacheTtlSeconds`：`redirects.json` 的缓存时间。
- `analytics.ingestEndpoint`：WebUI 统计收集端的 HTTPS 地址。
- `analytics.sourceId`：所有平台共用的小写基础域名和稳定统计命名空间。
- `plugins`：按命名空间隔离的非敏感插件设置，以及环境变量密钥绑定名称。

### 选择 Data Source

GitHub Raw 仍然可用，并保留分别缓存 `config.json` 与 `redirects.json` 的行为。在 [../../packages/config/src/defaults.ts](../../packages/config/src/defaults.ts) 中使用 `data.source.provider: "github"` 选择它。

仓库当前启用的 HTTP Snapshot Source 会从 WebUI 原子读取两份文档：

```ts
source: {
  provider: "http",
  snapshotUrl: "https://u.example.com/api/runtime/snapshot",
  requestTimeoutMs: 5_000,
  maximumFetchAttempts: 2,
  failureBackoffSeconds: 30,
}
```

它会合并并发加载、使用 ETag、限制超时和瞬时错误重试次数，并在刷新失败时保留最后一次通过宿主校验的内存或平台缓存快照。无效快照结构、数据文档或必需插件声明都不会替换当前版本。PostgreSQL Repository 应搭配该 Source，让 Runtime 接收数据库中保存的状态，但不获得数据库凭据。Source 选择属于构建期启动配置，修改后需要重新构建 Runtime。

选择 GitHub Raw 时，程序化消费者可以通过 `HandlerOptions` 覆盖其地址，或直接注入完整数据源。

### 配置统计密钥

只有版本化收集端地址、source ID 均有效并设置下面的密钥时，才会启用统计事件投递：

- `I0C_SECRET`：用于签名统计投递的共享实例密钥。WebUI 和每个平台的 Runtime 必须使用相同值。

本地占位值见 [.env.example](.env.example)。内置 Runtime 不再从环境中读取其他配置项。

匹配成功的重定向和代理事件会全量发送；未匹配和系统结果按 10% 抽样，使任意机器人和探测流量可以分析，又不必上报每个 404。Cloudflare、Vercel、Netlify 分别使用平台的后台执行能力。收集端故障只会记录日志，不会改变重定向响应；当前属于尽力投递，没有重试队列。每次请求都使用 HMAC-SHA256 签名，签名放在 `X-Analytics-Signature`，签名时间戳放在 `X-Analytics-Timestamp`。

事件会分别记录实际入口域名和适配器平台。入口域名必须是配置的 source 域名或其子域名，其他域名归为 `unknown`。浏览器来源域名、签名渠道 ID 和验证后的内部短链接来源保持为相互独立的归因维度。受控短链接续跳使用短期签名 `_i0c_via` token，并在规则处理前删除。

分类只在边缘端本地生成受控的流量、机器人、置信度、资源、设备、匹配、结果和探测类别。因此，即使机器人访问 `redirects.json` 之外的路径，也能进入抽样 Runtime 分析。事件不会发送 IP、完整 User-Agent、完整来源 URL、查询参数、目标地址或原始未匹配路径。匹配事件只包含配置中的规则路径和稳定统计 ID。旧规则没有 `analyticsId` 时，Runtime 会生成确定性的兼容 ID。通过 WebUI 保存的显式对象规则会持久化 UUID；字符串简写规则在转换成对象格式前继续使用兼容 ID。

计数口径、归因 token、抽样、隐私限制、迁移顺序和验收场景详见 [统计架构文档](../../docs/analytics.zh-CN.md)。

自定义适配器启用统计后，还应通过 `HandlerOptions` 传入 `provider`、可选的 `country` 和平台提供的 `waitUntil`。

在仓库根目录运行插件契约、Runtime 测试与独立平台构建：

```bash
pnpm plugins:check
pnpm runtime:check
pnpm runtime:test
pnpm runtime:build:cf
pnpm runtime:build:vc
pnpm runtime:build:nf
```

### `redirects.json` 配置速查

也可以部署 [WebUI 面板](../webui) 在线编辑 `redirects.json`。

在 `redirects.json` 中提供 `Slots` 对象即可定义路由规则。下表列出每条路由可用字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `analyticsId` | UUID 字符串 | 自动生成或推导 | 稳定的统计身份。修改路径或目标地址时应保持不变。 |
| `description` | string | 不设置 | 最多 500 字符的可选管理备注；Runtime 匹配和响应时会忽略它。 |
| `type` | string | `prefix` | 路由模式：`prefix` 前缀重定向，`exact` 精确匹配，`proxy` 反向代理。 |
| `target` | string | `""` | 目标地址，`target`、`to`、`url` 三选一。 |
| `to` / `url` | string | `""` | `target` 的别名字段，`target`、`to`、`url` 三选一。 |
| `appendPath` | boolean | `true` | `prefix` 或 `proxy` 模式下是否拼接剩余路径，`exact` 不适用。 |
| `proxyOptions` | object | 省略 | `proxy` 规则可选的请求头、响应头、跳转、Cookie、超时和请求体限制覆盖。 |
| `status` | number | `302` | 非 `proxy` 响应使用 200 到 599 的状态码，`proxy` 不要设置。 |
| `priority` | number | 按顺序 | 同一路径存在多条规则时用于排序，数字越小越先匹配。 |

- 键名需要以 `/` 开头，可以使用冒号参数，例如 `:id`，也可以使用 `*` 通配符。匹配结果可以在目标地址中用 `$1`、`:id` 等占位符引用。
- 多个路径模式同时匹配时，字面量片段优先于冒号参数，参数优先于 `*`；共享片段特异性相同时，层级更深的模式优先。
- `proxy` 类型会把请求转发到目标地址并返回上游响应，其他类型返回 `Location` 重定向。
- 代理请求会保留 `Cookie`、`Authorization`、`Origin`、`Referer` 等应用层请求头。Runtime 会删除逐跳头，重设 `X-Forwarded-Host` 与 `X-Forwarded-Proto`，并在上游跳转到不同源时停止转发凭据。
- 上游安全响应头和多个独立的 `Set-Cookie` 等响应头会得到保留。Cookie 的 `Domain` 属性会被移除，使其绑定到公开代理域名。
- `proxyOptions.requestHeaders` 与 `proxyOptions.responseHeaders` 使用字符串设置对应头字段，使用 `null` 删除对应头字段。Runtime 管理的协议头不能覆盖；上游跳转到不同源后也不会重新应用自定义请求头。
- 代理默认最多跟随五次上游跳转。`proxyOptions.redirects` 可以修改次数或直接返回上游跳转；可选超时和请求体限制分别使用秒与 MB，部署平台自身限制仍然有效。
- 如果需要为同一路径配置多条规则，可以把值写成数组。数组顺序决定默认优先级，也可以通过 `priority` 显式指定。

在文件顶部添加下面的 schema 引用，可以在支持的编辑器里获得自动补全和校验。Schema 放在 `main` 分支，即使 `redirects.json` 在 `data` 分支也能生效：

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json",
  "Slots": {
    // ...
  }
}
```

#### 示例 `redirects.json`

```jsonc
{
  "Slots": {
    "/": "https://example.com",
    "/docs/:page": [
      {
        "type": "exact",
        "target": "https://kb.example.com/:page",
        "status": 302,
        "priority": 1
      },
      {
        "type": "prefix",
        "target": "https://docs.example.com/:page",
        "appendPath": false,
        "status": 301,
        "priority": 5
      }
    ],
    "/promo": {
      "target": "https://example.com/campaign",
      "status": 308
    },
    "/api": [
      {
        "type": "exact",
        "target": "https://status.example.com/healthz",
        "status": 200,
        "priority": 1
      },
      {
        "type": "proxy",
        "target": "https://api.example.com",
        "appendPath": true,
        "priority": 10
      },
      {
        "type": "proxy",
        "target": "https://backup-api.example.com",
        "appendPath": true,
        "priority": 20
      }
    ],
    "/media/*": {
      "type": "proxy",
      "target": "https://cdn.example.com/$1",
      "proxyOptions": {
        "requestHeaders": {
          "Referer": "https://www.example.com/"
        },
        "redirects": {
          "maxHops": 3
        },
        "timeoutSeconds": 10,
        "maxRequestBodyMegabytes": 5
      }
    },
    "/admin": {
      "type": "prefix",
      "target": "https://console.example.com",
      "appendPath": true,
      "status": 307
    }
  }
}
```

英文版本见 [README.md](README.md)。
