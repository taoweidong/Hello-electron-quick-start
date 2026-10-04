# 优化方案（2026-10）

配套文档：[代码质量评估报告](code-quality-assessment-2026-10.md)（发现编号 S/R/C/D/E 以该报告为准）
本方案范围依据用户选定边界：**安全加固 + 工程化必修**，且 **IPC 返回结构一次性统一为单一响应包装器**。
本轮（文档轮）**不修改任何源码**；下述批次为待批准的实施计划。

## 0. 目标与验收总则

目标是**断掉 §4 的 RCE 链**并**恢复最小验证面**，不是把 37 项发现逐条清零。因此每批的验收标准都写成"可判定的动作"，而不是"已修复 X"：

- 每批合入前必须依次通过：`npm run type-check` → `npx eslint .`（不带 `--fix`）→ `npm run build` → `npm run electron:test`。
- 每批一个 commit（B3 允许两个：主进程侧 + 渲染层侧），commit message 用 `fix(security):` / `fix(main):` / `chore(tooling):` 前缀并引用发现编号（如 `S1/S2`）。
- 行为变更类改动（更新源、上传顺序、IPC 返回形状）必须在 commit body 里写明"回滚方式"与"对既有产物/用户数据的影响"。
- 安全类改动必须附带**反向用例**：构造一个应该被拒绝的输入，确认它确实被拒。

## 1. 批次划分（顺序即依赖顺序）

### B1 止血 —— 零契约变更，可独立合入（✅ 已实施 2026-10-04）

对应发现：S1、S4、S5、R2、R3、R8、R9
规模：约 6 文件 / 120 行

| 改动 | 文件 | 要点 |
|---|---|---|
| 目录穿越防护 | 新增 `src/main/security/zipSlip.ts`；改 `src/main/ipc/fileHandlers.ts:48,111` | 纯函数 `safeJoin(root: string, entryName: string): string`，抛错即整包失败并返回 `{success:false,error}`；ZIP 与 RAR **共用同一函数**（RAR 的 `header.name` 用反斜杠，需先归一为 `/`） |
| 进程级异常兜底 | `src/main/index.ts` | `process.on('uncaughtException' \| 'unhandledRejection')` → 写 `app.log`（含 stack）**但不退出**，避免把偶发异常升级成崩溃；注册点必须在 `requestSingleInstanceLock` 之后、`whenReady()` 之前 |
| 导航与外链 | `src/main/index.ts:76-81` 附近 | 新增 `win.webContents.on('will-navigate', ...)`：仅允许 dev server origin（`VITE_DEV_SERVER_URL` 的 host）与 `file:`，其余 `preventDefault`；`setWindowOpenHandler` 保留现有 `deny`，把 `openExternal` 收紧为 `https:` + host 命中白名单（`github.com` 等应用内真实外链域名，集中成常量） |
| 加载失败可见 | `src/main/index.ts:63-67` | `catch` 内 `dialog.showErrorBox('启动失败', ...)` + `app.quit()`，不再显示空窗 |
| DB 关闭 | `src/main/db/index.ts` 加 `closeDb()`；`src/main/index.ts` 注册 `before-quit` | `db?.close(); db = null`；`before-quit` 只注册一次（放在 `whenReady` 外层，不放 `createWindow` 内，避免窗口重建时重复注册） |
| 日志上限与级别 | `src/main/index.ts:9-17` | 简单尺寸轮转：写入前 `statSync` 超 5MB 则 `rename` 为 `app.log.1`（保留 1 份历史）；`logToFile(level, msg)` 输出 `[时间] [LEVEL] msg`；写失败首次告警到 stderr，不静默 |
| 工作目录回落 | `src/main/workspace/index.ts:40-41` | 检查第二次 `trySetup` 返回值；两处都失败时 `dialog.showErrorBox` + `app.quit()`（当前忽略返回值会静默进入全功能失败状态） |

