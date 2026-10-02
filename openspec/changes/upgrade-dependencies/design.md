# Design

## Context

现状（动机见 proposal.md - Why）：Electron 28.1.0（内嵌 Node 18.18.2、ABI 119、Chromium 120）、Vite 5.4、ESLint 8（eslintrc 格式）、TypeScript 5.9、vue-tsc 3.3；构建体系已在前次重构中收敛（`rootDir=src`、无后处理脚本），验证链为 `type-check / lint / build / electron:test / 便携版实机启动`。

已核实的外部事实：

- Electron 44.5.1（2026-08 发布）内嵌 Node v24.18.1+（补丁版至 24.20）/ Chromium 152 / V8 15.2
- `vue-tsc@3.3.11` peer 声明 `typescript >=5.0.0`（TS 7 兼容）
- `pinia@4` 需要 `vue ^3.5.11`、`typescript >=5.6`、peer `@vue/devtools-api ^8`；`vue-router@5` 需要 `vue ^3.5.34+` 且接受 `pinia ^4`；`element-plus@2.14` 需要 `vue ^3.3.7` —— 相互咬合无冲突
- `vite@8` 要求 Node `^20.19 || >=22.12`（构建期依赖，本机 Node 24 满足）
- Electron 32 起移除 `File.path`，替代 API 为 `webUtils.getPathForFile`
- `unrar@0.2.0`：无安装脚本、无原生构建依赖（非 .node 模块），但已停更多年

约束：面向 Windows（portable + NSIS）；dev 端口 5180 固定；主进程保持 CJS + 相对导入约定；IPC 三处同步约定不变。

## Goals / Non-Goals

**Goals:**

- 将依赖栈一次性升级到目标版本组合（见 D1），构建、运行、打包三类验证全部通过
- 适配 Electron 28→44 的 API 变更，保持既有功能与安全基线不回退
- 全程可回退：单分支分步提交，每步以完整验证链把关

**Non-Goals:**

- 不引入新功能——SQLite 工作目录、自动升级分别由 `add-sqlite-working-dir`、`add-auto-update` 承接
- 不重构主进程打包方式（维持 tsc 直编，不引入 esbuild/bundle 主进程）
- 不做与升级无关的代码清理（仅允许清理明确的死代码，如 Win7 GPU 分支）
- 不采用超出目标组合的版本（如 `@types/node@26`、Node 26）

## Decisions

**D1 —— 目标版本组合锁定**

| 依赖 | 当前 | 目标 |
|------|------|------|
| electron | 28.1.0 | **44.5.1** |
| electron-builder | 24.13.3 | **26.15.3** |
| vite / @vitejs/plugin-vue | 5.4 / 5.x | **8.3.2 / 6.0.9** |
| vue / vue-router / pinia | 3.4.15 / 4.3.0 / 2.1.7 | **3.5.43 / 5.3.1 / 4.0.3** |
| element-plus / @element-plus/icons-vue | 2.4.4 / 2.3.1 | **2.14.7 / 2.3.2** |
| typescript | 5.9.3 | **7.0.2**（回退链见 D2） |
| eslint / eslint-plugin-vue / @typescript-eslint | 8.57 / 9.x / 7.x | **10.11.0 / 10.11.1 / 8.71.0** |
| vue-tsc / @vue/tsconfig | 3.3.11 / 0.5 | **3.3.11 / 0.9.1** |
| sass / cross-env / concurrently / wait-on | 当前 | **最新稳定**（1.105.1 / 10.1.0 / 10.0.5 / 9.5.1） |
| @types/node | 20.x | **24.x**（对齐 engines，不用 26） |
| jszip / unrar | 3.10.2 / 0.2.0 | **3.10.2 / 0.2.0**（unrar 策略见 D5） |

理由：全部取当前最新稳定，peer 咬合已核实（见 Context）。备选"分两步先 33 后 44"被放弃——中间版本无独立价值，一次性到位 + 验证链把关的总成本更低。

**D2 —— TypeScript 7 直接采用，带回退链**

采用 7.0.2（原生编译器，type-check 显著提速）；验证门为 `npm run type-check` 全绿。若 vue-tsc / 插件在 TS 7 下报错且无法快速修复，回退顺序：7.0.2 → 6.x 最新 → 5.9.3。备选"直接锁 5.9"被放弃：peer 明确支持 TS 7，且 TS 7 是后续生态方向。

**D3 —— ESLint 迁移 flat config**

