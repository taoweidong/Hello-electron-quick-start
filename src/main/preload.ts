import type { ElectronAPI } from '@shared/types/electron'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

// 暴露安全的 API 给渲染进程（类型以 @shared/types/electron 的 ElectronAPI 为准）
const api: ElectronAPI = {
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

  // 拖拽文件取真实路径（Electron 32+ 移除了 DOM File.path，官方替代为 webUtils）
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

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
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // 工作目录
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),

  // 配置读写（SQLite 实例）
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value)
}

contextBridge.exposeInMainWorld('electronAPI', api)
