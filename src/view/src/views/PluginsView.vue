<template>
  <div class="page plugins-page">
    <PageHeader
      eyebrow="扩展能力"
      title="插件"
      description="扫描工作区 plugins/ 下的本地插件；注册完成后按 runOnStartup 执行入口脚本，也可以在这里手动运行、启停和查看输出。"
    >
      <template #actions>
        <el-button :icon="FolderOpened" @click="handleOpenFolder()">打开插件目录</el-button>
        <el-button :icon="Refresh" :loading="reloading" @click="handleReload">重新扫描</el-button>
        <el-button type="primary" :icon="MagicStick" :loading="installing" @click="handleInstallSample">
          安装示例插件
        </el-button>
      </template>
    </PageHeader>

    <div class="plugin-notice">
      <el-icon :size="18"><Lock /></el-icon>
      <p>
        <strong>只安装你信任的插件。</strong>
        入口脚本以当前用户权限运行；主进程会限制入口路径、参数、超时（默认 15 秒）与输出上限，但无法沙箱化 Python 代码本身。Python 解释器可用环境变量
        <code>MYWINAPP_PYTHON</code> 指定。
      </p>
    </div>

    <StatRail :items="statCards" :loading="loading" aria-label="插件统计" />

    <section class="plugin-panel app-surface">
      <header class="plugin-panel__head">
        <div>
          <h2>已安装插件</h2>
          <p>每个目录对应一个插件，清单文件为 <code>plugin.json</code>。</p>
        </div>
        <span class="plugin-panel__count">{{ plugins.length }} 个</span>
      </header>

      <div v-if="loading" class="plugin-loading">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="plugins.length === 0" class="plugin-empty">
        <span class="plugin-empty__icon">
          <el-icon :size="28"><Connection /></el-icon>
        </span>
        <h3>还没有插件</h3>
        <p>安装示例 Python 插件，查看“注册 → 执行脚本 → 回传状态”的完整链路。</p>
        <el-button type="primary" :icon="MagicStick" :loading="installing" @click="handleInstallSample">
          安装示例插件
        </el-button>
      </div>

      <ul v-else class="plugin-list">
        <li
          v-for="plugin in plugins"
          :key="plugin.id"
          class="plugin-row"
          :class="`is-${plugin.status}`"
        >
          <span class="plugin-row__rail" aria-hidden="true"></span>
          <span class="plugin-row__icon">
            <el-icon :size="20"><Cpu /></el-icon>
          </span>

          <div class="plugin-row__main">
            <div class="plugin-row__title">
              <strong>{{ plugin.name }}</strong>
              <el-tag v-if="plugin.version" size="small" effect="plain" round>
                v{{ plugin.version }}
              </el-tag>
              <el-tag size="small" effect="plain" round>{{ runtimeLabel(plugin.runtime) }}</el-tag>
              <el-tag :type="statusMeta(plugin).tagType" size="small" effect="light" round>
                <el-icon v-if="plugin.status === 'running'" class="is-loading" :size="12">
                  <Loading />
                </el-icon>
                {{ statusMeta(plugin).label }}
              </el-tag>
              <el-tag v-if="plugin.status === 'error' && plugin.entry" size="small" type="danger" effect="plain" round>
                清单或运行异常
              </el-tag>
            </div>

            <p class="plugin-row__desc">{{ plugin.description || '暂无描述' }}</p>

            <div class="plugin-row__meta">
              <code>{{ plugin.entry || '未配置入口' }}</code>
              <span v-if="plugin.runOnStartup && plugin.enabled">启动时运行</span>
              <span v-if="plugin.lastRunAt">
                上次运行 {{ formatRelativeTime(plugin.lastRunAt) }}
              </span>
              <span v-if="plugin.lastDurationMs !== null">{{ plugin.lastDurationMs }} ms</span>
              <span v-if="plugin.exitCode !== null">退出码 {{ plugin.exitCode }}</span>
            </div>

            <p v-if="plugin.error" class="plugin-row__error">{{ plugin.error }}</p>
          </div>

          <div class="plugin-row__actions">
            <el-button
              size="small"
              type="primary"
              plain
              :loading="plugin.status === 'running'"
              :disabled="!isRunnable(plugin)"
              @click="handleRun(plugin)"
            >
              运行一次
            </el-button>
            <el-button
              size="small"
              text
              :disabled="!plugin.output && !plugin.error"
              @click="openOutput(plugin)"
            >
              输出
            </el-button>
            <el-tooltip :content="plugin.enabled ? '禁用插件' : '启用插件'" placement="top">
              <el-switch
                :model-value="plugin.enabled"
                :aria-label="`${plugin.enabled ? '禁用' : '启用'} ${plugin.name}`"
                :disabled="plugin.status === 'running' || !plugin.entry"
                @change="handleToggle(plugin, $event)"
              />
            </el-tooltip>
            <el-tooltip content="打开插件目录" placement="top">
              <el-button
                text
                circle
                :icon="FolderOpened"
                aria-label="打开插件目录"
                @click="handleOpenFolder(plugin)"
              />
            </el-tooltip>
          </div>
        </li>
      </ul>
    </section>

    <el-dialog v-model="outputVisible" width="760px" align-center class="plugin-output-dialog">
      <template #header>
        <div class="output-head">
          <span class="output-head__icon">
            <el-icon :size="18"><Document /></el-icon>
          </span>
          <div>
            <h3>{{ selectedPlugin?.name || '插件输出' }}</h3>
            <p>{{ selectedPlugin ? statusMeta(selectedPlugin).label : '运行日志' }}</p>
          </div>
        </div>
      </template>

      <div v-if="selectedPlugin" class="output-body">
        <div class="output-meta">
          <span>入口 <code>{{ selectedPlugin.entry || '—' }}</code></span>
          <span v-if="selectedPlugin.lastRunAt">
            {{ formatDateTime(selectedPlugin.lastRunAt) }}
          </span>
          <span v-if="selectedPlugin.lastDurationMs !== null">
            耗时 {{ selectedPlugin.lastDurationMs }} ms
          </span>
          <span v-if="selectedPlugin.exitCode !== null">退出码 {{ selectedPlugin.exitCode }}</span>
        </div>
        <pre class="output-pre">{{ outputText }}</pre>
      </div>

      <template #footer>
        <div class="output-footer">
          <el-button @click="outputVisible = false">关闭</el-button>
          <el-button
            type="primary"
            :loading="selectedPlugin?.status === 'running'"
            :disabled="!selectedPlugin || !isRunnable(selectedPlugin)"
            @click="rerunSelected"
          >
            重新运行
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { PluginInfo, PluginRuntime, PluginStatus } from '@shared/types/electron'
import {
  Box,
  CircleCheck,
  Connection,
  Cpu,
  Document,
  FolderOpened,
  Loading,
  Lock,
  MagicStick,
  Refresh,
  Warning
} from '@element-plus/icons-vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import StatRail from '@/components/layout/StatRail.vue'
import type { StatRailItem } from '@/utils/ui'
import { formatDateTime, formatRelativeTime } from '@/utils/time'

