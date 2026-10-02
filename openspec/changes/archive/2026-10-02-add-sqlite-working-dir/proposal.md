# Proposal

## Why

应用目前把日志写入系统 AppData（`userData/app.log`），数据与配置没有统一归属，SQLite 数据能力为零。用户要求以 D 盘指定目录作为应用安装后的默认工作路径，统一承载日志、数据、配置，并提供 SQLite 操作的实例代码为后续数据类功能打底。前期可行性报告已论证 D 盘可写；本会话完成依赖栈升级后已实测：Electron 44 内嵌 Node 24.21 的 `node:sqlite`（SQLite 3.53.4）建表/读写全链路可用——SQLite 可以零依赖实现，无需任何原生模块。

## What Changes

- **新增工作目录解析模块**（主进程）：默认工作目录为 `D:\MyWinApp`，可用环境变量 `MYWINAPP_WORKDIR` 覆盖；其下固定 `logs/`、`data/`、`config/` 三个子目录，启动时确保存在；D 盘不可用（目录无法创建/写入）时回落到 `userData` 并记录回落日志。
- **日志位置迁移**：主进程 `logToFile` 的输出从 `userData/app.log` 迁移到 `{工作目录}/logs/app.log`（回落场景写 `{userData}/logs/app.log`）。
- **SQLite 实例代码**（主进程）：基于 `node:sqlite` 的 `DatabaseSync` 持有 `{工作目录}/data/app.db`；提供可复用的连接获取与 query/exec 封装；示例表 `settings`（key-value 配置存储，`config/` 目录布局为其文件化扩展预留）。
- **新增 IPC 通道**：`settings:get` / `settings:set`（读写 `settings` 表，preload 与类型三处同步）。
- **渲染层示例接入**：`SettingsView.vue` 从占位页改为可用的设置示例页（读取/保存一项配置到 SQLite，展示工作目录信息），并注册 Settings 路由使示例可实际访问与验证。

## Capabilities

### New Capabilities

- `workspace-directory`: 应用工作目录的解析（默认 `D:\MyWinApp`、环境变量覆盖、不可用时回落 `userData`）与 `logs/`、`data/`、`config/` 子目录布局的建立。
- `sqlite-storage`: 主进程基于 `node:sqlite` 的 SQLite 实例生命周期（`data/app.db`）、`settings` 配置读写的 IPC 实例（`settings:get` / `settings:set`）及渲染层 SettingsView 示例。

### Modified Capabilities

（无 —— 项目尚无既有规格，两个能力均为新增。）

## Impact

- **代码**：`src/main/`（新增 `workspace/` 目录解析与 `db/` 模块、`ipc/settingsHandlers.ts`、`index.ts` 日志路径调整）；`src/view/src/views/SettingsView.vue` 重写为示例页；`src/view/src/router/index.ts` 注册 Settings 路由；preload 与 `ElectronAPI` 类型三处同步。
- **依赖**：零新增（`node:sqlite` 为 Node 24 内置模块）；无原生模块、无 asar unpack 需求，打包配置不动。
- **数据**：`D:\MyWinApp` 首次运行时自动创建，无数据迁移；旧 `userData/app.log` 不搬迁（历史日志留原地，新日志写新位置）。
- **实施顺序**：本 change 的结论依赖 `upgrade-dependencies`（已实施并归档：Node 24.21 运行时是 `node:sqlite` 可用的前提）。
