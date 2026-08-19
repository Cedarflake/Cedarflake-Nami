---
title: 准备数据库
description: 创建 PostgreSQL 或 D1 存储，并在第一次部署前初始化 Nami 需要的表。
---

# 准备数据库

数据库只由 WebUI 使用。它保存实例设置、重定向规则、修订历史和可选统计；Runtime 不连接数据库。

如果你还没有明确选择，先用 PostgreSQL。仓库默认配置已经选择它，而且一个数据库就够用。

## 使用 PostgreSQL

先在 Neon 或其他 PostgreSQL 服务中创建一个空数据库，取得连接地址。它通常类似：

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

把这个值放到 WebUI 的部署环境中。运行初始化命令的本地 Shell 也需要临时读取同一个值。

在仓库根目录安装依赖后执行：

```sh
pnpm database:init
```

这条命令会依次准备规则与设置需要的表，再准备统计表。它只处理仓库启动配置中当前选中的数据库插件；表已经是最新版本时可以安全重复执行。

完成后，你会得到一个结构已经准备好、但还没有实例文档的数据库。第一次打开 WebUI 时，初始化页面会创建首份设置和空规则集。

## 使用 Cloudflare D1

D1 需要两个空数据库：

- 规则数据库，保存设置、规则和修订；
- Analytics 数据库，保存事件和聚合统计。

在 Cloudflare Dashboard 中创建它们，然后记下 Account ID 和两个 Database ID。接着修改 `packages/config/src/defaults.ts`：

1. 把 `data.repository.provider` 改为 `"d1"`；
2. 把 `webui.analyticsStore.provider` 改为 `"d1"`；
3. 填写 `webui.d1.accountId` 与两个 `databaseIds`。

为 WebUI 和本地初始化命令提供一个具有这两个 D1 数据库读写权限的 Token：

```dotenv
CLOUDFLARE_D1_API_TOKEN="your-d1-read-write-api-token"
```

然后仍然从仓库根目录运行：

```sh
pnpm database:init
```

内置 WebUI 默认通过 Cloudflare 的服务端 API 访问 D1。以后如果把 WebUI 放到能注入原生 D1 Binding 的 Host，也可以让自定义适配器使用同一套数据库契约。

## 初始化不会自动发生

`pnpm build`、应用启动和普通健康检查都不会创建或更新表。第一次部署要先运行 `pnpm database:init`；已有实例在新版本增加 Schema 时，才使用[数据库更新](/zh-CN/operations/database)中的 `pnpm database:update` 命令。

切换 PostgreSQL 与 D1 也不会复制旧数据。更换数据库类型只会改变后续读写的位置；跨数据库搬迁需要单独导出、转换、导入和核对。

数据库准备好后，继续[部署 WebUI](/zh-CN/deployment/webui)。
