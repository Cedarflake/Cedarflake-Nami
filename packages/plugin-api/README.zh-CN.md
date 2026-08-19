# 插件 API

`@nami/plugin-api` 定义 Nami 宿主与插件共用的稳定编译期协议。

它负责插件 Manifest、宿主与插槽声明、能力、配置元数据、Secret 要求、初始化服务、健康检查、迁移协议，以及 Runtime 和 WebUI 使用的类型化扩展边界。

该包不包含平台 SDK、数据库驱动、React 组件或动态插件加载器。插件必须是由宿主在构建时明确选择的 workspace 或包依赖。

插件配置 Schema 有意只支持一组经过校验的 JSON Schema 子集：`type`、`properties`、`required`、布尔值 `additionalProperties`、`items`、`enum`、`const`、`minimum`、`maximum`、`minLength`、`pattern`、`uniqueItems` 与 `uri` format。注册 Manifest 时会拒绝未支持的关键字或类型、非法正则表达式和非 JSON 字面量。

---

[English](README.md) · 简体中文
