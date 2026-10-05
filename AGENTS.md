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
- `npm run build:single` — 一键打包单一 EXE：复用构建链 + 产物核验（存在/体积/版本一致性/sha512）+ 结果回显；`node scripts/pack-single.js --verify-only` 仅复检既有产物；仓库根 `一键打包.bat` 为双击入口
- `npm run electron:test` — 冒烟测试：加载构建产物并自动退出（exit 0 成功 / 1 失败），需先 `npm run build`
- `npm run test` — 单元测试：`tsc -p tsconfig.test.json` 预编译 `tests/` 到 `dist-test/`（根包是 CommonJS，Node 不能直跑 `.ts`），再 `node --test` 执行；`test:watch` 为监听模式
- `npm run clean` — 清理 dist / release / *.tsbuildinfo

纯函数用例走 `npm run test`（`node:test`，无断言库依赖，用例放 `tests/`）；`npm run type-check` 已含 `tsconfig.test.json`。验证改动用 `npm run test` + `npm run type-check` + `npm run lint` + `npm run electron:test`，再手动跑 `electron:dev` 确认窗口行为。

## 架构

- `src/main/` — Electron 主进程（TypeScript，经 `tsconfig.node.json` 编译，package.json 的 main 指向 `dist/main/main/index.js`）。入口创建窗口、经 `src/main/logger.ts` 写日志到工作目录 `logs/app.log`（超 5MB 轮转为 `app.log.1`，写失败只告警一次）、启动时初始化 SQLite（退出前 `before-quit` 调 `closeDb()` 落盘 WAL）、构建中文应用菜单；IPC 处理器在 `src/main/ipc/`（appHandlers / fileHandlers / workspaceHandlers / settingsHandlers）。入口另有三道闸门：外链域名白名单 `ALLOWED_EXTERNAL_HOSTS`、页面内导航锁定（dev 锁 Vite origin、prod 只允许 file:）、`uncaughtException`/`unhandledRejection` 记录不退出。
- 工作目录与数据：`src/main/workspace/` 解析工作目录（默认 `D:\MyWinApp`，env `MYWINAPP_WORKDIR` 覆盖，不可用整体回落 `userData`；回落也不 writable 则 `resolveWorkspace()` 抛错，入口据此弹窗退出，不再静默报告成功），固定 `logs/`、`data/`、`config/` 子布局；`src/main/db/` 基于 `node:sqlite`（Node 24 内置）持有 `data/app.db`（WAL），启动时建库建表（`settings` 键值表），IPC `settings:get` / `settings:set` / `workspace:get` 提供配置读写与目录信息。`settings:set` 有键白名单（`settingsHandlers.ts` 的 `WRITABLE_KEYS`，当前只有 `theme`）——新增可写配置项必须显式加进白名单，不要放开成任意键。
- 自动更新：`src/main/updater/` 基于 electron-updater（generic provider），**两级**更新源 env `MYWINAPP_UPDATE_URL` > 打包内置 `app-update.yml`（settings 表 `update.url` 一档已移除：渲染层可写的存储不能决定下载哪个 exe）；env 覆盖必须先过 `feedUrl.ts` 的 `assertSafeFeedUrl`（协议 http/https、URL 不得内嵌凭据、主机命中 `MYWINAPP_UPDATE_HOSTS` ∪ 内置源主机 ∪ 回环地址），不合规则 WARN 并回落内置源；`autoDownload` + `autoInstallOnAppQuit`，启动延迟 5s 自动检查；状态经 `update:status` 事件推送，IPC `update:check` / `update:install` / `update:get-status`。**发布流程**：`npm run release` 一键完成——`build:prod` 构建 → 三件套对账核验（版本三方一致 + latest.yml 逐文件 sha512/base64 与本地实算对账）→ 归集到 `dist-release/<版本>/` → 经 HTTP PUT 上传更新源（`release.config.json` 配 `upload.url`，凭据仅经环境变量 `RELEASE_UPLOAD_AUTH`，格式 `user:pass`）→ 上传后 GET latest.yml 逐字节比对 + HEAD 尺寸核对；远端已有同版本默认拒绝，`--force` 显式覆盖。更新源目录需**预先建好且支持 PUT**（WebDAV 不自动 MKCOL）；`npm run release:collect` 只核验归集不上传。仅 NSIS 安装版可自更新，portable 需手动分发（`--with-portable` 可附带归集上传）。
- `src/view/` — Vue 3 渲染进程。**Vite 的 root 是 `src/view` 而非项目根**，构建输出 `dist/view`。入口 `src/view/src/main.ts`；页面在 `views/`（Home / Files / Settings / About）；Pinia 在 `store/`；路由在 `router/`。
- `src/shared/` — 主/渲染进程共享代码，别名 `@shared`。
- 主进程构建的关键：`tsconfig.node.json` 的 `rootDir` 是 `./src`（不是 `./src/main`），产物布局为 `dist/main/main/**` + `dist/main/shared/**`，源码里的相对导入（`../../shared/constants`）在产物中原样成立，**不需要任何编译后处理脚本**。
- 路径别名（改动需同步 vite.config.ts 与各 tsconfig）：`@` → `src/view/src`，`@shared` → `src/shared`。
- IPC 约定：`src/main/preload.ts` 用 contextBridge 暴露 `window.electronAPI`（`ipcRenderer.invoke`）；主进程在 `src/main/ipc/` 里 `ipcMain.handle`。类型单一来源是 `src/shared/types/electron.d.ts` 的 `ElectronAPI` 接口（preload 实现它，`src/view/src/types/electron.d.ts` 据此做全局 Window 增强）——新增 IPC 通道时 preload、handler、类型三处都要改。
- 安全基线：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`。另有主进程路径根 `src/main/security/pathGuard.ts`：`file:read` / `file:write` / `file:getInfo` / `file:readDir` 必须过 `assertPathAllowed(path, 'read' | 'write')`，解压目标必须过 `assertPathAllowed(extractPath, 'write')`；读写根 = `userData/extracted` + dialog 选定路径的所在目录（会话级 Map，上限 64 条 LRU）；判定包含关系一律用 `realpath` + `path.win32.relative`，**禁止字符串前缀比较**；`\\?\`/`\\.\`/UNC/盘符相对/ADS 形态在字符串层直接拒绝。压缩包**来源**路径不做读限制（用户亲自拖入才可拿到，属产品功能）。
- 文件渲染/解压：渲染进程 `services/` 按文件类型走 Zip/Rar 提取器与渲染器（jszip、node-unrar-js），组件在 `components/renderers/`；主进程经 IPC `zip:extract` / `rar:extract` 解压到 `userData/extracted/`。**条目名必须经 `src/main/security/zipSlip.ts` 的 `safeJoin()`**（拒绝 `..` 越界、绝对/盘符/UNC/`\\?\`/`\\.\` 前缀、控制字符与 Windows 非法字符，反斜杠与正斜杠同等处理），根占位条目（`/`、`./`）用 `isRootPlaceholder()` 跳过，越界即整包失败并 WARN 落日志。

## 陷阱与注意事项

- **主进程只有相对导入可用**：tsc 不改写 paths 别名，主进程源码不要用 `@shared` 别名导入运行时模块（类型 import 除外，如 preload），否则产物在运行时无法解析。
- **TypeScript 锁定 6.x**：TS 7 原生编译器移除了 `./lib/tsc` 导出，vue-tsc 3 无法加载（已实测）；升级 TS 前必须先验证 `npm run type-check`。TS 6 已弃用 `baseUrl` 与 `moduleResolution: node`，主进程用 `module/moduleResolution: node16`。
- **拖拽文件取路径必须走 `electronAPI.getPathForFile`**（Electron 32+ 已移除 DOM `File.path`，官方替代为 `webUtils.getPathForFile`，经 preload 暴露）。
- **`src/shared/constants/index.ts` 是唯一版本**，不要再生成/提交编译产物（.js/.d.ts）。
- dev 端口固定 5180：vite.config.ts（strictPort）与 electron:dev 的 wait-on 都依赖它，不要改。
- 打包配置在根目录 `electron-builder.json`（win: portable + nsis x64，输出 `release/`）。`files` 不含 node_modules——electron-builder 自动附带生产依赖，不要手动加回去。
- 排查运行时问题先看工作目录下的 `logs/app.log`（默认 `D:\MyWinApp\logs\app.log`；工作目录不可用回落 `userData` 时在 `userData/logs/app.log`）。
- `docs/project-structure.md` 已与实际结构同步，改动结构时记得更新它。
