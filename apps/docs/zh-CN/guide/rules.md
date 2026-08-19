---
title: 管理规则
description: 根据实际 URL 行为选择精确跳转、前缀跳转或透明反代，并在需要时查看原始 JSON。
---

# 管理规则

新建规则时，先别从字段名出发。先问自己：访客打开这个路径后，浏览器地址栏应该发生什么？

## 只跳一个路径：`exact`

`exact` 只匹配填写的完整路径。

```text
/docs        → 命中
/docs/setup  → 不命中
```

它适合普通短链接、活动入口或一个固定旧地址。测试时用 `302` 或 `307`，确定不会再改后再考虑 `301` 或 `308`，避免浏览器长期缓存错误结果。

## 迁移整段路径：`prefix`

`prefix` 会匹配一个路径以及它下面的内容。

例如路径是 `/old`，目标是 `https://new.example.com`，并开启“拼接路径”：

```text
/old          → https://new.example.com/
/old/install  → https://new.example.com/install
```

它适合站点迁移、目录改名和一组结构相同的旧链接。关闭“拼接路径”后，所有命中请求都会去同一个目标地址。

## 地址栏保持不变：`proxy`

`proxy` 让 Runtime 代替浏览器请求上游。访客继续看到公开 Runtime 域名：

```text
浏览器访问 https://go.example.com/images/a.jpg
Runtime 请求 https://image.example.com/a.jpg
```

默认透明反代会保留应用层请求信息，包括方法、请求体、Cookie、Authorization、Origin 和 Referer；逐跳头仍会被移除。上游返回的 `Set-Cookie` 会分别传给浏览器，并按公开代理域名处理 Cookie Domain。

大多数自有服务不需要再填高级选项。上游明确要求固定 Referer、额外请求头、较短超时或特殊跳转行为时，才打开“高级反向代理”。部署平台自己的请求体和执行时间限制仍然优先。

## WebUI 中的几个常用字段

- **路径**必须以 `/` 开头；分组名称只整理界面，不会加到路径前面。
- **描述**只给管理者看，不参与匹配，也不会发送给访客。
- **统计 ID**由 WebUI 生成。修改路径或目标时保留它，统计历史才会继续归在同一条规则下。
- **优先级**只在多条规则可能同时命中时有用，数字越小越先执行。
- **状态码**只用于跳转规则，`proxy` 不返回跳转状态。

使用数据库保存规则时，弹窗确认后会立即创建新修订。只有改用 GitHub Contents 存储插件后，页面才会恢复暂存、撤销、重做和统一“保存改动”的工作流。

## 需要直接编辑 JSON 时

可视化编辑器已经覆盖日常字段。只有在排查兼容格式、批量检查或使用 GitHub 存储方式时，才有必要打开 JSON 编辑器。

一份简化配置如下：

```json
{
  "$schema": "https://raw.githubusercontent.com/Cedarflake/Cedarflake-Nami/main/packages/config/redirects.schema.json",
  "Slots": {
    "Main": {
      "/docs": {
        "type": "exact",
        "target": "https://docs.example.com",
        "status": 302,
        "description": "项目文档"
      },
      "/old": {
        "type": "prefix",
        "target": "https://new.example.com",
        "appendPath": true,
        "status": 308
      },
      "/images": {
        "type": "proxy",
        "target": "https://image.example.com",
        "appendPath": true
      }
    }
  }
}
```

`Slots` 下可以使用具名分组，也兼容旧格式的 `slots` 与 `SLOT`。字符串值仍是前缀跳转的简写，但完整对象更适合长期维护，因为它能保存描述、优先级和稳定统计 ID。

共享 Schema 会在保存前检查未知字段、目标地址、状态码与反代选项。完整高级字段以 WebUI 表单和 `packages/config/redirects.schema.json` 为准。

规则保存后但 Runtime 仍返回旧结果时，先等待规则缓存周期，再按[故障排查](/zh-CN/operations/troubleshooting)检查快照来源和密钥。
