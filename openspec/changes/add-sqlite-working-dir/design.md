# Design

## Context

动机见 proposal.md - Why。已核实的关键事实：

- Electron 44 内嵌 Node 24.21.0，实测 `node:sqlite`（SQLite 3.53.4）建表/插入/查询全链路可用且无实验性警告
- `D:\MyWinApp` 及 `logs/`、`data/`、`config/` 子目录创建/写入/删除实测通过
- 现状：日志经 `logToFile` 写 `userData/app.log`；SettingsView 为占位页；路由仅注册 Files 一页；IPC 遵循 preload/handler/类型三处同步约定

约束：主进程保持 CJS + 相对导入；IPC 新增通道必须三处同步；打包配置不引入原生模块。

## Goals / Non-Goals

**Goals:**

- 工作目录统一承载日志、数据库、配置（`D:\MyWinApp\{logs,data,config}`），带环境变量覆盖与不可用回落
- 基于内置 `node:sqlite` 的 SQLite 实例与 `settings` 配置读写实例代码，端到端可验证（含重启持久性）
- 设置页从占位页变为可用的示例页

**Non-Goals:**

- 不做完整配置体系（JSON 配置文件、多 profile）——`config/` 目录仅预留布局
- 不迁移历史日志（旧 `userData/app.log` 留原地）
- 不做数据库迁移框架/ORM——仅连接封装 + 示例表
- 不改 Files 页解压目录（`userData/extracted` 迁移到工作目录留待后续需求）

## Decisions

**D1 —— SQLite 用 `node:sqlite` 而非 better-sqlite3**

实测当前运行时内嵌 SQLite 3.53.4 可用且零警告；零依赖、零 ABI 负担、无 asar unpack 需求、永远不会因 Electron 升级而需要重编译。备选 better-sqlite3 被放弃：需核实 ABI 149 预编译、增加 asarUnpack 配置、并给未来每次 Electron 升级引入原生模块重建负担（可行性报告中"升级 Electron ≥35 后可零依赖"的远期选项在栈升级后兑现）。`node:sqlite` 为同步 API——桌面单用户、低频配置读写场景可接受。

**D2 —— 工作目录：默认 `D:\MyWinApp` + 环境变量覆盖 + 启动时回落**

默认值取 `D:\MyWinApp`（用户指定 D 盘；可行性报告结论：不用 `temp` 等会被清理工具触碰的位置承载配置与数据库）。`MYWINAPP_WORKDIR` 环境变量可整体覆盖（面向测试与特殊部署）。启动时 `mkdirSync(recursive)` 建立三个子目录并以写入探针确认可写，失败即整体回落 `userData`，回落事实写入回落位置日志。工作目录在启动时解析一次并缓存（单例），不做运行中热切换；D 盘运行中被移除属已知限制（见 Risks）。

**D3 —— 日志迁移**

`logToFile` 改从工作目录模块取日志路径（`{workdir}/logs/app.log`；回落时 `{userData}/logs/app.log`）。工作目录模块自身解析失败时，`logToFile` 保持现有 try/catch 容错，不因日志问题阻断启动。

**D4 —— settings IPC 设计**

通道：`settings:get (key) => string | null`、`settings:set (key, value) => { success, error? }`。表结构 `settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)`，启动时 `CREATE TABLE IF NOT EXISTS`。连接参数开启 WAL（`journal_mode=WAL`）以降低写入阻塞面。示例键 `theme`。preload、`ElectronAPI` 类型、settingsHandlers 三处同步。

**D5 —— 设置页示例与路由注册**

`SettingsView.vue` 重写为示例页：展示当前工作目录与回落状态（新增 IPC `workspace:get => { path, fallback }`）、提供 `theme` 配置项的下拉选择与保存（写 `settings` 表）、保存后 `ElMessage` 提示。同时在 `router/index.ts` 注册 `/settings` 路由——使示例端到端可用、可被自动化实测（这是"实例代码"可验证性的必要条件，非 UI 扩张）。

**D6 —— 打包零改动**

无原生模块、无额外二进制：electron-builder 配置与 asar 策略完全不动；数据库文件天然位于 asar 之外（工作目录），不涉及 asar 只读问题。

## Risks / Trade-offs

- [`node:sqlite` 在未来 Electron 升级中 API 变动] → 主进程 `db/` 模块单点封装，替换引擎（如 better-sqlite3）只动一个文件；upgrade-dependencies 的 change 已建立"升级前验证 type-check + 冒烟"的流程护栏
- [D 盘运行中被移除/不可写] → 启动时解析并缓存，运行中写失败以错误经 IPC 返回（不热回落），重启后按回落规则生效；记录为已知限制
- [同步 SQLite 阻塞主进程] → 示例场景为低频键值读写，可接受；高负载场景留待后续改造（async 队列或 worker）
- [`config/` 目录本期空置] → 目录布局先行建立，避免后续配置文件化时再改目录契约

## Migration Plan

1. 无数据迁移：`D:\MyWinApp` 首次运行自动创建；旧 `userData/app.log` 不搬迁
2. 实施顺序：工作目录模块 → 日志迁移 → SQLite 模块 → IPC → 设置页与路由 → 全量验证（含打包产物 CDP 端到端的重启持久性验证）
3. 回滚：单分支分步提交，任一步验证失败 `git revert` 该步；本 change 不触碰既有功能数据

## Open Questions

（无 —— 默认路径、覆盖机制、回落规则均已由用户需求与实测事实确定。）
