# @i0c/plugin-catalog

i0c.cc 宿主使用的静态已安装插件目录。它分别导出 Runtime 与 WebUI Manifest 投影，并根据已安装 Manifest、宿主支持、插件自有 Schema、Secret 声明和插槽冲突校验远程声明。

这个包只进行编译期注册，不在运行时发现或加载包。

```bash
pnpm --filter @i0c/plugin-catalog check
pnpm --filter @i0c/plugin-catalog test
```

完整架构见 [../../apps/docs/zh-CN/plugins/architecture.md](../../apps/docs/zh-CN/plugins/architecture.md)。
