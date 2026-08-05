# 插件测试工具

`@i0c/plugin-testkit` 提供与测试运行器无关的 i0c.cc 插件契约断言。官方插件使用同一组断言校验 Manifest、数据源、仓库、Runtime 平台、统计 Sink、统计 Store、健康检查和迁移。

该包只用于开发和测试。生产宿主与插件 Bundle 应依赖 `@i0c/plugin-api`，不能依赖 Testkit。

---

[English](README.md) · 简体中文