const STATUS_META: Record<
  PluginStatus,
  { label: string; tagType: 'info' | 'primary' | 'success' | 'danger' }
> = {
  idle: { label: '待运行', tagType: 'info' },
  running: { label: '运行中', tagType: 'primary' },
  success: { label: '成功', tagType: 'success' },
  error: { label: '异常', tagType: 'danger' },
  disabled: { label: '已禁用', tagType: 'info' }
}

const plugins = ref<PluginInfo[]>([])
const loading = ref(true)
const reloading = ref(false)
const installing = ref(false)
const outputVisible = ref(false)
const selectedId = ref<string | null>(null)

let offStatus: (() => void) | null = null

const selectedPlugin = computed(
  () => plugins.value.find((plugin) => plugin.id === selectedId.value) ?? null
)

const outputText = computed(() => {
  const plugin = selectedPlugin.value
  if (!plugin) return ''
  const sections: string[] = []
  if (plugin.output) sections.push(plugin.output)
  if (plugin.error) sections.push(`[错误]\n${plugin.error}`)
  return sections.join('\n\n') || '暂无输出。运行一次插件后，stdout / stderr 会显示在这里。'
})

const statCards = computed<StatRailItem[]>(() => {
  const enabled = plugins.value.filter((plugin) => plugin.enabled).length
  const success = plugins.value.filter((plugin) => plugin.status === 'success').length
  const failed = plugins.value.filter((plugin) => plugin.status === 'error').length

  return [
    {
      label: '已安装',
      value: plugins.value.length,
      hint: '工作区 plugins/',
      tone: 'primary',
      icon: Box
    },
    {
      label: '已启用',
      value: enabled,
      hint: '启动时按清单执行',
      tone: 'info',
      icon: Connection
    },
    {
      label: '运行成功',
      value: success,
      hint: '最近一次执行',
      tone: 'success',
      icon: CircleCheck
    },
    {
      label: '需要处理',
      value: failed,
      hint: failed > 0 ? '查看错误与输出' : '没有异常',
      tone: 'danger',
      icon: Warning
    }
  ]
})