验收：① 构造含 `../evil.txt` 条目的 zip，拖入应用 → 必须返回解压失败且目标目录外无新文件；② `will-navigate` 用例：dev 下手动 `window.location.href='https://example.com'` → 被拦截且日志留痕；③ 人为在主进程抛一个异步异常 → 进程存活且 `app.log` 有 stack；④ 关闭应用后 `data/` 目录不应残留 `app.db-wal`/`-shm`。
回滚：单 commit revert，无数据格式变更，无用户可见行为退化（除 R8/回落失败新增错误弹窗）。

实施记录（2026-10-04）：四条验收均通过——手写 STORED zip（条目名保留字面 `../b1-evil.txt`）经 `zip:extract` 后解压目录外无新文件；导航/外链拒绝与解压拒绝都在 `app.log` 留 `[WARN]` 痕；优雅退出后 `data/` 只剩 `app.db`（`-wal`/`-shm` 被 checkpoint 删除）；`type-check` / `eslint .`（无 `--fix`）/ `build` / `electron:test` 全绿，并新增 `npm test`（8 条 zipSlip 用例）。三点实施期发现改变了原方案细节：

- **穿越面比预估窄**：jszip 在 `loadAsync` 阶段就把 `../x` 规范化成 `x`，ZIP 侧的 `../` 走不到拼接；真正传原始名的是 RAR 的 `header.name`（反斜杠、不做规范化）。`safeJoin` 仍然必要——它同时拦 `/abs`、`C:\`、UNC、`\\?\`、控制字符与 Windows 非法字符，这些 jszip 都不管。
- **严格拒绝会误伤合法归档**：Windows 自带 `tar.exe -a -cf x.zip .` 会产生名为 `/` 的根占位条目，一律抛错会让这类包整解压失败。故新增 `isRootPlaceholder()`：目录型占位条目跳过，文件型仍按异常拒绝。
- **测试链路**：根包 `type: commonjs` 下 Node 24 的原生 type stripping 不能跑 ESM 语法的 `.ts`，`npm run test` 先 `tsc -p tsconfig.test.json` 产出 `dist-test/` 再 `node --test`；`type-check` 追加同一配置的 `--noEmit` 检查，`dist-test/` 与 `eslint` 均已 ignore。

### B2 断链 —— 路径根 + 更新源校验（本轮 P0 收口）

对应发现：S2、S3、S8、R1（+ S4 的白名单集中化）
规模：约 8 文件 / 200 行

**2.1 `pathGuard` 实施层：IPC handler 外的一层包装器，不绑 workspace 根**

为什么不绑 `D:\MyWinApp`：合法业务必须读用户拖入的任意盘符文件、写 dialog 选定目录，绑工作目录根会直接废掉 FilesView 的全部功能；放渲染层可被绕过（渲染层已被假定不可信）；放在 `workspace/` 会把"数据目录"与"权限根"两个概念搅在一起。因此新增 `src/main/security/pathGuard.ts`，在 `fileHandlers.ts` 各 handler 入口调用。

允许集（会话级）：
- `userData/extracted`：**读 + 写**（`FilesView.vue:230-231` 现在就把解压目标放在这里，零 UX 变更）；
- `dialog:openFile` / `dialog:saveFile` 返回的所在目录：**读**（在 `appHandlers.ts:6,17` 的成功分支里登记）；
- 拖拽经 `getPathForFile` 得到的文件所在目录：**读**（`file:read`/`getInfo`/`readDir` 首次成功访问时登记父目录）。
登记结构：`Set<string>`（realpath 归一后的目录），带 LRU 上限（如 64）防止无界增长。

校验算法（**Windows 陷阱全覆盖**）：
1. 字符串层先拒：`\\?\`、`\\.\`、`/?/` 前缀式路径；UNC `\\server\share`；单个 `\` 或 `/` 开头的根相对路径；NTFS 备用数据流（basename 含 `:`，盘符前缀除外）。
2. 拒绝 entry 名/参数里的绝对路径与盘符（解压场景）。
3. **不要用 `resolved.startsWith(rootPrefix)` 判定包含关系**——Windows 文件系统大小写不敏感（`d:\mywinapp` vs `D:\MyWinApp`）、8.3 短名（`D:\MYWIN~1`）、junction/符号链接都能骗过字符串前缀比较。
4. 正确做法：对根与目标两端 `await fs.promises.realpath`（Windows 上即 `fsutil` 级真实长路径解析，会展开 junction）；写入场景目标不存在时，对**最近的已存在祖先**做 realpath，再把剩余段拼回去。两端 `toLowerCase()` 后用 `path.win32.relative(prefix, target)` 判定：`rel === '' || (!rel.startsWith('..') && !path.win32.isAbsolute(rel))`。
5. realpath 失败（EPERM/ENOENT 链）→ 拒绝，并记一条 `WARN`。
6. 解压条目名：反斜杠归一后逐段过滤 `.`/`..`/空段，并拒绝含 `:`,`?`,`*`,`<`,`>`,`"`,`|` 与控制字符的段；`zipSlip.safeJoin` 与 `pathGuard.assertReadable/assertWritable` 共用这套分段函数。

