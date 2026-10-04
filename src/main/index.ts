import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'node:path'
import { resolveWorkspace } from './workspace'
import { getDb, closeDb } from './db'
import { initUpdater } from './updater'
import { logInfo, logWarn, logError, logErrorWithStack } from './logger'

// 渲染层可请求用系统浏览器打开的外链域名白名单（其余一律拒绝，见方案 B1/S4）
const ALLOWED_EXTERNAL_HOSTS = ['github.com']

function isAllowedExternalUrl(target: string): boolean {
  try {
    const parsed = new URL(target)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return ALLOWED_EXTERNAL_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

// __dirname 在开发与打包（app.asar）下均为 <dist>/main/main，
// 渲染产物固定在 <dist>/view，向上两级即到 dist
const distViewDir = join(__dirname, '../../view')
const indexHtml = join(distViewDir, 'index.html')
const preload = join(__dirname, 'preload.js')
const devServerUrl = process.env.VITE_DEV_SERVER_URL

// 页面内导航只允许当前载体：开发模式锁到 Vite 源，生产模式锁到本地文件
// （渲染层一旦注入外部内容，即可经 electronAPI 改写更新源，见方案 §4 的 RCE 链）
function isAllowedNavigation(target: string): boolean {
  try {
    const parsed = new URL(target)
    if (devServerUrl) return parsed.origin === new URL(devServerUrl).origin
    return parsed.protocol === 'file:'
  } catch {
    return false
  }
}

// 设置 Windows 10+ 通知的应用名称
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  logInfo('App already running, exiting')
  app.quit()
  process.exit(0)
}

// 进程级兜底：记录现场但不退出，避免偶发异常升级成崩溃（方案 B1/S5）
process.on('uncaughtException', (error) => {
  logErrorWithStack('ERROR', error)
})
process.on('unhandledRejection', (reason) => {
  logErrorWithStack('ERROR', reason)
})

let win: BrowserWindow | null = null

async function createWindow() {
  win = new BrowserWindow({
    title: 'My Electron App',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    transparent: false
  })

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url)
    } else {
      logWarn(`拒绝打开外部链接: ${url}`)
    }
    return { action: 'deny' }
  })

  // 拦截页面内导航
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAllowedNavigation(target)) {
      event.preventDefault()
      logWarn(`拦截页面导航: ${target}`)
    }
  })

  // 处理页面加载错误
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logError(`Page failed to load: ${errorCode} - ${errorDescription}`)
  })

  // 开发模式加载 Vite 开发服务器，生产模式加载构建产物
  if (devServerUrl) {
    logInfo(`Loading dev server: ${devServerUrl}`)
    await win.loadURL(devServerUrl)
    win.webContents.openDevTools()
  } else {
    logInfo(`Loading file: ${indexHtml}`)
    try {
      await win.loadFile(indexHtml)
    } catch (error) {
      // 加载失败不显示空窗：给出可见提示后退出（方案 B1/R8）
      const message = (error as Error)?.message ?? String(error)
      logError(`Failed to load file: ${message}`)
      dialog.showErrorBox('启动失败', `无法加载应用页面：\n${indexHtml}\n${message}`)
      app.quit()
      return
    }
  }

  // 窗口准备好后显示
  win.on('ready-to-show', () => {
    win?.show()
  })

  createApplicationMenu()
}

app
  .whenReady()
  .then(() => {
    logInfo('App is ready')
    // 工作目录不可写时后续日志与建库都会静默失败，先确认再启动（方案 B1/R9）
    try {
      resolveWorkspace()
    } catch (error) {
      logErrorWithStack('ERROR', error)
      dialog.showErrorBox('无法准备工作目录', (error as Error).message)
      app.quit()
      return
    }
    // 启动时建立 data/app.db 与 settings 表（规格：SQLite 数据库文件归属）
    try {
      getDb()
    } catch (error) {
      logError(`Database init failed: ${(error as Error).message}`)
    }
    // 自动更新（更新源由环境变量或打包内置 app-update.yml 决定，见方案 B2/S3）
    initUpdater((msg) => logInfo(`[updater] ${msg}`))
    createWindow()
  })
  .catch((error) => {
    logErrorWithStack('ERROR', error)
  })

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

// 退出前关闭 SQLite，避免 WAL 模式残留 -wal/-shm（方案 B1/R3）
app.on('before-quit', () => {
  closeDb()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// IPC 处理器注册
import './ipc/index'

function createApplicationMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // 新建文件逻辑
          }
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(win!, {
              properties: ['openFile'],
              filters: [{ name: 'All Files', extensions: ['*'] }]
            })
            if (!result.canceled) {
              win?.webContents.send('file-opened', result.filePaths[0])
            }
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: async () => {
            const { shell } = await import('electron')
            await shell.openExternal('https://github.com/taoweidong/Hello-electron-quick-start')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template as any)
  Menu.setApplicationMenu(menu)
}
