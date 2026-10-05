import { getSetting, setSetting } from '../db'
import { ipcSafe } from './ipcSafe'

// 配置读写（SQLite settings 键值表实例，见 openspec specs/sqlite-storage）
// 写入键必须有白名单：渲染层可写的存储若允许任意键，等于给渲染层一条通往主进程行为的通道
// （历史教训：update.url 曾可运行时改写，配合 autoDownload + quitAndInstall 构成 RCE 链，方案 §4）
const WRITABLE_KEYS = ['theme'] as const

ipcSafe('settings:get', (event, key: string) => {
  return getSetting(key)
})

ipcSafe('settings:set', (event, key: string, value: string) => {
  if (!WRITABLE_KEYS.includes(key as (typeof WRITABLE_KEYS)[number])) {
    throw new Error(`不允许写入的配置项：${key}`)
  }
  setSetting(key, value)
})
