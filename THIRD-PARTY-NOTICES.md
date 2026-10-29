# APUI 第三方组件与许可声明

| 项目 | 内容 |
|---|---|
| 版本 | v1.0 |
| 生效日期 | 2026-10-29 |
| 适用软件 | APUI 0.1.x |
| 说明 | 本文件汇总 APUI 使用/依赖的第三方组件。正式发布前应结合实际依赖版本复核。 |

---

## 1. APUI 自身

| 项 | 内容 |
|---|---|
| 名称 | APUI（Album Player 新版 Web 操作界面） |
| 版权 | Copyright 2026 harmonyosnews |
| 许可证 | **Apache License 2.0** |
| 许可证文件 | [`LICENSE`](LICENSE) |
| 归属/声明文件 | [`NOTICE`](NOTICE) |

APUI 的源代码、构建产物、安装/卸载脚本和文档按 Apache 2.0 授权。您可以在遵守 Apache 2.0 的条件下复制、修改、分发。

---

## 2. 运行时第三方组件

### 2.1 Album Player for Linux（aplayer）

| 项 | 内容 |
|---|---|
| 名称 | Album Player for Linux |
| 版本基线 | 2.19 |
| 权利人 | Album Player 作者/权利人 |
| 许可证 | 第三方 freeware/闭源（以官方发布为准） |
| 是否包含在 APUI 发布包 | **否** |
| APUI 使用方式 | 通过本机 HTTP 接口（默认 7778）通信；不修改、不反编译、不重新分发 aplayer 二进制 |

- APUI 不是 Album Player 的官方产品，也未获得其权利人背书。
- 您需要自行从官方渠道获取并安装 aplayer，并遵守其许可/条款。
- Album Player 及其名称、标识、商标归其权利人所有。

### 2.2 TinyLMS

| 项 | 内容 |
|---|---|
| 名称 | TinyLMS |
| 版本参考 | 1.3.4（界面/交互参考） |
| 权利人 | TinyLMS 项目/权利人 |
| 许可证 | 以 TinyLMS 项目发布为准 |
| 是否包含在 APUI 发布包 | **否** |
| APUI 使用方式 | 仅作为视觉/交互参考；APUI 代码与样式为独立编写，发布包不包含 TinyLMS 的代码或资源 |

- TinyLMS 及其名称、标识、商标归其权利人所有。
- 如 TinyLMS 权利人对“参考”范围有异议，请联系交付方处理。

---

## 3. 构建/测试依赖（不随运行时发布包分发）

以下组件用于开发、构建和自动化测试，**不包含在 APUI 运行时发布包**中。实际版本以 `web/package-lock.json` 为准；发布前应复核许可证。

| 组件 | 用途 | 典型许可证 | 是否随发布包 |
|---|---|---|---|
| Vite | 前端构建 | MIT | 否 |
| TypeScript | 类型检查/编译 | Apache-2.0 | 否 |
| esbuild | Vite 构建依赖 | MIT | 否 |
| Playwright-core | GUI 自动化测试 | Apache-2.0 | 否 |
| Chromium（Playwright 缓存） | 测试浏览器 | BSD-style + 第三方许可 | 否 |
| Node.js | 构建运行时 | MIT | 否 |
| npm | 包管理 | Artistic-2.0 | 否 |

> 这些工具仅用于生成/验证静态产物；APUI 运行时不需要 Node.js、Vite 或 Playwright。

---

## 4. 字体、图标与图片

| 项 | 说明 |
|---|---|
| 字体 | APUI 使用系统字体栈（如 `-apple-system`、`Segoe UI`、`PingFang SC`、`Microsoft YaHei`），**不随包分发字体文件**。系统字体的许可由操作系统/字体权利人决定。 |
| 图标 | 使用内联 SVG（写在 JS/HTML 中），不使用第三方图标字体；图标路径由本项目编写/组合。如后续引入第三方图标，应在此登记其名称、版本、许可证与出处。 |
| 图片 | 专辑封面/电台图片由 aplayer 或第三方电台提供；APUI 发布包不包含这些图片。 |
| 测试截图 | `gui-test-screenshots/` 中的截图可能包含第三方专辑封面/电台 logo，仅用于项目验收，不应作为独立素材再分发。 |

---

## 5. 许可证文本

- Apache License 2.0 全文见 [`LICENSE`](LICENSE)。
- Apache License 2.0 由 Apache Software Foundation 发布；许可证文本本身的版权归 Apache Software Foundation。
- 其他第三方许可证文本请以各项目官方发布为准；如分发时需要，应将对应许可证文本随包提供。

---

## 6. 合规建议

1. 发布前运行 `npm ls --all` / `npm audit`，复核实际依赖版本与许可证。
2. 如将 APUI 用于商业产品/系统集成，请让法务审阅 Apache 2.0 义务、NOTICE 保留、商标使用和第三方许可。
3. 不要在发布包中包含 aplayer 二进制、TinyLMS 代码/资源、第三方专辑封面/电台图片，除非您已获得相应授权。
4. 如修改 APUI 源代码，请在修改文件中显著标明修改，并保留 `LICENSE`/`NOTICE`。
5. 本文件不构成法律意见；正式发布前应由交付方/法务确认。
6. 仓库中的 `work/` 是现场分析快照（含厂商前端/资源），不属于 APUI 发布包，不得对外分发；打包/发布前应排除。`gui-test-screenshots/` 可能含第三方封面/电台 logo，仅用于验收，不应作为独立素材再分发。