**2.2 更新源校验**

- 把 `resolveFeedUrl` 拆成纯函数 `pickFeedUrl(envUrl, settingUrl, builtinUrl): string`（便于单测），新增 `assertSafeFeedUrl(url): void`：`new URL()` 必须成功、`protocol === 'https:'`、`hostname` 命中白名单（env `MYWINAPP_UPDATE_HOSTS` 逗号分隔，或内置 `app-update.yml` 的 host）。校验失败 → **回落内置地址**并记 `ERROR`，绝不调用 `setFeedURL`。
- `settingsHandlers.ts:9` 加 key 白名单：`{ 'theme', 'update.url' }`，且 `update.url` 的值必须当场过 `assertSafeFeedUrl`（否则拒绝写入，返回错误）。**注意**：`update.url` 是否允许运行时改属产品决策，见 §4-2；若选"不允许"，则把它从白名单剔除、只保留 env 与内置源，改动更小。
- `electron-builder.json:11` 与 `release.config.json:3` 的 `http://localhost:58132/update/` 改为真实 https 源（本地联调另用 env 覆盖，不再污染打包内置值）。
- `updater/index.ts:60` 日志里的 feedUrl 去掉可能内嵌的 userinfo。
- 评估期内**不建议**顺手把 `autoDownload` 改成 false（会改变更新体验，属产品决策）；但 B2 完成后必须复核：静默安装的信任前提（https + host 白名单）已经成立。

**2.3 修 `npm run clean`**

`package.json:24` 改为 `node scripts/clean.js`，新增 `scripts/clean.js`（约 25 行：`rmSync(path,{recursive:true,force:true})` 逐个清 `dist`/`release`/`dist-release`/`*.tsbuildinfo`，打印每项结果）。**不新增 `rimraf` 依赖**——Node 24 内置能力已足够，加依赖只增加 `npm ci` 的离线失败面。

验收：① `npm run clean` 退出码 0 且三项目录确实消失；② `file:read` 一个允许集外的路径（如 `C:\Windows\win.ini`）必须返回权限错误；③ 构造 `update.url = http://attacker/` 经 IPC 写入 → 必须被拒且 `app.log` 留痕；④ 改内置源为 https 后 `npm run release:collect` 仍通过（它不上传，可安全跑）；⑤ 拖入含 `MYWIN~1` 或 junction 路径的用例做一轮人工验证（若本机有该条件）。
回滚：`pathGuard` 是新增文件 + handler 入口插桩，revert 即回到原行为；`electron-builder.json`/`release.config.json` 的 URL 变更需在 commit body 标注，回滚时同步。

### B3 IPC 契约统一（破坏性，一次性改完）

对应发现：R4、R5、C1、C2、C3
规模：约 12-15 文件（唯一无法切成小 commit 的批次，故排在行为变更之前、结构清理之后）

