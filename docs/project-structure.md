# 项目结构说明

## 目录结构

```
.
├── build/                  # 构建相关配置和资源
│   ├── config/             # 构建配置文件
│   │   ├── electron-builder.json  # Electron 打包配置
│   │   ├── tsconfig.json          # TypeScript 主配置
│   │   ├── tsconfig.node.json     # Node.js 相关 TypeScript 配置
│   │   ├── tsconfig.web.json      # Web 相关 TypeScript 配置
│   │   └── vite.config.ts         # Vite 构建配置
│   └── icons/              # 应用图标
│       ├── icon.icns       # macOS 图标
│       ├── icon.ico        # Windows 图标
│       └── icon.png        # 通用图标
├── dist/                   # 构建输出目录
│   └── view/               # Vue 渲染进程构建输出 (原 renderer 目录)
├── docs/                   # 项目文档
├── release/                # Electron 打包输出
├── src/                    # 源代码
│   ├── main/               # Electron 主进程
│   ├── view/               # Vue 渲染进程 (原 renderer 目录)
│   └── shared/             # 主进程与渲染进程共享代码
└── package.json            # 项目配置
```

## 变更说明

为了保持项目结构的整洁，所有与构建相关的配置文件和静态资源已归档到 `build` 目录下：

1. **配置文件迁移**：
   - `electron-builder.json` → `build/config/electron-builder.json`
   - `vite.config.ts` → `build/config/vite.config.ts`
   - `tsconfig.json` → `build/config/tsconfig.json`
   - `tsconfig.node.json` → `build/config/tsconfig.node.json`
   - `tsconfig.web.json` → `build/config/tsconfig.web.json`

2. **静态资源迁移**：
   - 项目图标已统一放置在 `build/icons/` 目录下

3. **目录重命名**：
   - `renderer` 目录已重命名为 `view`，以更好地反映其作为视图层的用途

4. **脚本更新**：
   - 所有 npm 脚本已更新，使用 `--config` 参数指向新的配置文件位置
   - 使用 `tsc` 替代 `vue-tsc` 进行类型检查，避免在 Windows 上的兼容性问题

## 使用说明

- 开发：`npm run dev`
- 构建：`npm run build`
- 打包：`npm run electron:pack`
- 清理：`npm run clean` （清理构建产物，包括 dist/ 和 release/ 目录）

所有构建和打包操作都会自动使用 `build/config/` 目录下的配置文件。