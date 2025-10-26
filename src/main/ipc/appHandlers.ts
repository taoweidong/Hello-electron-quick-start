import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { cpus } from 'node:os'
import { APP_CONSTANTS } from '../../shared/constants'

// 对话框处理
ipcMain.handle('dialog:openFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePaths: [] }
  
  const result = await dialog.showOpenDialog(win, {
    ...options,
    properties: ['openFile', ...(options.properties || [])]
  })
  return result
})

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePath: '' }
  
  const result = await dialog.showSaveDialog(win, options)
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