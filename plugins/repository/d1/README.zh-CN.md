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

首次使用新数据库时运行 `pnpm database:init` 完成初始化；后续 Repository Schema 变更
使用 `pnpm database:update d1 repository` 更新。两项操作都需要明确执行，构建和应用启动
不会自动修改数据库。Runtime 仍通过 HTTP 数据源读取已发布的快照。

插件负责文档表结构与领域查询；共用的 D1 传输、迁移和测试基础设施位于
`@i0c/database-d1`。

## 检查

```bash
pnpm --filter @i0c/plugin-data-repository-d1 check
pnpm --filter @i0c/plugin-data-repository-d1 test
```

---

[English](README.md) · 简体中文