- 新增 `src/main/ipc/ipcSafe.ts`：`ipcSafe(channel, fn)` 统一注册，返回 `{ ok: true, data }` / `{ ok: false, error: { code, message } }`；内部 `try/catch` 包住 handler，并把 `error.message` 与通道名一并写日志（解决 §5.6 可观测性里"缺上下文"的问题）。23 个通道全部改走它，`appHandlers.ts` 里 dialog / window / systemInfo 这类原先裸值直通的 handler 一并收编。
- `settings:get` 从裸值改为 `{ok, data: string|null}`，`settings:set` 从 `{success}` 改为新形状（**这是渲染层所有调用点都要改的原因**）。
- `src/main/preload.ts`：`onFileOpened`/`onUpdateStatus` 返回退订函数（`() => ipcRenderer.removeListener(...)`）；**删除 `:37` 的 `removeAllListeners` 暴露**；`showOpenDialog/showSaveDialog` 的 `options: any` 换成 `OpenDialogOptions` 结构类型（从 `electron` 的 type 导入，主进程 type-only 合规）。
- `src/shared/types/electron.d.ts`：`ElectronAPI` 全部方法返回值改为 `IpcResult<T>`（新增该泛型），`extractZip/extractRar` 复用已有的 `ExtractResult`/`ExtractedFileInfo`（消 C1）；`UpdateState`/`WorkspaceInfo` 的**唯一定义放这里**，主进程侧改 `import type`（消 C3，注意主进程运行时代码不能用 `@shared` 别名做值导入）。
- `src/view/src/types/electron.d.ts:9-11`：删除幽灵 `File.path` 扩展（消 C2），只保留 `Window.electronAPI` 增强。
- 渲染层调用点：`views/FilesView.vue`、`views/SettingsView.vue`、`components/renderers/*.vue`、`services/{Zip,Rar}Extractor.ts` 统一按 `{ok,data,error}` 解构；`SettingsView.vue:113` 配 `onUnmounted` 退订。
- 顺带（低成本、同文件）：`FilesView.vue:290` 与扩展名解析的 Windows 分隔符 bug（R6）修在 `src/view/src/utils/path.ts`，供 `FilesView`/`FileRenderer.vue` 共用。

同步面清单（**改一处必改三处**，AGENTS.md 的硬约定）：`src/main/preload.ts` + `src/main/ipc/*.ts` + `src/shared/types/electron.d.ts`。
验收：① `type-check` 通过即证明所有调用点已随形状变更被迫改完（这是本项目唯一可靠的完整性证明，也是选择 `type-check` 而非运行时断言的原因）；② 手动跑一遍：拖 zip 解压、读文本/图片、保存文件、改主题、检查更新——五条主路径无 `undefined` 解构；③ `grep -rn "\.success" src/view` 结果为 0；④ `grep -rn "removeAllListeners" src` 只剩主进程内部；⑤ `electron:test` 通过。
回滚：整批 revert（无落盘数据格式变更，SQLite `settings` 表结构未动）。降级方案：若单次 diff 不可接受，可先加 `settings:get2` 并行一个版本再切——默认不采用，因为并行期会掩盖漏改的调用点。

### B4 工程化必修

对应发现：E2、E3、E4、E5（部分）、E6、E7（部分）、R7（非 Worker 部分）、S7/S8（低风险部分）
规模：约 7 文件 / 250 行

