# Design

## Context

现状与缺口见 proposal.md - Why。已核实事实：

- `build:portable` = `type-check && compile:main && vite build && electron-builder --win=portable`，产物 `release/My-Win-App-<version>-portable.exe`（实测 160MB）
- electron-builder 的输出目录由 `electron-builder.json` 的 `directories.output`（当前 `release/`）决定；产物名由 `portable.artifactName`（`${productName}-${version}-portable.${ext}`）决定
- 本会话在 Git Bash 调用安装器时踩过 MSYS 路径转换坑（`/S` 被改写）；Windows 下以 `spawnSync` 调 `npm` 系命令必须 `shell: true`（npm.cmd）
- 项目无单元测试框架；负路径验证需要脚本自身提供钩子

约束：零新增依赖；`scripts/` 不进安装包；不改变现有任何命令的行为。

## Goals / Non-Goals

**Goals:**

- `npm run build:single` 一条命令完成"源码 → 经核验的 portable EXE"，全程步骤化输出、失败红字定位到具体步骤
- 产物三重核验（存在与体积阈值 / ProductVersion 一致性 / sha512）与清晰回显（路径、体积、哈希、总耗时）
- `--verify-only` 复检模式，支撑负路径验证与 CI 复用

**Non-Goals:**

- 不处理 NSIS 与更新源三件套（`build:prod` 职责，发布流水线另行立项）
- 不做构建缓存/加速优化
- 不清理 `release/` 历史产物（避免误删用户文件）
- 不引入并行构建或输出重定向等花活

## Decisions

**D1 —— Node 脚本（`scripts/pack-single.js`，CJS）而非 bat/ps1**

跨 shell（npm scripts 在 Windows 走 cmd、开发者可能用 Git Bash/PowerShell）、`node:crypto` 原生算哈希、退出码语义可控。备选 PowerShell 脚本被放弃：跨 shell 一致性差；备选纯 npm script 命令链被放弃：无法插入核验逻辑与结构化回显。

**D2 —— 逐步 `spawnSync` 且继承 stdio**

四个构建步骤逐一执行（复用 package.json 现有脚本名 `type-check` / `compile:main`，其余两条直接调 `vite` / `electron-builder` 的 npm run），每步开始/结束打印分隔标记；Windows 下调 npm 系命令用 `shell: true`（npm.cmd 需要），步骤任一非零退出立即终止并红字提示失败步骤。备选一次性执行整条 `&&` 链被放弃：无法定位失败步骤。

**D3 —— 产物定位读配置而非硬编码**

从 `electron-builder.json` 读取 `directories.output` 与 `portable.artifactName` 模板，用 `package.json` 的 `productName` / `version` 渲染出期望文件名。配置漂移时脚本自动跟随。阈值：体积 > 50MB（实测 160MB，阈值防"空文件/占位产物"）。

**D4 —— 版本一致性双断言**

① 期望文件名中包含 `package.json` 的版本号且文件存在；② exe 的 `ProductVersion`（PowerShell `VersionInfo` 读取，非 Windows 环境跳过该项并提示）与 `package.json` 版本一致——防止"文件名对、内容旧"的错配。sha512 以 `node:crypto` 计算，回显前 16 位。

**D5 —— `--verify-only` 复检模式**

跳过构建，仅对既有产物执行核验与回显。用途：负路径验证（改名/删文件触发断言）、发版前快速复检、CI 二次校验。

**D6 —— 命令命名 `build:single`**

与 `build / build:prod / build:portable` 同族、直白表达"单一 EXE"。备选 `pack:portable` 被放弃：与 electron-builder 术语（pack = 仅打包不构建）易混淆。

**D7 —— Windows 双击入口 `一键打包.bat`（用户追加范围）**

仓库根目录提供批处理脚本：`chcp 65001` 切 UTF-8（内容须无 BOM、转 CRLF 行尾——batch 对 LF 与 BOM 敏感）、`cd /d "%~dp0"` 定位仓库根、检测 Node 存在后调用 `node scripts\pack-single.js`，结束 `pause` 保持窗口（供双击场景查看结果）。备选 PowerShell 双击入口被放弃：默认执行策略与更多告警面。

## Risks / Trade-offs

- [PowerShell 读取 ProductVersion 仅限 Windows] → 产品目标即 Windows；非 Windows 开发机跳过该断言并黄字提示，不影响其余核验
- [构建耗时全部叠加在一条命令内（实测数分钟）] → 步骤化输出 + 计时让等待可感知；不引入缓存（Non-Goal）
- [electron-builder 输出解析依赖其日志格式] → 核验不解析构建日志，只核对文件系统事实（文件存在/体积/版本/哈希），构建日志仅透传
- [`scripts/` 被误打进安装包] → `files` 白名单只含 `dist/**`，天然排除；无需额外配置

## Migration Plan

1. 新增脚本与命令，独立于现有命令，无数据/行为迁移
2. 实施顺序：脚本 → npm 命令 → 正向验证（全链路）→ 负路径验证（`--verify-only` 断言触发）→ 文档 → 提交
3. 回滚：删除脚本与命令即可，无遗留状态

## Open Questions

（无 —— 范围（仅 portable）、核验集、命令名均已确认。）
