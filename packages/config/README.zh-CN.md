# @i0c/config

Runtime 与 WebUI 共用的数据契约和启动配置包。

普通实例配置存放在 `data` 分支的 `config.json`，并由 [config.schema.json](config.schema.json) 与 [src/validation.ts](src/validation.ts) 中兼容边缘环境的校验器共同约束。Runtime 与 WebUI 会远程读取该文档，因此有效更新不需要重新构建应用。

路由规则存放在同一分支的 `redirects.json`，其结构由 [redirects.schema.json](redirects.schema.json) 描述。两份 data 文档的 Schema 统一归入此包，可避免 WebUI 编辑器反向依赖 Runtime 应用包。

[src/defaults.ts](src/defaults.ts) 只保存远程配置加载前必须存在的安全回退值和启动信息：GitHub 仓库、data 分支、文档路径与 OAuth scope。只有迁移数据源本身时才修改这些值；启动配置变化需要重新构建消费方。

密钥和部署绑定仍保留在各应用的环境变量中。这个包不得写入凭据、数据库地址、签名密钥或认证密钥。

`webui.access` 契约保存访问模式、管理者 GitHub 数字账号 ID，以及非白名单模式可选的用户黑名单。

插件公开配置按命名空间放在 `plugins` 中；其中 `secrets` 只保存环境变量绑定名称，不保存密钥值。消费方会直接打包 TypeScript 源码，因此配置包的构建只校验源码，不生成需要提交的产物。

在仓库根目录运行配置包检查：

```bash
pnpm config:check
```

英文版本见 [README.md](README.md)。
