import { ipcMain } from 'electron'
import { checkForUpdates, getStatus, installNow } from '../updater'

// 自动更新通道（见 openspec specs/auto-update）
ipcMain.handle('update:check', () => {
  return checkForUpdates()
})

ipcMain.handle('update:install', () => {
  installNow()
})

ipcMain.handle('update:get-status', () => {
  return getStatus()
})
