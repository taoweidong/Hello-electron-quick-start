# Proposal

## Why

`build:portable` 虽已是单条命令，但存在三个体验缺口：最终产物路径埋在 electron-builder 冗长输出里；构建结束后没有任何产物核验（本会话实测过"文件名版本与实际产物版本对不上"的隐患，目前只靠人工发现）；CI / 脚本调用时缺少稳定的退出码与结构化回显。需要一个一键命令：从源码到**经过核验的 portable 单一 EXE**，产物可追溯。

## What Changes

- **新增 `scripts/pack-single.js`**（零新增依赖的 Node 脚本）：前置检查 → 逐步执行现有构建链（type-check / compile:main / vite build / electron-builder portable）→ 产物核验 → 结果回显。
- **产物核验集**：exe 存在且体积超过阈值；exe 的 `ProductVersion` 与 `package.json` 版本一致；计算并展示 sha512。
- **新增 npm 命令 `build:single`**；脚本支持 `--verify-only`（跳过构建、仅对既有产物执行核验，供复检与负路径验证）。
- **范围限定**：仅 portable 单一 EXE；NSIS 与更新源三件套不在本 change 内（继续走 `build:prod`，未来发布流水线另行立项）。
- 现有 `build:portable` 命令保留不动。

## Capabilities

### New Capabilities

（无 —— 本变更为纯工具链改动，不改变应用的任何外部行为，规格保持真实、不虚构需求。）

### Modified Capabilities

（无 —— 据此在 `.openspec.yaml` 设置 `skip_specs: true`。）

## Impact

- **代码**：新增 `scripts/pack-single.js` 与 `package.json` 一条脚本命令；不触碰任何应用源码与打包配置。
- **依赖**：零新增（`node:crypto` / `node:child_process` / `node:fs` 均为内置）。
- **文档**：AGENTS.md 常用命令、README 常用命令、docs/project-structure.md 增加对应条目。
- **打包**：`scripts/` 不进安装包（`files` 只含 dist 与生产依赖），无影响。
