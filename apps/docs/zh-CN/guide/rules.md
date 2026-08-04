---
title: 重定向规则
description: 定义精确重定向、前缀重定向与透明反代规则。
---

# 重定向规则

规则位于 `Slots`、`slots` 或兼容旧格式的 `SLOT` 根节点下。路径键可以放入具名分组中便于管理，分组名称不会改变公开路径。

```json
{
  "$schema": "https://raw.githubusercontent.com/Revaea/i0c.cc/main/packages/config/redirects.schema.json",
  "Slots": {
    "Main": {
      "/": {
        "type": "proxy",
        "target": "https://example.com",
        "appendPath": true,
        "description": "主站"
      },
      "/docs": {
        "type": "exact",
        "target": "https://docs.example.com",
        "status": 302
      }
    }
  }
}
```

## 规则类型

| 类型 | 匹配与响应行为 |
| --- | --- |
| `exact` | 只匹配完整路径，并返回 HTTP 重定向 |
| `prefix` | 匹配路径前缀，并返回 HTTP 重定向 |
| `proxy` | 匹配路径前缀，并把请求转发到单个上游 |

字符串值是前缀重定向的简写。需要稳定统计 ID、描述、优先级或反代选项时，建议使用完整对象。

## 通用字段

- `target`：目标 URL。`to` 与 `url` 仍作为别名接受，但三者只能出现一个。
- `appendPath`：为前缀和反代规则拼接未匹配的路径后缀。
- `status`：非反代规则返回的重定向状态码。
- `priority`：多条规则共享基础路径时，数值越小越先执行。
- `analyticsId`：稳定 UUID，用于在路径或目标变化后保留同一条规则的统计身份。
- `description`：只在管理界面展示的说明，最多 500 个字符，不影响路由。

## 透明反代默认值

反代规则默认转发请求方法、请求体、Cookie、Authorization、Origin、Referer 和端到端请求头。上游返回的多个 `Set-Cookie` 会分别传回；必要时，其 Domain 会改写为公开 Runtime 主机。

只有上游明确提出要求时，才需要使用高级 `proxyOptions`：

- 设置或删除请求头、响应头；
- 1–120 秒的上游超时；
- 最大 100 MB 的应用层请求体限制；
- 跟随或透传上游跳转，以及最大跳转次数；
- 改写、保留或移除响应 Cookie Domain。

平台自身限制仍然生效。逐跳头和平台控制头不能作为普通覆盖项安全转发。

## 安全编辑

WebUI 会生成并保留 `analyticsId`。你仍然可以编辑原始 JSON，但替换稳定 ID 会创建新的统计身份。Repository 保存修订前会执行 Schema 校验。
