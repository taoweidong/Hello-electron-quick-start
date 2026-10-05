import type { ElectronAPI, UpdateStatusInfo } from '@shared/types/electron'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

// 暴露安全的 API 给渲染进程（类型以 @shared/types/electron 的 ElectronAPI 为准）

// 事件订阅 → 返回退订函数（方案 B3/R5）：渲染层 onUnmounted 里精确移除自己的监听器，
// 不再暴露 removeAllListeners 这种会影响同通道其他订阅者的核弹
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_: unknown, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ElectronAPI = {
  // 文件操作
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  extractZip: (zipPath: string, extractPath: string) => ipcRenderer.invoke('zip:extract', zipPath, extractPath),
  extractRar: (rarPath: string, extractPath: string) => ipcRenderer.invoke('rar:extract', rarPath, extractPath),
  getFileInfo: (path: string) => ipcRenderer.invoke('file:getInfo', path),
  readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),
  getAppPath: (name: string) => ipcRenderer.invoke('app:getPath', name),

  // 拖拽文件取真实路径（Electron 32+ 移除了 DOM File.path，官方替代为 webUtils；本地同步调用，非 IPC）
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

  // 事件监听（返回退订函数）
  onFileOpened: (callback) => subscribe<string>('file-opened', callback),

  // 工作目录
  getWorkspace: () => ipcRenderer.invoke('workspace:get'),

  // 配置读写（SQLite 实例）
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // 自动更新
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  onUpdateStatus: (callback) => subscribe<UpdateStatusInfo>('update:status', callback)
}

contextBridge.exposeInMainWorld('electronAPI', api)
