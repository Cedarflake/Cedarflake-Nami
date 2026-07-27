# HTTP 原子快照数据源

`@i0c/plugin-http-snapshot-source` 从 HTTPS 端点读取一份经过校验的 Runtime 快照。快照中的 `config.json` 与 `redirects.json` 来自同一个 Repository 版本，因此一次 Runtime 请求不会混用不同保存批次的两份文档。

内置 WebUI 会在下面的端点发布快照：

```text
https://<webui-domain>/api/runtime/snapshot
```

在 `packages/config/src/defaults.ts` 中于构建期选择该数据源：

```ts
source: {
  provider: "http",
  snapshotUrl: "https://u.example.com/api/runtime/snapshot",
  requestTimeoutMs: 5_000,
  maximumFetchAttempts: 2,
  failureBackoffSeconds: 30,
}
```

Runtime 必须先知道这些字段才能加载远程实例配置，因此它们属于启动配置，不能通过 `plugins.*.config` 编辑。

该数据源会合并并发加载、使用 ETag 重新验证、限制请求超时与瞬时错误重试次数，并在刷新失败时继续使用最后一次通过宿主校验的快照。冷启动实例可以使用平台 Runtime 缓存。无效快照结构、无效数据文档或关闭必需 Runtime 插件的配置都不会替换有效缓存。

从仓库根目录运行：

```bash
pnpm --filter @i0c/plugin-http-snapshot-source check
pnpm --filter @i0c/plugin-http-snapshot-source test
```

边缘 Runtime 部署不会共享 WebUI 登录会话，因此快照端点是公开读取端点。两份数据文档都不得保存 Secret 值；插件 Secret 值仍由部署绑定提供。
