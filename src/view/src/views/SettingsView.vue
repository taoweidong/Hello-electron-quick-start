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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { WorkspaceInfo } from '@shared/types/electron'

const workspace = ref<WorkspaceInfo | null>(null)
const theme = ref('light')
const saving = ref(false)

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
    }
  }
}
</style>
