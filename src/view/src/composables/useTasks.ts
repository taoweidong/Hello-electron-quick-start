import { onScopeDispose, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Task, TaskInput, TaskQuery, TaskStats, TaskStatus } from '@shared/types/electron'

function createDefaultQuery(): TaskQuery {
  return {
    keyword: '',
    status: 'all',
    priority: 'all',
    category: 'all',
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10
  }
}

function createEmptyStats(): TaskStats {
  return { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 }
}

/**
 * 任务列表状态与 CRUD 动作（页面只负责展示与确认框）。
 * 请求带序号：快速切换筛选时，晚返回的旧响应不会覆盖新结果。
 */
export function useTasks() {
  const query = reactive<TaskQuery>(createDefaultQuery())
  const tasks = ref<Task[]>([])
  const total = ref(0)
  const stats = ref<TaskStats>(createEmptyStats())
  const loading = ref(false)
  const statsLoading = ref(false)

  let requestId = 0
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function loadTasks(): Promise<void> {
    const current = ++requestId
    loading.value = true
    try {
      const result = await window.electronAPI.listTasks({ ...query })
      if (current !== requestId) return
      if (result.ok) {
        tasks.value = result.data.items
        total.value = result.data.total
      } else {
        ElMessage.error(`加载任务失败: ${result.error.message}`)
      }
    } catch (error) {
      if (current === requestId) {
        ElMessage.error(`加载任务失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  async function loadStats(): Promise<void> {
    statsLoading.value = true
    try {
      const result = await window.electronAPI.getTaskStats()
      if (result.ok) stats.value = result.data
    } catch {
      // 统计只是辅助信息，失败不打断列表主流程
    } finally {
      statsLoading.value = false
    }
  }

  async function refresh(): Promise<void> {
    await Promise.all([loadTasks(), loadStats()])
  }

  async function applyQuery(resetPage = true): Promise<void> {
    if (resetPage) query.page = 1
    await loadTasks()
  }

  /** 搜索框防抖：输入停止 260ms 后回到第一页查询 */
  function scheduleSearch(): void {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      query.page = 1
      void loadTasks()
    }, 260)
  }

  async function setPage(page: number): Promise<void> {
    query.page = page
    await loadTasks()
  }

  async function setPageSize(pageSize: number): Promise<void> {
    query.pageSize = pageSize
    query.page = 1
    await loadTasks()
  }

  function clampPageAfterDelete(deleted: number): void {
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total.value - deleted) / query.pageSize))
    if (query.page > lastPage) query.page = lastPage
  }

  async function removeTask(task: Task): Promise<boolean> {
    try {
      const result = await window.electronAPI.deleteTask(task.id)
      if (!result.ok) {
        ElMessage.error(result.error.message || '删除失败')
        return false
      }
      ElMessage.success('任务已删除')
      clampPageAfterDelete(result.data.deleted)
      await refresh()
      return true
    } catch (error) {
      ElMessage.error(`删除失败: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async function removeTasks(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return false
    try {
      const result = await window.electronAPI.deleteTasks(ids)
      if (!result.ok) {
        ElMessage.error(result.error.message || '批量删除失败')
        return false
      }
      ElMessage.success(`已删除 ${result.data.deleted} 条任务`)
      clampPageAfterDelete(result.data.deleted)
      await refresh()
      return true
    } catch (error) {
      ElMessage.error(`批量删除失败: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async function changeStatus(task: Task, status: TaskStatus): Promise<void> {
    if (task.status === status) return
    const input: TaskInput = {
      title: task.title,
      description: task.description,
      status,
      priority: task.priority,
      category: task.category,
      tags: [...task.tags],
      dueDate: task.dueDate
    }

    try {
      const result = await window.electronAPI.updateTask(task.id, input)
      if (!result.ok) {
        ElMessage.error(result.error.message || '状态更新失败')
        return
      }
      ElMessage.success(`已标记为${status === 'done' ? '已完成' : status === 'in_progress' ? '进行中' : '待开始'}`)
      await refresh()
    } catch (error) {
      ElMessage.error(`状态更新失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function seedDemoData(): Promise<number> {
    try {
      const result = await window.electronAPI.seedDemoTasks()
      if (!result.ok) {
        ElMessage.error(result.error.message || '载入示例数据失败')
        return 0
      }
      if (result.data.inserted === 0) {
        ElMessage.info('示例数据已存在，无需重复载入')
      } else {
        ElMessage.success(`已载入 ${result.data.inserted} 条示例任务`)
      }
      await refresh()
      return result.data.inserted
    } catch (error) {
      ElMessage.error(`载入示例数据失败: ${error instanceof Error ? error.message : String(error)}`)
      return 0
    }
  }

  async function fetchTask(id: number): Promise<Task | null> {
    try {
      const result = await window.electronAPI.getTask(id)
      if (result.ok) return result.data
      ElMessage.warning(result.error.message || '任务不存在')
      return null
    } catch (error) {
      ElMessage.warning(`读取任务失败: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  function resetFilters(): void {
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    Object.assign(query, createDefaultQuery())
    void loadTasks()
  }

  onScopeDispose(() => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = null
  })

  return {
    query,
    tasks,
    total,
    stats,
    loading,
    statsLoading,
    loadTasks,
    loadStats,
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
  }
}