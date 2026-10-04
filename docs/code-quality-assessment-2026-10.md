# 代码质量评估报告（2026-10）

评估对象：`electron-quick-start-vue` @ commit `255f3f1`（版本 1.0.1，main 分支）
评估日期：2026-10-04　评估人：Qoder（AI 取证 + 人工逐条复核）
配套文档：[优化方案](optimization-plan-2026-10.md)

## 1. 评估范围与方法

覆盖整个仓库的 41 个 TS/Vue 源文件（2753 行）、根配置（`package.json`、`tsconfig*`、`eslint.config.mjs`、`vite.config.ts`、`electron-builder.json`）、`scripts/` 两个构建发布脚本、`test-main.js`、`docs/` 与 `openspec/`。

取证方式分三步：先由三个只读 Explore 代理分区审查（主进程 / 渲染层与共享层 / 工程化基础设施），再由我对**每一条中高级结论回读源码逐个核对行号**，最后由 Plan 代理复核技术可行性并修正了 5 处误判（见 §8）。评估全程未运行应用、未修改任何文件，因此所有结论均为**静态代码证据**，不含运行时观测。

风险等级口径：`严重`=可被利用的安全缺陷或必然失败的构建环节；`中等`=会随时间恶化的健壮性/一致性债务；`轻微`=风格、冗余与可维护性问题。`置信度`区分"源码直读可证"与"需构造样本或运行验证"。负责人默认全部为本仓库单一维护者，故不单独列 owner 列。

## 2. 执行摘要

**架构骨架是健康的，短板集中在安全边界与验证面。** 分层（main / view / shared）、IPC 契约三方一致性、依赖锁定、文档与代码同步程度都高于同类 Electron 起步项目，发布脚本 `scripts/release.js` 里的"逐文件实算 sha512 对账 + 上传后逐字节回读校验"是全仓工程质量最高的一段代码。

但存在一条完整的**远程代码执行链**：渲染层无任何导航/CSP 约束 → 可经 `settings:set` 改写更新源地址 → 更新源解析不校验协议 → 内置更新源本身是明文 `http://localhost:58132/update/` → `autoDownload` + `autoInstallOnAppQuit` + 静默 `quitAndInstall`。链条上任一环即可把"下载并执行任意安装包"落地，而唯一的内容完整性保障（latest.yml 里的 sha512）与安装包走同一明文通道，可同时被替换。

同时，**该项目没有任何自动化验证手段**：零单元测试、零 CI 工作流、无 `test` 脚本，`npm run electron:test` 只验证两个产物文件存在和页面能加载完，不断言任何 IPC 行为。这意味着上述问题长期未被发现并非偶然，而是缺少能发现它们的机制；也意味着后续整改本身只能靠 `type-check` + `lint` + 手动跑回归来兜底——这是本报告最重要的结构性结论。

风险分布：严重 8 项、中等 15 项、轻微 14 项（编号发现共 37 项，其中 S6 属外部采购决策，S8/R9/R10 为评估末轮新增）。

## 3. 量化基线

| 指标 | 实测值 | 取数方式 |
|---|---|---|
| tracked 文件 | 113（src 45 / openspec 34 / .zcode 12 / scripts 2 / docs 2 / 根配置 12） | `git ls-files` |
| 源码规模 | TS+Vue 41 文件 2753 行；主进程 11 文件 777 行，view+shared 30 文件 1976 行 | `wc -l` |
| 最大文件 | `FilesView.vue` 448、`HomeView.vue` 261、`main/index.ts` 208、`fileHandlers.ts` 199、`SettingsView.vue` 198 | `wc -l` |
| `any` 使用 | 约 41 处（主进程 `: any` 17 + `as any` 1；渲染/共享 23），热点 `FilesView.vue` 9 处 | grep |
| 抑制注释 | `@ts-ignore` / `@ts-expect-error` / `eslint-disable` / `TODO` / `FIXME` 全仓 **0** | grep |
| IPC 面 | 23 个 `ipcMain.handle` ↔ 23 个 preload `invoke` 名称逐条一致；2 个主→渲染推送事件 | 逐通道核对 |
| 自动化测试 | 单测 **0**、集成测试 **0**、`*.test.*`/`*.spec.*` 文件 **0** | glob |
| CI/CD | **无**（`.github/` 目录不存在） | 目录检查 |
| 依赖锁定 | `package-lock.json` lockfileVersion 3，与 25 项 deps/devDeps 范围逐条一致（0 DIFF / 0 MISS / 0 EXTRA） | 比对 |
| 工作树 | `git status` 干净，无编译产物/exe/日志误提交（最大 tracked 文件 `build/icons/icon.ico` 285KB） | `git ls-files` |
| tsconfig 严格度 | `strict=true`（继承 `@vue/tsconfig`）→ `noImplicitAny`/`strictNullChecks`/`useUnknownInCatchVariables` 生效；`exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`、`noUnusedLocals`、`noImplicitOverride` **未启用** | 配置读取 |

