---
title: 部署 Runtime
description: 让 Cloudflare、Vercel 或 Netlify 中的一个平台接收公开请求并读取 WebUI 快照。
---

# 部署 Runtime

Runtime 是公开入口。访客访问短链接时，请求到达这里，而不是 WebUI。

下面三个平台只需选择一个。开始前请确认 WebUI 已完成初始化，并准备好与 WebUI 完全相同的 `I0C_SECRET`。

## 1. 指向自己的 WebUI 快照

Runtime 在构建时就要知道从哪里读取第一份快照。打开 `packages/config/src/defaults.ts`，把：

```ts
bootstrapConfig.data.source.snapshotUrl
```

改为自己的 WebUI 地址：

```text
https://your-webui.example.com/api/runtime/snapshot
```

仓库默认值指向公开的 i0c.cc 实例。自行部署时如果不改，Runtime 不会读取你刚初始化的数据库。

修改快照来源后需要重新构建 Runtime。以后在 WebUI 中修改普通规则或实例设置，则不需要重新构建。

## 2. 选择一个平台

### Cloudflare Workers

创建 Worker 项目并使用完整的 Monorepo 检出。项目根目录是 `apps/runtime`，`wrangler.toml` 已配置：

```text
Build command: pnpm build:cf
Entry file: dist/platforms/cloudflare.js
```

在 Worker Secrets 中添加 `I0C_SECRET`，然后部署。仓库根目录对应的本地命令是：

```sh
pnpm runtime:build:cf
pnpm runtime:deploy:cf
```

部署命令会写入当前 Wrangler 账号，只在确认目标账号和环境后执行。

### Vercel Edge Functions

创建另一个 Vercel 项目，Root Directory 设为 `apps/runtime`。保持开启 **Include source files outside of the Root Directory in the Build Step**。

`apps/runtime/vercel.json` 已配置：

```text
Build command: pnpm build:vc
Output directory: .vercel/output
```

在项目环境变量中添加 `I0C_SECRET`。也可以从仓库根目录使用：

```sh
pnpm runtime:build:vc
pnpm runtime:deploy:vc
```

### Netlify Edge Functions

创建 Netlify Site，Base directory 设为 `apps/runtime`。`netlify.toml` 会执行 `pnpm build:nf`，并把生成的 Edge Function 映射到所有路径。

在 Site 环境变量中添加 `I0C_SECRET`。对应的根目录命令是：

```sh
pnpm runtime:build:nf
pnpm runtime:deploy:nf
```

## 3. 绑定公开域名

把准备好的 `go.example.com` 绑定到刚部署的 Runtime。不要把这个域名指向 WebUI。

新实例还没有规则时，直接打开该域名应该看到 i0c.cc 的 404 页面。这个结果不是故障：它说明 DNS、平台部署和 Runtime Handler 已经连通，只是当前快照没有匹配路径。

如果平台直接返回自己的 404、500 或 Bad Gateway，先检查项目根目录、平台构建命令、`I0C_SECRET` 和快照 URL。

<!-- 需要真实截图：任选一个 Runtime 平台部署成功后的域名与环境变量位置，不显示密钥值。 -->

## 4. 回到 WebUI 核对实例设置

在 WebUI 的设置页确认 Runtime 规范地址就是刚绑定的 HTTPS 域名，并且已启用实际部署的平台适配器。关闭仍在运行的平台适配器会让那份部署进入错误兜底，并不会替你删除外部项目。

Runtime 已就绪。下一步[创建第一条规则](/zh-CN/guide/first-rule)，把刚才的 404 变成一次真实跳转。
