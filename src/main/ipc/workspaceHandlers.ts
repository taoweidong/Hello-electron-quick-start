import { resolveWorkspace } from '../workspace'
import { ipcSafe } from './ipcSafe'

// 工作目录信息（设置页展示与诊断用）
ipcSafe('workspace:get', () => {
  return resolveWorkspace()
})
