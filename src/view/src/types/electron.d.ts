import type { FileOperationResult, DialogResult, AppInfo, SystemInfo, PerformanceInfo } from '@shared/types/electron'

export interface ElectronAPI {
  // 文件操作
  showOpenDialog: (options: any) => Promise<DialogResult>
  showSaveDialog: (options: any) => Promise<DialogResult>
  readFile: (path: string) => Promise<FileOperationResult>
  writeFile: (path: string, content: string) => Promise<FileOperationResult>

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }

  namespace NodeJS {
    interface ProcessVersions {
      electron: string
      chrome: string
      node: string
    }
  }
}