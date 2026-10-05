# 项目结构说明

## 目录结构

```
.
├── build/
│   └── icons/              # 应用图标（icon.ico / icon.icns / icon.png）
├── dist/                   # 构建输出（gitignore）
│   ├── main/               # 主进程 tsc 编译输出
│   │   ├── main/           #   ← src/main 的产物（package.json main 指向 main/index.js）
│   │   └── shared/         #   ← src/shared 的产物（供主进程运行时引用）
│   └── view/               # Vite 构建输出（Vite root 为 src/view）
├── dist-test/              # tests 的 tsc 预编译输出（gitignore，npm run test 生成）
├── docs/                   # 项目文档
├── openspec/               # OpenSpec 规划与规格（specs/ 主规格库 + changes/ 与 archive/）
├── release/                # electron-builder 打包输出（gitignore）
├── src/
│   ├── main/               # Electron 主进程（TypeScript）
│   │   ├── index.ts        #   入口：窗口、菜单、SQLite 初始化、外链/导航白名单、进程级异常兜底
│   │   ├── logger.ts       #   工作目录 logs/app.log 写入（超 5MB 轮转 app.log.1）
│   │   ├── security/       #   zipSlip.ts（条目名 safeJoin）+ pathGuard.ts（读写根授权）+ archiveLimit.ts（归档 500MB 上限，零 electron）
│   │   ├── preload.ts      #   contextBridge 暴露 window.electronAPI
│   │   ├── utils/          #   path.ts（主进程 baseName 双分隔符解析，零 electron）
│   │   ├── workspace/      #   工作目录解析（默认 D:\MyWinApp，env 覆盖，回落 userData，不可写则抛错）
│   │   │                   #   trySetup.ts（目录建立 + 写探测，fs 经 SetupFs 接口注入，零 electron）
│   │   ├── db/             #   node:sqlite 数据库单例与 settings 键值表（data/app.db，WAL）
│   │   ├── updater/        #   electron-updater 自动更新（两级更新源 + 源校验、状态机、事件推送）
│   │   └── ipc/            #   ipcSafe.ts（统一注册 + IpcResult 包装）与处理器
│   │                       #   （appHandlers / fileHandlers / workspaceHandlers /
│   │                       #   settingsHandlers / updateHandlers）
│   ├── view/               # Vue 3 渲染进程（Vite root）
│   │   ├── index.html
│   │   └── src/
│   │       ├── components/ #   公共组件与文件渲染器（renderers/）
│   │       ├── services/   #   文件渲染/解压服务（Zip / Rar / Text / Image）
│   │       ├── styles/     #   index.scss（滚动条/动画/工具类；颜色一律 --el-*，无自定义变量块）
│   │       ├── utils/      #   index.ts（格式化）+ path.ts（双分隔符路径/扩展名解析）
│   │       │               #   + theme.ts（resolveTheme 纯函数 + applyTheme 切 html.dark，方案 P2-3）
│   │       ├── views/      #   页面（Files / Settings / About 已注册路由；Home 文件保留）
│   │       ├── store/      #   Pinia
│   │       ├── router/     #   Vue Router
│   │       ├── types/      #   渲染进程类型声明（含 Window.electronAPI 全局增强）
│   │       └── main.ts
│   └── shared/             # 主/渲染进程共享代码（别名 @shared）
│       ├── constants/      #   常量（仅 index.ts，单一来源）
│       └── types/          #   共享类型（electron.d.ts：ElectronAPI + IpcResult<T> 单一来源）
├── .github/workflows/ci.yml # CI（windows-latest：npm ci → type-check + eslint → npm test → build:prod；electron:test 不进 CI）
├── test-main.js            # 冒烟测试（npm run electron:test，自动退出）
├── tests/                  # node --test 单元测试（npm run test，纯函数用例：zipSlip / pathGuard / feedUrl /
│                           #   releaseUtils / viewPath / archiveLimit / workspaceTrySetup / extractorFactory /
│                           #   theme 九文件）
├── scripts/
│   ├── clean.js            # 清理产物（npm run clean，Node 内置 rmSync，不引 rimraf）
│   ├── pack-single.js      # 一键打包脚本（npm run build:single，含产物核验与回显）
│   ├── release.js          # 发布流水线（npm run release：对账核验 + 归集 + PUT 上传 + 校验）
│   └── lib/
│       └── release-utils.js # 发布/打包共用纯函数（parseLatestYml/sha512/PE 版本/版本比较，node --test 可直测）
├── release.config.json     # 发布配置（upload.url；凭据经 RELEASE_UPLOAD_AUTH 环境变量）
├── 一键打包.bat             # Windows 双击入口（调用 build:single，UTF-8 + CRLF）
├── eslint.config.mjs       # ESLint 10 flat config（类型感知：按目录映射 node/web/test tsconfig）
├── electron-builder.json   # 打包配置（根目录，生效配置）
├── vite.config.ts          # Vite 配置（根目录，生效配置）
├── tsconfig.json           # TS 聚合入口（files:[] + references 到下面三个，仅导航/工具用）
├── tsconfig.node.json      # 主进程 TS 配置（rootDir=src，输出 dist/main）
├── tsconfig.test.json      # 测试 TS 配置（tests → dist-test，供 node --test 运行）
└── tsconfig.web.json       # 渲染进程 TS 配置
```