## 4. 风险链专章：渲染层内容 → 静默安装包执行

这是本次评估的最高优先级发现，单独成节。攻击路径（每步都有源码证据）：

```mermaid
flowchart LR
  A["页内任意内容<br/>无 CSP / 无 will-navigate"] --> B["electronAPI.setSetting<br/>preload.ts:44"]
  B --> C["settings:set 无 key 白名单<br/>settingsHandlers.ts:9"]
  C --> D["update.url 写入 SQLite<br/>db/index.ts:31"]
  D --> E["resolveFeedUrl 不校验协议<br/>updater/index.ts:26-36"]
  E --> F["setFeedURL(generic, 攻击者地址)<br/>updater/index.ts:59"]
  F --> G["latest.yml 与安装包同通道<br/>sha512 可一并伪造"]
  G --> H["autoDownload + quitAndInstall(true,true)<br/>updater/index.ts:63,64,94"]
  H --> I["任意代码以用户权限执行"]
```

1. `src/main/index.ts:44` `sandbox: false`，且 `src/view/index.html` 无 CSP meta、全仓未注册 `will-navigate`；页内可加载/注入任意脚本，或把窗口导航到远端页面。
2. 一旦被注入，渲染层持有的 `electronAPI` 能力过宽：`setSetting(任意 key, 任意值)`（`preload.ts:44` → `settingsHandlers.ts:9` 无 key 白名单、无值校验）、`writeFile(任意路径)`（`fileHandlers.ts:18`）、`extractZip/extractRar` 未防目录穿越（`fileHandlers.ts:48/111`）。
3. 更新源解析 `updater/index.ts:26-36` 对 settings 值零校验，`:59` 直接 `setFeedURL`；打包内置地址本身是 `http://localhost:58132/update/`（`electron-builder.json:8-13`）。
4. `autoDownload = true`、`autoInstallOnAppQuit = true`（`:63-64`），`installNow()` 走 `quitAndInstall(true, true)` 静默安装并重启（`:94`）。
5. 唯一完整性校验是 electron-updater 比对 latest.yml 内的 sha512，而 latest.yml 与 exe 走同一 HTTP 通道 → 中间人可同时替换两者。若更新源为 NSIS 安装版，客户端会信任并执行替换后的安装包。

**判定**：这不是四个独立中危问题的叠加，而是一个严重项。前三环（路径约束、key 白名单、协议校验）任一补齐即可断链；建议以"断链"为验收目标，而不是逐项打勾。

**置信度**：源码直读可证（高）。未做实际利用验证——构造恶意压缩包与本地 http 更新源做端到端复现，列为整改阶段的验收动作（见优化方案 B2 验收标准）。

## 5. 分维度发现

### 5.1 安全（严重 8 项）

