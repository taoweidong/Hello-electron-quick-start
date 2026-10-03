# Tasks

## 1. 脚本与命令（design D1-D6）

- [x] 1.1 新增 `scripts/pack-single.js`：前置检查（Node >= 24、node_modules 存在）→ 逐步 spawnSync 构建链（type-check / compile:main / vite build / electron-builder portable，失败红字定位并透传退出码）→ 产物核验（从 electron-builder.json 读取输出目录与产物名模板、exe 存在且体积 > 50MB、PowerShell 读 ProductVersion 与 package.json 版本一致〔非 Windows 跳过〕、sha512 计算）→ 结果回显（路径/体积/哈希/总耗时）；支持 `--verify-only`；验证：`node scripts/pack-single.js --verify-only` 对既有产物 exit 0 且回显完整
- [x] 1.2 `package.json` 新增 `"build:single": "node scripts/pack-single.js"`；验证：`npm run build:single` 全链路 exit 0，回显中路径指向真实存在的 exe

- [x] 1.3 Windows 双击入口 `一键打包.bat`（仓库根，design D7）：UTF-8 无 BOM + CRLF、chcp 65001、定位仓库根、检测 Node、调用 build:single、pause 保持窗口；验证：cmd 下执行 bat 全链路 exit 0 且窗口文案正常无乱码

## 2. 负路径验证（design D4 / D5）

- [x] 2.1 负路径验证：临时将 release 下 exe 改名后运行 `--verify-only`，断言触发并以 exit 1 结束；恢复文件名后复跑 exit 0；验证：两种场景的退出码与错误提示均符合预期

## 3. 文档与收尾

- [x] 3.1 文档同步：AGENTS.md 常用命令、README 常用命令、docs/project-structure.md 增加 scripts/ 条目与命令说明；验证：文档所述命令可执行、文件路径存在
- [x] 3.2 全量回归与提交：type-check / lint / build:single 全链路 exit 0 后提交推送；验证：`git status` 干净、远程同步
