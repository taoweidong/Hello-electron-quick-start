<template>
  <div class="page home-page">
    <section class="hero">
      <div class="hero__content">
        <span class="hero__eyebrow">工作台 · {{ todayLabel }}</span>
        <h1>{{ greeting }}，欢迎回来</h1>
        <p class="hero__lead">
          在这里管理任务、浏览归档文件，并通过完整 CRUD 示例了解数据如何从界面写入本地 SQLite。
        </p>
        <div class="hero__actions">
          <el-button type="primary" size="large" @click="goCreate">
            <el-icon><Plus /></el-icon>
            新建任务
          </el-button>
          <el-button size="large" @click="goTasks">
            <el-icon><Tickets /></el-icon>
            查看全部任务
          </el-button>
        </div>
        <div class="hero__meta">
          <span :title="workspace?.path">
            <el-icon><FolderOpened /></el-icon>
            {{ workspace?.path || '工作目录加载中' }}
          </span>
          <span>
            <el-icon><Cpu /></el-icon>
            {{ platformLabel }}
          </span>
        </div>
      </div>

      <div class="hero__art" aria-hidden="true">
        <span class="hero__ring hero__ring--outer"></span>
        <span class="hero__ring hero__ring--inner"></span>
        <span class="hero__orb">
          <el-icon :size="42"><Odometer /></el-icon>
        </span>
        <span class="hero__pulse hero__pulse--one"></span>
        <span class="hero__pulse hero__pulse--two"></span>
      </div>
    </section>

    <section class="stats-grid" aria-label="任务概览">
      <article
        v-for="card in statCards"
        :key="card.label"
        class="stat-card app-surface"
        :class="`is-${card.tone}`"
      >
        <span class="stat-card__icon">
          <el-icon :size="20"><component :is="card.icon" /></el-icon>
        </span>
        <div class="stat-card__body">
          <span class="stat-card__label">{{ card.label }}</span>
          <strong>{{ loading ? '—' : card.value }}</strong>
          <small>{{ card.hint }}</small>
        </div>
      </article>
    </section>

    <div class="home-grid">
      <section class="panel recent-panel app-surface">
        <header class="panel-head">
          <div>
            <span class="panel-kicker">最近更新</span>
            <h2>最近任务</h2>
          </div>
          <el-button text type="primary" @click="goTasks">
            查看全部
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </header>

        <div v-if="loading" class="recent-skeleton">
          <el-skeleton :rows="4" animated />
        </div>

        <div v-else-if="recentTasks.length === 0" class="recent-empty">
          <span class="recent-empty__icon">
            <el-icon :size="26"><Tickets /></el-icon>
          </span>
          <h3>还没有任务</h3>
          <p>一键载入一组示例任务，或直接创建第一条。</p>
          <div class="recent-empty__actions">
            <el-button :loading="seeding" @click="handleSeed">
              <el-icon><MagicStick /></el-icon>
              载入示例
            </el-button>
            <el-button type="primary" @click="goCreate">新建任务</el-button>
          </div>
        </div>

        <TransitionGroup v-else name="list" tag="ul" class="recent-list">
          <li
            v-for="task in recentTasks"
            :key="task.id"
            class="recent-item"
            @click="navigateToTask(task)"
          >
            <span class="recent-item__status" :class="`is-${task.status}`" aria-hidden="true"></span>
            <div class="recent-item__main">
              <div class="recent-item__title-row">
                <span class="recent-item__title">{{ task.title }}</span>
                <TaskStatusTag :status="task.status" />
              </div>
              <div class="recent-item__meta">
                <TaskPriorityBadge :priority="task.priority" />
                <span class="meta-divider">·</span>
                <span>{{ task.category }}</span>
                <span v-if="task.dueDate" class="meta-divider">·</span>
                <span
                  v-if="task.dueDate"
                  class="recent-item__due"
                  :class="`is-${dueState(task.dueDate, task.status)}`"
                >
                  {{ formatDueLabel(task.dueDate, task.status) }}
                </span>
                <span class="meta-divider">·</span>
                <span>{{ formatRelativeTime(task.updatedAt) }}</span>
              </div>
            </div>
            <el-icon class="recent-item__arrow"><ArrowRight /></el-icon>
          </li>
        </TransitionGroup>

        <div v-if="!loading && recentTasks.length" class="recent-footer">
          <span>
            <el-icon><InfoFilled /></el-icon>
            点击任务可打开详情抽屉
          </span>
          <span><kbd>Ctrl / Cmd + N</kbd> 新建任务</span>
        </div>
      </section>

      <aside class="home-side">
        <section class="panel progress-panel app-surface">
          <header class="panel-head">
            <div>
              <span class="panel-kicker">完成情况</span>
              <h2>完成进度</h2>
            </div>
          </header>
          <div class="progress-ring">
            <el-progress
              type="dashboard"
              :percentage="stats.completionRate"
              :width="132"
              :stroke-width="10"
              :show-text="false"
            />
            <div class="progress-ring__center">
              <strong>{{ stats.completionRate }}%</strong>
              <span>完成率</span>
            </div>
          </div>
          <div class="distribution">
            <div v-for="item in distribution" :key="item.label" class="distribution-row">
              <span class="distribution-label">{{ item.label }}</span>
              <span class="distribution-track">
                <span
                  class="distribution-fill"
                  :class="`is-${item.tone}`"
                  :style="{ width: `${item.percent}%` }"
                ></span>
              </span>
              <span class="distribution-value">{{ item.value }}</span>
            </div>
          </div>
          <div class="overdue-note" :class="{ 'has-overdue': stats.overdue > 0 }">
            <el-icon>
              <WarningFilled v-if="stats.overdue > 0" />
              <CircleCheckFilled v-else />
            </el-icon>
            <span v-if="stats.overdue > 0">有 {{ stats.overdue }} 条任务已逾期</span>
            <span v-else>没有逾期任务，节奏很好</span>
          </div>
        </section>

        <section class="panel env-panel app-surface">
          <header class="panel-head">
            <div>
              <span class="panel-kicker">本机信息</span>
              <h2>运行环境</h2>
            </div>
          </header>
          <div class="env-list">
            <div v-for="item in envItems" :key="item.label" class="env-row">
              <span>{{ item.label }}</span>
              <code>{{ item.value }}</code>
            </div>
          </div>
          <el-button text type="primary" class="env-link" @click="openHomepage">
            项目主页
            <el-icon><TopRight /></el-icon>
          </el-button>
        </section>
      </aside>
    </div>

    <section class="scenarios">
      <div class="section-heading">
        <div>
          <span class="panel-kicker">示例场景</span>
          <h2>从这里开始体验</h2>
        </div>
        <p>每个入口都对应真实可操作的功能，而不是静态占位。</p>
      </div>
      <div class="scenario-grid">
        <button
          v-for="card in scenarioCards"
          :key="card.title"
          type="button"
          class="scenario-card app-surface"
          :class="`is-${card.tone}`"
          @click="card.action"
        >
          <span class="scenario-card__icon">
            <el-icon :size="20"><component :is="card.icon" /></el-icon>
          </span>
          <span class="scenario-card__body">
            <span class="scenario-card__tag">{{ card.tag }}</span>
            <strong>{{ card.title }}</strong>
            <span class="scenario-card__desc">{{ card.description }}</span>
          </span>
          <el-icon class="scenario-card__arrow"><ArrowRight /></el-icon>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  CircleCheck,
  CircleCheckFilled,
  Cpu,
  Delete,
  Filter,
  FolderOpened,
  InfoFilled,
  MagicStick,
  Moon,
  Odometer,
  Plus,
  Sunny,
  Tickets,
  Timer,
  TopRight,
  Warning,
  WarningFilled
} from '@element-plus/icons-vue'
import type {
  AppInfo,
  IpcResult,
  SystemInfo,
  Task,
  TaskStats,
  WorkspaceInfo
} from '@shared/types/electron'
import { APP_CONSTANTS } from '@shared/constants'
import TaskStatusTag from '@/components/tasks/TaskStatusTag.vue'
import TaskPriorityBadge from '@/components/tasks/TaskPriorityBadge.vue'
import { useTheme } from '@/composables/useTheme'
import { dueState, formatDueLabel, formatRelativeTime } from '@/utils/task'

