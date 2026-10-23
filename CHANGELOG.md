# 更新日志

人类可读的变更归档。版本号唯一来源仍是 `package.json` 的 `version`（运行时经 `app.getVersion()` 取，代码里没有版本常量），本文件**不**参与构建，也不被发布脚本读取——发布对账只看 `package.json` / `electron-builder.json` / 产物 PE 版本三处是否一致。

条目按提交所在的版本区间归置（用 `git log -S'"version"' -- package.json` 对账），格式参考 [Keep a Changelog](https://keepachangelog.com/)，分类用本项目口径：**新增** = 新能力，**变更** = 既有行为调整，**修复** = 缺陷，**工程化** = 不影响用户的使用验证链。

## [未发布]

1.0.1 之后落在 `main` 上、尚未升版本号的改动（2026-10-03 ~ 2026-10-20）。下次发版前它们会随 `npm run release` 一起对账。

### 新增

- **插件系统（Python / Node 初始化脚本）**：扫描工作区 `plugins/<id>/plugin.json`，插件注册完成后按 `runOnStartup` 执行入口脚本；新增 Plugins 页支持手动运行、启停、重新扫描、查看 stdout/stderr 与一键安装示例 Python 插件。入口只允许插件目录内相对路径并经 `realpath` 二次校验；执行使用 `spawn` 参数数组（`shell: false`）、固定 cwd、默认 15 秒超时与 64KB 输出上限；Python 解释器优先 `MYWINAPP_PYTHON`，其次 `python` / `py -3`。启用状态用内部设置键持久化，运行状态经 `plugin:status` 推送。插件脚本以当前用户权限运行，UI 明确提示只安装可信插件。
- **概览页与任务管理页（完整 CRUD 示例）**：默认路由改为 Home（任务统计 / 完成率仪表盘 / 状态分布 / 最近任务 / 运行环境 / 可点击的示例场景）；新增 Tasks 页，SQLite `tasks` 表真实持久化，支持新建 / 编辑 / 删除 / 批量删除、状态快速流转、搜索防抖、状态 / 优先级 / 分类组合筛选、四种排序、分页、表单校验、详情抽屉与按 `demo_key` 幂等的 12 条示例数据。IPC 契约新增 `task:list/get/create/update/delete/deleteMany/stats/seed`，入参在主进程经 `shared/tasks/model.ts` 归一化后再进参数化 SQL；排序字段走白名单映射，不拼 query。原生菜单「新建任务」（Ctrl/Cmd+N）已接通。
- **应用壳与视觉体系**：新增侧边栏 / 顶栏 / 页面标题组件、路由过渡、全局设计令牌（圆角 / 过渡 / 面板 / 表格 / 按钮视觉收编）；统计区统一为带分隔线的 `StatRail`，示例场景改为双栏列表、插件列表改为带状态轨的整行结构，减少重复卡片与悬浮动画；字体切换为 Windows 原生 Display/Text 栈，移除页面级背景渐变，把视觉重点留在概览 Hero。主题状态提升为 `useTheme` 单例，顶栏切换与设置页共享；文件页与设置页同步重构为空状态、信息面板与可复制路径的新版布局；窗口默认尺寸调整为 1280×860（最小 960×640）。
- **冒烟测试增强**：`electron:test` 不再只看 `did-finish-load`，会等待 Vue 应用壳与导航项真实挂载，并监听 `render-process-gone` 失败退出。
- **一键打包单一 EXE**：`npm run build:single` 复用既有构建链，附产物核验（存在性 / 体积 / 版本一致性 / sha512）与结果回显，`--verify-only` 可只复检既有产物；`一键打包.bat` 是双击入口。
- **发布级全套的双击入口**：`scripts/一键打包-Windows.bat` 薄壳调用同一份 `scripts/release.js --no-upload`（= `npm run release:collect`）——`build:prod` 出 NSIS 安装包 + portable → 三件套对账核验（版本三方一致 + 逐文件 sha512 实算对账）→ 归集 `dist-release/<版本>/`，不触网、不需凭据。前置检查（Node 存在且主版本 ≥ 24、依赖已装）与 electron 镜像默认值（`ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR`，已自行设置则不覆盖）在 bat 内完成；结束时用 `dir /b` 列出 `release\` 与 `dist-release\` 的真实清单，避免把"portable 已构建"误读成"portable 已归集"。
- **发布流水线**：`npm run release` 一键完成 `build:prod` → 三件套对账核验（版本三方一致 + `latest.yml` 逐文件 sha512/base64 与本地实算对账）→ 归集 `dist-release/<版本>/` → HTTP PUT 上传 → 远端 `latest.yml` 逐字节 + HEAD 尺寸核对；`release:collect` 只核验归集不上传。凭据仅经环境变量 `RELEASE_UPLOAD_AUTH`，不落 argv、不入仓库。
- **安全基线四道闸**（代码质量评审 B1/B2/B4 批次）：
  - `security/zipSlip.ts` 的 `safeJoin()` 断掉 zip-slip——条目名拒绝 `..` 越界、绝对/盘符/UNC/`\\?\`/`\\.\` 前缀、控制字符与 Windows 非法字符，反斜杠与 `/` 同等处理；越界即整包失败并落 WARN。
  - `security/pathGuard.ts` 给 `file:read` / `file:write` / `file:getInfo` / `file:readDir` 与解压目标做路径根授权（`realpath` + `path.win32.relative` 判包含，禁止字符串前缀比较；会话级授权 Map 上限 64 条 LRU）。
  - 外链主机白名单 + 页面内导航锁定 + `uncaughtException` / `unhandledRejection` 记录不退出。
  - 归档体积闸门：超 500MB 由 `security/archiveLimit.ts` 直接拒绝解压（防 OOM）。
- **日志与退出落盘**：`logger.ts` 统一写 `logs/app.log`（超 5MB 轮转、写失败只告警一次）；`closeDb()` 挂 `before-quit`，退出后 `data/` 不再残留 `-wal` / `-shm`。
- **压缩包选择的键盘入口**（评审 P3-4）：空状态从不可聚焦的 `<el-text>` 改为真实 `<button>`（Tab 可聚焦、Enter/空格触发），点击唤起 hidden `input[type=file]`；拖放与点选两条路径合流到 `useArchiveDrop` 的同一个 `extractArchive`，复用同一套校验与状态机。`getPathForFile` 对 `input` 选中的 `File` 同样有效，因此**没有新增 IPC 通道或依赖**。拖放区补 `role="group"` + `aria-labelledby` + `aria-busy`，详情区补 `role="region"`，解压提示补 `role="status"`，装饰性图标 `aria-hidden`。

### 变更

- **IPC 契约一次性统一**：主进程 handler 一律经 `ipc/ipcSafe.ts` 注册，返回结构收敛为 `IpcResult<T>` = `{ok,data}` | `{ok:false,error:{code,message}}`（原先 `settings:get` 给裸值、`settings:set` 给 `{success}`、`file/dialog` 各自拼形状）；失败连同通道名写 WARN。preload 的 `onFileOpened` / `onUpdateStatus` **返回退订函数**，删除 `removeAllListeners` 暴露。
- **更新源降为两级**：env `MYWINAPP_UPDATE_URL` > 打包内置 `app-update.yml`；`settings` 表的 `update.url` 一档移除（渲染层可写的存储不能决定下载哪个 exe），`WRITABLE_KEYS` 只剩 `theme`。env 覆盖必须先过 `updater/feedUrl.ts` 的 `assertSafeFeedUrl`，不合规 WARN 并回落内置源。
- **上传顺序固定** exe → blockmap → latest.yml **最后**：半途失败不会留下"指针指向缺失产物"的坏通道；`latest.yml` 解析失败即报错，不允许空 `files` 静默通过；远端版本比本次新（降级）默认拒绝，需 `--force`；设了 `RELEASE_UPLOAD_AUTH` 时 `upload.url` 必须 https。
- **工作目录失败不再静默**：回落 `userData` 后仍不可写时 `resolveWorkspace()` 抛错，入口据此弹窗退出（原先报告成功但实际没建目录）。
- **主题闭环**：`settings.theme` 真实驱动界面——`main.ts` 在 mount 前引入 Element Plus 深色变量并 `applyTheme`，深/浅色由 `html.dark` class 翻转；原先的自定义 `:root` 变量组、`prefers-color-scheme` 媒体块与 `variables.scss`（曾被 vite `additionalData` 复制进每个编译单元）删除，新样式一律用 `--el-*`。
- **应用身份单一来源**：`shared/constants` 的 `APP_CONSTANTS`（`APP_NAME` / `AUTHOR` / `HOMEPAGE`）驱动 `app.name`、窗口标题、文档标题与菜单"关于"外链；`electron-builder.json` 的 `appId` / `copyright` 与 `package.json.author` 换成真实值；**版本常量被删除**，避免再造一个漂移面。
- **渲染层瘦身**：`services/` 的渲染器死岛（6 文件，闭环互引但无调用方）、`HomeView` / `AboutView` / `SidebarMenu`、空 `store` 与 `createPinia` 全部删除；`FilesView` 由 498 行拆到约 250 行，逻辑进 `composables/`（`useFileTree` / `useArchiveDrop`）与 `utils/`（`fileType` 扩展名谓词单一来源、`fileTree` 纯装配）。`pinia` 依赖随后从 `package.json` 卸载（它是 vue-router 5 的**可选** peer）。
- **导航结构升级**：默认路由由 Files 改为 Home，文件管理移至 `/files`；`App.vue` 从仅承载路由视图升级为侧边栏 + 顶栏 + 页面过渡的应用壳，路由 meta 增加 description 供顶栏展示；窗口默认尺寸 1280×860。

### 修复

- **文件树子目录内容不显示**：旧 `buildFileTree` 建了目录节点却从未把它挂进父节点；现先建全部目录节点、再按父路径入树（`tests/fileTree.test.ts` 锁行为）。
- **图标与类型判定**：目录节点曾用 `!filename.includes('.')` 猜类型，导致无扩展名文件显示文件夹图标、目录渲染出两个图标；现按节点布尔标志判定，扩展名谓词统一走 `utils/fileType.ts`。
- **缺失元数据渲染成 `NaN`**：目录没有 `size` / 时间戳时界面显示 `NaN undefined`、`NaN-NaN-NaN`，现显式显示 `-`。
- **`readDir` 名称计算**：双分隔符 `split` 缺陷随共享路径工具（`utils/path.ts` 的 `baseName` / `parentDir` / `extname`，`\` 与 `/` 同等处理）一并修掉。
- **文件树图标尺寸**：`.drop-zone .el-icon`（48px）是后代选择器，权重压过 `.file-icon`，把树节点图标也放大到 48px；现用 `.file-tree-node .el-icon`（16px）显式回压。
- **文件树标签带相对路径**：主进程回传的 `name` 是归档内相对路径（如 `doc/a.txt`），旧树直接把它当标签；现统一取 `path` 最后一段，嵌套目录与文件显示正确名称（`tests/fileTree.test.ts` 增加回归用例）。
- **任务行点击无响应**：Element Plus 的 `row-click` 在程序化触发/点击行空白处时 `column` 可能为 undefined，旧 handler 直接读 `column.type` 抛错导致详情抽屉打不开；现改为 `column?.type` 守卫，并在深链任务不在当前页时用单独拉取的快照兜底。

### 工程化

- **验证链从零到有**：`npm test`（`tsc -p tsconfig.test.json` 预编译 `tests/` → `node --test`，当前 83 条 / 15 个文件）、`.github/workflows/ci.yml`（windows-latest：`npm ci` → type-check + eslint → npm test → build:prod；`electron:test` 需桌面会话，刻意留作本地发布前门禁）。可单测的纯函数一律拆成零 `electron` 顶层导入的接缝模块，fs 副作用经接口注入。
- **类型治理**：`no-explicit-any` / `no-unsafe-*` / `restrict-template-expressions` 七条规则从 warn 升 **error**（基线 0 error / 0 warning，全程没有一条 `eslint-disable`）；`ipcSafe` 用泛型接缝而非 `any[]`；三份 tsconfig（node/web/test）同步开 `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`。
- **构建链单入口**：`build:core`（type-check + 编译主进程 + Vite 构建）被 `build` / `build:prod` / `build:portable` / `pack-single` 复用，不再各抄一份步骤；删除坏脚本 `electron:pack`；`npm run clean` 改 `scripts/clean.js`（原命令引用的 `rimraf` 本就不在依赖里，一直是坏的）。
- **产物与打包**：Vite `target: chrome126`、`sourcemap: 'hidden'`（`.map` 不进 asar）、`manualChunks` 函数形态拆 vendor-element-plus（rolldown 不支持对象形态）；`electron-builder.json` 删 mac/linux 目标、显式 `asar` / `compression`；补 `src/view/public/favicon.ico`。
- **导航守卫**：`router.beforeEach` 从已废弃的 `next()` 回调改为 return 形态，消除每条路由切换的 `VUE_ROUTER_R0025`（这是 2026-10-02 依赖升级时就列出、当时未执行的 vue-router 5 迁移项）。
- **开发环境锚点**：仓库根补 `.nvmrc`（`24`，与 `engines` 和 Electron 44 内嵌 Node 同世代）与 `.editorconfig`（UTF-8 / LF / 2 空格 / 末行换行；`[*.md]` 保留尾随空白，`[*.bat]` 显式 CRLF）。行尾口径经 blob 字节实测确认：仓库内所有受版文本都以 LF 存储，`core.autocrlf=true` 只在检出时转换。

## [1.0.1] - 2026-10-02

### 新增

- **自动更新**：`src/main/updater/` 基于 electron-updater 的 generic provider；`autoDownload` + `autoInstallOnAppQuit`，启动延迟 5s 首检；状态经 `update:status` 事件推送；设置页新增更新卡片。NSIS 产物内置 `app-update.yml`。
- **工作目录与配置存储**：`workspace/` 解析工作目录（默认 `D:\MyWinApp`，`MYWINAPP_WORKDIR` 覆盖，不可用整体回落 `userData`），固定 `logs/` / `data/` / `config/` 子布局；`db/` 用 Node 24 内置 `node:sqlite` 持 `data/app.db`（WAL）并建 `settings` 键值表，IPC `settings:get` / `settings:set` / `workspace:get` 读写配置与目录信息。

### 变更

- **运行时进入 Node 24 世代**：Electron 28.1.0 → 44.5.1（内嵌 Node 24.21 / Chromium 152），electron-builder 24 → 26.15.3；依赖栈升到 Vite 8（Rolldown）、Vue 3.5.43、vue-router 5、Element Plus 2.14.7、ESLint 10 flat config。TypeScript 锁 6.0.3（TS 7 原生编译器移除 `./lib/tsc` 会让 vue-tsc 3 无法加载，已实测）。
- **拖拽取路径改走 `getPathForFile`**：Electron 32+ 移除了 DOM `File.path`，preload 经 `contextBridge` 暴露 `webUtils.getPathForFile`，`ElectronAPI` 类型三处同步。
- **RAR 解压换实现**：`unrar@0.2.0`（停更、需外部二进制且 API 失配）替换为 `node-unrar-js`（WASM，免外部二进制）。
- `files` 不再显式打包 `node_modules`，生产依赖由 electron-builder 智能裁剪，安装包体积显著减小。

## [1.0.0] - 2025-10-26

### 新增

- Electron + Vue 3 + TypeScript 桌面应用骨架：主进程 / 预加载 / 渲染层三段，文件树浏览与压缩包（ZIP / RAR）拖放解压。

### 修复

- 打包后 `index.html` 加载路径错误导致的白屏（生产模式按 `__dirname` 定位）；开发热更新（`electron:dev` 经 cross-env 注入 `VITE_DEV_SERVER_URL`，端口固定 5180）。

### 工程化

- `tsconfig.node.json` 的 `rootDir` 收敛为 `./src`，产物布局 `dist/main/main/**` + `dist/main/shared/**`，源码相对导入在产物中原样成立，因此**不需要任何编译后处理脚本**（删除 `compile-main.js`）。
- `ElectronAPI` 类型收敛到 `shared/types/electron.d.ts` 单一来源，preload 按接口实现；`npm run type-check` 变成真实全量检查（vue-tsc 查渲染进程 + tsc 查主进程）。
