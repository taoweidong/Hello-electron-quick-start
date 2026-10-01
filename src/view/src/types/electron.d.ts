import type { ElectronAPI } from '@shared/types/electron'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }

  // Electron 在 DOM File 上注入了非标准的 path 属性（拖拽文件场景，Electron 28）
  interface File {
    path: string
  }
}
