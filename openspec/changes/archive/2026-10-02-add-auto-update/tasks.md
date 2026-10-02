# Tasks

## 1. 依赖与打包配置（design D1 / D2）

- [x] 1.1 安装 `electron-updater@6.8.9`；验证：`npm install` 成功且 `npm ls electron-updater --depth=0` 正常
- [x] 1.2 `electron-builder.json` 增加 `publish: [{ "provider": "generic", "url": "http://localhost:58132/update/" }]`（占位默认地址）；验证：`npm run build:prod` 后安装包内存在 `app-update.yml`（asar 外的 resources 目录），`latest.yml` 继续生成

## 2. 更新模块与 IPC（design D2 / D3 / D4）

- [x] 2.1 新增 `src/main/updater/`：三级更新源解析（env > settings 表 `update.url` > 内置默认）、状态机归一化（checking / latest / available / downloading / downloaded / error）、`setFeedURL` + `autoDownload` + `autoInstallOnAppQuit` 接线、启动延迟自动检查；验证：`npm run type-check` exit 0
- [x] 2.2 新增 `src/main/ipc/updateHandlers.ts`：`update:check`（手动检查）/ `update:install`（quitAndInstall）/ `update:get-status`，事件推送 `update:status`，preload 与 `ElectronAPI` 类型三处同步；验证：`npm run type-check` 与 `npm run lint` exit 0

## 3. 设置页更新卡片（design D4）

- [x] 3.1 `SettingsView.vue` 新增"软件更新"卡片：当前版本、更新源展示、检查更新按钮、状态与下载进度条、「立即安装」按钮（downloaded 状态才可见）；验证：`npm run type-check` 与 `npm run lint` exit 0

## 4. 端到端验证与收尾

- [x] 4.1 本地更新服务器模拟远端：临时 node 静态服务器托管 `latest.yml` + 安装包 + blockmap；版本提升至 1.0.1 重新打包，验证「检查到新版本 → 自动下载 → 状态 downloaded」全链路（CDP 观察 `update:status` 事件与 `update:get-status` 快照）；验证：CDP 捕获到 downloaded 状态且进度事件出现过非 0 百分比
- [x] 4.2 安装闭环验证：下载完成后触发 `update:install` 或退出安装，重装后应用版本为 1.0.1；验证：安装后可执行文件版本/`app.getVersion()` 为 1.0.1（若本环境静默安装无法闭环，则记录实际情况并以「已下载待安装 + 安装器被正确拉起」为验收，剩余人工确认）
- [x] 4.3 文档同步：AGENTS.md（更新模块与发布流程：上传 latest.yml/exe/blockmap 三件套）、docs/project-structure.md（updater/ 模块条目）；验证：文档所述与实现一致
- [x] 4.4 全量回归与提交：type-check / lint / build / electron:test 全链路 exit 0 后，按"依赖与打包/更新模块/设置页/收尾"分步提交并推送；验证：`git log` 清晰、`git status` 干净、远程同步