| # | 发现 | 证据 | 等级/置信度 |
|---|---|---|---|
| S1 | ZIP/RAR 解压未防目录穿越：条目名直接 `join` 到目标目录，未过滤 `..`/绝对路径 | `src/main/ipc/fileHandlers.ts:48`（ZIP `relativePath`）、`:111`（RAR `header.name`） | 严重 / 高（未做端到端复现） |
| S2 | 文件 IPC 接受任意绝对路径，无根目录或会话授权约束；`file:write` 可直接落盘 | `fileHandlers.ts:9`、`:18`、`:154`、`:175` | 严重 / 高 |
| S3 | 更新源三级解析不校验 scheme/host，且 `settings:set` 对 key 无白名单；内置源为明文 http | `src/main/updater/index.ts:26-36`、`:59`；`src/main/ipc/settingsHandlers.ts:9`；`electron-builder.json:8-13` | 严重 / 高 |
| S4 | `shell.openExternal(url)` 对任意 http/https 放行，可被诱导触发外部协议处理器（窗口导航本身已 `action:'deny'`，风险在此分支） | `src/main/index.ts:76-81` | 严重 / 中（需实际协议劫持样本） |
| S5 | 主进程无 `uncaughtException` / `unhandledRejection` 兜底，全仓 0 命中；仅 `whenReady().catch` | `src/main/index.ts:102-104` | 严重 / 高 |
| S6 | Windows 代码签名完全缺失，安装包与更新包无发布者信任链 | `electron-builder.json:21-34` 无 `sign`/`certificateSubjectName`；README 自认未签名 | 严重（属采购决策，本轮不实施）/ 高 |
| S7 | 发布脚本：凭据进 curl argv（Windows 同机用户可由进程命令行读取）、所有 curl 调用无 `--connect-timeout`/`--max-time`/`--retry`、`latest.yml` 在归集列表首位即最先上传、远端预检只拒绝同版本（允许把线上 1.0.2 覆盖成 1.0.1） | `scripts/release.js:156-157`、`:161/166/186/198/207`、`:135`、`:171-176` | 严重 / 高 |
| S8 | 上传端点为明文 HTTP 时仍发送 Basic 凭据——`release.config.json` 当前即 http 地址，凭据在网络上明文可达 | `release.config.json:3`、`scripts/release.js:149-157,186` | 严重 / 高 |

补充（轻微）：`src/main/index.ts:60` 的 `openDevTools()` 只在 dev 分支，符合预期；`updater/index.ts:60` 把 feedUrl 原样写日志，若 URL 内嵌凭据会落进 `app.log`（写日志的 `catch` 在 `index.ts:14-16` 静默）。

### 5.2 健壮性与生命周期（中等 9 项 + 轻微 1 项）

| # | 发现 | 证据 | 等级 |
|---|---|---|---|
| R1 | `npm run clean` 必然失败：脚本调用 `rimraf`，但它既不在 deps 也不在 devDeps，`node_modules/.bin/rimraf` 实测不存在 → 一跑即 ENOENT | `package.json:24` | 中等（构建环节必然失败，实际优先级等同严重） |
| R2 | 日志无轮转、无大小上限，纯 `appendFileSync` 追加；写失败被静默吞掉，故障时可能既丢日志又无告警 | `src/main/index.ts:9-17` | 中等 |
| R3 | `DatabaseSync` 单例无关闭路径，全仓无 `.close()` / `before-quit` → WAL 模式下 `-wal`/`-shm` 可能残留，影响下次启动一致性判断 | `src/main/db/index.ts:8-22` | 中等 |
| R4 | 事件监听治理缺失：preload 的 `onFileOpened`/`onUpdateStatus` 不返回退订句柄，`SettingsView.vue:113` 每次进页面叠加一次 `update:status` 注册；更关键的是 `preload.ts:37` 把 `removeAllListeners(任意 channel)` 直接暴露给渲染层，可被用于让更新推送静默失效 | `src/main/preload.ts:33-34,37,50-51`；`src/view/src/views/SettingsView.vue:113` | 中等（叠加注册部分实为噪声级，见 §8-3） |
| R5 | IPC 返回结构三套混用：`{success,error}`（fileHandlers 全部）／裸值直通且无 try-catch（`appHandlers.ts:26-63`，dialog 抛错会以 rejected 形式落到渲染层）／`settings:get` 裸值 vs `settings:set` 包裹 | `src/main/ipc/appHandlers.ts:10-23`、`settingsHandlers.ts:5-16` | 中等 |
| R6 | Windows 路径分隔符假设：取父目录用 `lastIndexOf('/')`；扩展名解析用 `substring(lastIndexOf('.'))`，无点号目录名退化为整串（`.tar.gz` 亦失真） | `src/view/src/views/FilesView.vue:290`、`:151/158/165/219`；`components/FileRenderer.vue:68,75` | 中等 |
| R7 | 大文件整包读入主进程内存解压，无 Worker、无流式；渲染层 `await` 期间无 loading/进度/取消三态 | `src/main/ipc/fileHandlers.ts:34,102`；`FilesView.vue:235` | 中等 |
| R8 | `win.loadFile` 失败仅记日志，窗口仍然显示为空白，用户无提示 | `src/main/index.ts:63-67` | 中等 |
| R9 | 工作目录回落到 `userData` 时**忽略第二次 `trySetup` 的返回值**：若回落目录同样不可写，仍把 `path` 报告为可用并继续启动，后续所有写日志/建库都落入静默失败 | `src/main/workspace/index.ts:40-41` | 中等 / 高（评估末轮新发现） |
| R10 | `vite.config.ts:9` 的 `publicDir` 指向不存在的 `src/view/public`，而 `src/view/index.html:5` 引用 `/favicon.ico` → 运行时 404、图标缺失 | `vite.config.ts:9`、`src/view/index.html:5` | 轻微 / 高 |

