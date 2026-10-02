# AGENTS.md

Electron 44 + Vue 3.5 + TypeScript 6 + Vite 8 + Element Plus 桌面应用，面向 Windows（portable / NSIS），产品名 My-Win-App，包名为 CommonJS。要求 Node >= 24（运行时由 Electron 44 内嵌 Node 24.21）。当前版本 1.0.1。

## 常用命令

- `npm run electron:dev` — 开发模式：先 `tsc -p tsconfig.node.json` 编译主进程，再并行启动 Vite（端口 5180）和 Electron（cross-env 注入 `VITE_DEV_SERVER_URL`，渲染进程走 Vite 热更新）
- `npm run dev` — 仅启动渲染进程 Vite 开发服务器（strictPort，端口固定 5180）
- `npm run type-check` — 真实全量类型检查：`vue-tsc` 查渲染进程 + `tsc` 查主进程
- `npm run lint` — ESLint 10（flat config：`eslint.config.mjs`）检查并自动修复
- `npm run build` — 类型检查 + 编译主进程 + Vite 构建 + electron-builder --dir
- `npm run build:prod` — 产出 NSIS 安装包（--publish=never）
- `npm run build:portable` — 产出 Windows 便携版 exe
- `npm run electron:test` — 冒烟测试：加载构建产物并自动退出（exit 0 成功 / 1 失败），需先 `npm run build`
- `npm run clean` — 清理 dist / release / *.tsbuildinfo

没有单元测试框架；验证改动用 `npm run type-check` + `npm run lint` + `npm run electron:test`，再手动跑 `electron:dev` 确认窗口行为。

## 架构

- `src/main/` — Electron 主进程（TypeScript，经 `tsconfig.node.json` 编译，package.json 的 main 指向 `dist/main/main/index.js`）。入口创建窗口、写日志到工作目录 `logs/app.log`（`logToFile`）、启动时初始化 SQLite、构建中文应用菜单；IPC 处理器在 `src/main/ipc/`（appHandlers / fileHandlers / workspaceHandlers / settingsHandlers）。
- 工作目录与数据：`src/main/workspace/` 解析工作目录（默认 `D:\MyWinApp`，env `MYWINAPP_WORKDIR` 覆盖，不可用回落 `userData`），固定 `logs/`、`data/`、`config/` 子布局；`src/main/db/` 基于 `node:sqlite`（Node 24 内置）持有 `data/app.db`（WAL），启动时建库建表（`settings` 键值表），IPC `settings:get` / `settings:set` / `workspace:get` 提供配置读写与目录信息。
- 自动更新：`src/main/updater/` 基于 electron-updater（generic provider），三级更新源 env `MYWINAPP_UPDATE_URL` > settings 表 `update.url` > 打包内置 `app-update.yml`；`autoDownload` + `autoInstallOnAppQuit`，启动延迟 5s 自动检查；状态经 `update:status` 事件推送，IPC `update:check` / `update:install` / `update:get-status`。**发布流程**：`build:prod` 后将 `release/` 下的 `latest.yml`、`My-Win-App-<版本>-x64.exe`、`.blockmap` 三件套上传到更新源服务器；仅 NSIS 安装版可自更新，portable 需手动分发。
- `src/view/` — Vue 3 渲染进程。**Vite 的 root 是 `src/view` 而非项目根**，构建输出 `dist/view`。入口 `src/view/src/main.ts`；页面在 `views/`（Home / Files / Settings / About）；Pinia 在 `store/`；路由在 `router/`。
- `src/shared/` — 主/渲染进程共享代码，别名 `@shared`。
- 主进程构建的关键：`tsconfig.node.json` 的 `rootDir` 是 `./src`（不是 `./src/main`），产物布局为 `dist/main/main/**` + `dist/main/shared/**`，源码里的相对导入（`../../shared/constants`）在产物中原样成立，**不需要任何编译后处理脚本**。
- 路径别名（改动需同步 vite.config.ts 与各 tsconfig）：`@` → `src/view/src`，`@shared` → `src/shared`。
- IPC 约定：`src/main/preload.ts` 用 contextBridge 暴露 `window.electronAPI`（`ipcRenderer.invoke`）；主进程在 `src/main/ipc/` 里 `ipcMain.handle`。类型单一来源是 `src/shared/types/electron.d.ts` 的 `ElectronAPI` 接口（preload 实现它，`src/view/src/types/electron.d.ts` 据此做全局 Window 增强）——新增 IPC 通道时 preload、handler、类型三处都要改。
- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`。
- 文件渲染/解压：渲染进程 `services/` 按文件类型走 Zip/Rar 提取器与渲染器（jszip、node-unrar-js），组件在 `components/renderers/`；主进程经 IPC `zip:extract` / `rar:extract` 解压到 `userData/extracted/`。

## 陷阱与注意事项

- **主进程只有相对导入可用**：tsc 不改写 paths 别名，主进程源码不要用 `@shared` 别名导入运行时模块（类型 import 除外，如 preload），否则产物在运行时无法解析。
- **TypeScript 锁定 6.x**：TS 7 原生编译器移除了 `./lib/tsc` 导出，vue-tsc 3 无法加载（已实测）；升级 TS 前必须先验证 `npm run type-check`。TS 6 已弃用 `baseUrl` 与 `moduleResolution: node`，主进程用 `module/moduleResolution: node16`。
- **拖拽文件取路径必须走 `electronAPI.getPathForFile`**（Electron 32+ 已移除 DOM `File.path`，官方替代为 `webUtils.getPathForFile`，经 preload 暴露）。
- **`src/shared/constants/index.ts` 是唯一版本**，不要再生成/提交编译产物（.js/.d.ts）。
- dev 端口固定 5180：vite.config.ts（strictPort）与 electron:dev 的 wait-on 都依赖它，不要改。
- 打包配置在根目录 `electron-builder.json`（win: portable + nsis x64，输出 `release/`）。`files` 不含 node_modules——electron-builder 自动附带生产依赖，不要手动加回去。
- 排查运行时问题先看工作目录下的 `logs/app.log`（默认 `D:\MyWinApp\logs\app.log`；工作目录不可用回落 `userData` 时在 `userData/logs/app.log`）。
- `docs/project-structure.md` 已与实际结构同步，改动结构时记得更新它。
