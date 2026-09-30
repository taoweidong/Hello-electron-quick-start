# AGENTS.md

Electron 28 + Vue 3 + TypeScript + Vite + Element Plus 桌面应用，面向 Windows（portable / NSIS），产品名 My-Win-App，包名为 CommonJS。要求 Node >= 18。

## 常用命令

- `npm run electron:dev` — 开发模式：先 `node compile-main.js` 编译主进程，再并行启动 Vite（端口 5180）和 Electron
- `npm run dev` — 仅启动渲染进程 Vite 开发服务器（strictPort，端口固定 5180）
- `npm run type-check` — `tsc --noEmit` 全量类型检查（root tsconfig 引用 node / web 两个子项目）
- `npm run lint` — ESLint 检查并自动修复 `.vue/.js/.ts/.tsx`
- `npm run build` — 类型检查 + 编译主进程 + Vite 构建 + electron-builder --dir
- `npm run build:prod` — 产出 NSIS 安装包（--publish=never）
- `npm run build:portable` — 产出 Windows 便携版 exe
- `npm run clean` — 清理 dist / release / *.tsbuildinfo

没有单元测试框架；`npm run electron:test` 只是运行 `test-main.js` 里的最小冒烟窗口。验证改动用 `npm run type-check` + `npm run lint`，再手动跑 `electron:dev` 确认窗口行为。

## 架构

- `src/main/` — Electron 主进程（TypeScript，经 `tsconfig.node.json` 编译到 `dist/main`，package.json 的 main 指向 `dist/main/index.js`）。入口创建窗口、写日志到 `userData/app.log`（`logToFile`）、构建中文应用菜单；IPC 处理器在 `src/main/ipc/`（appHandlers / fileHandlers）。
- `src/view/` — Vue 3 渲染进程。**Vite 的 root 是 `src/view` 而非项目根**，构建输出 `dist/view`。入口 `src/view/src/main.ts`；页面在 `views/`（Home / Files / Settings / About）；Pinia 在 `store/`；路由在 `router/`。
- `src/shared/` — 主/渲染进程共享代码，别名 `@shared`。
- 路径别名（改动需同步 vite.config.ts 与各 tsconfig）：`@` → `src/view/src`，`@shared` → `src/shared`。
- IPC 约定：`src/main/preload.ts` 用 contextBridge 暴露 `window.electronAPI`（`ipcRenderer.invoke`）；主进程在 `src/main/ipc/` 里 `ipcMain.handle`。渲染进程侧类型声明在 `src/view/src/types/` 与 `src/shared/types/electron.d.ts`——新增 IPC 通道时 preload、handler、类型三处都要改。
- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`。
- 文件渲染/解压：渲染进程 `services/` 按文件类型走 Zip/Rar 提取器与渲染器（jszip、unrar），组件在 `components/renderers/`。

## 陷阱与注意事项

- **`electron:dev` 实际不会连上 Vite 热更新**：脚本从未设置 `VITE_DEV_SERVER_URL`（仓库里只有主进程在读它，无 .env、无 cross-env），Electron 走生产分支加载 `dist/view/index.html`。要看渲染进程最新改动，需先 `vite build` 或手动设 `VITE_DEV_SERVER_URL=http://localhost:5180` 再启动 Electron。主进程有大量 `logToFile` 调试代码即为排查白屏所留。
- **`compile-main.js` 是自定义编译脚本**：tsc 输出落在 `dist/main/main/` 时会把文件搬回 `dist/main/`，把 `src/shared/constants` 复制到 `dist/main/shared/constants`，并把产物中 `../../shared/constants` 改写为 `../shared/constants`。调整主进程目录结构或别名时必须顾及它。
- **`src/shared/constants/` 同时存在 index.ts / index.js / index.d.ts 三份且内容已出现漂移**——改常量时需人工同步三处。
- 打包配置在根目录 `electron-builder.json`（win: portable + nsis x64，输出 `release/`）。`docs/project-structure.md` 声称配置已迁到 `build/config/`，**已过时**——生效的是根目录的 vite.config.ts / tsconfig*.json / electron-builder.json，`build/` 现在只有图标。
- dev 端口固定 5180：vite.config.ts（strictPort）与 electron:dev 的 wait-on 都依赖它，不要改。
- 打包时 dist 与 node_modules 一起进包（见 electron-builder.json 的 files），产物体积大属预期。
