export interface FileOperationResult {
  success: boolean
  error?: string
  content?: string
}

export interface DialogResult {
  canceled: boolean
  filePaths: string[]
  filePath?: string
}

export interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

export interface AppInfo {
  version: string
  name: string
  author: string
}

export interface PerformanceInfo {
  usedMemory: number
  totalMemory: number
  cpuCores: number
}