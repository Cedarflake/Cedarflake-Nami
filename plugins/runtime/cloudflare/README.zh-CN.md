# Cloudflare Runtime 插件

将 Cloudflare Worker 请求、绑定、国家元数据、Cache API 与 `waitUntil` 适配到平台无关的 Runtime 处理器契约。

`useDefaultCache` 会影响远程配置本身的加载，因此属于编译期适配器参数。远程插件声明不包含适配器字段，只用于确认所选平台仍处于启用状态。

---

[English](README.md) · 简体中文