| 改动 | 文件 | 要点 |
|---|---|---|
| ESLint 升级为类型感知 | `eslint.config.mjs` | 换 `tseslint.configs.recommendedTypeChecked`（或 `strictTypeChecked` 若新增错误可接受）+ `languageOptions.parserOptions.projectService: true`；`no-explicit-any` 由 `off` 降为 `warn`（B3 之后可升 error）；`ignores` 补 `dist-release/**`、`.zcode/**`；`lint` 去掉 `--fix`，新增 `lint:fix` |
| 构建链单一入口 | `package.json:13-15`、`scripts/pack-single.js:106-109` | 抽 `"build:core": "npm run type-check && npm run compile:main && vite build"`，其余脚本引用它；`pack-single.js` 改为调 `npm run build:core` 而非自己 npx 重写；删除或修 `electron:pack`（若保留必须补 `--publish=never`） |
| 发布脚本韧性 | `scripts/release.js` | `collectFiles` 顺序改为 **exe → blockmap → latest.yml 最后**（`:135`，避免半途中断留下"yml 指向缺失 exe"的坏通道）；curl 统一注入 `--connect-timeout 10 --max-time 3600 --retry 3 --retry-delay 2`，上传用 `--fail-with-body`；远端预检加 semver **单调递增断言**（`--force` 保留绕过，`:171-176`）；上传前校验 `uploadUrl` 协议为 `https:`，否则拒绝发送凭据（S8）；上传失败时打印"已传到第 N 个文件、远端当前状态"的部分失败告警；`--no-build` 时输出显著 `WARN` 并在结尾结论里标注"未重新构建"（E3） |
| YAML 解析 | `scripts/release.js:65-76` | 手搓正则改为最小可用的**结构化解析**（`yaml` devDep 或按行状态机），至少做到：解析不出 `files` 数组即失败，而非静默返回空 |
| Vite 调优 | `vite.config.ts:10-16` | 加 `build.target`（Electron 44 = Chrome 13x，可 `'chrome126'`）、`sourcemap: 'hidden'`（产物不带 map 但可上传排障）、`manualChunks` 拆 element-plus；删空操作 `external: []`；补 `publicDir` 指向不存在的目录问题（R10：建 `src/view/public/favicon.ico` 或删掉 HTML 引用） |
| tsconfig 死配置 | `tsconfig.json` | 要么删（无命令引用），要么改成带 `references` 到 node/web 的聚合入口；node 侧 `target/lib` 由 ES2020 提到 ES2023（Node 24 运行时） |
| 打包配置对齐形态 | `electron-builder.json:47-56` | 删 mac/linux 目标（Windows-only）；显式声明 `asar: true`、`compression`、`extraMetadata.version`，让产物元数据可复现（E6）；appId/copyright 的真实值属 D4，放 P2-2 一起做（避免与版本号策略改动混批） |
| 解压过程可见性 | `src/view/src/views/FilesView.vue:235` 附近 | R7 的**非 Worker 部分**：`extracting` ref + `ElProgress`/禁用拖放区做 loading 态，失败与空结果分别提示；主进程 `fileHandlers.ts` 加体积阈值预检（如 >500MB 直接返回明确错误而不是 OOM 风险）。流式/Worker 化本身按 §3-3 延后 |

验收：① `npm run lint` 在新规则下退出码 0（若初期错误过多，用 `warn` 过渡并记录待办数量，不允许加 `eslint-disable`）；② 跑一次 `npm run release:collect`（不上传，安全）确认 latest.yml 解析与归集仍通过；③ 断网或指向不可达 host 跑 `npm run release -- --no-build --no-upload` 类只读路径，确认超时参数生效且不会永久挂起；④ `grep -c "type-check && npm run compile:main" package.json` 结果为 0（复制已消除）；⑤ `npm run build` 产物体积与改动前对比记录进 commit（防手工回归）；⑥ `npm run build:prod` 与 `npm run build:portable` 均成功，且 `release/` 下不再出现非 win 目标相关产物（builder 配置改动的回归证明）。
回滚：配置类改动逐条 revert 即可；`release.js` 的顺序/校验改动属发布链路，合入后**第一次真实上传前**须人工核对远端目录状态。

### B5 最小验证面（建议，超出你勾选范围 → 待批）

对应发现：E1

测试选型：**默认推荐 `node --test`**（Node 24 内置，零新依赖，符合"离线 `npm ci` 不应失败"约束）。待测纯函数只有 8 个，不值得为此引入 vitest。若你希望组件级测试与覆盖率，再单独批 `vitest` + `@vue/test-utils`。

优先测试对象（都是本轮整改新建/新近修改的纯函数，收益最高）：

