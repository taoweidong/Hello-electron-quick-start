// Window 接口扩展
import type { ElectronAPI } from './electron'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}