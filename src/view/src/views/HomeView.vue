<template>
  <div class="home-view">
    <el-card shadow="never" class="welcome-card">
      <div class="welcome">
        <el-icon :size="40" color="var(--el-color-primary)"><ChatDotRound /></el-icon>
        <h2>{{ welcomeMessage }}</h2>
        <p class="app-meta">{{ appInfo.name }} v{{ appInfo.version }} · {{ appInfo.author }}</p>
        <div class="actions">
          <el-button type="primary" :icon="FolderOpened" @click="handleOpenFile">打开文件</el-button>
          <el-button :icon="ChatDotRound" @click="handleShowDialog">示例提示</el-button>
          <el-button :icon="Platform" @click="handleGetPlatform">当前平台</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="info-card">
          <template #header>
            <div class="card-header">
              <el-icon><Monitor /></el-icon>
              <span>系统信息</span>
            </div>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="平台">{{ systemInfo.platform || '-' }}</el-descriptions-item>
            <el-descriptions-item label="架构">{{ systemInfo.arch || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Node">{{ systemInfo.nodeVersion || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Electron">{{ systemInfo.electronVersion || '-' }}</el-descriptions-item>
            <el-descriptions-item label="Chrome">{{ systemInfo.chromeVersion || '-' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="hover" class="info-card">
          <template #header>
            <div class="card-header">
              <el-icon><DataLine /></el-icon>
              <span>性能信息</span>
            </div>
          </template>
          <p class="memory-value">{{ formatMemory(performanceInfo.usedMemory) }}</p>
          <el-progress :percentage="memoryPercent" :stroke-width="10" />
          <p class="memory-sub">
            堆内存共 {{ formatMemory(performanceInfo.totalMemory) }}
            <el-icon class="inline-icon"><Cpu /></el-icon>
            {{ performanceInfo.cpuCores }} 核
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  FolderOpened,
  ChatDotRound,
  Monitor,
  Platform,
  Cpu,
  DataLine
} from '@element-plus/icons-vue'
import type { AppInfo, PerformanceInfo, SystemInfo } from '@shared/types/electron'

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

const memoryPercent = computed(() => {
  const total = performanceInfo.value.totalMemory
  if (!total) return 0
  return Math.min(100, Math.round((performanceInfo.value.usedMemory / total) * 100))
})

const handleOpenFile = async () => {
  if (window.electronAPI) {
    const result = await window.electronAPI.showOpenDialog({
      title: '选择文件',
      properties: ['openFile'],
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'Image Files', extensions: ['jpg', 'png', 'gif'] }
      ]
    })
    if (!result.ok) {
      ElMessage.error(`打开文件对话框失败: ${result.error.message}`)
      return
    }

    if (!result.data.canceled && result.data.filePaths.length > 0) {
      ElMessage.success(`已选择文件: ${result.data.filePaths[0]}`)

      // 读取文件内容示例
      const fileResult = await window.electronAPI.readFile(result.data.filePaths[0])
      if (fileResult.ok) {
        console.log('文件内容:', fileResult.data.substring(0, 100))
      }
    }
  } else {
    ElMessage.info('在浏览器环境中无法调用文件对话框')
  }
}

const handleShowDialog = () => {
  ElMessage.success('这是一个示例操作，展示了 Element Plus 的消息提示')
}

const handleGetPlatform = async () => {
  if (window.electronAPI) {
    const platform = await window.electronAPI.getPlatform()
    ElMessage.info(`当前平台: ${platform.ok ? platform.data : navigator.platform}`)
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
  if (window.electronAPI) {
    window.electronAPI.getPerformanceInfo().then((result) => {
      if (result.ok) {
        performanceInfo.value = result.data
      }
    }).catch((error: any) => {
      console.warn('无法获取性能信息:', error)
    })
  }
}

onMounted(async () => {
  if (window.electronAPI) {
    // 获取完整的应用信息
    const appData = await window.electronAPI.getAppInfo()
    if (appData.ok) {
      appInfo.value = appData.data
    }

    // 获取系统信息
    const sysInfo = await window.electronAPI.getSystemInfo()
    if (sysInfo.ok) {
      systemInfo.value = sysInfo.data
    }

    // 获取性能信息
    const perfInfo = await window.electronAPI.getPerformanceInfo()
    if (perfInfo.ok) {
      performanceInfo.value = perfInfo.data
    }
  }

  // 定时刷新性能信息
  performanceInterval = window.setInterval(updatePerformanceInfo, 2000)
  updatePerformanceInfo()
})

onUnmounted(() => {
  if (performanceInterval) {
    clearInterval(performanceInterval)
  }
})
</script>

<style lang="scss" scoped>
.home-view {
  padding: 16px;

  .welcome-card {
    margin-bottom: 16px;

    .welcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 16px 0;

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .app-meta {
        margin: 0;
        color: var(--el-text-color-secondary);
        font-size: 13px;
      }

      .actions {
        margin-top: 8px;
        display: flex;
        gap: 8px;
      }
    }
  }

  .info-card {
    margin-bottom: 16px;

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .memory-value {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-color-primary);
    }

    .memory-sub {
      margin: 8px 0 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;

      .inline-icon {
        vertical-align: -2px;
      }
    }
  }
}
</style>
