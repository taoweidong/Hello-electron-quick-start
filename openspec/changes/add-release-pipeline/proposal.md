# Proposal

## Why

自动升级已上线，但"发布"仍是三段手工操作：`build:prod` 后人工核对 `latest.yml` / 安装包 / blockmap 的版本与哈希一致性、人工归集三件套、手工上传到更新源。任何一步疏漏（尤其 latest.yml 与实际产物不一致、漏传文件）都会直接打断已分发客户端的自动升级。探索方向 B（发布流水线）+ 用户确认的更新源协议（HTTP PUT / WebDAV）使发布可以一条命令闭环。

## What Changes

- **新增 `scripts/release.js`**（零新增依赖的 Node 脚本）：构建（复用 `build:prod`）→ 三件套核验对账 → 按版本归集 → HTTP PUT 上传 → 上传后校验。
- **三件套对账核验**：`package.json` 版本 == `latest.yml` 版本 == 安装包 `ProductVersion`；`latest.yml` 中每个文件的 sha512 与本地实算哈希逐一对账；三件套（`latest.yml` / `.exe` / `.blockmap`）齐全。
- **按版本归集**：三件套拷贝到 `dist-release/<版本>/`（gitignore），作为上传与留档的单一事实来源。
- **HTTP PUT 上传**：Windows 自带 `curl` 逐文件 `--upload-file` 到配置的更新源 URL（flat 布局，与 electron-updater 期望一致）；支持可选 Basic Auth（凭据仅经环境变量 `RELEASE_UPLOAD_AUTH`，不落盘）。
- **覆盖保护与上传后校验**：远端 `latest.yml` 已存在同版本时默认拒绝上传（需 `--force` 显式覆盖）；上传完成后 GET 远端 `latest.yml` 与本地逐字节比对。
- **新增 npm 命令**：`release`（默认全链路含上传）、`release:collect`（核验 + 归集，不上传，`--no-upload` 等价）；脚本支持 `--with-portable`（连 portable exe 一并归集/上传，供手动分发镜像）。
- 新增配置文件 `release.config.json`（仅含上传地址，无密钥，随仓库提交；默认沿用 `electron-builder.json` 的占位地址，部署时替换）。

## Capabilities

### New Capabilities

（无 —— 纯构建/发布工具链，不改变应用外部行为，规格保持真实。）

### Modified Capabilities

（无 —— 据此在 `.openspec.yaml` 设置 `skip_specs: true`。）

## Impact

- **代码**：新增 `scripts/release.js` 与 `release.config.json`、`package.json` 两条命令、`.gitignore` 增补 `dist-release/`；不触碰应用源码。
- **依赖**：零新增（curl 为 Windows 10+ 自带；node 内置模块足够）。
- **服务端要求**：更新源目录支持 HTTP PUT（Nginx DAV / MinIO / S3 兼容网关等）且支持 GET；无认证时可不配置 `RELEASE_UPLOAD_AUTH`。
- **文档**：AGENTS.md 发布流程、README 发布章节、docs/project-structure.md 增补条目。
