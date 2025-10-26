const electronMain = require('electron')
const { cpus } = require('node:os')
const { APP_CONSTANTS } = require('../../shared/constants')

// 对话框处理
electronMain.ipcMain.handle('dialog:openFile', async (event: any, options: any) => {
  const win = electronMain.BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePaths: [] }
  
  const result = await electronMain.dialog.showOpenDialog(win, {
    ...options,
    properties: ['openFile', ...(options.properties || [])]
  })
  return result
})

electronMain.ipcMain.handle('dialog:saveFile', async (event: any, options: any) => {
  const win = electronMain.BrowserWindow.fromWebContents(event.sender)
  if (!win) return { canceled: true, filePath: '' }
  
  const result = await electronMain.dialog.showSaveDialog(win, options)
  return result
})

// 应用信息
electronMain.ipcMain.handle('app:getVersion', () => {
  return electronMain.app.getVersion()
})

electronMain.ipcMain.handle('app:getPath', (event: any, name: string) => {
  return electronMain.app.getPath(name)
})

electronMain.ipcMain.handle('app:getPlatform', () => {
  return process.platform
})

electronMain.ipcMain.handle('app:getInfo', () => {
  return {
    version: electronMain.app.getVersion(),
    name: APP_CONSTANTS.APP_NAME,
    author: APP_CONSTANTS.AUTHOR
  }
})

electronMain.ipcMain.handle('app:getSystemInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  }
})

electronMain.ipcMain.handle('app:getPerformanceInfo', () => {
  const memory = process.memoryUsage()
  return {
    usedMemory: memory.heapUsed,
    totalMemory: memory.heapTotal,
    cpuCores: cpus().length
  }
})

// 窗口操作
electronMain.ipcMain.handle('window:minimize', (event: any) => {
  const win = electronMain.BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

electronMain.ipcMain.handle('window:maximize', (event: any) => {
  const win = electronMain.BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

electronMain.ipcMain.handle('window:close', (event: any) => {
  const win = electronMain.BrowserWindow.fromWebContents(event.sender)
  win?.close()
})