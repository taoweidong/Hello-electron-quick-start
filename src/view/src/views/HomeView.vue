<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  FolderOpened, 
  ChatDotRound, 
  Monitor,
  Platform,
  Cpu,
  DataLine 
} from '@element-plus/icons-vue'

// 类型声明
interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

interface PerformanceInfo {
  usedMemory: number
  totalMemory: number
  cpuCores: number
}

interface AppInfo {
  version: string
  name: string
  author: string
}

interface FileOperationResult {
  success: boolean
  error?: string
  content?: string
}

interface DialogResult {
  canceled: boolean
  filePaths: string[]
  filePath?: string
}

const welcomeMessage = ref('基于 Electron + Vue 3 + TypeScript + Vite + Element Plus 的现代化桌面应用')

const systemInfo = ref<SystemInfo>({
  platform: '',
  arch: '',
  nodeVersion: '',
  electronVersion: '',
  chromeVersion: ''
})

const performanceInfo = ref<PerformanceInfo>({
  usedMemory: 0,
  totalMemory: 0,
  cpuCores: 0
})

const appInfo = ref<AppInfo>({
  version: '1.0.0',
  name: 'My Electron App',
  author: 'Your Name'
})

let performanceInterval: number

const handleOpenFile = async () => {
  // @ts-ignore
  if (window.electronAPI) {
    try {
      // @ts-ignore
      const result = await window.electronAPI.showOpenDialog({
        title: '选择文件',
        properties: ['openFile'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt', 'md'] },
          { name: 'Image Files', extensions: ['jpg', 'png', 'gif'] }
        ]
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        ElMessage.success(`已选择文件: ${result.filePaths[0]}`)
        
        // 读取文件内容示例
        // @ts-ignore
        const fileResult = await window.electronAPI.readFile(result.filePaths[0])
        if (fileResult.success) {
          console.log('文件内容:', fileResult.content?.substring(0, 100))
        }
      }
    } catch (error) {
      ElMessage.error('打开文件对话框失败')
      console.error('File open error:', error)
    }
  } else {
    ElMessage.info('在浏览器环境中无法调用文件对话框')
  }
}

const handleShowDialog = () => {
  ElMessage.success('这是一个示例操作，展示了 Element Plus 的消息提示')
}

const handleGetPlatform = async () => {
  // @ts-ignore
  if (window.electronAPI) {
    // @ts-ignore
    const platform = await window.electronAPI.getPlatform()
    ElMessage.info(`当前平台: ${platform}`)
  } else {
    ElMessage.info(`当前平台: ${navigator.platform}`)
  }
}

const formatMemory = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const updatePerformanceInfo = () => {
  // @ts-ignore
  if (window.electronAPI) {
    // @ts-ignore
    window.electronAPI.getPerformanceInfo().then((info: PerformanceInfo) => {
      performanceInfo.value = info
    }).catch((error: any) => {
      console.warn('无法获取性能信息:', error)
    })
  }
}

onMounted(async () => {
  // 获取应用版本
  // @ts-ignore
  if (window.electronAPI) {
    // 获取完整的应用信息
    try {
      // @ts-ignore
      const appData = await window.electronAPI.getAppInfo()
      appInfo.value = appData
    } catch (error) {
      console.warn('无法获取应用信息:', error)
    }
    
    // 获取系统信息
    try {
      // @ts-ignore
      const sysInfo = await window.electronAPI.getSystemInfo()
      systemInfo.value = sysInfo
    } catch (error) {
      console.warn('无法获取系统信息:', error)
    }
    
    // 获取性能信息
    try {
      // @ts-ignore
      const perfInfo = await window.electronAPI.getPerformanceInfo()
      performanceInfo.value = perfInfo
    } catch (error) {
      console.warn('无法获取性能信息:', error)
    }
  }
  
  // 更新性能信息
  performanceInterval = window.setInterval(updatePerformanceInfo, 2000)
  updatePerformanceInfo()
})

onUnmounted(() => {
  if (performanceInterval) {
    clearInterval(performanceInterval)
  }
})
</script>