## 关键约定

1. **主进程构建**：`tsconfig.node.json` 的 `rootDir` 为 `./src`，因此 `src/main` 产物落在
   `dist/main/main/`、`src/shared` 产物落在 `dist/main/shared/`，源码中的相对导入
   （如 ipc 里的 `../../shared/constants`）在产物中原样成立，无需任何后处理脚本。
2. **类型单一来源**：`window.electronAPI` 的类型唯一声明在 `src/shared/types/electron.d.ts`
   的 `ElectronAPI` 接口；所有 invoke 通道返回 `IpcResult<T>`（`{ok,data}` | `{ok:false,error}`），
   由主进程 `ipcSafe()` 注册产出，handler 只 return/throw。preload 实现该接口，渲染进程通过
   `src/view/src/types/electron.d.ts` 做全局 Window 增强。新增 IPC 通道时三处同步修改。
   事件订阅（onFileOpened/onUpdateStatus）返回退订函数，渲染层 onUnmounted 调用。
3. **常量单一来源**：`src/shared/constants/index.ts` 是唯一版本，禁止再放置编译产物。
4. **dev 热更新**：`npm run electron:dev` 通过 cross-env 注入
   `VITE_DEV_SERVER_URL=http://localhost:5180`，Electron 加载 Vite 开发服务器。
5. **打包**：`electron-builder.json` 的 `files` 不再显式包含 `node_modules`，
   electron-builder 自动附带生产依赖，安装包体积显著减小。
6. **可单测纯函数约定**：`node --test` 无法加载 import 了 `electron` 的模块，故需要直测的纯函数
   独立成零 electron 接缝模块（`workspace/trySetup.ts`、`security/archiveLimit.ts`、
   `main/utils/path.ts`、`scripts/lib/release-utils.js`），fs 类副作用经接口注入；测试文件一律放
   `tests/`（经 tsconfig.test 编译到 `dist-test/`），不与源文件同层，避免进 `dist/` 产物。
   `baseName` 在主进程与渲染层是双实现，改语义两边同步，用 `tests/` 用例锁行为。
7. **主题闭环**：渲染层颜色一律使用 Element Plus 的 `--el-*` 变量，禁止硬编码色值；深/浅色由
   `html.dark` class 翻转（`utils/theme.ts` 的 `applyTheme` 负责切换，`main.ts` 挂载前应用存储的
   `theme` 值，SettingsView 保存即时生效）。不要恢复 vite `additionalData` 注入 SCSS 全局片段
   （会把样式块复制进每个编译单元）。

## 常用命令

- 开发：`npm run electron:dev`（先编译主进程，再并行启动 Vite 与 Electron）
- 类型检查：`npm run type-check`（vue-tsc 检查渲染进程，tsc 检查主进程与测试，真实生效）
- 单元测试：`npm run test`（tsc 预编译 `tests/` 到 `dist-test/` 后 `node --test`）
- 冒烟测试：`npm run build && npm run electron:test`
- 打包目录版：`npm run build`；NSIS 安装包：`npm run build:prod`；便携版：`npm run build:portable`
- 清理：`npm run clean`
