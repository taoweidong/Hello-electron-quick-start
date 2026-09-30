import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron'
import { release } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// 添加日志函数
function logToFile(message: string) {
  const logPath = join(app.getPath('userData'), 'app.log')
  const timestamp = new Date().toISOString()
  try {
    require('fs').appendFileSync(logPath, `[${timestamp}] ${message}\n`)
  } catch (error) {
    // 忽略日志错误
  }
}

// 环境变量配置
process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist/view')  // 修改这里，指向 view 目录
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// 禁用 Windows 7 的 GPU 加速
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// 设置 Windows 10+ 通知的应用名称
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  logToFile('App already running, exiting')
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = join(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL
// 正确设置生产模式下的 index.html 路径
let indexHtml = ''
if (process.env.VITE_DEV_SERVER_URL) {
  indexHtml = join(process.env.DIST, 'index.html')
} else {
  // 在生产模式下，使用正确的路径指向打包后的文件
  // Electron Builder 会将文件打包到 app.asar 中，我们需要指向正确的路径
  indexHtml = join(__dirname, '../view/index.html')
}
const iconPath = process.env.PUBLIC ? join(process.env.PUBLIC, 'favicon.ico') : undefined

async function createWindow() {
  logToFile('Creating window...')
  logToFile(`DIST_ELECTRON: ${process.env.DIST_ELECTRON}`)
  logToFile(`DIST: ${process.env.DIST}`)
  logToFile(`indexHtml path: ${indexHtml}`)
  logToFile(`File exists: ${existsSync(indexHtml)}`)
  
  win = new BrowserWindow({
    title: 'My Electron App',
    ...(iconPath && { icon: iconPath }), // 只有当 iconPath 存在时才设置图标
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

  // 开发模式加载开发服务器，生产模式加载本地文件
  if (url) {
    logToFile(`Loading URL: ${url}`)
    await win.loadURL(url)
    win.webContents.openDevTools()
  } else {
    // 生产模式下使用正确的路径
    logToFile(`Loading file: ${indexHtml}`)
    try {
      await win.loadFile(indexHtml)
      logToFile('Successfully loaded file')
    } catch (error: any) {
      logToFile(`Failed to load file: ${error.message}`)
      logToFile(`Error stack: ${error.stack}`)
    }
  }

  // 窗口准备好后显示
  win.on('ready-to-show', () => {
    logToFile('Window ready to show')
    win?.show()
  })

  // 处理外部链接
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 处理页面加载错误
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logToFile(`Page failed to load: ${errorCode} - ${errorDescription}`)
  })

  // 创建应用菜单
  createApplicationMenu()
}

app.whenReady().then(() => {
  logToFile('App is ready')
  createWindow()
}).catch(error => {
  logToFile(`Failed to create window: ${error.message}`)
})

app.on('window-all-closed', () => {
  logToFile('All windows closed')
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  logToFile('Second instance')
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  logToFile('App activated')
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