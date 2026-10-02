<template>
  <div class="settings-view">
    <h1>设置</h1>

    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header">
          <span>工作目录</span>
          <el-tag v-if="workspace" :type="workspace.fallback ? 'warning' : 'success'" size="small">
            {{ workspace.fallback ? '已回落（默认目录不可用）' : '默认工作目录' }}
          </el-tag>
        </div>
      </template>
      <p class="workdir-path">{{ workspace ? workspace.path : '加载中...' }}</p>
      <p class="hint">日志、数据库（data/app.db）与配置均存储在该目录下；日志位于 logs/ 子目录。</p>
    </el-card>

    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header"><span>主题偏好（SQLite 存储示例）</span></div>
      </template>
      <div class="theme-row">
        <el-select v-model="theme" style="width: 200px" placeholder="选择主题">
          <el-option label="浅色" value="light" />
          <el-option label="深色" value="dark" />
        </el-select>
        <el-button type="primary" :loading="saving" @click="saveTheme">保存</el-button>
      </div>
      <p class="hint">该配置写入工作目录下 data/app.db 的 settings 表，应用重启后仍生效。</p>
    </el-card>

    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header"><span>软件更新</span></div>
      </template>
      <p class="hint update-meta">
        当前版本 v{{ updateStatus?.version || '...' }} · 更新源
        {{ updateStatus?.feedUrl || '内置默认（未配置运行时覆盖）' }}
      </p>
      <div class="theme-row">
        <el-button :loading="updateStatus?.type === 'checking'" @click="checkUpdate">
          检查更新
        </el-button>
        <el-button
          v-if="updateStatus?.type === 'downloaded'"
          type="primary"
          @click="installNow"
        >
          立即安装并重启
        </el-button>
      </div>
      <el-progress
        v-if="updateStatus?.type === 'downloading'"
        :percentage="updateStatus.percent || 0"
        class="update-progress"
      />
      <p class="hint" :class="{ 'update-error': updateStatus?.type === 'error' }">
        {{ updateStatusText }}
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UpdateStatusInfo, WorkspaceInfo } from '@shared/types/electron'

const workspace = ref<WorkspaceInfo | null>(null)
const theme = ref('light')
const saving = ref(false)
const updateStatus = ref<UpdateStatusInfo | null>(null)

const updateStatusText = computed(() => {
  const s = updateStatus.value
  if (!s) return '更新状态加载中...'
  switch (s.type) {
    case 'checking':
      return '正在检查更新...'
    case 'latest':
      return s.info || '已是最新版本'
    case 'available':
    case 'downloading':
      return s.info || `正在下载更新 ${s.percent ?? 0}%`
    case 'downloaded':
      return s.info || '更新已下载，退出时将自动安装'
    case 'error':
      return `更新失败: ${s.error || '未知错误'}`
    default:
      return '尚未检查更新'
  }
})

onMounted(async () => {
  try {
    workspace.value = await window.electronAPI.getWorkspace()
  } catch (error) {
    console.warn('获取工作目录失败:', error)
  }

  try {
    const saved = await window.electronAPI.getSetting('theme')
    if (saved) theme.value = saved
  } catch (error) {
    console.warn('读取主题配置失败:', error)
  }

  try {
    updateStatus.value = await window.electronAPI.getUpdateStatus()
  } catch (error) {
    console.warn('获取更新状态失败:', error)
  }
  window.electronAPI.onUpdateStatus(status => {
    updateStatus.value = status
  })
})

const saveTheme = async () => {
  saving.value = true
  try {
    const result = await window.electronAPI.setSetting('theme', theme.value)
    if (result.success) {
      ElMessage.success('已保存，应用重启后仍生效')
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error(`保存失败: ${error.message}`)
  } finally {
    saving.value = false
  }
}

const checkUpdate = async () => {
  try {
    updateStatus.value = await window.electronAPI.checkForUpdates()
  } catch (error: any) {
    ElMessage.error(`检查更新失败: ${error.message}`)
  }
}

const installNow = () => {
  // 触发后应用将退出并静默安装重启，无需等待返回值
  void window.electronAPI.installUpdate()
}
</script>

<style scoped>
.settings-view {
  padding: 16px;

  h1 {
    margin-top: 0;
    font-size: 20px;
  }

  .settings-card {
    margin-bottom: 16px;

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .workdir-path {
      margin: 0 0 8px;
      font-family: Consolas, monospace;
      color: var(--el-color-primary);
    }

    .theme-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .hint {
      margin: 8px 0 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;

      &.update-error {
        color: var(--el-color-danger);
      }
    }

    .update-meta {
      margin: 0 0 12px;
    }

    .update-progress {
      margin-top: 12px;
    }
  }
}
</style>
