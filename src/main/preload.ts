const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  extractZip: (zipPath: string, extractPath: string) => ipcRenderer.invoke('zip:extract', zipPath, extractPath),
  extractRar: (rarPath: string, extractPath: string) => ipcRenderer.invoke('rar:extract', rarPath, extractPath),
  getFileInfo: (path: string) => ipcRenderer.invoke('file:getInfo', path),
  readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),
  getAppPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // 应用操作
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
  getPerformanceInfo: () => ipcRenderer.invoke('app:getPerformanceInfo'),
  
  // 窗口操作
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // 事件监听
  onFileOpened: (callback: (filePath: string) => void) => 
    ipcRenderer.on('file-opened', (_: any, filePath: string) => callback(filePath)),
  
  // 移除监听器
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
})

// 类型安全声明
export interface ElectronAPI {
  showOpenDialog: (options: any) => Promise<any>
  showSaveDialog: (options: any) => Promise<any>
  readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
  extractZip: (zipPath: string, extractPath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
  extractRar: (rarPath: string, extractPath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
  getFileInfo: (path: string) => Promise<{ success: boolean; info?: any; error?: string }>
  readDir: (path: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
  getAppPath: (name: string) => Promise<string>
  getAppVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  onFileOpened: (callback: (filePath: string) => void) => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}