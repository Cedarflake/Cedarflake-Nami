# HTTP 统计 Sink 插件

使用 HMAC-SHA256 签名统计事件，并通过边缘运行时兼容的手动重定向与有限瞬时重试投递到配置的 Collector。投递失败会报告给 Runtime 宿主，由宿主保持重定向请求故障放行。

---

[English](README.md) · 简体中文
