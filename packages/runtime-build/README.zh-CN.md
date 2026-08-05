# Runtime Build

`@i0c/runtime-build` 在构建期解析 Runtime 平台安装项，并通过虚拟模块提供给通用 i0c Runtime 入口。平台包自行声明 Manifest、模块地址、Bundle 依赖和输出入口；`apps/runtime` 不再导入具体适配器。

外部适配器加入根级 Runtime 安装配置后即可构建，不需要在宿主中增加源码文件。

## 检查

```bash
pnpm --filter @i0c/runtime-build check
pnpm --filter @i0c/runtime-build test
```

采用 Apache-2.0 许可证，详见仓库根目录的 `LICENSE`。

---

[English](README.md) · 简体中文