### 5.3 契约与类型一致性（中等 1 项 + 轻微 4 项）

优点必须先说清：**23 个 `ipcMain.handle` 通道与 preload 的 23 个 `invoke`、`ElectronAPI` 类型声明三方名称逐条对应，无漏改、无多余通道**（含 `ipc/index.ts:2-6` 注册的 5 个 handler 模块），这在多次迭代的 IPC 项目里并不常见。

| # | 发现 | 证据 | 等级 |
|---|---|---|---|
| C1 | 解压器把条目累加进 `const extractedFiles: any[]` 后直接返回，而 `src/shared/types/electron.d.ts:11-23` 已定义 `ExtractedFileInfo`/`ExtractResult` 并被 `ElectronAPI` 引用（`:97-98`），实现侧未使用 → 类型形同注释，改字段时无编译期保护 | `src/main/ipc/fileHandlers.ts:39,106`（累加器）、`:85,147`（返回点） | 轻微 |
| C2 | 幽灵声明：`src/view/src/types/electron.d.ts:9-11` 仍给 DOM `File` 扩展 `path: string`，与 `preload.ts:18` 采用的 `webUtils.getPathForFile` 方案自相矛盾（Electron 32 起该属性已移除），会诱导后续代码误用 `file.path` | `src/view/src/types/electron.d.ts:9-11` | 中等 |
| C3 | 同一形状两份定义：主进程 `UpdateState`（`updater/index.ts:7-14`）与共享 `UpdateStatusInfo`（`shared/types/electron.d.ts:78-85`）字段完全相同；主进程 `WorkspaceInfo`（`workspace/index.ts:7-10`）与共享同名接口（`:66-69`）重复。新增字段时只改一处不会报错 | 见证据行 | 轻微 |
| C4 | `any` 约 41 处（见 §3），含 `template as any`（`main/index.ts:206`）、`options: any`（`preload.ts:7-8`）与共享类型里的 `options?: any`（`electron.d.ts:93-94`）、`catch (error: any)` 系列 | 多处 | 轻微 |
| C5 | 通道命名风格混杂：`file:getInfo`（camel）与 `update:get-status`（kebab）并存，事件名 `file-opened` 与 `update:status` 也不统一 | `fileHandlers.ts:154`、`updateHandlers.ts:13`、`index.ts:153` | 轻微（不建议改名，见方案"不做清单"5） |

### 5.4 结构与死代码（中等 1 项 + 轻微 5 项；D3 因用户可感知上调为中等）

