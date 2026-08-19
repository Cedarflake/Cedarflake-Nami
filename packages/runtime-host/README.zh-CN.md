# Runtime Host

`@nami/runtime-host` 负责平台无关的 Runtime 装配契约。它把 Nami 请求处理器与一个编译期平台插件组合起来，并校验已安装的 Runtime Data Source、Analytics Sink 与 Feature 集合，但不会导入具体实现。

workspace 内的插件提供 Manifest 与类型化工厂或 Runtime Installation 入口，再通过根目录 `nami.runtime.config.ts` 加入构建。Platform 与 Feature fixture 已证明该装配无需修改 `apps/runtime` 源码。公共包分发不属于当前契约。

## 检查

```bash
pnpm --filter @nami/runtime-host check
pnpm --filter @nami/runtime-host test
```

采用 Apache-2.0 许可证，详见仓库根目录的 `LICENSE`。

---

[English](README.md) · 简体中文