type StatTone = 'primary' | 'warning' | 'success' | 'danger' | 'info'

interface StatCard {
  label: string
  value: number
  hint: string
  tone: StatTone
  icon: Component
}

interface ScenarioCard {
  title: string
  description: string
  tag: string
  tone: StatTone
  icon: Component
  action: () => void
}

const router = useRouter()
const { isDark, toggleTheme } = useTheme()

const loading = ref(true)
const seeding = ref(false)
const stats = ref<TaskStats>({
  total: 0,
  todo: 0,
  inProgress: 0,
  done: 0,
  overdue: 0,
  completionRate: 0
})
const recentTasks = ref<Task[]>([])
const systemInfo = ref<SystemInfo | null>(null)
const workspace = ref<WorkspaceInfo | null>(null)
const appInfo = ref<AppInfo | null>(null)

/** 单个 IPC 失败不拖垮整页：返回 null 由调用方保持兜底值 */
async function readIpc<T>(request: Promise<IpcResult<T>>): Promise<T | null> {
  try {
    const result = await request
    return result.ok ? result.data : null
  } catch {
    return null
  }
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const todayLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
)

const platformLabel = computed(() => {
  const platform = systemInfo.value?.platform
  if (!platform) return '运行环境加载中'
  const names: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux'
  }
  return `${names[platform] ?? platform} · ${systemInfo.value?.arch ?? ''}`
})

