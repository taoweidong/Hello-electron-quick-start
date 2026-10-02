import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { getLogsDir } from './workspace'
import { getDb } from './db'

// 写日志到工作目录 logs/app.log（工作目录不可用时回落 userData），便于排查运行问题
function logToFile(message: string) {
  const logPath = join(getLogsDir(), 'app.log')
  const timestamp = new Date().toISOString()
  try {
    appendFileSync(logPath, `[${timestamp}] ${message}\n`)
  } catch {
    // 忽略日志错误
  }
}

// __dirname 在开发与打包（app.asar）下均为 <dist>/main/main，
// 渲染产物固定在 <dist>/view，向上两级即到 dist
const distViewDir = join(__dirname, '../../view')
const indexHtml = join(distViewDir, 'index.html')
const preload = join(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL

// 设置 Windows 10+ 通知的应用名称
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  logToFile('App already running, exiting')
  app.quit()
  process.exit(0)
}

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

  // 开发模式加载 Vite 开发服务器，生产模式加载构建产物
  if (url) {
    logToFile(`Loading dev server: ${url}`)
    await win.loadURL(url)
    win.webContents.openDevTools()
  } else {
    logToFile(`Loading file: ${indexHtml}`)
    try {
      await win.loadFile(indexHtml)
    } catch (error: any) {
      logToFile(`Failed to load file: ${error.message}`)
    }
  }

  // 窗口准备好后显示
  win.on('ready-to-show', () => {
    win?.show()
  })

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 处理页面加载错误
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logToFile(`Page failed to load: ${errorCode} - ${errorDescription}`)
  })

  createApplicationMenu()
}

app.whenReady().then(() => {
  logToFile('App is ready')
  // 启动时建立 data/app.db 与 settings 表（规格：SQLite 数据库文件归属）
  try {
    getDb()
  } catch (error: any) {
    logToFile(`Database init failed: ${error.message}`)
  }
  createWindow()
}).catch(error => {
  logToFile(`Failed to create window: ${error.message}`)
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
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
              filters: [
                { name: 'All Files', extensions: ['*'] }
              ]
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
