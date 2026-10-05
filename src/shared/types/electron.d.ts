// 主/渲染进程共享类型定义（单一事实来源）
// IPC 契约：所有 invoke 通道统一返回 IpcResult<T>（方案 B3/R4）——
// 成功 { ok: true, data }，失败 { ok: false, error: { code, message } }，
// 由主进程 ipcSafe 包装器唯一产出，渲染层不再有 {success}/{info}/裸值 三套形状。

/** IPC 统一失败负载 */
export interface IpcError {
  /** 机器可读码：Error.name 或 Node errno（如 'PathDeniedError' / 'ENOENT'） */
  code: string
  /** 人可读信息，可直接展示 */
  message: string
}

/** IPC 统一返回包装器 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

/** 对话框文件过滤器 */
export interface DialogFilter {
  name: string
  extensions: string[]
}

/** openFile 对话框选项（electron OpenDialogOptions 的结构化子集，避免渲染层依赖 electron 类型） */
export interface OpenDialogOptions {
  title?: string
  message?: string
  buttonLabel?: string
  defaultPath?: string
  filters?: DialogFilter[]
  properties?: Array<
    | 'openFile'
    | 'openDirectory'
    | 'multiSelections'
    | 'showHiddenFiles'
    | 'createDirectory'
    | 'promptToCreate'
    | 'noResolveAliases'
    | 'treatPackageAsDirectory'
    | 'dontAddToRecent'
  >
}

/** saveFile 对话框选项 */
export interface SaveDialogOptions {
  title?: string
  message?: string
  buttonLabel?: string
  defaultPath?: string
  filters?: DialogFilter[]
}

/** 对话框结果（open 填 filePaths，save 填 filePath） */
export interface DialogResult {
  canceled: boolean
  filePaths: string[]
  filePath?: string
}

/** 压缩包解压结果中的单个条目（解压清单不含时间戳） */
export interface ExtractedFileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

/** 文件元信息 */
export interface FileInfo {
  name?: string
  path: string
  size: number
  isDirectory: boolean
  created: Date
  modified: Date
}

/** 系统信息 */
export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

/** 应用信息 */
export interface AppInfo {
  version: string
  name: string
  author: string
}

/** 性能信息 */
export interface PerformanceInfo {
  usedMemory: number
  totalMemory: number
  cpuCores: number
}

/** 应用工作目录信息（唯一定义在此，主进程 workspace 模块 import type 复用，方案 B3/C3） */
export interface WorkspaceInfo {
  path: string
  fallback: boolean
}

/** 自动更新状态（唯一定义在此，主进程 updater 模块 import type 复用，方案 B3/C3） */
export interface UpdateStatusInfo {
  type: 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error'
  info?: string
  percent?: number
  error?: string
  version: string
  feedUrl: string
}

/** 事件订阅的退订函数（方案 B3/R5：渲染层 onUnmounted 时调用，替代 removeAllListeners 核弹） */
export type Unsubscribe = () => void

/**
 * preload 暴露给渲染进程的安全 API。
 * 必须与 src/main/preload.ts 中的 contextBridge 实现保持一致。
 */
export interface ElectronAPI {
  // 文件操作
  showOpenDialog: (options?: OpenDialogOptions) => Promise<IpcResult<DialogResult>>
  showSaveDialog: (options?: SaveDialogOptions) => Promise<IpcResult<DialogResult>>
  readFile: (path: string) => Promise<IpcResult<string>>
  writeFile: (path: string, content: string) => Promise<IpcResult<void>>
  extractZip: (zipPath: string, extractPath: string) => Promise<IpcResult<ExtractedFileInfo[]>>
  extractRar: (rarPath: string, extractPath: string) => Promise<IpcResult<ExtractedFileInfo[]>>
  getFileInfo: (path: string) => Promise<IpcResult<FileInfo>>
  readDir: (path: string) => Promise<IpcResult<FileInfo[]>>
  getAppPath: (name: string) => Promise<IpcResult<string>>

  /** 获取拖拽 File 对象的真实磁盘路径（Electron 32+ 移除 File.path 后的官方替代；本地同步调用，非 IPC） */
  getPathForFile: (file: File) => string

  // 应用操作
  getAppVersion: () => Promise<IpcResult<string>>
  getPlatform: () => Promise<IpcResult<string>>
  getAppInfo: () => Promise<IpcResult<AppInfo>>
  getSystemInfo: () => Promise<IpcResult<SystemInfo>>
  getPerformanceInfo: () => Promise<IpcResult<PerformanceInfo>>

  // 窗口操作
  minimizeWindow: () => Promise<IpcResult<void>>
  maximizeWindow: () => Promise<IpcResult<void>>
  closeWindow: () => Promise<IpcResult<void>>

  // 事件监听：返回退订函数
  onFileOpened: (callback: (filePath: string) => void) => Unsubscribe

  // 工作目录与配置（SQLite 实例）
  getWorkspace: () => Promise<IpcResult<WorkspaceInfo>>
  getSetting: (key: string) => Promise<IpcResult<string | null>>
  setSetting: (key: string, value: string) => Promise<IpcResult<void>>

  // 自动更新
  checkForUpdates: () => Promise<IpcResult<UpdateStatusInfo>>
  installUpdate: () => Promise<IpcResult<void>>
  getUpdateStatus: () => Promise<IpcResult<UpdateStatusInfo>>
  onUpdateStatus: (callback: (status: UpdateStatusInfo) => void) => Unsubscribe
}
