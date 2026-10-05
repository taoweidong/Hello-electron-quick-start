import { checkForUpdates, getStatus, installNow } from '../updater'
import { ipcSafe } from './ipcSafe'

// 自动更新通道（见 openspec specs/auto-update）
ipcSafe('update:check', async () => {
  return checkForUpdates()
})

ipcSafe('update:install', () => {
  installNow()
})

ipcSafe('update:get-status', () => {
  return getStatus()
})
