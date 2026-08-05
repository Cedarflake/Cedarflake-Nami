# GitHub 数据插件

该官方插件提供两个编译期入口：

- `./runtime` 通过兼容 GitHub Raw 的 HTTPS 读取 `config.json` 与 `redirects.json`，支持 ETag、缓存、请求去重、失败退避和最后有效值。
- `./webui` 通过 GitHub Contents API 读写同一组文档，并使用版本号保护并发写入。

宿主必须显式选择并注册这些入口。插件不会读取未声明的 Secret，也不会从 data 分支加载可执行代码。

仓库位置、分支、文档路径、初始 Raw URL 与公开读取缓存时间必须在读取 `config.json` 前存在，因此属于宿主启动参数。远程插件声明不提供定位字段，只用于确认必需的已安装 Source 与 Repository 仍处于启用状态。

---

[English](README.md) · 简体中文