| # | 发现 | 证据 |
|---|---|---|
| D1 | 渲染器"死岛"：`src/view/src/services/` 下 `FileRenderer.ts`、`FileRendererFactory.ts`、`{Text,Image,Zip,Rar}FileRenderer.ts` 共 6 个文件互相闭环引用，无任何视图导入（实际渲染走 `components/FileRenderer.vue:42-46` 的 .vue 渲染器）。⚠️ 同目录的 `FileExtractor.ts`/`FileExtractorFactory.ts`/`ZipExtractor.ts`/`RarExtractor.ts` 是**活代码**（`FilesView.vue:222` 在用），清理时不可顺手删 | grep 全仓导入关系 |
| D2 | 未路由页面与组件：`HomeView.vue`（261 行）、`AboutView.vue`、`SidebarMenu.vue` 不在路由（`router/index.ts` 仅 2 条）且无导入；`router` 声明 `meta.keepAlive` 但 `App.vue:5-9` 无 `<KeepAlive>`；`store/index.ts:4` 的 `useAppStore` 全项目 0 处使用；`shared/constants` 的 `PLATFORMS`/`STORAGE_KEYS` 0 处使用 | 逐条 grep |
| D3 | 主题功能是半成品：`SettingsView.vue:121` 把 `theme` 存进 SQLite 但无任何 UI 消费，深浅色实际只由 `prefers-color-scheme` 决定（`styles/variables.scss:30`、`styles/index.scss:30`），用户选"暗色"后重启不生效——这是**可感知的功能缺陷**，不只是死代码 | `SettingsView.vue:101-131` |
| D4 | 常量/版本漂移：`shared/constants/index.ts:7-9` 的 `APP_NAME:'My Electron App'`、`VERSION:'1.0.0'`、`AUTHOR:'Your Name'` 与 `package.json`（my-win-app / 1.0.1）不一致；`electron-builder.json:2-4` 的 `appId: com.yourcompany.yourapp`、copyright "2024 Your Company" 仍是脚手架默认值。漂移出口：`app:getInfo` 的 name/author、窗口标题（`main/index.ts:39`）、文档标题（`router/index.ts:35`、`index.html:7`） | 逐文件比对 |
| D5 | 超大 SFC：`FilesView.vue` 448 行混杂拖拽（200-247）、文件树构建（250-311）、6 个类型判定（142-187），且扩展名清单在 `FilesView.vue:142-187`、`FileRenderer.vue:66-96`、`FileRendererFactory.ts:19-23` 三处重复 | 结构阅读 |
| D6 | UI 一致性债务：`FilesView.vue:345-447` 共 14 处硬编码色值（`#303133`/`#409eff`/`#dcdfe6` 等）与 `styles/variables.scss:2-26` 已定义的变量语义重复，换肤/对齐 Element 主题时需逐处改；全仓 `aria-*` 0 处，拖放区（`FilesView.vue:9`）无键盘可达替代入口 | grep：FilesView 色值 14 处、`aria-` 全仓 0 命中 |

### 5.5 构建与发布工程化（中等 4 项 + 轻微 4 项）

