# i0c.cc 文档站

i0c.cc 双语使用、部署、运维与扩展文档的 VitePress 源码。

在仓库根目录运行：

```bash
pnpm docs:dev
pnpm docs:check
pnpm docs:build
pnpm docs:preview
```

英文页面位于文档根目录，每个面向用户的页面都必须在 `zh-CN` 下存在对应中文页面。`pnpm docs:check` 会先检查路由是否成对，再构建文档站。

生成的 `.vitepress/dist` 属于本地构建产物，不应直接编辑或提交。发布站点、配置 `d.i0c.cc` 或修改 DNS 均属于独立的外部操作。

## Vercel 部署

创建独立的 Vercel 项目，并把 Root Directory 设为 `apps/docs`。仓库内的 [vercel.json](vercel.json) 使用 Corepack 管理的 pnpm 从仓库根安装工作区、执行 `corepack pnpm build`，并发布 `.vitepress/dist`。文档站不需要在仓库根目录放置 Vercel 配置。

确认部署健康后再绑定 `d.i0c.cc`。创建项目、部署、绑定域名与修改 DNS 仍属于需要明确执行的外部操作。

---

[English](README.md) · 简体中文
