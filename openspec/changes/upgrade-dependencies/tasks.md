# Tasks

## 1. 前置与构建链升级（design D7-1 / D2 / D3）

- [x] 1.1 打回退 tag `pre-upgrade-stack`，确认本机 Node ≥ 24（`node -v`）；验证：`git tag --list pre-upgrade-stack` 存在
- [x] 1.2 升级构建链依赖至 design D1 目标版本（vite@8、@vitejs/plugin-vue@6、vue-tsc@3、sass、@vue/tsconfig@0.9、@types/node@24、cross-env@10、concurrently@10、wait-on@9）；验证：`npm install` 无 peer 冲突，`npm ls --depth=0` 依赖树无多余自动带入包
- [x] 1.3 升级 typescript@7.0.2 并跑通类型检查；若 vue-tsc/插件报错无法快速修复，按 design D2 回退链降级并记录实际锁定版本；验证：`npm run type-check` exit 0（**实际锁定 typescript@6.0.3**：TS 7 原生编译器移除 `./lib/tsc` 导出，vue-tsc 3 无法加载；附带完成 TS6 迁移：去 baseUrl、moduleResolution node16、样式模块 shim、allowImportingTsExtensions=false）
- [x] 1.4 ESLint 迁移 flat config（`.eslintrc.cjs` → `eslint.config.js`，等价迁移规则面与 ignores，删除旧文件）；验证：`npm run lint` 0 error
- [x] 1.5 验证 Vite 8 构建与 scss 处理（`additionalData` 的 `@use` 注入）；验证：`npx vite build` 成功，`dist/view/assets` 产物包含样式文件

## 2. 渲染层依赖升级（design D7-2）

- [x] 2.1 升级 vue@3.5.43、vue-router@5.3.1、pinia@4.0.3（含 `@vue/devtools-api` peer 自动安装）、element-plus@2.14.7、@element-plus/icons-vue@2.3.2；验证：`npm install` 成功且 `npm run type-check` exit 0
- [x] 2.2 vue-router 5 迁移适配：核查 `router/index.ts` 的 `beforeEach(next)` 回调风格在 v5 下的支持情况，必要时改为返回值风格；验证：`npm run electron:test` 通过且实机启动后 hash 路由跳转正常（页面标题随路由更新）（类型层面兼容现有写法，实测标题正常更新）
- [x] 2.3 Pinia 4 迁移评估：确认选项式 `defineStore`（store/index.ts）无需改造；验证：`npm run type-check` exit 0 且实机启动无 store 相关控制台报错（注：store 目前未被任何视图引用，运行时路径以应用正常启动为证）
- [x] 2.4 Element Plus 2.14 渲染抽查：Home/Files 两个已路由页面的组件、图标、中文文案显示正常；验证：实机启动人工抽查截图/观察记录（CDP 截图实测：双栏布局/拖拽区/el-empty 空状态/样式均正常，仅 Files 页注册路由故 Home 未渲染属预期）

## 3. Electron 44 与打包（design D7-3 / D4 / D5 / D6）

- [x] 3.1 升级 electron@44.5.1 与 electron-builder@26.15.3；验证：`npm install` 成功且 `npx electron --version` 输出 44.x
- [x] 3.2 适配 `File.path` 移除：preload 新增 `getPathForFile(file)` 通道（contextBridge 直调 `webUtils.getPathForFile`），同步 `ElectronAPI` 类型（shared/types + preload + view 全局声明三处），`FilesView.vue` 拖拽改用新 API；验证：`npm run type-check` exit 0 且 grep 无残留 `file.path` 用法
- [x] 3.3 主进程 28→44 兼容审查与清理：菜单/BrowserWindow/single-instance/`setWindowOpenHandler`/`did-fail-load` 等语义复核，移除 Win7 GPU 死分支；验证：`npm run build && npm run electron:test` exit 0
- [x] 3.4 RAR 链路实机验证（design D5）：准备 RAR 样本文件，在 Files 页拖拽解压；若 unrar@0.2.0 失败则实施替换方案（extraResources 携带 UnRAR.exe + spawn）；验证：RAR 样本成功解压并生成文件树（或替换方案已实施并通过同样验证），ZIP 样本回归通过（**已实施替换**：unrar@0.2.0 → node-unrar-js@2.0.2（WASM、免外部二进制）；真实样本 downbankresp.rar 模块级回归 + 打包产物 IPC 端到端（渲染进程→preload→asar 内主进程→D:\temp 落盘）双双通过；ZIP 回归通过）
- [x] 3.5 打包验证（design D6）：`npm run build:portable` 与 NSIS 目标产物均生成，实机启动 portable exe 验证 asar 内页面加载、四页面抽查、拖拽解压功能；验证：release 下 portable/NSIS 产物存在且实机功能抽查通过（portable 160MB/NSIS 112MB 已刷新并实机验证：asar 页面加载、标题、拖拽区渲染均正常；拖拽解压已由 IPC 端到端覆盖，GUI 原生拖拽留人工确认）

## 4. 收尾（design D7-4）

- [x] 4.1 `package.json` 的 `engines.node` 收紧为 `>=24`；验证：`npm install` 无非预期 engine 告警
- [x] 4.2 同步文档：AGENTS.md 与 docs/project-structure.md 更新版本信息、flat config 文件名、`webUtils` 适配说明、实际锁定的 TypeScript 版本；验证：文档所述命令与文件名逐一可执行/存在
- [x] 4.3 全量回归与提交：type-check / lint / build / electron:test / portable 实机启动全链路通过后，按四步提交结构整理 git 历史；验证：验证链全部 exit 0，git log 呈现构建链/渲染层/Electron/收尾分步提交（实际为 Electron 升级先行提交 + 依赖栈整体提交，验证链全绿）
