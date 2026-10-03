# My-Win-App

基于 **Electron 44 + Vue 3.5 + TypeScript 6 + Vite 8 + Element Plus** 的 Windows 桌面应用（My-Win-App），面向 portable / NSIS 双分发形态，内置工作目录管理、SQLite 配置存储与自动升级能力。

| 技术 | 版本 | 说明 |
|------|------|------|
| **Electron** | 44.5.1 | 运行时内嵌 Node 24.21 / Chromium 152 |
| **Vue** | 3.5.43 | 渲染进程（vue-router 5 / Pinia 4） |
| **Element Plus** | 2.14.7 | UI 组件库 |
| **TypeScript** | 6.0.3 | TS 7 原生编译器暂不兼容 vue-tsc（锁定 6.x） |
| **Vite** | 8.3.2 | Rolldown 引擎，渲染进程构建 |
| **electron-builder** | 26.15.3 | portable + NSIS x64 打包 |
| **electron-updater** | 6.8.9 | generic provider 自动升级 |
| **Node.js** | >= 24 | 开发环境要求（engines 已约束） |

## 核心功能

- **文件管理页（Files，默认路由）**：拖拽 ZIP/RAR 到窗口即解压并生成文件树；点击文件按类型分发渲染（文本内容、图片预览、压缩包提示）。ZIP 走 jszip、RAR 走 node-unrar-js（WASM，免外部二进制），解压均在主进程完成。
- **设置页（Settings）**：工作目录展示（含回落状态）、主题偏好读写示例（持久化到 SQLite `settings` 表，重启仍生效）、软件更新卡片（检查更新、下载进度、立即安装）。
- **工作目录**：默认 `D:\MyWinApp`（环境变量 `MYWINAPP_WORKDIR` 覆盖），统一承载 `logs/`（应用日志）、`data/`（SQLite 数据库）、`config/`（配置预留）；目标盘不可用时自动回落 `userData`。
- **SQLite 存储**：`node:sqlite`（Node 24 内置，零原生依赖）单例连接 `data/app.db`（WAL），`settings` 键值表经 IPC 读写，缺失键返回空值不抛错。
- **自动升级**：generic provider 三级更新源（环境变量 `MYWINAPP_UPDATE_URL` > 配置存储 `update.url` > 打包内置地址）；启动自动检查 + 手动检查；发现新版本自动下载（差量优先），退出时自动安装或立即重启安装。
- **应用基座**：中文应用菜单、单实例锁、外部链接系统浏览器打开、安全基线（contextIsolation / 无 nodeIntegration）。

## 架构速览

```
src/
├── main/       # 主进程：入口（窗口/菜单/日志）、preload、workspace/ db/ updater/、ipc/ 处理器
├── view/       # 渲染进程：Vite root，页面 / services / store / router / 类型
└── shared/     # 共享层：ElectronAPI 类型单一来源 + 常量（别名 @shared）
```

- **IPC 约定**：渲染进程经 `window.electronAPI`（contextBridge）调用，主进程 `ipcMain.handle`；新增通道需 preload / handler / 类型三处同步。通道全集见 `src/main/preload.ts`：文件读写与解压、应用/系统/性能信息、窗口控制、拖拽取路径（`webUtils.getPathForFile`）、工作目录、配置读写、更新检查/安装/状态与 `update:status` 推送事件。
- 详细目录结构与构建要点：[docs/project-structure.md](docs/project-structure.md)；面向 AI/代理的工作约定：[AGENTS.md](AGENTS.md)。

## 常用命令

```bash
npm run electron:dev     # 开发模式：编译主进程 + Vite(5180) + Electron（热更新）
npm run type-check       # 真实全量类型检查（vue-tsc + tsc 双进程）
npm run lint             # ESLint 10（flat config）检查并自动修复
npm run build            # 类型检查 + 主进程编译 + Vite 构建 + electron-builder --dir
npm run build:prod       # 产出 NSIS 安装包 + portable（含 latest.yml / blockmap）
npm run build:portable   # 仅便携版
npm run build:single     # 一键打包单一 EXE（构建 + 产物核验 + 路径/哈希回显；或双击仓库根"一键打包.bat"）
npm run electron:test    # 冒烟测试：加载构建产物并自动退出（需先 build）
npm run clean            # 清理 dist / release / *.tsbuildinfo
```

无单元测试框架；改动验证链为 `type-check` → `lint` → `build` → `electron:test`，再手动跑 `electron:dev` 确认窗口行为。

## 发布与自动升级

1. `npm version <新版本>`；
2. **一键发布**：`npm run release` —— 构建 → 三件套对账核验（版本与哈希双重一致性）→ 归集到 `dist-release/<版本>/` → 经 HTTP PUT 上传更新源 → 上传后校验。只需先在 `release.config.json` 配好 `upload.url`（更新源目录需预建且支持 PUT/WebDAV），有认证时设环境变量 `RELEASE_UPLOAD_AUTH=user:pass`；远端已有同版本默认拒绝（`--force` 覆盖）。仅核验归集不上传用 `npm run release:collect`；
3. 客户端侧三选一指定更新源：环境变量 `MYWINAPP_UPDATE_URL`、`settings` 表写入 `update.url`、或修改 `electron-builder.json` 中的默认地址后重新打包；
4. 已安装的 NSIS 版本客户端会自动检查 → 下载 → 在退出时安装（设置页可"立即安装并重启"）。

> 限制：仅 NSIS 安装版支持自更新，portable 版需手动分发；构建未签名，Windows 可能提示发布者未知（不影响升级功能）。

## 目录与数据

- 安装版默认安装到 `%LOCALAPPDATA%\Programs\My-Win-App`；
- 工作目录默认 `D:\MyWinApp`：`logs\app.log` 排障日志、`data\app.db` SQLite 数据库（WAL）、`config\` 配置预留；
- 升级缓存位于 `%LOCALAPPDATA%\my-win-app-updater`。

## 文档索引

- [docs/project-structure.md](docs/project-structure.md) — 目录结构、构建要点与关键约定
- [AGENTS.md](AGENTS.md) — 常用命令、架构与陷阱（面向 AI 代理）
- [openspec/specs/](openspec/specs/) — 能力规格（workspace-directory / sqlite-storage / auto-update）
