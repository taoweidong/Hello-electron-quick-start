import { ipcMain } from 'electron'
import { resolveWorkspace } from '../workspace'

// 工作目录信息（设置页展示与诊断用）
ipcMain.handle('workspace:get', () => {
  return resolveWorkspace()
})
