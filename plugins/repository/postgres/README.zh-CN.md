# PostgreSQL 数据 Repository

这个编译期 WebUI 插件将 `config` 与 `redirects` 保存为带版本的
PostgreSQL 文档。它提供乐观并发写入和原子快照读取，同时不让 Runtime
直接依赖 PostgreSQL。

## 前置条件

- PostgreSQL 能够由 `postgres` 客户端连接。
- 迁移命令与 WebUI 启动绑定使用
  `DATA_REPOSITORY_DATABASE_URL`。
- 选择该插件前，已执行本包拥有的迁移。
- WebUI 或 Runtime 快照端点读取前，两个文档都已完成初始化。

## 命令

```bash
pnpm --filter @i0c/plugin-data-repository-postgres check
pnpm --filter @i0c/plugin-data-repository-postgres test
pnpm --filter @i0c/plugin-data-repository-postgres migrate
pnpm --filter @i0c/plugin-data-repository-postgres seed -- --config <config.json> --redirects <redirects.json>
```

迁移与初始化命令都会修改所配置的数据库，不得把它们当成验证命令运行。初始化会先校验两份文件，再在同一个事务中仅创建缺失文档，不会覆盖已有内容。
用于初始化的 `config.json` 必须启用构建所选的 PostgreSQL Repository 与 HTTP Snapshot Source 声明。

## 存储契约

- 文档 revision 为 `0` 表示首次写入可以创建文档。
- 后续写入必须提供当前数字 revision。
- 过期 revision 会被拒绝，不会覆盖较新的内容。
- 快照读取在同一个可重复读事务中返回两个文档。
- 本包使用独立迁移表，不与统计迁移混用。
