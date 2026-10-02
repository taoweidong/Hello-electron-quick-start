import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getSetting } from '../db'

// 自动更新：generic provider，三级更新源（env > settings 表 update.url > 打包内置 app-update.yml），
// 状态机归一化后经 update:status 事件推送（见 openspec specs/auto-update 与 design D2-D4）
export interface UpdateState {
  type: 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'downloaded' | 'error'
  info?: string
  percent?: number
  error?: string
  version: string
  feedUrl: string
}

let state: UpdateState = { type: 'idle', version: app.getVersion(), feedUrl: '' }
let log: (msg: string) => void = () => {}

function push(next: Partial<UpdateState>) {
  state = { ...state, ...next }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update:status', state)
  }
}

function resolveFeedUrl(): string {
  const envUrl = process.env.MYWINAPP_UPDATE_URL
  if (envUrl) return envUrl
  try {
    const fromSettings = getSetting('update.url')
    if (fromSettings) return fromSettings
  } catch {
    // settings 存储不可用时静默跳过该级（design 风险项）
  }
  return '' // 空 = 使用打包内置 app-update.yml 的默认地址
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
    log(`更新源（运行时覆盖）: ${state.feedUrl}`)
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

export function getStatus(): UpdateState {
  return { ...state }
}

export async function checkForUpdates(): Promise<UpdateState> {
  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    // error 事件已归入状态机；此处仅避免未处理的 Promise 拒绝
    log(`检查更新失败: ${err?.message}`)
  }
  return getStatus()
}

export function installNow(): void {
  if (state.type !== 'downloaded') return
  // 静默安装并在完成后重启（design D3：立即安装）
  autoUpdater.quitAndInstall(true, true)
}
