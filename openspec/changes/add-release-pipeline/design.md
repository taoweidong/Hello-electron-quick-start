# Design

## Context

缺口见 proposal.md - Why。已核实事实：

- `build:prod` 产物集：`release/latest.yml`、`My-Win-App-<v>-x64.exe`、`.blockmap`（三件套）、portable exe、`win-unpacked/`
- `latest.yml` 由 electron-builder 生成，含每个文件的 `sha512` 与 `size`——对账的权威来源
- Windows 10 1803+ 自带 `curl.exe`；curl 原生支持 `--upload-file`（PUT）与 `-u user:pass` Basic Auth
- 上一 change（add-one-click-pack）已确立"产物路径从配置推导 + 三重核验 + `--verify-only` 式钩子"的脚本范式，本脚本沿用
- 更新源协议形态经用户确认为 **HTTP PUT / WebDAV**（Nginx DAV、MinIO、S3 兼容网关等）

约束：零新增依赖；凭据不落盘；`scripts/` 不进安装包；不改变应用行为。

## Goals / Non-Goals

**Goals:**

- `npm run release` 一条命令：构建 → 对账 → 归集 → 上传 → 上传后校验，全程步骤化输出与稳定退出码
- 对账以 `latest.yml` 为权威：版本三方一致 + 文件级 sha512/size 逐项核对，任何不一致拒绝发布
- 覆盖保护：同版本已在远端时默认拒绝，`--force` 显式放行

**Non-Goals:**

- 不做多平台发布（仅 Windows NSIS 三件套；portable 经 `--with-portable` 可选附带）
- 不做差量/灰度/多通道、不管理历史版本清理
- 不做签名（沿用现状）
- 不实现 PUT 之外的上传协议（SSH/OSS 等未来按需加适配器）

## Decisions

**D1 —— `scripts/release.js` 单脚本，核验自包含**

独立脚本（CJS、零依赖）。与 `pack-single.js` 的哈希/版本读取逻辑少量重复而不抽公共库——两个脚本演进方向不同，抽库收益低于耦合成本。

**D2 —— `latest.yml` 为对账权威**

核验顺序：文件齐全（三件套存在于 `release/`）→ 版本三方一致（package.json / latest.yml.version / exe ProductVersion）→ 逐文件对账（latest.yml 中每个 entry 的 sha512/size 与本地实算一致）→ 通过后才归集与上传。任何一步失败即 exit 1，杜绝"发出对不上账的更新"。

**D3 —— 配置：`release.config.json`（入库，无密钥）+ 环境变量（凭据）**

```json
{ "upload": { "url": "http://localhost:58132/update/" } }
```

- `upload.url`：PUT 目标目录（flat 布局，文件直接落在该路径下，与 electron-updater 读取路径一致）
- 凭据仅经环境变量 `RELEASE_UPLOAD_AUTH`（格式 `user:pass`，映射 curl `-u`）；未配置即匿名 PUT
- 备选"全部走 env"被放弃：地址非敏感，落盘配置便于团队共享与 CI 复用；备选"地址+密钥都入库"被放弃：密钥绝不落盘

**D4 —— 上传与校验**

- 预检：GET `<url>/latest.yml`，若远端版本与本次相同且无 `--force` → 拒绝（防覆盖线上）；远端不可达视为"新目录"放行（首次发布场景）
- 逐文件 PUT：`curl --upload-file <本地> <url>/<文件名>`（curl 自动走 PUT），任一非 2xx 即失败终止
- 后校验：GET `<url>/latest.yml` 与本地逐字节比对；再 HEAD 两个二进制核对 `Content-Length` 与本地 size 一致
- `--with-portable` 时 portable exe 加入集合（仅上传分发，latest.yml 不含它——它不参与自更新）

**D5 —— 归集目录 `dist-release/<版本>/`（gitignore）**

三件套（及可选 portable）拷贝于此，作为"本次发布了什么"的留档与人工兜底来源。备选直接从 `release/` 上传被放弃：release/ 混有多版本产物与 unpacked 目录，归集目录是干净的单一事实点。

**D6 —— 命令面**

- `npm run release`：全链路（构建 → 对账 → 归集 → 上传）
- `npm run release:collect`：到归集为止，不上传（等价 `--no-upload`）
- 脚本 flags：`--no-upload`、`--with-portable`、`--force`、`--no-build`（跳过构建直接核验现有产物）
- 备选"只做一条命令+全部 flag"被放弃：两条语义化命令覆盖 90% 用法，flag 保留逃生口

## Risks / Trade-offs

- [PUT 目录不存在导致 409/404（WebDAV 需要 MKCOL）] → 首选约定"服务器预建目录"（部署侧一次动作，写入文档）；脚本检测 409 时给出明确提示，不做自动 MKCOL（各服务器行为差异大，越权风险）
- [远端 GET 预检不可达被误判为"首次发布"] → 404 视为放行；连接层错误（超时/拒绝）视为失败终止，宁可手工复查
- [latest.yml 伪造/手动改坏导致对账通过但内容错误] → 对账锚定"本地实算哈希 vs latest.yml 声明"，latest.yml 与 exe 同由 electron-builder 生成，双方独立生成却一致的错单概率极低；不做额外签名（Non-Goal 同未签名现状）
- [覆盖保护依赖远端 latest.yml 可 GET] → 与后校验同一通道，行为一致；`--force` 逃生口显式
- [curl 在精简版 Windows 缺失] → 脚本前置 `where curl` 检查并给出安装提示（Win10 1803+ 原生自带）

## Migration Plan

1. 实施顺序：脚本（对账+归集）→ 上传与校验 → 本地 PUT 服务器端到端 → 负路径 → 文档 → 提交
2. 端到端验证：临时 node 服务器（PUT 落盘 + GET 回读）模拟 WebDAV，`release.config.json` 指向本地端口全链路演练
3. 回滚：删除脚本、两条命令与配置即可；无应用侧状态

## Open Questions

（无 —— 协议形态已确认，地址与凭据属部署期配置。）
