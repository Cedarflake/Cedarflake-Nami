# `@i0c/database-d1`

i0c 插件共用的 Cloudflare D1 基础设施。

此包提供与 Binding 兼容的精简数据库契约、带结果校验的操作辅助函数、供非 Cloudflare 宿主使用的 HTTP REST 传输，以及可复用的迁移机制。具体数据表与领域 SQL 仍由各 Repository 或 Analytics Store 插件负责。

REST 传输需要仅服务端可见的 Cloudflare API Token。不得将其暴露给浏览器代码或写入实例数据配置。
