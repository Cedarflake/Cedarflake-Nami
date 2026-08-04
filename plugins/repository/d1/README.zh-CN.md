# Cloudflare D1 数据 Repository

这个编译期 WebUI 插件把 `config` 与 `redirects` 保存为带版本的 Cloudflare
D1 文档，并与 PostgreSQL 插件遵循同一套 Data Repository 行为契约：

- 首次初始化和两份文档导入均为原子操作；
- 每次写入都执行乐观 revision 校验；
- 保留不可变版本历史，恢复旧内容时不会改写历史；
- 为 Runtime HTTP Snapshot Source 提供原子快照；
- 校验迁移 checksum 和迁移历史连续性。

## 宿主要求

WebUI 宿主必须在首次使用 Repository 前，通过
`configureAppDataRepositoryBinding` 注入兼容的 `D1Database`。Cloudflare 宿主可以直接
传入原生 binding；其他服务端宿主可以使用 `@i0c/database-d1/rest`，并配置账户 ID、
数据库 ID 与仅服务端可见的 API Token。

选择插件前需要明确应用 [migrations](migrations) 中的两份 SQL；构建和应用启动不会自动
修改数据库。WebUI 提供的迁移命令是 `pnpm data:migrate:d1`。Runtime 仍通过 HTTP 数据源
读取已发布的快照。

插件负责文档表结构与领域查询；共用的 D1 传输、迁移和测试基础设施位于
`@i0c/database-d1`。

## 检查

```bash
pnpm --filter @i0c/plugin-data-repository-d1 check
pnpm --filter @i0c/plugin-data-repository-d1 test
```