const statCards = computed<StatCard[]>(() => [
  {
    label: '全部任务',
    value: stats.value.total,
    hint: '保存在 data/app.db',
    tone: 'primary',
    icon: Tickets
  },
  {
    label: '进行中',
    value: stats.value.inProgress,
    hint: `待开始 ${stats.value.todo} 条`,
    tone: 'warning',
    icon: Timer
  },
  {
    label: '已完成',
    value: stats.value.done,
    hint: '任务闭环示例',
    tone: 'success',
    icon: CircleCheck
  },
  {
    label: '已逾期',
    value: stats.value.overdue,
    hint: stats.value.overdue > 0 ? '需要优先处理' : '暂无逾期任务',
    tone: 'danger',
    icon: Warning
  }
])

const distribution = computed(() => {
  const total = stats.value.total || 1
  return [
    {
      label: '待开始',
      value: stats.value.todo,
      percent: Math.round((stats.value.todo / total) * 100),
      tone: 'todo'
    },
    {
      label: '进行中',
      value: stats.value.inProgress,
      percent: Math.round((stats.value.inProgress / total) * 100),
      tone: 'doing'
    },
    {
      label: '已完成',
      value: stats.value.done,
      percent: Math.round((stats.value.done / total) * 100),
      tone: 'done'
    }
  ]
})

const envItems = computed(() => [
  { label: 'Electron', value: systemInfo.value?.electronVersion ?? '—' },
  { label: 'Chromium', value: systemInfo.value?.chromeVersion ?? '—' },
  { label: 'Node', value: systemInfo.value?.nodeVersion ?? '—' },
  { label: '应用版本', value: appInfo.value?.version ?? '—' }
])

const scenarioCards = computed<ScenarioCard[]>(() => [
  {
    title: '新建任务',
    description: '表单校验、状态与优先级选择、标签和截止日期。',
    tag: 'CRUD',
    tone: 'primary',
    icon: Plus,
    action: goCreate
  },
  {
    title: '筛选与搜索',
    description: '按状态、优先级、分类组合筛选，并支持关键词搜索。',
    tag: '查询',
    tone: 'info',
    icon: Filter,
    action: () => {
      void router.push({ path: '/tasks', query: { status: 'in_progress' } })
    }
  },
  {
    title: '批量操作',
    description: '表格多选后批量删除，体验带确认的危险操作流程。',
    tag: '批量',
    tone: 'danger',
    icon: Delete,
    action: goTasks
  },
  {
    title: '文件解压预览',
    description: '拖拽 ZIP / RAR，查看文件树、属性与内容预览。',
    tag: '文件',
    tone: 'success',
    icon: FolderOpened,
    action: goFiles
  },
  {
    title: isDark.value ? '切换到浅色模式' : '切换到深色模式',
    description: '主题写入 settings 表，切换立即生效并在重启后保留。',
    tag: '主题',
    tone: 'warning',
    icon: isDark.value ? Sunny : Moon,
    action: () => {
      void toggleTheme()
    }
  },
  {
    title: stats.value.total > 0 ? '补充示例数据' : '载入示例数据',
    description: '按 demo_key 幂等补齐 12 条示例任务，可反复点击。',
    tag: '数据',
    tone: 'primary',
    icon: MagicStick,
    action: () => {
      void handleSeed()
    }
  }
])

function goCreate(): void {
  void router.push({ path: '/tasks', query: { create: '1' } })
}

function goTasks(): void {
  void router.push('/tasks')
}

function goFiles(): void {
  void router.push('/files')
}

