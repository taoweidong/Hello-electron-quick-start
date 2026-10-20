<template>
  <div class="page settings-page">
    <PageHeader
      eyebrow="偏好与环境"
      title="设置"
      description="主题、工作目录、更新源与运行环境集中在这里，所有可写配置都会持久化到本地 SQLite。"
    />

    <div class="settings-grid">
      <div class="settings-column">
        <section class="section-card app-surface">
          <header class="section-head">
            <span class="section-icon">
              <el-icon :size="19"><component :is="theme === 'dark' ? Moon : Sunny" /></el-icon>
            </span>
            <div class="section-copy">
              <h2>外观主题</h2>
              <p>主题偏好保存在 settings 表，切换后立即生效并在重启后保留。</p>
            </div>
            <el-tag size="small" effect="plain" round>
              当前{{ theme === 'dark' ? '深色' : '浅色' }}
            </el-tag>
          </header>

          <div class="theme-options">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="theme-option"
              :class="{ 'is-active': theme === option.value }"
              :aria-pressed="theme === option.value"
              :disabled="themeSaving"
              @click="selectTheme(option.value)"
            >
              <span class="theme-option__icon">
                <el-icon :size="20"><component :is="option.icon" /></el-icon>
              </span>
              <span class="theme-option__body">
                <strong>{{ option.label }}</strong>
                <span>{{ option.description }}</span>
              </span>
              <el-icon v-if="theme === option.value" class="theme-option__check">
                <CircleCheckFilled />
              </el-icon>
            </button>
          </div>
          <p class="section-hint">切换会立即落库；保存失败时保持当前主题不变。</p>
        </section>

        <section class="section-card app-surface">
          <header class="section-head">
            <span class="section-icon">
              <el-icon :size="19"><FolderOpened /></el-icon>
            </span>
            <div class="section-copy">
              <h2>工作目录</h2>
              <p>日志、数据库与配置都存放在该目录下。</p>
            </div>
            <el-tag
              v-if="workspace"
              :type="workspace.fallback ? 'warning' : 'success'"
              size="small"
              effect="plain"
              round
            >
              {{ workspace.fallback ? '已回落' : '默认目录' }}
            </el-tag>
          </header>

          <div class="path-box">
            <code>{{ workspace ? workspace.path : '加载中…' }}</code>
            <el-button
              text
              type="primary"
              :icon="CopyDocument"
              :disabled="!workspace"
              @click="copyWorkspacePath"
            >
              复制
            </el-button>
          </div>
          <p class="section-hint">
            {{
              workspace?.fallback
                ? '默认目录不可用，已整体回落到 userData；日志与数据库同样位于该回落目录。'
                : '可通过环境变量 MYWINAPP_WORKDIR 覆盖默认目录；数据库文件为 data/app.db。'
            }}
          </p>

          <div class="path-facts">
            <span><strong>logs/</strong>运行日志</span>
            <span><strong>data/</strong>SQLite</span>
            <span><strong>config/</strong>配置文件</span>
          </div>
        </section>

        <section class="section-card app-surface">
          <header class="section-head">
            <span class="section-icon">
              <el-icon :size="19"><Key /></el-icon>
            </span>
            <div class="section-copy">
              <h2>快捷键</h2>
              <p>原生菜单与页面内交互共享同一套快捷键。</p>
            </div>
          </header>

          <div class="shortcut-list">
            <div v-for="item in shortcuts" :key="item.keys" class="shortcut-row">
              <span>{{ item.label }}</span>
              <kbd>{{ item.keys }}</kbd>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-column">
        <section class="section-card app-surface">
          <header class="section-head">
            <span class="section-icon">
              <el-icon :size="19"><Download /></el-icon>
            </span>
            <div class="section-copy">
              <h2>软件更新</h2>
              <p>更新源由环境变量或打包内置 app-update.yml 决定。</p>
            </div>
          </header>

          <div class="update-meta">
            <div class="update-version">
              <span>当前版本</span>
              <strong>v{{ updateStatus?.version || appInfo?.version || '…' }}</strong>
            </div>
            <code class="feed-url">{{ updateStatus?.feedUrl || '内置默认（未配置运行时覆盖）' }}</code>
          </div>

          <div class="update-actions">
            <el-button :loading="updateStatus?.type === 'checking'" :icon="Refresh" @click="checkUpdate">
              检查更新
            </el-button>
            <el-button v-if="updateStatus?.type === 'downloaded'" type="primary" @click="installNow">
              立即安装并重启
            </el-button>
          </div>

          <el-progress
            v-if="updateStatus?.type === 'downloading'"
            :percentage="updateStatus.percent || 0"
            class="update-progress"
          />
          <p class="update-status" :class="{ 'is-error': updateStatus?.type === 'error' }">
            {{ updateStatusText }}
          </p>
        </section>

        <section class="section-card about-card app-surface">
          <div class="about-brand">
            <span class="about-mark">
              <el-icon :size="24"><Monitor /></el-icon>
            </span>
            <div>
              <h2>{{ appInfo?.name || APP_NAME }}</h2>
              <p>{{ appInfo?.author || AUTHOR }} · v{{ appInfo?.version || '…' }}</p>
            </div>
          </div>

          <div class="system-chips">
            <span v-for="chip in systemChips" :key="chip.label" class="system-chip">
              <span>{{ chip.label }}</span>
              <code>{{ chip.value }}</code>
            </span>
          </div>

          <el-button class="homepage-button" :icon="TopRight" @click="openHomepage">
            访问项目主页
          </el-button>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Component } from 'vue'
