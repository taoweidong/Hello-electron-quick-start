import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logWarn } from '../logger'
import type { UpdateStatusInfo } from '../../shared/types/electron'
import {
  assertSafeFeedUrl,
  hostOf,
  parseHostList,
  pickFeedUrl,
  readBuiltinFeedUrl,
  redactUrl
} from './feedUrl'

// 自动更新：generic provider，两级更新源（env MYWINAPP_UPDATE_URL > 打包内置 app-update.yml），
// 状态机归一化后经 update:status 事件推送（见 openspec specs/auto-update 与 design D2-D4）。
// settings 表 update.url 一档已取消：渲染进程可写的存储不能决定"下载哪个 exe 并静默安装"（方案 B2/S3）。
// UpdateStatusInfo 唯一定义在共享类型（方案 B3/C3），此处仅 type-only 复用。

let state: UpdateStatusInfo = { type: 'idle', version: app.getVersion(), feedUrl: '' }
let log: (msg: string) => void = () => {}

function push(next: Partial<UpdateStatusInfo>) {
  state = { ...state, ...next }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:status', state)
  }
}

// 返回需要显式 setFeedURL 的地址；空串表示"用打包内置 app-update.yml，不做覆盖"。
// env 覆盖必须过校验，不合规就回落到内置源（方案 B2/S3）
function resolveFeedUrl(): string {
  const envUrl = process.env.MYWINAPP_UPDATE_URL
  const builtinUrl = app.isPackaged ? readBuiltinFeedUrl(process.resourcesPath) : ''
  // 没有 env 覆盖时返回空串：electron-updater 自己会读打包内置的 app-update.yml
  if (!envUrl) return ''
  const chosen = pickFeedUrl(envUrl, builtinUrl)
  const allowList = [
    ...parseHostList(process.env.MYWINAPP_UPDATE_HOSTS),
    ...(hostOf(builtinUrl) ? [hostOf(builtinUrl)] : [])
  ]
  try {
    assertSafeFeedUrl(chosen, allowList)
  } catch (error) {
    logWarn(
      `忽略不安全的更新源并回落内置地址: ${(error as Error).message}` +
        `（额外允许主机: ${allowList.join(', ') || '仅回环'}）`
    )
    return ''
  }
  return chosen
}

function wireEvents() {
  autoUpdater.on('checking-for-update', () => push({ type: 'checking', info: '正在检查更新' }))
  autoUpdater.on('update-available', info => {
    push({ type: 'available', info: `发现新版本 ${info.version}` })
  })
  autoUpdater.on('update-not-available', () => push({ type: 'latest', info: '已是最新版本' }))
  autoUpdater.on('download-progress', progress => {
    push({ type: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', info => {
    push({ type: 'downloaded', info: `新版本 ${info.version} 已下载待安装` })
  })
  autoUpdater.on('error', err => {
    push({ type: 'error', error: err?.message || '更新过程出错' })
  })
}

export function initUpdater(logger: (msg: string) => void): void {
  log = logger
  state.feedUrl = resolveFeedUrl()
  if (state.feedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: state.feedUrl })
    log(`更新源（运行时覆盖）: ${redactUrl(state.feedUrl)}`)
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  wireEvents()

  if (app.isPackaged) {
    // 启动后延迟数秒自动检查，避开启动争用（design D3）
    setTimeout(() => {
      void checkForUpdates()
    }, 5000)
  } else {
    log('开发环境无 app-update.yml，跳过启动自动检查')
  }
}

export function getStatus(): UpdateStatusInfo {
  return { ...state }
}

export async function checkForUpdates(): Promise<UpdateStatusInfo> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    // error 事件已归入状态机；此处仅避免未处理的 Promise 拒绝
    log(`检查更新失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  return getStatus()
}

export function installNow(): void {
  if (state.type !== 'downloaded') return
  // 静默安装并在完成后重启（design D3：立即安装）
  autoUpdater.quitAndInstall(true, true)
}
