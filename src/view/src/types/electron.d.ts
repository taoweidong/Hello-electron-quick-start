import type { ElectronAPI } from '@shared/types/electron'

// Window 增强以共享类型为唯一来源；Electron 32+ 已移除 DOM File.path，
// 拖拽取路径一律走 electronAPI.getPathForFile（评审 C2：删除幽灵声明）
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
