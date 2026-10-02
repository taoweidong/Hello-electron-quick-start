# Proposal

## Why

应用目前没有任何更新机制，版本迭代只能靠用户手动重新下载安装。用户要求：配置远端服务器后，客户端能自动拉取最新版本并完成升级。前期工作已完成铺垫——NSIS 产物自带 `latest.yml` 与 `.blockmap`（差量更新元数据），SQLite `settings` 表可承载更新源配置。

## What Changes

- **新增 `electron-updater@6.8.9` 依赖**（主进程）：基于 generic provider（远端静态文件服务器）实现更新检查、下载与安装。
- **打包配置**：`electron-builder.json` 增加 `publish`（generic provider，默认远端 URL 占位），使 NSIS 安装包内置 `app-update.yml`；portable 产物不参与自更新（Electron 限制，保持手动分发）。
- **更新源三级配置**：环境变量 `MYWINAPP_UPDATE_URL` > SQLite `settings` 表 `update.url` > 内置默认 URL（打包时写入）。
- **更新行为**：启动后自动检查更新；发现新版本自动下载（差量优先）；下载完成默认在应用退出时安装，同时提供"立即重启安装"能力；无更新/检查失败静默或提示。
- **IPC 与设置页**：新增 `update:check`（手动检查）、`update:install`（立即安装）、`update:get-status` 通道与 `update:status` / `update:progress` 推送事件（三处同步）；设置页新增"软件更新"卡片（当前版本、检查按钮、进度与结果展示）。

## Capabilities

### New Capabilities

- `auto-update`: 客户端自动升级能力——更新源配置解析、启动/手动更新检查、自动下载（差量）与安装时机、进度事件向渲染层的推送。

### Modified Capabilities

（无 —— 既有能力规格不受影响；设置页仅新增一个卡片，其既有行为不变。）

## Impact

- **代码**：`src/main/`（新增 `updater/` 模块与 `updateHandlers.ts`、`index.ts` 启动接线）；`src/main/preload.ts` 与 `ElectronAPI` 类型三处同步；`SettingsView.vue` 增加更新卡片；`electron-builder.json` 增加 `publish` 配置。
- **依赖**：新增 `electron-updater@6.8.9`（纯 JS，无原生模块，无 asar 特殊处理）。
- **服务端要求**（部署侧）：远端为静态文件服务即可，需托管 `latest.yml`、`My-Win-App-<版本>-x64.exe` 与 `.blockmap`；HTTPS 建议但本地测试可用 HTTP。
- **限制**：仅 NSIS 安装版支持自更新；portable 版保持手动分发。当前构建未签名——Windows 下 electron-updater 可正常工作，但系统可能提示发布者未知（见 design 风险）。
- **实施顺序**：依赖 `add-sqlite-working-dir`（已实施并归档）——更新源配置读取 `settings` 表。
