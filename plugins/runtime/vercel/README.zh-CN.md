# Vercel Runtime 插件

将 Vercel Edge 请求、国家请求头、选定的环境绑定与 `waitUntil` 适配到平台无关的 Runtime 处理器契约。

环境绑定允许列表需要在远程配置加载前限制边缘 Bundle 能访问的绑定，因此属于编译期适配器参数。远程插件声明不包含适配器字段，只用于确认所选平台仍处于启用状态。

---

[English](README.md) · 简体中文
