import { dialog, BrowserWindow, app } from 'electron'
import { cpus } from 'node:os'
import { dirname } from 'node:path'
import { APP_CONSTANTS } from '../../shared/constants'
import { grantReadDir, grantWriteDir } from '../security/pathGuard'
import { ipcSafe } from './ipcSafe'
import type { OpenDialogOptions, SaveDialogOptions } from '../../shared/types/electron'

// 应用/对话框/窗口通道（B3 起统一走 ipcSafe：抛错即 {ok:false,error}，返回值即 {ok:true,data}）

// 对话框处理：用户亲自选定的路径是合法授权来源，成功分支里登记进 pathGuard（方案 B2/S2）
ipcSafe('dialog:openFile', async (event, options: OpenDialogOptions = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('找不到发起请求的窗口')

  const properties = options.properties ?? []
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

ipcSafe('dialog:saveFile', async (event, options: SaveDialogOptions = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('找不到发起请求的窗口')

  const result = await dialog.showSaveDialog(win, options)
  if (!result.canceled && result.filePath) {
    grantWriteDir(dirname(result.filePath))
  }
  return result
})

// 应用信息
ipcSafe('app:getVersion', () => {
  return app.getVersion()
})

ipcSafe('app:getPath', (event, name: Parameters<typeof app.getPath>[0]) => {
  return app.getPath(name)
})

ipcSafe('app:getPlatform', () => {
  return process.platform
})

ipcSafe('app:getInfo', () => {
  return {
    version: app.getVersion(),
    name: APP_CONSTANTS.APP_NAME,
    author: APP_CONSTANTS.AUTHOR
  }
})

ipcSafe('app:getSystemInfo', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  }
})

ipcSafe('app:getPerformanceInfo', () => {
  const memory = process.memoryUsage()
  return {
    usedMemory: memory.heapUsed,
    totalMemory: memory.heapTotal,
    cpuCores: cpus().length
  }
})

// 窗口操作
ipcSafe('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('找不到发起请求的窗口')
  win.minimize()
})

ipcSafe('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('找不到发起请求的窗口')
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcSafe('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) throw new Error('找不到发起请求的窗口')
  win.close()
})
