import { ipcMain } from 'electron'
import { getSetting, setSetting } from '../db'

// 配置读写（SQLite settings 键值表实例，见 openspec specs/sqlite-storage）
ipcMain.handle('settings:get', (event, key: string) => {
  return getSetting(key)
})

ipcMain.handle('settings:set', (event, key: string, value: string) => {
  try {
    setSetting(key, value)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