ESLint 10 仅支持 flat config：`.eslintrc.cjs` → `eslint.config.js`，等价迁移现有规则面（vue3-essential + js recommended + @typescript-eslint recommended、`^_` 未用变量豁免、js 文件的 `no-var-requires` 豁免、dist/release ignores）。备选"停 ESLint 8"被放弃：与 @typescript-eslint 8、插件生态脱节。

**D4 —— 拖拽路径改用 webUtils**

`FilesView.vue` 中 `file.path`（Electron 32 起不存在）改为经 preload 暴露的 `getPathForFile(file)`：preload 用 contextBridge 直接调用 `webUtils.getPathForFile`（渲染层不可直接 import electron 内部模块，且 File 对象不可经 IPC 序列化，此为唯一正解）。同步修改 `ElectronAPI` 类型——遵守三处同步约定。

**D5 —— unrar 验证策略**

实机用 RAR 样本验证 RAR 解压链路。`unrar@0.2.0` 为 node-unrar 包装器（无原生模块），若其运行时依赖外部 unrar 可执行文件而失败，则替换为：extraResources 携带官方 UnRAR.exe + 主进程 spawn（首选），或 unrar-js（WASM）。本 change 只保证 ZIP 链路不回退为硬性门槛，RAR 链路以验证结果决定是否当场替换。

**D6 —— electron-builder 26 兼容沿用**

现有 `electron-builder.json`（files / win targets / portable / nsis）在 26.x 下兼容，沿用；`--publish=never` 保留；portable 与 NSIS 双产物实机启动验证。

**D7 —— 实施顺序（单分支四步提交，每步过验证链再前进）**

1. 构建链：vite / plugin-vue / vue-tsc / eslint(flat) / typescript / sass / @vue/tsconfig / @types/node / cross-env / concurrently / wait-on
2. 渲染层：vue / vue-router / pinia / element-plus / icons + API 迁移适配
3. Electron：electron 44 + `webUtils` 适配 + electron-builder 26 + 打包验证
4. 收尾：engines `>=24`、AGENTS.md / docs/project-structure.md 同步

理由：类型与工具先行能尽早暴露源码隐患；Electron 大版本最后动，缩小问题二分定位面。备选"一次 npm install 全量升级"被放弃：回归定位困难。

**D8 —— Node 版本口径**

开发/构建环境与 `engines.node` 统一为 Node 24 LTS；运行时 Node 由 Electron 44 内嵌（24.18+），不额外引入独立 Node。`@types/node` 取 24.x 对齐，避免误用未发布 API。

## Risks / Trade-offs

- [跨 16 个 Electron 主版本，回归面大] → D7 分步提交，每步跑完整验证链（type-check / lint / build / electron:test / 实机启动 + 四页面功能抽查），问题可二分到具体提交
- [TS 7 × vue-tsc / 插件生态兼容未知数] → D2 回退链；type-check 独立成任务步验证
- [vue-router 5 / Pinia 4 API 迁移] → 现用面极小（`createRouter` + hash history + 选项式 `defineStore`），预期仅 `beforeEach(next)` 回调风格需按 v5 要求改为返回值风格；迁移量在任务步确认
- [vue-router 5 声明了 vite/@pinia/colada 等 peer，npm 可能自动带入多余包] → 每步 `npm ls` 复核依赖树
- [electron-builder 24→26 打包行为差异] → portable + NSIS 双产物实机启动验证；asar 内 `dist/view` 加载路径已由冒烟脚本覆盖
- [Vite 8 的 scss 处理差异（`additionalData` 的 `@use` 注入）] → 构建任务步验证 styles 编译产物
- [unrar 链路本就存疑（停更包）] → D5 策略；即使 RAR 需替换也不阻塞本 change（硬性门槛为 ZIP 不回退）
- [回滚] → 升级前打 tag（`pre-upgrade-stack`），任一步失败 `git revert` 该步即可；本 change 不触及持久化数据，无数据迁移

## Migration Plan

1. 前置：打 tag `pre-upgrade-stack`；确认本机 Node 24（已满足）
2. 按 D7 顺序逐步执行，每步固定流程：`npm install` → 代码适配 → `type-check` → `lint` → `build` → `electron:test` → 实机启动抽查
3. 收尾：engines 收紧、AGENTS.md / docs/project-structure.md 同步、全量验证通过后单次合并
4. 回滚：`git revert` 至 tag；无数据回滚需求

## Open Questions

- D5 的 unrar 实机验证结果（决定是否当场替换 RAR 方案，验证后即决，不影响架构）
- vue-router 5 的可选 peer 是否被 npm 自动带入依赖树（安装时观察，不影响方案）
