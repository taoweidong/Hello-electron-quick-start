# Tasks

## 1. 对账核验与归集（design D2 / D5）

- [x] 1.1 新增 `scripts/release.js`：构建（默认跑 `build:prod`，`--no-build` 跳过）→ 三件套核验（存在 / package.json == latest.yml.version == exe ProductVersion / latest.yml 逐文件 sha512+size 对账）→ 归集到 `dist-release/<版本>/`（`--with-portable` 附带 portable）；`.gitignore` 增补 `dist-release/`；验证：`npm run release:collect` exit 0 且归集目录三件套齐全
- [x] 1.2 `package.json` 新增 `release` / `release:collect` 命令，新增 `release.config.json`（upload.url 占位）；验证：两命令 `--help` 式输出正常、配置读取生效
- [x] 1.3 负路径验证（对账）：临时篡改 latest.yml 的 sha512 → 核验 exit 1 并指明不一致文件；恢复后 exit 0；验证：断言触发与恢复两场景

## 2. HTTP PUT 上传与校验（design D3 / D4）

- [x] 2.1 上传实现：curl 逐文件 PUT（flat 布局）、`RELEASE_UPLOAD_AUTH` 可选 Basic Auth、覆盖预检（远端同版本且无 `--force` 拒绝；连接层错误终止，404 视为首次发布）、上传后 GET latest.yml 逐字节比对 + HEAD 二进制核对 Content-Length；验证：type-check 不涉及、脚本 `--no-upload` 回归 exit 0
- [x] 2.2 本地 WebDAV 模拟端到端：临时 node 服务器（PUT 落盘 + GET 回读），`release.config.json` 指向本地端口跑 `npm run release -- --no-build`；验证：服务器目录收到三件套、远端 latest.yml 与本地一致、退出码 0

## 3. 文档与收尾

- [x] 3.1 文档同步：AGENTS.md 发布流程（release 命令与凭据环境变量）、README 发布章节改写、docs/project-structure.md 增补 scripts/release.js 与 release.config.json、服务端 PUT 目录部署前置说明；验证：文档命令可执行、配置键与实现一致
- [x] 3.2 全量回归与提交：lint / release:collect / 本地端到端全绿后，按"核验归集/上传/文档"分步提交并推送；验证：`git status` 干净、远程同步
