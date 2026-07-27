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
`configureAppDataRepositoryBinding` 注入兼容的 `D1Database` binding。需要明确将
[migrations](migrations) 中的两份 SQL 应用到该 binding；构建和应用启动不会自动修改数据库。

仓库当前的 Vercel WebUI 继续使用 PostgreSQL。D1 供支持 D1 binding 的 WebUI
宿主选择，并且仍需搭配 HTTP Runtime 数据源。

## 检查

```bash
pnpm --filter @i0c/plugin-data-repository-d1 check
pnpm --filter @i0c/plugin-data-repository-d1 test
```