function navigateToTask(task: Task): void {
  void router.push({ path: '/tasks', query: { focus: String(task.id) } })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [statsData, listData, system, workspaceData, app] = await Promise.all([
      readIpc(window.electronAPI.getTaskStats()),
      readIpc(
        window.electronAPI.listTasks({
          keyword: '',
          status: 'all',
          priority: 'all',
          category: 'all',
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          page: 1,
          pageSize: 8
        })
      ),
      readIpc(window.electronAPI.getSystemInfo()),
      readIpc(window.electronAPI.getWorkspace()),
      readIpc(window.electronAPI.getAppInfo())
    ])

    if (statsData) stats.value = statsData
    if (listData) recentTasks.value = listData.items
    if (system) systemInfo.value = system
    if (workspaceData) workspace.value = workspaceData
    if (app) appInfo.value = app
  } finally {
    loading.value = false
  }
}

async function handleSeed(): Promise<void> {
  if (seeding.value) return
  seeding.value = true
  try {
    const result = await window.electronAPI.seedDemoTasks()
    if (!result.ok) {
      ElMessage.error(result.error.message || '载入示例数据失败')
      return
    }
    if (result.data.inserted === 0) {
      ElMessage.info('示例数据已存在，无需重复载入')
    } else {
      ElMessage.success(`已载入 ${result.data.inserted} 条示例任务`)
    }
    await load()
  } catch (error) {
    ElMessage.error(`载入示例数据失败: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    seeding.value = false
  }
}

function openHomepage(): void {
  window.open(APP_CONSTANTS.HOMEPAGE, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 12px;
}

.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 228px;
  padding: 32px 36px;
  overflow: hidden;
  border-radius: var(--app-radius-xl);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color-lighter));
  background:
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--el-color-primary) 18%, transparent), transparent 42%),
    radial-gradient(circle at 12% 108%, color-mix(in srgb, var(--el-color-success) 12%, transparent), transparent 38%),
    var(--el-bg-color);
  box-shadow: var(--el-box-shadow-lighter);
}

.hero__content {
  position: relative;
  z-index: 1;
  max-width: 640px;
}

.hero__eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--el-color-primary);
}

.hero h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--el-text-color-primary);
}

.hero__lead {
  margin: 12px 0 0;
  max-width: 580px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.hero__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
}

.hero__meta {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 18px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.hero__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero__art {
  position: relative;
  flex: 0 0 260px;
  height: 200px;
  display: grid;
  place-items: center;
}

.hero__ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 26%, transparent);
}

.hero__ring--outer {
  width: 210px;
  height: 210px;
  border-style: dashed;
  animation: slow-spin 28s linear infinite;
}

.hero__ring--inner {
  width: 150px;
  height: 150px;
  border-color: color-mix(in srgb, var(--el-color-primary) 34%, transparent);
}

.hero__orb {
  position: relative;
  z-index: 1;
  width: 92px;
  height: 92px;
  display: grid;
  place-items: center;
  border-radius: 30px;
  color: var(--el-color-white);
  background: linear-gradient(
    140deg,
    var(--el-color-primary),
    color-mix(in srgb, var(--el-color-primary) 42%, var(--el-color-success))
  );
  box-shadow:
    0 18px 38px color-mix(in srgb, var(--el-color-primary) 32%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--el-color-white) 36%, transparent);
}

.hero__pulse {
  position: absolute;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-color-primary) 38%, transparent);
}

.hero__pulse--one {
  width: 9px;
  height: 9px;
  top: 30px;
  right: 48px;
}

.hero__pulse--two {
  width: 7px;
  height: 7px;
  bottom: 38px;
  left: 34px;
  background: color-mix(in srgb, var(--el-color-success) 55%, transparent);
}

@keyframes slow-spin {
  to {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.stat-card {
  --stat-color: var(--el-color-primary);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  transition: transform var(--app-transition), box-shadow var(--app-transition);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--el-box-shadow-light);
}

.stat-card.is-warning {
  --stat-color: var(--el-color-warning);
}

.stat-card.is-success {
  --stat-color: var(--el-color-success);
}

.stat-card.is-danger {
  --stat-color: var(--el-color-danger);
}

.stat-card__icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: var(--stat-color);
  background: color-mix(in srgb, var(--stat-color) 12%, transparent);
}

.stat-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-card__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-card__body strong {
  margin-top: 1px;
  font-size: 26px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.stat-card__body small {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
  gap: 16px;
  align-items: stretch;
}

.panel {
  padding: 18px 20px;
}

.recent-panel {
  display: flex;
  flex-direction: column;
}

.recent-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px dashed var(--el-border-color-lighter);
  font-size: 11.5px;
  color: var(--el-text-color-placeholder);
}

.recent-footer span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.recent-footer kbd {
  padding: 2px 6px;
  border: 1px solid var(--el-border-color);
  border-bottom-width: 2px;
  border-radius: 6px;
  font-family: Consolas, monospace;
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-kicker {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
}

.panel-head h2,
.section-heading h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.recent-skeleton {
  padding: 8px 2px;
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  margin: 0 -10px;
  border-radius: 11px;
  cursor: pointer;
  transition: background-color var(--app-transition);
}

.recent-item + .recent-item {
  border-top: 1px solid var(--el-border-color-lighter);
}

.recent-item:hover {
  background: var(--el-fill-color-lighter);
}

.recent-item:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.recent-item__status {
  width: 3px;
  height: 34px;
  flex: 0 0 3px;
  border-radius: 999px;
  background: var(--el-border-color);
}

.recent-item__status.is-in_progress {
  background: var(--el-color-primary);
}

.recent-item__status.is-done {
  background: var(--el-color-success);
}

.recent-item__main {
  flex: 1;
  min-width: 0;
}

.recent-item__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.recent-item__title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-item__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 5px;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.meta-divider {
  color: var(--el-text-color-placeholder);
}

.recent-item__due.is-overdue {
  color: var(--el-color-danger);
  font-weight: 600;
}

.recent-item__due.is-today,
.recent-item__due.is-soon {
  color: var(--el-color-warning);
  font-weight: 600;
}

.recent-item__arrow {
  color: var(--el-text-color-placeholder);
  transition: transform var(--app-transition), color var(--app-transition);
}

.recent-item:hover .recent-item__arrow {
  color: var(--el-color-primary);
  transform: translateX(3px);
}

.recent-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 20px;
  text-align: center;
}

.recent-empty__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.recent-empty h3 {
  margin: 2px 0 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.recent-empty p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.recent-empty__actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.home-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.progress-ring {
  position: relative;
  display: grid;
  place-items: center;
  margin: 4px 0 16px;
}

.progress-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.progress-ring__center strong {
  font-size: 26px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.progress-ring__center span {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.distribution {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.distribution-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.distribution-track {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--el-fill-color-light);
}

.distribution-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--el-text-color-placeholder);
  transition: width 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.distribution-fill.is-doing {
  background: var(--el-color-primary);
}

.distribution-fill.is-done {
  background: var(--el-color-success);
}

.distribution-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.overdue-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: var(--app-radius-md);
  font-size: 12px;
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 9%, transparent);
}

.overdue-note.has-overdue {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 9%, transparent);
}

.env-list {
  display: flex;
  flex-direction: column;
}

.env-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.env-row + .env-row {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.env-row code {
  font-family: Consolas, 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--el-text-color-primary);
}

.env-link {
  margin-top: 8px;
  padding-left: 0;
}

.scenarios {
  margin-top: 2px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 12px;
}

.section-heading p {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.scenario-card {
  --scenario-color: var(--el-color-primary);
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition:
    transform var(--app-transition),
    box-shadow var(--app-transition),
    border-color var(--app-transition);
}

.scenario-card.is-info {
  --scenario-color: var(--el-color-info);
}

.scenario-card.is-success {
  --scenario-color: var(--el-color-success);
}

.scenario-card.is-warning {
  --scenario-color: var(--el-color-warning);
}

.scenario-card.is-danger {
  --scenario-color: var(--el-color-danger);
}

.scenario-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--scenario-color) 40%, var(--el-border-color-lighter));
  box-shadow: var(--el-box-shadow-light);
}

.scenario-card:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.scenario-card__icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--scenario-color);
  background: color-mix(in srgb, var(--scenario-color) 12%, transparent);
}

.scenario-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.scenario-card__tag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--scenario-color);
}

.scenario-card__body strong {
  margin-top: 2px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.scenario-card__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

.scenario-card__arrow {
  margin-top: 2px;
  color: var(--el-text-color-placeholder);
  transition: transform var(--app-transition), color var(--app-transition);
}

.scenario-card:hover .scenario-card__arrow {
  color: var(--scenario-color);
  transform: translateX(3px);
}

.list-enter-active,
.list-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

@media (max-width: 1240px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-grid {
    grid-template-columns: 1fr;
  }

  .home-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scenario-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .hero__art {
    display: none;
  }

  .home-side {
    grid-template-columns: 1fr;
  }

  .scenario-grid {
    grid-template-columns: 1fr;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}

@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>