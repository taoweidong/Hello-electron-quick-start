// 最小冒烟测试：验证主进程产物与渲染产物能被 Electron 正常加载
// 前置条件：先执行 npm run build（或至少 compile:main + vite build）
const { app, BrowserWindow } = require('electron')
const { existsSync } = require('node:fs')
const { join } = require('node:path')

const indexHtml = join(__dirname, 'dist/view/index.html')
const preload = join(__dirname, 'dist/main/main/preload.js')

if (!existsSync(indexHtml) || !existsSync(preload)) {
  console.error('[smoke] 缺少构建产物，请先运行 npm run build')
  process.exit(1)
}

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[smoke] 页面加载失败: ${errorCode} - ${errorDescription}`)
    app.exit(1)
  })

  win.webContents.on('did-finish-load', () => {
    console.log('[smoke] 页面加载成功')
    // 给 preload 与首帧渲染留出时间，无异常则正常退出
    setTimeout(() => app.exit(0), 1500)
  })

  win.loadFile(indexHtml).catch((error) => {
    console.error(`[smoke] loadFile 失败: ${error.message}`)
    app.exit(1)
  })
})

app.on('window-all-closed', () => app.exit(0))
