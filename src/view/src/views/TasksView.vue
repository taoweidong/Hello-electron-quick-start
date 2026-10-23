<template>
  <div class="page tasks-page">
    <PageHeader
      eyebrow="CRUD 示例"
      title="任务管理"
      description="从创建、编辑、状态流转到批量删除，所有变更都会写入本地 SQLite，并同步刷新概览统计。"
    >
      <template #actions>
        <el-button :loading="seeding" @click="handleSeed">
          <el-icon><MagicStick /></el-icon>
          载入示例
        </el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新建任务
        </el-button>
      </template>
    </PageHeader>

    <StatRail :items="statCards" :loading="statsLoading" aria-label="任务统计" />

    <section class="filter-bar app-surface" aria-label="任务筛选">
      <el-input
        v-model="query.keyword"
        class="filter-search"
        clearable
        placeholder="搜索标题、描述或分类"
        @input="scheduleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-radio-group v-model="query.status" class="status-filter" @change="handleFilterChange">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button
          v-for="option in TASK_STATUS_OPTIONS"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </el-radio-button>
      </el-radio-group>

      <el-select
        v-model="query.priority"
        class="filter-select"
        placeholder="优先级"
        @change="handleFilterChange"
      >
        <el-option label="全部优先级" value="all" />
        <el-option
          v-for="option in TASK_PRIORITY_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <el-select
        v-model="query.category"
        class="filter-select"
        placeholder="分类"
        @change="handleFilterChange"
      >
        <el-option label="全部分类" value="all" />
        <el-option
          v-for="category in categoryOptions"
          :key="category"
          :label="category"
          :value="category"
        />
      </el-select>

      <el-select v-model="sortValue" class="filter-sort">
        <el-option
          v-for="option in SORT_OPTIONS"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>

      <el-button text :icon="RefreshLeft" @click="handleReset">重置</el-button>
    </section>

    <section class="table-panel app-surface">
      <div class="table-toolbar">
        <div class="table-summary">
          <strong>{{ total }}</strong>
          <span>条任务</span>
          <el-tag v-if="selectedIds.length" type="primary" effect="light" round size="small">
            已选 {{ selectedIds.length }} 项
          </el-tag>
        </div>
        <div class="table-actions">
          <el-button
            v-if="selectedIds.length"
            size="small"
            type="danger"
            plain
            :icon="Delete"
            @click="handleBatchDelete"
          >
            批量删除
          </el-button>
          <el-button size="small" :icon="Refresh" :loading="loading" @click="handleRefresh">
            刷新
          </el-button>
        </div>
      </div>

      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tasks"
        row-key="id"
        class="task-table"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column label="任务" min-width="260">
          <template #default="{ row }">
            <div class="task-cell">
              <span class="task-title">{{ row.title }}</span>
              <p v-if="row.description" class="task-description">{{ row.description }}</p>
              <div v-if="row.tags.length" class="task-tags">
                <el-tag
                  v-for="tag in row.tags.slice(0, 3)"
                  :key="tag"
                  size="small"
                  effect="plain"
                  round
                >
                  {{ tag }}
                </el-tag>
                <span v-if="row.tags.length > 3" class="more-tags">+{{ row.tags.length - 3 }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-dropdown
              trigger="click"
              @command="handleStatusCommand(row, $event)"
              @click.stop
            >
              <button type="button" class="status-trigger" aria-label="快速切换任务状态">
                <TaskStatusTag :status="row.status" />
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="option in TASK_STATUS_OPTIONS"
                    :key="option.value"
                    :command="option.value"
                    :disabled="row.status === option.value"
                  >
                    {{ option.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>

        <el-table-column label="优先级" width="88">
          <template #default="{ row }">
            <TaskPriorityBadge :priority="row.priority" />
          </template>
        </el-table-column>

        <el-table-column label="分类" width="90">
          <template #default="{ row }">
            <span class="category-pill">{{ row.category }}</span>
          </template>
        </el-table-column>

        <el-table-column label="截止日期" width="112">
          <template #default="{ row }">
            <span class="due-date" :class="`is-${dueState(row.dueDate, row.status)}`">
              {{ formatDueLabel(row.dueDate, row.status) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最近更新" width="116">
          <template #default="{ row }">
            <span class="updated-at">{{ formatRelativeTime(row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <div class="row-actions" @click.stop>
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="table-empty">
            <span class="table-empty__icon">
              <el-icon :size="28"><Tickets /></el-icon>
            </span>
            <h3>{{ hasActiveFilters ? '没有匹配的任务' : '还没有任务' }}</h3>
            <p>
              {{
                hasActiveFilters
                  ? '试试更换关键词或清除筛选条件，查看全部任务。'
                  : '先载入一组示例数据体验完整流程，或直接创建你的第一条任务。'
              }}
            </p>
            <div class="table-empty__actions">
              <el-button v-if="hasActiveFilters" @click="handleReset">清除筛选</el-button>
              <el-button v-else type="primary" :loading="seeding" @click="handleSeed">
                <el-icon><MagicStick /></el-icon>
                载入示例数据
              </el-button>
            </div>
          </div>
        </template>
      </el-table>

      <div class="table-footer">
        <span class="pagination-hint">第 {{ query.page }} 页 · 共 {{ total }} 条</span>
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :page-sizes="PAGE_SIZES"
          :total="total"
          background
          layout="sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <TaskFormDialog ref="formDialog" @saved="handleSaved" />

    <TaskDetailDrawer
      v-model="detailVisible"
      :task="activeTask"
      @edit="openEdit"
      @delete="confirmDelete"
      @toggle-done="handleToggleDone"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import type { TableInstance } from 'element-plus'
import {
  CircleCheck,
  Delete,
  MagicStick,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  Tickets,
  Timer,
  Warning
} from '@element-plus/icons-vue'
import type { Task, TaskSortBy, TaskStatus } from '@shared/types/electron'
import { isTaskStatus, TASK_PAGE_SIZES } from '@shared/tasks/model'
import PageHeader from '@/components/layout/PageHeader.vue'
import StatRail from '@/components/layout/StatRail.vue'
import TaskFormDialog from '@/components/tasks/TaskFormDialog.vue'
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer.vue'
import TaskStatusTag from '@/components/tasks/TaskStatusTag.vue'
import TaskPriorityBadge from '@/components/tasks/TaskPriorityBadge.vue'
import { useTasks } from '@/composables/useTasks'
import {
  dueState,
  formatDueLabel,
  TASK_CATEGORY_SUGGESTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS
} from '@/utils/task'
import { formatRelativeTime } from '@/utils/time'
import type { StatRailItem } from '@/utils/ui'

const route = useRoute()
const router = useRouter()

const {
  query,
  tasks,
  total,
  stats,
  loading,
  statsLoading,
  refresh,
  applyQuery,
  scheduleSearch,
  setPage,
  setPageSize,
  removeTask,
  removeTasks,
  changeStatus,
  seedDemoData,
  fetchTask,
  resetFilters
} = useTasks()

const PAGE_SIZES = [...TASK_PAGE_SIZES]

const SORT_OPTIONS = [
  { value: 'updatedAt:desc', label: '最近更新' },
  { value: 'createdAt:asc', label: '最先创建' },
  { value: 'dueDate:asc', label: '截止日期最近' },
  { value: 'priority:asc', label: '优先级从高到低' }
] as const

const sortValue = computed({
  get: () => `${query.sortBy}:${query.sortOrder}`,
  set: (value: string) => {
    const option = SORT_OPTIONS.find((item) => item.value === value)
    if (!option) return
    const [sortBy, sortOrder] = option.value.split(':')
    if (
      sortBy === 'updatedAt' ||
      sortBy === 'createdAt' ||
      sortBy === 'dueDate' ||
      sortBy === 'priority'
    ) {
      query.sortBy = sortBy as TaskSortBy
    }
    query.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
    void applyQuery()
  }
})

const statCards = computed<StatRailItem[]>(() => [
  {
    label: '全部任务',
    value: stats.value.total,
    hint: '本地 SQLite 持久化',
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
    hint: `完成率 ${stats.value.completionRate}%`,
    tone: 'success',
    icon: CircleCheck
  },
  {
    label: '已逾期',
    value: stats.value.overdue,
    hint: stats.value.overdue > 0 ? '建议优先处理' : '暂无逾期任务',
    tone: 'danger',
    icon: Warning
  }
])

const categoryOptions = computed(() => {
  const values = new Set<string>(TASK_CATEGORY_SUGGESTIONS)
  for (const task of tasks.value) values.add(task.category)
  return [...values].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const hasActiveFilters = computed(
  () =>
    query.keyword.trim() !== '' ||
    query.status !== 'all' ||
    query.priority !== 'all' ||
    query.category !== 'all'
)

const tableRef = ref<TableInstance>()
const selectedIds = ref<number[]>([])
const detailVisible = ref(false)
const activeId = ref<number | null>(null)
const focusedTask = ref<Task | null>(null)
const seeding = ref(false)
const formDialog = ref<InstanceType<typeof TaskFormDialog>>()

// 深链/筛选场景下任务可能不在当前页：优先用列表数据，列表没有时回落到单独拉取的快照
const activeTask = computed(
  () =>
    tasks.value.find((task) => task.id === activeId.value) ??
    (focusedTask.value?.id === activeId.value ? focusedTask.value : null)
)

function handleFilterChange(): void {
  void applyQuery()
}

function handleReset(): void {
  resetFilters()
  tableRef.value?.clearSelection()
}

function handleRefresh(): void {
  void refresh()
}

function handlePageChange(page: number): void {
  void setPage(page)
}

function handlePageSizeChange(pageSize: number): void {
  void setPageSize(pageSize)
}

function handleSelectionChange(rows: Task[]): void {
  selectedIds.value = rows.map((row) => row.id)
}

function handleRowClick(row: Task, column?: { type?: string }): void {
  // 点击选择列不打开详情；程序化触发时 column 可能为 undefined
  if (column?.type === 'selection') return
  activeId.value = row.id
  focusedTask.value = row
  detailVisible.value = true
}

function handleStatusCommand(task: Task, command: string): void {
  if (!isTaskStatus(command)) return
  void changeStatus(task, command)
}

async function handleToggleDone(task: Task): Promise<void> {
  const next: TaskStatus = task.status === 'done' ? 'in_progress' : 'done'
  await changeStatus(task, next)
  // 抽屉可能展示的是不在当前页的任务：刷新后单独拉一次，避免状态显示滞后
  if (activeId.value === task.id) {
    focusedTask.value = tasks.value.find((item) => item.id === task.id) ?? (await fetchTask(task.id))
  }
}

function openCreate(): void {
  detailVisible.value = false
  formDialog.value?.open()
}

function openEdit(task: Task): void {
  detailVisible.value = false
  formDialog.value?.open(task)
}

async function handleSaved(): Promise<void> {
  await refresh()
  if (activeId.value !== null && !tasks.value.some((task) => task.id === activeId.value)) {
    focusedTask.value = await fetchTask(activeId.value)
  }
}

async function handleSeed(): Promise<void> {
  if (seeding.value) return
  seeding.value = true
  try {
    await seedDemoData()
  } finally {
    seeding.value = false
  }
}

async function confirmDelete(task: Task): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除任务「${task.title}」吗？此操作不可撤销。`,
      '删除任务',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  const removed = await removeTask(task)
  if (removed && activeId.value === task.id) {
    detailVisible.value = false
    activeId.value = null
    focusedTask.value = null
  }
}

async function handleBatchDelete(): Promise<void> {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.value.length} 条任务吗？此操作不可撤销。`,
      '批量删除',
      {
        confirmButtonText: '全部删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }

  const removed = await removeTasks([...selectedIds.value])
  if (removed) {
    selectedIds.value = []
    tableRef.value?.clearSelection()
  }
}

/** 消费路由 query：?create=1 打开新建，?focus=id 打开详情（概览页跳转入口） */
async function handleActionQuery(): Promise<void> {
  if (route.query.create === '1') {
    openCreate()
    await router.replace({ path: '/tasks' })
    return
  }

  const focus = route.query.focus
  if (typeof focus === 'string') {
    const id = Number(focus)
    if (Number.isSafeInteger(id) && id > 0) {
      const task = await fetchTask(id)
      if (task) {
        activeId.value = task.id
        focusedTask.value = task
        detailVisible.value = true
      }
    }
    await router.replace({ path: '/tasks' })
  }
}

watch(
  () => [route.query.create, route.query.focus],
  () => {
    if (route.name === 'Tasks') void handleActionQuery()
  }
)

onMounted(async () => {
  const status = route.query.status
  if (typeof status === 'string' && isTaskStatus(status)) {
    query.status = status
  }
  await refresh()
  await handleActionQuery()
})
</script>

<style scoped>
.tasks-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 16px;
}

.filter-search {
  flex: 1 1 230px;
  min-width: 200px;
}

.status-filter {
  flex: 0 0 auto;
}

.filter-select {
  width: 128px;
}

.filter-sort {
  width: 158px;
}

.table-panel {
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.table-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.table-summary strong {
  font-size: 16px;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}

.table-summary .el-tag {
  margin-left: 8px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-table :deep(.el-table__row) {
  cursor: pointer;
}

.task-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 2px 0;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-description {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-tags {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  flex-wrap: wrap;
}

.more-tags {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.status-trigger {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
}

.status-trigger:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.category-pill {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
}

.due-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.due-date.is-overdue {
  color: var(--el-color-danger);
  font-weight: 600;
}

.due-date.is-today,
.due-date.is-soon {
  color: var(--el-color-warning);
  font-weight: 600;
}

.due-date.is-done {
  color: var(--el-text-color-placeholder);
}

.updated-at {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 46px 20px 40px;
  text-align: center;
}

.table-empty__icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  border-radius: 18px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.table-empty h3 {
  margin: 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.table-empty p {
  margin: 0;
  max-width: 420px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.table-empty__actions {
  margin-top: 8px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pagination-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 900px) {
  .filter-search {
    flex-basis: 100%;
  }

  .filter-select,
  .filter-sort {
    flex: 1;
  }
}
</style>