1. `zipSlip.safeJoin` / `pathGuard` 的包含判定：`..`、绝对 entry、大小写差异、`\\?\` 前缀、8.3 短名、ADS 冒号、junction。
2. `pickFeedUrl` + `assertSafeFeedUrl`：http/https、host 白名单、非法 URL 回落。
3. `scripts/release.js` 的 `parseLatestYml`：CRLF、缺 `sha512`、多文件、无 `files` 段。
4. `release.js:53-58` 的 `artifactName`/`portableName` 模板推导（占位符缺失场景）。
5. `src/view/src/utils/path.ts`：无点号目录名、`.tar.gz`、`\` 与 `/` 混合。
6. `src/main/workspace/index.ts` 的 `trySetup` 回落判定（注入 fs，验证 `fallback:true` 与两处都失败的路径）。
7. `FileExtractorFactory.createExtractor('.EXE' / '' / '.zip' / '.exe')` 大小写与未知扩展。
8. `file:getInfo` 的 `name` 计算（`fileHandlers.ts:161` 的双分隔符 split）。

落点：`scripts/` 侧纯函数需先**导出**（把 `release.js` 的 `parseLatestYml` 等提成 `scripts/lib/release-utils.js`，`release.js` 与 `pack-single.js` 共用——顺带消 E4 的部分重复）；主进程侧纯函数放 `src/main/security/`、`src/main/workspace/`，测试文件与之同层（`*.test.ts` 需排除出 `tsconfig.node.json` 的 include 或用独立 tsconfig，避免进产物）。新增脚本：`"test": "node --test"`、`"test:watch"`。

CI：只跑 `windows-latest`（Windows-only 项目，跨 OS 矩阵对 NSIS/portable/`Get-Item VersionInfo`/路径语义只会产无意义红灯）。最小三步：`npm ci` → `npm run type-check` + `npx eslint .` → `npm test` → `npm run build:prod`。**Electron 冒烟不进 CI**（`electron:test` 需 electron 下载 + 桌面会话，每次 +3~5 min 且易受镜像限速影响），改为把脚本写成 `npm run build && npm run electron:test` 作为本地发布前门禁，避免现在这种"忘 build 就 exit 1"的误报。

验收：`npm test` 退出码 0 且上面 8 项各有至少一条反向用例；CI 首次绿。

## 2. P2/P3 待办（登记，本轮不实施）

| 项 | 内容 | 建议触发条件 |
|---|---|---|
| P2-1 | 死代码清理 D1/D2：删 `services/` 渲染器死岛 6 文件、`HomeView.vue`、`AboutView.vue`、`SidebarMenu.vue`、未用的 `store/index.ts`、`PLATFORMS`/`STORAGE_KEYS`、`meta.keepAlive` | 与"重构 FilesView"同批做（D5），删死岛与合并三处扩展名清单可共用一个 commit，回归面集中在 `FilesView.vue` |
| P2-2 | 常量与身份漂移 D4：`shared/constants` 的 APP_NAME/VERSION/AUTHOR 与 `electron-builder.json` 的 appId/copyright 对齐真实值；标题改由单一来源驱动 | 下次发版前（影响 `app:getInfo` 展示与安装器元数据） |
| P2-3 | 主题功能闭环 D3：把 `theme` 接到 Element Plus 的 `dark` class 与实际样式变量 | 用户可感知缺陷，建议优先于纯清理项 |
| P2-4 | `any` 收敛 C4（约 41 处）+ 开 `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` | B3/B4 合入且 `no-explicit-any` 已降 warn 之后单独一批，否则 diff 不可审 |
| P2-5 | `FilesView.vue` 448 行拆分（`useFileTree`/`useArchiveDrop` composable） | 与 P2-1 同批 |
| P3-1 | Element Plus 按需引入（`unplugin-vue-components` + `unplugin-auto-import`） | 有包体积/启动耗时基线数据后再决定（当前收益量级未知，见报告 §9） |
| P3-2 | 大文件流式/Worker 解压、渲染层进度与取消 | 有 >200MB 真实使用场景时；Worker 在 asar 内需同步调 `electron-builder.json` 的 `files` 白名单 |
| P3-3 | CHANGELOG + `sandbox: true` 评估 + `.nvmrc`/`.editorconfig` | 与下一次功能迭代同批 |
| P3-4 | UI 一致性 D6：`FilesView.vue:345-447` 的 14 处硬编码色值换 `--el-*`/`variables.scss` 变量；补 `aria-*` 与拖放区键盘替代入口 | 有 UI 改版时 |

## 3. 明确不做（及理由）

1. **实施 Windows 代码签名**：证书（EV/OV 或 Azure Trusted Signing）+ 硬件密钥/云 KMS 属采购决策；无证书时 electron-builder 只是跳过签名不会失败，但**预填** `certificateSubjectName` 会让构建直接报错。本轮只在 §4 给接入步骤。
2. **`sandbox: true`**：技术判断为低风险（`preload.ts` 只用 `contextBridge`/`ipcRenderer`/`webUtils`，均 sandbox 兼容；`jszip`/`node-unrar-js` 都在主进程，不进 preload），但改动必须重跑打包与拖拽取路径验证，与本轮"只出文档"冲突 → 列 P3-3。
3. **大文件解压 Worker 化**（P3-2）：见上。
4. **`exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`**：会与现有约 41 处 `any` 一起爆出大量错误，混进 B3/B4 会让 diff 不可审 → P2-4 独立批。
5. **IPC 通道全量改 kebab 命名（C5）**：当前三方名称完全一致是既成优点，改名纯风格、零收益且触发三处同步风险。不做。
6. **S7/S8 凭据的彻底修法**（curl `--netrc-file` / `--config` 临时文件 / PowerShell `-Credential`）：要改发布形态与运维流程；B4 只做"加超时重试 + 顺序 + 拒绝向 http 端点发凭据"这三件低风险项。
7. **Element Plus 按需引入**（P3-1）：新增两个 devDep + 全图标注册逐个改写，样式回退风险高于收益；B4 只做 `manualChunks`。
8. **重命名 `一键打包.bat`**：非 ASCII 文件名确实带来 `quotepath` 摩擦，但它是你现有的双击入口，改动属于用户习惯决策 → 只登记（E8）。

## 4. 需要你决策的外部项

1. **代码签名**：走 OV/EV 证书还是 Azure Trusted Signing？决定后 B4 追加签名核验步骤（`release.js` 校验 `Get-AuthenticodeSignature` 状态为 Valid 才允许上传）。
2. **更新源**：是否提供真实 https 域名（当前 `http://localhost:58132/update/` 同时出现在 `electron-builder.json` 与 `release.config.json`）？以及 `update.url` 是否允许在运行时由设置页修改——**建议不允许**（B2 白名单里剔除它，只留 env + 内置源，改动最小且断链彻底）。
3. **B5 是否本轮一起做**（`node --test` + Windows CI）：不含在你勾选的范围内，但它决定后续整改是否有回归保护。建议做，成本约半天。