import {
  CircleCheckFilled,
  CopyDocument,
  Download,
  FolderOpened,
  Key,
  Monitor,
  Moon,
  Refresh,
  Sunny,
  TopRight
} from '@element-plus/icons-vue'
import type {
  AppInfo,
  SystemInfo,
  Unsubscribe,
  UpdateStatusInfo,
  WorkspaceInfo
} from '@shared/types/electron'
import { APP_CONSTANTS } from '@shared/constants'
import PageHeader from '@/components/layout/PageHeader.vue'
import { useTheme } from '@/composables/useTheme'
import type { Theme } from '@/utils/theme'

const APP_NAME = APP_CONSTANTS.APP_NAME
const AUTHOR = APP_CONSTANTS.AUTHOR

const { theme, saving: themeSaving, loadTheme, setTheme } = useTheme()

const themeOptions: Array<{ value: Theme; label: string; description: string; icon: Component }> = [
  {
    value: 'light',
    label: '浅色模式',
    description: '明亮清爽，适合白天使用',
    icon: Sunny
  },
  {
    value: 'dark',
    label: '深色模式',
    description: '低亮度界面，适合夜间使用',
    icon: Moon
  }
]

const shortcuts = [
  { keys: 'Ctrl / Cmd + N', label: '新建任务（原生菜单）' },
  { keys: 'Ctrl / Cmd + O', label: '打开文件对话框' },
  { keys: 'Ctrl / Cmd + Shift + I', label: '开发者工具' }
]

const workspace = ref<WorkspaceInfo | null>(null)
const updateStatus = ref<UpdateStatusInfo | null>(null)
const appInfo = ref<AppInfo | null>(null)
const systemInfo = ref<SystemInfo | null>(null)
let offUpdateStatus: Unsubscribe | null = null

const updateStatusText = computed(() => {
  const status = updateStatus.value
  if (!status) return '更新状态加载中…'
  switch (status.type) {
    case 'checking':
      return '正在检查更新…'
    case 'latest':
      return status.info || '已是最新版本'
    case 'available':
    case 'downloading':
      return status.info || `正在下载更新 ${status.percent ?? 0}%`
    case 'downloaded':
      return status.info || '更新已下载，退出时将自动安装'
    case 'error':
      return `更新失败: ${status.error || '未知错误'}`
    default:
      return '尚未检查更新'
  }
})

const systemChips = computed(() => [
  { label: 'Electron', value: systemInfo.value?.electronVersion ?? '—' },
  { label: 'Chromium', value: systemInfo.value?.chromeVersion ?? '—' },
  { label: 'Node', value: systemInfo.value?.nodeVersion ?? '—' },
  { label: '平台', value: systemInfo.value ? `${systemInfo.value.platform} · ${systemInfo.value.arch}` : '—' }
])