function statusMeta(plugin: PluginInfo): { label: string; tagType: 'info' | 'primary' | 'success' | 'danger' } {
  return STATUS_META[plugin.status]
}

function runtimeLabel(runtime: PluginRuntime): string {
  return runtime === 'python' ? 'Python' : 'Node'
}

function isRunnable(plugin: PluginInfo): boolean {
  return plugin.enabled && plugin.entry !== '' && plugin.status !== 'running'
}

function replacePlugin(next: PluginInfo): void {
  const index = plugins.value.findIndex((plugin) => plugin.id === next.id)
  if (index >= 0) plugins.value.splice(index, 1, next)
  else plugins.value.push(next)
}

async function loadPlugins(): Promise<void> {
  loading.value = true
  try {
    const result = await window.electronAPI.listPlugins()
    if (result.ok) plugins.value = result.data
    else ElMessage.error(result.error.message || '读取插件列表失败')
  } catch (error) {
    ElMessage.error(`读取插件列表失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    loading.value = false
  }
}

async function handleReload(): Promise<void> {
  if (reloading.value) return
  reloading.value = true
  try {
    const result = await window.electronAPI.reloadPlugins()
    if (result.ok) {
      plugins.value = result.data
      ElMessage.success(`已重新扫描，共 ${result.data.length} 个插件`)
    } else {
      ElMessage.error(result.error.message || '重新扫描失败')
    }
  } catch (error) {
    ElMessage.error(`重新扫描失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    reloading.value = false
  }
}

async function handleInstallSample(): Promise<void> {
  if (installing.value) return
  installing.value = true
  try {
    const result = await window.electronAPI.installSamplePlugin()
    if (!result.ok) {
      ElMessage.error(result.error.message || '安装示例插件失败')
      return
    }
    if (result.data.installed) {
      ElMessage.success('示例插件已安装，可点击“运行一次”体验 Python 执行')
    } else {
      ElMessage.info('示例插件已存在，无需重复安装')
    }
    await loadPlugins()
  } catch (error) {
    ElMessage.error(`安装示例插件失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    installing.value = false
  }
}

async function handleRun(plugin: PluginInfo): Promise<void> {
  if (!isRunnable(plugin)) return
  try {
    const result = await window.electronAPI.runPlugin(plugin.id)
    if (!result.ok) {
      ElMessage.error(result.error.message || '插件运行失败')
      return
    }
    replacePlugin(result.data)
    if (result.data.status === 'success') {
      ElMessage.success(`插件执行完成（${result.data.lastDurationMs ?? 0} ms）`)
    } else {
      ElMessage.error(result.data.error || '插件执行失败')
    }
  } catch (error) {
    ElMessage.error(`插件运行失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleToggle(plugin: PluginInfo, value: unknown): Promise<void> {
  const enabled = value === true
  if (plugin.enabled === enabled) return

  try {
    const result = await window.electronAPI.setPluginEnabled(plugin.id, enabled)
    if (!result.ok) {
      ElMessage.error(result.error.message || '切换插件状态失败')
      return
    }
    replacePlugin(result.data)
    ElMessage.success(enabled ? '插件已启用' : '插件已禁用')
  } catch (error) {
    ElMessage.error(`切换插件状态失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function handleOpenFolder(plugin?: PluginInfo): Promise<void> {
  try {
    const result = await window.electronAPI.openPluginFolder(plugin?.id)
    if (!result.ok) ElMessage.error(result.error.message || '无法打开插件目录')
  } catch (error) {
    ElMessage.error(`无法打开插件目录: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function openOutput(plugin: PluginInfo): void {
  selectedId.value = plugin.id
  outputVisible.value = true
}

function rerunSelected(): void {
  if (selectedPlugin.value) void handleRun(selectedPlugin.value)
}

onMounted(async () => {
  await loadPlugins()
  offStatus = window.electronAPI.onPluginStatus((plugin) => {
    replacePlugin(plugin)
  })
})

onUnmounted(() => {
  offStatus?.()
  offStatus = null
})
</script>

<style scoped>
.plugins-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}

.plugin-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-left: 3px solid var(--el-color-warning);
  border-radius: 0 var(--app-radius-md) var(--app-radius-md) 0;
  background: color-mix(in srgb, var(--el-color-warning) 7%, transparent);
  color: var(--el-text-color-secondary);
}

.plugin-notice .el-icon {
  margin-top: 1px;
  flex: 0 0 auto;
  color: var(--el-color-warning);
}

.plugin-notice p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
}

.plugin-notice strong {
  color: var(--el-text-color-primary);
}

.plugin-notice code,
.plugin-panel__head code {
  padding: 1px 5px;
  border-radius: 5px;
  font-family: var(--app-font-mono);
  font-size: 11px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.plugin-panel {
  overflow: hidden;
}

.plugin-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.plugin-panel__head h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.plugin-panel__head p {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.plugin-panel__count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.plugin-loading {
  padding: 22px 20px;
}

.plugin-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 54px 20px 48px;
  text-align: center;
}

.plugin-empty__icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 18px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.plugin-empty h3 {
  margin: 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.plugin-empty p {
  margin: 0 0 8px;
  max-width: 420px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.plugin-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.plugin-row {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 14px;
  padding: 18px 20px 18px 24px;
  transition: background-color var(--app-transition);
}

.plugin-row + .plugin-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.plugin-row:hover {
  background: var(--el-fill-color-lighter);
}

.plugin-row__rail {
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 3px;
  border-radius: 999px;
  background: var(--el-border-color);
}

.plugin-row.is-running .plugin-row__rail {
  background: var(--el-color-primary);
}

.plugin-row.is-success .plugin-row__rail {
  background: var(--el-color-success);
}

.plugin-row.is-error .plugin-row__rail {
  background: var(--el-color-danger);
}

.plugin-row__icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.plugin-row.is-error .plugin-row__icon {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
}

.plugin-row.is-success .plugin-row__icon {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 10%, transparent);
}

.plugin-row.is-disabled .plugin-row__icon {
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}

.plugin-row__main {
  min-width: 0;
}

.plugin-row__title {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.plugin-row__title strong {
  font-size: 14.5px;
  color: var(--el-text-color-primary);
}

.plugin-row__title :deep(.el-tag) {
  gap: 2px;
}

.plugin-row__title :deep(.el-icon.is-loading) {
  margin-right: 3px;
}

.plugin-row__desc {
  margin: 5px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
}

.plugin-row__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 7px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.plugin-row__meta code {
  padding: 1px 6px;
  border-radius: 5px;
  font-family: var(--app-font-mono);
  font-size: 11px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}

.plugin-row__error {
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-color-danger);
  word-break: break-word;
}

.plugin-row__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
  max-width: 300px;
}

.output-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.output-head__icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}

.output-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.output-head p {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.output-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.output-meta code {
  font-family: var(--app-font-mono);
  color: var(--el-text-color-primary);
}

.output-pre {
  max-height: 440px;
  margin: 0;
  padding: 14px 16px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-md);
  background: var(--el-fill-color-lighter);
  font-family: var(--app-font-mono);
  font-size: 12px;
  line-height: 1.65;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
}

.output-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1100px) {
  .plugin-row {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .plugin-row__actions {
    grid-column: 2 / -1;
    justify-content: flex-start;
    max-width: none;
  }
}

@media (max-width: 640px) {
  .plugin-panel__head {
    flex-direction: column;
    gap: 6px;
  }

  .plugin-row {
    grid-template-columns: 1fr;
    padding-left: 20px;
  }

  .plugin-row__rail {
    top: 14px;
    bottom: 14px;
  }

  .plugin-row__actions {
    grid-column: 1 / -1;
  }
}
</style>