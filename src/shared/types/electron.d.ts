// 主/渲染进程共享类型定义（单一事实来源）

/** 文件读/写操作结果 */
export interface FileOperationResult {
  success: boolean
  error?: string
  content?: string
}

/** 压缩包解压结果中的单个条目 */
export interface ExtractedFileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

/** 压缩包解压操作结果 */
export interface ExtractResult {
  success: boolean
  error?: string
  files?: ExtractedFileInfo[]
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

/** 对话框结果 */
export interface DialogResult {
  canceled: boolean
  filePaths: string[]
  filePath?: string
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

/** 应用工作目录信息 */
export interface WorkspaceInfo {
  path: string
  fallback: boolean
}

/** 配置写入结果 */
export interface SettingWriteResult {
  success: boolean
  error?: string
}

/**
 * preload 暴露给渲染进程的安全 API。
 * 必须与 src/main/preload.ts 中的 contextBridge 实现保持一致。
 */
export interface ElectronAPI {
  // 文件操作
  showOpenDialog: (options?: any) => Promise<DialogResult>
  showSaveDialog: (options?: any) => Promise<DialogResult>
  readFile: (path: string) => Promise<FileOperationResult>
  writeFile: (path: string, content: string) => Promise<FileOperationResult>
  extractZip: (zipPath: string, extractPath: string) => Promise<ExtractResult>
  extractRar: (rarPath: string, extractPath: string) => Promise<ExtractResult>
  getFileInfo: (path: string) => Promise<{ success: boolean; info?: FileInfo; error?: string }>
  readDir: (path: string) => Promise<{ success: boolean; files?: FileInfo[]; error?: string }>
  getAppPath: (name: string) => Promise<string>

  /** 获取拖拽 File 对象的真实磁盘路径（Electron 32+ 移除 File.path 后的官方替代） */
  getPathForFile: (file: File) => string

  // 应用操作
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  getAppInfo: () => Promise<AppInfo>
  getSystemInfo: () => Promise<SystemInfo>
  getPerformanceInfo: () => Promise<PerformanceInfo>

  // 窗口操作
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>

  // 事件监听
  onFileOpened: (callback: (filePath: string) => void) => void
  removeAllListeners: (channel: string) => void

  // 工作目录与配置（SQLite 实例）
  getWorkspace: () => Promise<WorkspaceInfo>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<SettingWriteResult>
}