## 5. 验证矩阵

| 批次 | 必跑命令 | 额外人工/反向用例 |
|---|---|---|
| B1 | `type-check` / `eslint .` / `build` / `electron:test` | 恶意 zip（含 `../`）；主进程异步异常；关应用后无 `-wal`/`-shm` 残留 |
| B2 | 同上 + `npm run clean` + `npm run release:collect` | 越界 `file:read`；`update.url=http://attacker/` 被拒；`win.ini` 不可读 |
| B3 | 同上 + `grep -rn "\.success" src/view` 应为空 | 五条主路径手动走一遍：解压/读文本/读图/保存/检查更新；进出设置页两次确认无重复推送 |
| B4 | 同上 + `npm run lint`（无 `--fix`）退出 0 | 不可达 host 下 `release` 应在超时内失败而非挂死；断言 latest.yml 最后上传 |
| B5 | `npm test` + CI 首绿 | 每个被测函数至少一条反向用例 |

## 6. 工作量与顺序小结

B1 ≈ 半天，B2 ≈ 1 天（pathGuard 是主要成本，含 Windows 边界用例自测），B3 ≈ 1 天（机械但面广），B4 ≈ 半天，B5 ≈ 半天。合计约 3 人日。

顺序不可调换的理由：B1 先做是因为它零契约变更、可独立合入，能最快降低暴露面；B2 依赖 B1 的 `safeJoin` 分段函数；B3 必须晚于 B1/B2（否则要在新旧两套返回形状上各写一次 handler）；B4 与 B3 可并行但会冲突在 `package.json`/`eslint` 上，故串行；B5 需要 B2/B3 产出的纯函数作为测试对象，因此最后。