| # | 发现 | 证据 | 等级 |
|---|---|---|---|
| E1 | 零测试、零 CI（确定结论）：无 `.github/`、无 vitest/jest、无测试文件、无 `test` 脚本。`electron:test` 仅验证 `dist/view/index.html` + `dist/main/main/preload.js` 存在、隐藏窗口 `did-finish-load` 后 1.5s 退出，**不断言任何 IPC 通道、preload API 或 UI 行为**，且需先手工 `npm run build` 否则直接 exit 1 | `test-main.js:7-47` | 中等（评估结论层面的最高结构性风险） |
| E2 | ESLint 无门禁价值：仅 `@eslint/js` recommended + `tseslint.configs.recommended`（非类型感知）+ `pluginVue flat/essential`；`no-explicit-any` 被显式关闭；`ignores` 缺 `dist-release/**`；`lint` 默认 `--fix` 静默改文件；无格式化规则、无 Prettier/husky/lint-staged/audit | `eslint.config.mjs:11,13-15,39`；`package.json:22` | 中等 |
| E3 | 核验可被绕过与手搓 YAML 解析：`release.js:89-93` 的 `--no-build` 与 `pack-single.js:92-95` 的 `--verify-only` 会直接核验既有产物；`release.js:65-76` 用正则手搓解析 latest.yml，缩进/引号/CRLF 变化即静默漏项 → 可能出现"对账通过但实际未构建"或"少校验一个文件"的假绿 | `release.js:65-76,89-93`、`pack-single.js:92-95` | 中等 |
| E4 | 构建链四处复制并已漂移：`package.json:13/14/15` 三次复制 `type-check && compile:main && vite build`，`scripts/pack-single.js:106-109` 第四次以 npm/npx 形式重写；`electron:pack`（`package.json:20`）裸跑 electron-builder、跳过类型检查与 Vite 构建且漏 `--publish=never`（会按 publish 配置尝试上传本地 http 源）；`release.js` 全文无 Node 版本与 `node_modules` 前置校验，而 `pack-single.js:98-103` 有 | 见证据行 | 中等 |
| E5 | Vite 未按桌面场景调优：无 `build.target`、无 `sourcemap`（生产无源映射难排障）、无 `manualChunks`，`external: []` 是空操作；`main.ts:3-5,22-24` Element Plus 全量引入 + 全部图标全局注册 | `vite.config.ts:10-16`、`src/view/src/main.ts` | 轻微 |
| E6 | 打包配置与项目形态冲突：`electron-builder.json:47-56` 保留 mac/linux 目标（Windows-only），`asar`/`compression`/`extraMetadata`/`buildVersion` 均依赖默认值 → 产物元数据不可复现 | `electron-builder.json` | 轻微 |
| E7 | tsconfig 分层有死配置：根 `tsconfig.json:7-10` 的 `paths` 无人继承（node/web 各自 `extends "@vue/tsconfig"`），且没有任何命令引用根配置；`tsconfig.node.json:18-20` 声明了 `@shared` 别名但 tsc 不改写运行时路径（该陷阱已在 AGENTS.md 记录，实际代码遵守了）；node 侧 `target/lib: ES2020` 落后于 Node 24 运行时 | `tsconfig.json`、`tsconfig.node.json:9-10,18-20` | 轻微 |
| E8 | 仓库卫生：无 CHANGELOG；`一键打包.bat` 非 ASCII 文件名（`git ls-files` 输出为八进制转义）+ `.zcode/` 12 份工具文档约 190KB 入库；无 `.nvmrc`/`.editorconfig`/`.npmrc`（engines 仅 `package.json:55`）；commit 中英混排、无 scope（19/22 带 Conventional 前缀，粒度与 openspec change 1:1，这部分是优点） | 目录与 git log 检查 | 轻微 |

### 5.6 可观测性（轻微）

`logToFile` 无日志级别（只有 `[ISO时间] 消息` 前缀）、非结构化、无轮转（R2），`catch` 内静默吞错（`index.ts:14-16`）；诊断信息无导出入口（工作目录可在 `workspace:get` 拿到，但日志文件需用户自行定位 `D:\MyWinApp\logs\app.log`）。出错时能定位到"哪一类操作失败"（多数 handler 返回 `error.message`），但无法定位上下文（无 traceId、无通道名、无参数摘要）。评估判断：对一个单人维护的桌面应用，当前可观测性属"勉强可用"，整改成本最低见效最大的一步是给日志加级别 + 在 IPC 包装器里统一记录通道名与错误。

### 5.7 文档一致性

抽查结论总体良好：`AGENTS.md` 关于 `update:check/install/get-status`、`update:status` 推送、`webUtils.getPathForFile`、工作目录与 SQLite 三级更新源的断言均与代码一致；`docs/project-structure.md:31` 的"Files/Settings 已注册路由，Home/About 保留"与 `router/index.ts` 一致（保留=未路由但仍 tracked，与 §5.4-D2 相符）。两处缺项需补：`AGENTS.md` 的架构段列举 IPC 处理器时**漏了 `updateHandlers.ts`**（实际 `ipc/index.ts:2-6` 注册 5 个模块）；`AGENTS.md:38` 称 `src/shared/constants/index.ts` 是"唯一版本"，措辞易误解为版本号唯一来源，实指"不要提交其编译产物"，而该文件的 `VERSION` 字段恰恰是漂移的（D4）。

## 6. 优点（如实记录）

