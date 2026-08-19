# PostgreSQL 数据 Repository

这个编译期 WebUI 插件将 `config` 与 `redirects` 保存为带版本的
PostgreSQL 文档。它提供乐观并发写入和原子快照读取，同时不让 Runtime
直接依赖 PostgreSQL。

插件负责文档表结构、事务与领域查询；共用的 PostgreSQL 客户端创建和迁移历史校验位于
`@nami/database-postgres`。

## 前置条件

- PostgreSQL 能够由 `postgres` 客户端连接。
- 内置数据库命令与可选 seed 命令使用 `DATABASE_URL`。
- WebUI 使用启动配置中选择的数据库绑定，默认是 `DATABASE_URL`。
- 打开 WebUI 初始化流程前，已初始化所选 Repository Schema。
- Runtime 快照端点读取前，已通过 WebUI 初始化流程或可选的非交互 seed
  命令创建两份文档。

## 命令

```bash
pnpm --filter @nami/plugin-data-repository-postgres check
pnpm --filter @nami/plugin-data-repository-postgres test
pnpm database:init
pnpm database:update postgres repository
pnpm --filter @nami/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

初始化、Schema 更新与 seed 命令都会修改所配置的数据库，不得把它们当成验证命令运行。正常首次部署应先初始化 Schema，再由 WebUI 在 GitHub 身份认证和共享实例密钥校验后原子创建两份文档。seed 继续用于受控的非交互导入；它会先校验两份文件，再在同一个事务中仅创建缺失文档，不会覆盖已有内容。
用于初始化的 `config.json` 必须启用构建所选的 PostgreSQL Repository 与 HTTP Snapshot Source 声明。

## 存储契约

- 文档 revision 为 `0` 表示首次写入可以创建文档。
- 后续写入必须提供当前数字 revision。
- 过期 revision 会被拒绝，不会覆盖较新的内容。
- 快照读取在同一个可重复读事务中返回两个文档。
- 每次初始化、保存、导入和恢复都会写入不可变历史；恢复旧内容会创建新的活动 revision。
- 本包使用独立 Schema 历史表，不与 Analytics Schema 版本混用。

---

[English](README.md) · 简体中文
