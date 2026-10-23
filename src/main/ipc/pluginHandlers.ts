import {
  installSamplePlugin,
  listPlugins,
  openPluginFolder,
  reloadPlugins,
  runPlugin,
  setPluginEnabled
} from '../plugins'
import { ipcSafe } from './ipcSafe'

// 插件通道：id/布尔值均按 unknown 接收，由 plugins 层统一归一化。
// runPlugin 可能持续到 timeoutMs（默认 15s），ipcSafe 会等待它完成并返回最终状态。

ipcSafe('plugin:list', () => listPlugins())

ipcSafe('plugin:run', (event, id: unknown) => runPlugin(id, 'manual'))

ipcSafe('plugin:setEnabled', (event, id: unknown, enabled: unknown) =>
  setPluginEnabled(id, enabled)
)

ipcSafe('plugin:reload', () => reloadPlugins())

ipcSafe('plugin:installSample', () => installSamplePlugin())

ipcSafe('plugin:openFolder', (event, id: unknown) => openPluginFolder(id))