# Proposal

## Why

当前运行时栈已陈旧并开始产生实际成本：Electron 28（2023 年末发布）已超出官方支持窗口，内嵌 Node 18.18 / Chromium 120；Vite 5、ESLint 8、@typescript-eslint 7 等构建链落后多个大版本。生态兼容性裂痕已经出现（vue-tsc 1.x 与 TS 5.9 不兼容的先例），安全补丁与生态新能力均无法跟进，且升级成本随时间递增。

目标生态：**Electron 44**（2026-08-24 发布，内嵌 **Node v24.18.1+** / Chromium 152 / V8 15.2），使开发环境与产品运行时同时进入 Node 24+ 世代。参考：[Electron 44 官方发布博客](https://www.electronjs.org/blog/electron-44-0)、[v44.0.0 release](https://releases.electronjs.org/release/v44.0.0)。

## What Changes

- **Electron 28 → 44.5.x**（**BREAKING**）：内嵌 Node 18.18 → 24.20、Chromium 120 → 152。适配 API 变更：Electron 32 起移除 `File.path`，Files 页拖拽取路径需改用 `webUtils.getPathForFile`。
- **构建链升级**（**BREAKING**，仅工具链）：Vite 5 → 8、@vitejs/plugin-vue → 6、vue-tsc → 3.x、ESLint 8 → 10 并迁移 flat config（`.eslintrc.cjs` → `eslint.config.js`）、@typescript-eslint → 8。TypeScript 目标 7.x（原生编译器）；若 vue-tsc / 生态兼容性不足，则锁定 5.9/6.x 最新（design 阶段决定）。
- **渲染层依赖升级**：Vue 3.4 → 3.5、Element Plus 2.4 → 2.14、vue-router 4 → 5（**BREAKING** 迁移评估）、Pinia 2 → 4（**BREAKING** 迁移评估）。
- **工具链杂项升级**：electron-builder 24 → 26（打包配置兼容性验证）、cross-env → 10、concurrently → 10、wait-on → 9、sass / @vue/tsconfig / eslint-plugin-vue 到当前最新；`@types/node` 对齐 24.x。
- **引擎约束收紧**（**BREAKING**，对贡献者环境）：package.json `engines.node` 由 `>=18` 改为 `>=24`。
- **特别验证项**：`unrar@0.2.0` 已停更多年（非原生模块、无安装脚本），在新 Electron 下 RAR 解压链路的实际可用性需验证，必要时在 design 阶段确定替换方案（如 unrar-js 或 extraResources 携带官方 UnRAR.exe）。
- **保持不变**：全部既有用户可见功能（窗口/中文菜单/文件读写/ZIP/RAR 解压/四页面路由）、构建脚本结构（`type-check`/`lint`/`build`/`electron:test` 等命令语义）、IPC 三处同步约定、打包目标（portable + NSIS x64）、安全基线（contextIsolation / sandbox 配置）。

## Capabilities

### New Capabilities

（无 —— 本变更为行为保持型升级，不引入新的系统行为，规格保持真实、不虚构需求。）

### Modified Capabilities

（无 —— 不改变任何用户可见行为；拖拽取路径的 `webUtils` 适配属于保持既有行为的实现细节。据此在 `.openspec.yaml` 中设置 `skip_specs: true`。）

## Impact

- **代码适配点（预期少量）**：`FilesView.vue` 拖拽路径获取（`webUtils.getPathForFile`）；主进程 API 兼容性审查（`setWindowOpenHandler`、`contextBridge`、菜单等在 28→44 间的语义复核）；Electron 23 起已不支持 Win7，`index.ts` 中 Win7 GPU 分支成为死代码可顺手清理。
- **依赖**：上述全部 dependencies 与 devDependencies；原生模块（better-sqlite3 等）当前尚未引入，后续 change 将基于新 ABI 选型。
- **打包**：electron-builder 26 下重新验证 portable / NSIS 产物结构与实机启动；`files` / `asarUnpack` 等配置项兼容性确认。
- **风险**：跨 16 个 Electron 主版本的一次性升级，回归面广——以既有验证链（type-check / lint / build / electron:test / 便携版实机启动）作为不回退基线，逐项通过后才收尾；TS 7 与 vue-tsc 3 的兼容性、vue-router 5 / Pinia 4 的 API 迁移量为不确定点，均在 design 阶段锁定方案。
- **实施顺序依赖**：本 change 应**先于** `add-sqlite-working-dir` 与 `add-auto-update` 落地——两者分别依赖新栈的原生模块 ABI 与 electron-updater 兼容性。
