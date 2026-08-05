# 机器人分类 Feature 插件

通过 `onAnalyticsEvent` Feature Hook 对受限的 Runtime 统计事件进行分类。注册项具有确定顺序、可配置超时和 fail-open 行为，因此分类故障不能替换重定向响应。

远程声明可以设置 `hookTimeoutMs` 或关闭该 Feature。插件不会保留 IP、完整 User-Agent、查询参数、目标地址或原始未匹配路径。

```bash
pnpm --filter @i0c/plugin-feature-bot-classifier check
pnpm --filter @i0c/plugin-feature-bot-classifier test
```

---

[English](README.md) · 简体中文