1. IPC 契约三方逐通道一致（23/23），类型单一来源清晰，preload 用 `ElectronAPI` 约束实现。
2. 安全基线正确：`contextIsolation: true` + `nodeIntegration: false`，拖拽取路径用官方 `webUtils.getPathForFile` 而非已废弃的 `File.path`。
3. 零类型抑制：全仓无 `@ts-ignore`/`eslint-disable`/`TODO`/`FIXME`，`type-check` 是真实全量检查（vue-tsc + tsc 双跑）。
4. 依赖锁定健康：lockfileVersion 3 与 25 项依赖范围逐条一致，无漂移；无重复功能的库（未引入日期库/HTTP 库，上传用 curl 子进程）。
5. 发布对账链设计到位：版本三方一致 + latest.yml 逐文件 sha512/size 实算对账 + 上传后逐字节回读 + HEAD 尺寸核对（`release.js:95-128,196-219`），`--force` 显式覆盖远端同版本。
6. 工作目录设计有意图：写入探针确认目录"可写"而非仅"可建"（`workspace/index.ts:21-24`），env 覆盖 + userData 回落。
7. 仓库卫生：工作树干净，无编译产物/安装包/日志误提交；文档与代码同步维护；commit 粒度与 openspec change 1:1。
8. 路由 2/2 懒加载，渲染层无全局 store 依赖链。

## 7. 建议的下一步

优先级、批次划分、验收标准与回滚方式见 [优化方案](optimization-plan-2026-10.md)。摘要：B1 止血（异常兜底、zip-slip、DB 关闭、日志上限）→ B2 断链（路径守卫 + 更新源校验 + key 白名单 + 修 `clean`）→ B3 IPC 契约统一 → B4 工程化必修（ESLint 类型感知、构建链单一入口、发布脚本超时/顺序/凭据）→ B5 最小验证面（`node --test` 纯函数测试 + Windows-only CI）。

## 8. 已修正的取证错误（可信度声明）

本轮初稿由子代理生成，以下 5 条经源码复核后**修正**，特此记录以免结论被误当事实传播：

1. ~~"`app:getInfo` 把错误版本号喂给渲染层"~~ → 错。`appHandlers.ts:40` 用的是 `app.getVersion()`（读真实 package.json），版本正确；D4 漂移只影响 name/author 与标题。
2. ~~"缺 `setWindowOpenHandler` 导致窗口被导航劫持"~~ → 错。`index.ts:80` 已 `return { action: 'deny' }`；真实风险是 `openExternal` 的任意 http/https 放行，修法是 host 白名单而非补 deny（S4）。
3. ~~"渲染层监听器泄漏严重"~~ → 降级。`SettingsView.vue:113` 叠加的是同一闭包、单例 preload，泄漏有上界，属噪声级；必修的是 `preload.ts:37` 把 `removeAllListeners` 暴露给渲染层（R4）。
4. ~~"`@shared` 别名需三处同步且已同步"~~ → 更正为两处：`tsconfig.node.json` 与 `tsconfig.web.json` 各自 `extends @vue/tsconfig`，`src/view` 无独立 tsconfig；真正的问题是根 `tsconfig.json` 的 `paths` 无人继承（E7）。
5. ~~"`tsconfig.node.json` 缺 `@` 别名会导致解析不一致"~~ → 事实存在但不构成缺陷：主进程运行时代码本就禁止使用别名导入（AGENTS.md 已记），type-only 导入由 tsc 擦除，不产生运行时解析。

## 9. 本次评估未覆盖（需下一步补做）

- **未运行应用**：所有结论来自静态源码与配置；未验证 zip-slip 实际利用、未验证 `sandbox:false` 改动影响、未测大文件解压的内存峰值。
- **未联网核查 CVE**：未对 electron 44.5.1 / element-plus 2.14.7 / electron-updater 6.8.9 等版本做漏洞库比对（建议 `npm audit` 纳入 CI）。
- **未做性能与体积基线**：无包体积、启动耗时、渲染帧率的实测数据，故 E5（Element Plus 全量引入）的实际收益量级未知，不能作为改动依据。
- **未验证更新通道端到端**：需要一个真实/本地 https 更新源做 `release:collect` 与实际客户端升级演练。
- **openspec 归档与实现的一致性**：34 个 `openspec/` 文件未逐份核对是否仍与代码相符。
