# Tasks

## 1. 工作目录模块与日志迁移（design D2 / D3）

- [x] 1.1 新增 `src/main/workspace/`：`resolveWorkspace()` 惰性单例（默认 `D:\MyWinApp`、`MYWINAPP_WORKDIR` 覆盖、`logs/`+`data/`+`config/` 建目录、写入探针失败回落 `userData`）；验证：`npm run type-check` exit 0，且用临时脚本在 Electron 运行时分别验证默认解析与 env 覆盖两种场景的目录创建结果
- [x] 1.2 `logToFile` 迁移到 `{工作目录}/logs/app.log`（回落时 `{userData}/logs/app.log`），保持 try/catch 容错；验证：`npm run build && npm run electron:test` exit 0，且 `D:\MyWinApp\logs\app.log` 出现本次运行的日志行
- [x] 1.3 新增 IPC `workspace:get` 返回 `{ path, fallback }`，preload 与 `ElectronAPI` 类型三处同步；验证：`npm run type-check` exit 0

## 2. SQLite 模块与 settings IPC（design D1 / D4）

- [x] 2.1 新增 `src/main/db/`：`DatabaseSync` 打开 `{工作目录}/data/app.db`、`PRAGMA journal_mode=WAL`、`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`、提供 query/exec 封装；验证：`npm run electron:test` 后 `D:\MyWinApp\data\app.db` 存在
- [x] 2.2 新增 `src/main/ipc/settingsHandlers.ts`：`settings:get`（不存在键返回 null）/ `settings:set`，并在 `ipc/index.ts` 注册，preload 与类型三处同步；验证：`npm run type-check` exit 0

## 3. 设置页示例与路由（design D5）

- [x] 3.1 重写 `SettingsView.vue`：展示工作目录与回落状态（`workspace:get`）、`theme` 配置项读取/保存（`settings:get`/`settings:set`）、保存成功提示；`router/index.ts` 注册 `/settings` 路由；验证：`npm run type-check` 与 `npm run lint` exit 0

## 4. 全量验证与收尾

- [x] 4.1 打包产物端到端验证：CDP 连入 portable/unpacked 产物，设置页保存 `theme` → 完全退出 → 重启 → 读值一致（持久性场景）；验证：两轮 CDP evaluate 结果一致且 `data/app.db` 存在
- [x] 4.2 文档同步：AGENTS.md（架构段工作目录/SQLite/新 IPC、陷阱如工作目录回落行为）与 docs/project-structure.md（新增模块条目）；验证：文档所述文件路径与 IPC 通道逐一存在
- [x] 4.3 全量回归与提交：type-check / lint / build / electron:test / portable 实机启动全链路 exit 0 后，按"工作目录/SQLite/设置页"分步提交并推送；验证：`git log` 分步清晰、`git status` 干净、远程同步