async function readOrWarn<T>(
  request: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
  label: string
): Promise<T | null> {
  try {
    const result = await request
    if (result.ok) return result.data
    console.warn(`${label}失败: ${result.error.message}`)
    return null
  } catch (error) {
    console.warn(`${label}失败: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

onMounted(async () => {
  void loadTheme()

  const [workspaceData, status, app, system] = await Promise.all([
    readOrWarn(window.electronAPI.getWorkspace(), '获取工作目录'),
    readOrWarn(window.electronAPI.getUpdateStatus(), '获取更新状态'),
    readOrWarn(window.electronAPI.getAppInfo(), '获取应用信息'),
    readOrWarn(window.electronAPI.getSystemInfo(), '获取系统信息')
  ])

  if (workspaceData) workspace.value = workspaceData
  if (status) updateStatus.value = status
  if (app) appInfo.value = app
  if (system) systemInfo.value = system

  // 订阅返回退订函数，onUnmounted 精确移除（方案 B3/R5，防止路由切换叠加监听）
  offUpdateStatus = window.electronAPI.onUpdateStatus((next) => {
    updateStatus.value = next
  })
})

onUnmounted(() => {
  offUpdateStatus?.()
  offUpdateStatus = null
})

function selectTheme(next: Theme): void {
  void setTheme(next, true)
}

async function copyWorkspacePath(): Promise<void> {
  const path = workspace.value?.path
  if (!path) return
  try {
    await navigator.clipboard.writeText(path)
    ElMessage.success('工作目录已复制')
  } catch {
    ElMessage.warning('当前环境无法访问剪贴板，请手动选择路径复制')
  }
}

async function checkUpdate(): Promise<void> {
  try {
    const result = await window.electronAPI.checkForUpdates()
    if (result.ok) {
      updateStatus.value = result.data
    } else {
      ElMessage.error(`检查更新失败: ${result.error.message}`)
    }
  } catch (error) {
    ElMessage.error(`检查更新失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function installNow(): void {
  // 触发后应用将退出并静默安装重启，无需等待返回值
  void window.electronAPI.installUpdate()
}

function openHomepage(): void {
  window.open(APP_CONSTANTS.HOMEPAGE, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.settings-page {
  padding-bottom: 12px;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
  gap: 16px;
  align-items: start;
}

.settings-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.section-card {
  padding: 20px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.section-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.section-copy {
  flex: 1;
  min-width: 0;
}

.section-copy h2 {
  margin: 0;
  font-size: 16px;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.section-copy p {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.section-hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-placeholder);
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-md);
  background: var(--el-fill-color-lighter);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--app-transition),
    background-color var(--app-transition),
    box-shadow var(--app-transition);
}

.theme-option:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--el-color-primary) 38%, var(--el-border-color-lighter));
}

.theme-option.is-active {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.theme-option:disabled {
  cursor: progress;
  opacity: 0.75;
}

.theme-option:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-option__icon {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--el-color-primary);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
}

.theme-option__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-option__body strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.theme-option__body span {
  font-size: 11px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}

.theme-option__check {
  color: var(--el-color-primary);
}

.path-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-md);
  background: var(--el-fill-color-lighter);
}

.path-box code {
  flex: 1;
  min-width: 0;
  font-family: Consolas, 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--el-color-primary);
  word-break: break-all;
}

.path-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.path-facts span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 11px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.path-facts strong {
  font-family: Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.shortcut-row + .shortcut-row {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.shortcut-row kbd {
  padding: 3px 8px;
  border: 1px solid var(--el-border-color);
  border-bottom-width: 2px;
  border-radius: 7px;
  font-family: Consolas, 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
  white-space: nowrap;
}

.update-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 13px 14px;
  margin-bottom: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-md);
  background: var(--el-fill-color-lighter);
}

.update-version {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.update-version strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.feed-url {
  font-family: Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.update-progress {
  margin-top: 14px;
}

.update-status {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.update-status.is-error {
  color: var(--el-color-danger);
}

.about-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.about-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.about-mark {
  width: 54px;
  height: 54px;
  flex: 0 0 54px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: var(--el-color-white);
  background: linear-gradient(
    140deg,
    var(--el-color-primary),
    color-mix(in srgb, var(--el-color-primary) 42%, var(--el-color-success))
  );
  box-shadow: 0 12px 24px color-mix(in srgb, var(--el-color-primary) 24%, transparent);
}

.about-brand h2 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.about-brand p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.system-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.system-chip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 11px;
  border-radius: 9px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.system-chip code {
  font-family: Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.homepage-button {
  align-self: flex-start;
}

@media (max-width: 1080px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .theme-options,
  .system-chips,
  .path-facts {
    grid-template-columns: 1fr;
  }
}
</style>