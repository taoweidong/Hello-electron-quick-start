import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { cpus } from 'node:os'
import { dirname } from 'node:path'
import { APP_CONSTANTS } from '../../shared/constants'
import { grantReadDir, grantWriteDir } from '../security/pathGuard'

// 对话框处理：用户亲自选定的路径是合法授权来源，成功分支里登记进 pathGuard（方案 B2/S2）
ipcMain.handle('dialog:openFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePaths: [] }

  const properties = options?.properties || []
  const result = await dialog.showOpenDialog(win, {
    ...options,
    properties: ['openFile', ...properties]
  })
  if (!result.canceled) {
    const openDirectory = properties.includes('openDirectory')
    for (const selected of result.filePaths) {
      // 选中目录时只授权该目录本身；选中文件时连同所在目录（便于后续读同级文件）
      grantReadDir(selected)
      if (!openDirectory) grantReadDir(dirname(selected))
    }
  }
  return result
})

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePath: '' }

  const result = await dialog.showSaveDialog(win, options)
  if (!result.canceled && result.filePath) {
    grantWriteDir(dirname(result.filePath))
  }
  return result
})

// 应用信息
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:getPath', (event, name: Parameters<typeof app.getPath>[0]) => {
  return app.getPath(name)
})

ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

ipcMain.handle('app:getInfo', () => {
  return {
    version: app.getVersion(),
    name: APP_CONSTANTS.APP_NAME,
    author: APP_CONSTANTS.AUTHOR
  }
})

ipcMain.handle('app:getSystemInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  }
})

ipcMain.handle('app:getPerformanceInfo', () => {
  const memory = process.memoryUsage()
  return {
    usedMemory: memory.heapUsed,
    totalMemory: memory.heapTotal,
    cpuCores: cpus().length
  }
})

// 窗口操作
ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})
