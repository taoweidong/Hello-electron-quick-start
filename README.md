# Electron + Vue 3 + TypeScript + Vite + Element Plus 现代化桌面应用开发方案

## 技术栈版本信息

| 技术 | 版本 | 说明 |
|------|------|------|
| **Electron** | ^28.1.0 | 当前最新稳定版 |
| **Vue** | ^3.4.15 | Vue 3 最新稳定版 |
| **TypeScript** | ^5.4.5 | TypeScript 最新稳定版 |
| **Vite** | ^5.2.0 | Vite 最新稳定版 |
| **Element Plus** | ^2.4.4 | Element Plus 最新稳定版 |
| **Node.js** | >=18.0.0 | 运行时要求 |

## 项目目录结构

```
my-electron-app/
├── build/                          # 构建相关配置
│   └── icons/                      # 应用图标资源
├── dist/                           # Vite 构建输出
├── node_modules/
├── release/                        # Electron 打包输出
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 主进程入口
│   │   ├── preload.ts              # 预加载脚本
│   │   └── ipc/                    # IPC 通信处理
│   │       ├── index.ts
│   │       ├── fileHandlers.ts
│   │       └── appHandlers.ts
│   ├── view/                       # Vue 渲染进程 (原 renderer 目录)
│   │   ├── src/
│   │   │   ├── assets/             # 静态资源
│   │   │   ├── components/         # 公共组件
│   │   │   ├── views/              # 页面组件
│   │   │   ├── store/              # Pinia 状态管理
│   │   │   ├── router/             # Vue Router
│   │   │   ├── utils/              # 工具函数
│   │   │   ├── types/              # TypeScript 类型定义
│   │   │   ├── styles/             # 全局样式
│   │   │   ├── App.vue             # 根组件
│   │   │   └── main.ts             # 渲染进程入口
│   │   └── index.html              # HTML 模板
│   └── shared/                     # 共享代码
│       ├── types/                  # 共享类型定义
│       └── constants/              # 共享常量
├── package.json
├── tsconfig.json                   # TypeScript 根配置
├── tsconfig.node.json              # Node 环境配置
├── tsconfig.web.json               # Web 环境配置
├── vite.config.ts                  # Vite 配置
├── electron-builder.json           # Electron Builder 配置
└── README.md
```

## 核心功能

### 1. 应用窗口管理
- 窗口最小化、最大化/还原、关闭
- 自定义标题栏，支持拖拽
- 窗口控制按钮（最小化、最大化、关闭）

### 2. 文件操作
- 打开文件对话框
- 保存文件对话框
- 文件读取和写入

### 3. 系统信息获取
- 应用版本信息
- 操作系统平台信息
- 系统架构信息
- Node.js、Electron、Chrome 版本信息
- 内存使用情况
- CPU 核心数

### 4. 菜单系统
- 标准应用菜单（文件、编辑、视图、帮助）
- 快捷键支持

### 5. 路由管理
- 基于 Vue Router 的单页面应用
- 侧边栏导航菜单
- 页面路由切换

### 6. 状态管理
- 基于 Pinia 的状态管理
- 持久化存储支持

## IPC 通信机制

### 主进程暴露的 API
- `showOpenDialog`: 显示打开文件对话框
- `showSaveDialog`: 显示保存文件对话框
- `readFile`: 读取文件内容
- `writeFile`: 写入文件内容
- `getAppVersion`: 获取应用版本
- `getPlatform`: 获取操作系统平台
- `getAppInfo`: 获取应用信息
- `getSystemInfo`: 获取系统信息
- `getPerformanceInfo`: 获取性能信息
- `minimizeWindow`: 最小化窗口
- `maximizeWindow`: 最大化/还原窗口
- `closeWindow`: 关闭窗口

### 渲染进程调用方式
```typescript
// 打开文件对话框
const result = await window.electronAPI.showOpenDialog(options)

// 读取文件
const fileContent = await window.electronAPI.readFile(filePath)

// 获取应用版本
const version = await window.electronAPI.getAppVersion()

// 窗口控制
await window.electronAPI.minimizeWindow()
```

## 构建和部署

### 开发模式运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run electron:dev
```

### 构建命令

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 构建应用
npm run build

# 构建生产版本
npm run build:prod

# 构建便携版 (双击运行的exe)
npm run build:portable
```

### 便携版特性

- **独立运行**: 无需安装，双击即可运行
- **绿色环保**: 不向系统写入注册表信息
- **易于分发**: 单个exe文件，方便分享和部署
- **数据隔离**: 应用数据存储在应用同级目录

## 项目特点

### 技术优势

1. **现代化技术栈**: 使用最新的稳定版本技术栈
2. **类型安全**: 完整的 TypeScript 支持
3. **开发体验**: 热重载、类型检查、代码提示
4. **构建优化**: Vite 快速构建，Electron Builder 专业打包
5. **安全可靠**: 上下文隔离、安全的 IPC 通信

### 架构优势

1. **模块化设计**: 清晰的目录结构，便于维护
2. **组件化开发**: Vue 3 + Element Plus 组件库
3. **状态管理**: Pinia 状态管理方案
4. **路由管理**: Vue Router 单页面导航
5. **类型共享**: 主进程和渲染进程类型安全

### 产品化特性

1. **专业界面**: Element Plus 现代化 UI
2. **原生体验**: 完整的菜单系统和窗口控制
3. **文件操作**: 完整的文件读写能力
4. **多平台支持**: Windows、macOS、Linux
5. **便携版本**: 绿色版应用支持