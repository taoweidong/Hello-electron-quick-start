// 冒烟测试：验证主进程产物与渲染产物能被 Electron 正常加载，且 Vue 应用壳真正挂载
// 前置条件：先执行 npm run build（或至少 compile:main + vite build）
const { app, BrowserWindow } = require('electron')
const { existsSync, rmSync } = require('node:fs')
const { join } = require('node:path')
const os = require('node:os')

const indexHtml = join(__dirname, 'dist/view/index.html')
const preload = join(__dirname, 'dist/main/main/preload.js')
const ipcIndex = join(__dirname, 'dist/main/main/ipc/index.js')

if (!existsSync(indexHtml) || !existsSync(preload) || !existsSync(ipcIndex)) {
  console.error('[smoke] 缺少构建产物，请先运行 npm run build')
  process.exit(1)
}

// 用独立临时工作目录跑冒烟，避免污染用户真实 D:\MyWinApp；同时注册真实 IPC handler，
// 让渲染层走完整 IPC 链路（否则 invoke 会因缺少 handler 输出大量噪声错误）
const smokeWorkdir = join(os.tmpdir(), 'my-win-app-smoke')
rmSync(smokeWorkdir, { recursive: true, force: true })
process.env.MYWINAPP_WORKDIR = smokeWorkdir

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

app.disableHardwareAcceleration()

app.whenReady().then(() => {
  require(ipcIndex)

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
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

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[smoke] 渲染进程崩溃: ${details.reason}`)
    app.exit(1)
  })

  win.webContents.on('did-finish-load', async () => {
    console.log('[smoke] 页面加载成功')

    // 等待 Vue 挂载并确认应用壳与导航项真实渲染（不再只看 did-finish-load）
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rendered = await win.webContents.executeJavaScript(`
        (() => {
          const shell = document.querySelector('.app-shell')
          const nav = document.querySelector('.app-sidebar')?.textContent ?? ''
          return Boolean(shell && nav.includes('任务管理') && nav.includes('文件管理'))
        })()
      `)

      if (rendered) {
        console.log('[smoke] 应用壳渲染成功')
        app.exit(0)
        return
      }
      await delay(200)
    }

    console.error('[smoke] 应用壳未渲染：.app-shell 或导航项缺失')
    app.exit(1)
  })

  win.loadFile(indexHtml).catch((error) => {
    console.error(`[smoke] loadFile 失败: ${error.message}`)
    app.exit(1)
  })
})

app.on('window-all-closed', () => app.exit(0))
