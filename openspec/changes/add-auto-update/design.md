# Design

## Context

动机见 proposal.md - Why。已核实事实：

- `electron-updater` 最新稳定版 **6.8.9**（纯 JS、无 Electron 版本约束、无原生模块）
- electron-builder 26 已为 NSIS 产物生成 `latest.yml` 与 `.blockmap`（release 目录实测存在）——差量更新的元数据链路现成
- 更新源配置可复用刚落地的 SQLite `settings` 表（`settings:get/set` IPC 已就绪）
- 当前构建未签名；portable 产物无法自更新（Electron/NSIS 机制限制）

约束：IPC 三处同步约定；主进程 CJS 相对导入；不动既有能力规格。

## Goals / Non-Goals

**Goals:**

- 配置远端静态服务器后，客户端自动完成「检查 → 下载 → 安装」升级闭环
- 更新源地址三级可配（env / settings / 内置默认），无需重新打包即可换服务器
- 升级全过程状态与进度对渲染层可见（设置页承载 UI）

**Non-Goals:**

- 不做代码签名（当前无证书；未签名下 electron-updater 功能可用，风险见下）
- 不做多通道/灰度/强制升级策略（latest 单通道）
- 不支持 portable 自更新；不做 macOS/Linux 目标
- 不做更新的 UI 弹窗打断——设置页内展示即可

## Decisions

**D1 —— electron-updater 6.8.9 + generic provider**

官方搭配 electron-builder 的元数据格式（`latest.yml` + blockmap），差量下载开箱即用。备选自研轮询下载器被放弃：安装编排（退出时机、静默安装、失败回滚）复杂度高，electron-updater 已解决。

**D2 —— 更新源三级解析：env > settings > 内置默认**

`MYWINAPP_UPDATE_URL`（环境变量）> `settings` 表 `update.url`（可经设置页或直接写库调整）> 打包内置地址。实现上统一走 `autoUpdater.setFeedURL({ provider: 'generic', url })`；同时 `electron-builder.json` 增加 `publish: [{ provider: "generic", url: "<默认地址>" }]`，让安装包内置 `app-update.yml` 作为兜底（无 setFeedURL 时也能初始化）。默认地址本期为占位（如 `http://localhost:58132/update/`，由部署方替换或经 settings 覆盖）。

**D3 —— 更新策略：自动下载 + 退出时安装 + 可立即安装**

`autoDownload = true`、`autoInstallOnAppQuit = true`（最稳妥的默认：不打断用户）；提供 `update:install`（`quitAndInstall`）满足"立即升级"。启动后延迟数秒自动检查一次（避开启动争用），并暴露手动检查通道。

**D4 —— 状态/进度经主进程事件推送**

electron-updater 事件（`checking-for-update` / `update-available` / `download-progress` / `update-downloaded` / `error`）在主进程归一化为单一状态机，通过 `webContents.send('update:status', {...})` 推送；`update:get-status` 供渲染层主动拉取当前快照。渲染层设置页订阅并展示。

**D5 —— 打包与产物**

`build:prod` / `build:portable` 不变；`publish` 配置仅影响 NSIS 产物元数据。发布流程 = 上传 `latest.yml` + `.exe` + `.blockmap` 到远端目录。

## Risks / Trade-offs

- [未签名包的 Windows SmartScreen/发布者未知提示] → 功能不受阻；签名列入后续待办（需要证书采购，超本期范围）
- [远端不可达/地址配错] → `error` 事件归入「检查失败」状态，设置页可见，应用其余功能不受影响；env/settings 可即时纠正
- [portable 用户与自更新绝缘] → 设置页对 portable 场景展示"请重新下载"提示（便携版判定：进程路径含临时解压目录特征，不可靠时以文档说明代替——实现时取可靠判定，不确定则不做运行时判定）
- [latest.yml 与实际产物不一致（漏传文件）] → 下载报错进入失败状态；部署清单校验列入任务验收
- [SQLite 读取 update.url 失败] → 静默跳过该级，落到内置默认；不阻断启动

## Migration Plan

1. 实施顺序：依赖安装 → updater 模块（状态机 + 三级配置）→ IPC 与事件 → 打包配置 → 设置页 UI → 端到端验证
2. 端到端验证用本地静态服务器模拟远端（版本 1.0.0 → 1.0.1 全链路，见 tasks）
3. 回滚：单分支分步提交，任一步失败 `git revert`；`publish` 配置回滚不影响既有打包

## Open Questions

（无 —— 更新源默认地址为占位符属部署期决策，机制上已由三级配置覆盖。）
